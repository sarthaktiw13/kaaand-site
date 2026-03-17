/**
 * KAAAND Magazine — Pure Node.js Server
 * Zero dependencies. http · fs · path · url · crypto
 */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),url=require('url'),crypto=require('crypto');
const PORT=process.env.PORT||3000,ROOT=__dirname,DATA=path.join(ROOT,'data'),PUB=path.join(ROOT,'public');
// Ensure data dir exists (Railway ephemeral filesystem)
if(!fs.existsSync(DATA))fs.mkdirSync(DATA,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};

// Rate limiter
const rl=new Map();
function limit(key,windowMs,max){const n=Date.now(),e=rl.get(key)||{c:0,r:n+windowMs};if(n>e.r){e.c=0;e.r=n+windowMs;}e.c++;rl.set(key,e);return e.c<=max;}
setInterval(()=>{const n=Date.now();for(const[k,v]of rl.entries())if(n>v.r)rl.delete(k);},300000);

// Helpers
const rdj=(f)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}};
const wrj=(f,d)=>{const dir=path.dirname(f);if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(f,JSON.stringify(d,null,2));};
const jsn=(res,d,s=200)=>{const b=JSON.stringify(d);res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(b),'Cache-Control':'no-store'});res.end(b);};
const err=(res,m,s=400)=>jsn(res,{error:m},s);
const san=(s,n=500)=>String(s||'').trim().slice(0,n).replace(/[<>]/g,'');
const validEmail=(e)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());
function parseBody(req){return new Promise((ok,fail)=>{let b='';req.on('data',c=>{b+=c.toString();if(b.length>10000){req.destroy();fail(new Error('too large'));}});req.on('end',()=>{try{const ct=req.headers['content-type']||'';if(ct.includes('json'))ok(JSON.parse(b));else if(ct.includes('urlencoded')){const p=new URLSearchParams(b),o={};for(const[k,v]of p)o[k]=v;ok(o);}else ok({});}catch{fail(new Error('bad body'));}});req.on('error',fail);});}

// Cookie Parser Helper
const parseCookies = (req) => {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
};

// Static server with etag
function serve(res,fp,reqEtag){
  fs.stat(fp,(e,s)=>{
    if(e||!s.isFile())return;
    const ext=path.extname(fp).toLowerCase();
    const mime=MIME[ext]||'application/octet-stream';
    const etag='"'+crypto.createHash('md5').update(s.mtime.toISOString()+s.size).digest('hex').slice(0,12)+'"';
    const age=ext==='.html'?0:86400;
    if(reqEtag===etag){res.writeHead(304,{ETag:etag});return res.end();}
    res.writeHead(200,{'Content-Type':mime,'Content-Length':s.size,'ETag':etag,'Cache-Control':age?`public,max-age=${age}`:'no-cache','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(fp).on('error',()=>res.end()).pipe(res);
  });
}

// Router
const routes=[];
const route=(m,p,h)=>routes.push({m,p:new RegExp('^'+p+'$'),h});

// GET /api/articles
route('GET','/api/articles',(req,res,_,q)=>{
  const c=rdj(path.join(DATA,'content.json'));if(!c)return err(res,'Unavailable',503);
  let a=c.articles.map(x=>({id:x.id,slug:x.slug,title:x.title,subtitle:x.subtitle,category:x.category,author:x.author,date:x.date,readTime:x.readTime,featured:x.featured,image:x.image,tags:x.tags,lead:x.lead}));
  if(q.category&&q.category!=='all')a=a.filter(x=>x.category.toLowerCase()===q.category.toLowerCase());
  if(q.limit)a=a.slice(0,parseInt(q.limit)||10);
  jsn(res,{articles:a,total:a.length});
});

// GET /api/articles/:slug
route('GET','/api/articles/([\\w-]+)',(req,res,p)=>{
  const c=rdj(path.join(DATA,'content.json'));if(!c)return err(res,'Unavailable',503);
  const a=c.articles.find(x=>x.slug===p[0]);if(!a)return err(res,'Not found',404);
  jsn(res,a);
});

// GET /api/brands
route('GET','/api/brands',(req,res)=>{
  const c=rdj(path.join(DATA,'content.json'));if(!c)return err(res,'Unavailable',503);
  jsn(res,{brands:c.brands,total:c.brands.length});
});

// GET /api/brands/:id
route('GET','/api/brands/([\\w-]+)',(req,res,p)=>{
  const c=rdj(path.join(DATA,'content.json'));if(!c)return err(res,'Unavailable',503);
  const b=c.brands.find(x=>x.id===p[0]);if(!b)return err(res,'Not found',404);
  jsn(res,b);
});

// GET /api/tracks
route('GET','/api/tracks',(req,res)=>{
  const c=rdj(path.join(DATA,'content.json'));if(!c)return err(res,'Unavailable',503);
  jsn(res,{tracks:c.tracks,total:c.tracks.length});
});

// GET /api/stats
route('GET','/api/stats',(req,res)=>{
  const c=rdj(path.join(DATA,'content.json'))||{};
  const s=rdj(path.join(DATA,'submissions.json'))||[];
  const n=rdj(path.join(DATA,'newsletter.json'))||[];
  jsn(res,{articles:(c.articles||[]).length,brands:(c.brands||[]).length,tracks:(c.tracks||[]).length,submissions:s.length,subscribers:n.length,uptime:Math.floor(process.uptime())});
});

// POST /api/submit
route('POST','/api/submit',async(req,res,_,__,ip)=>{
  if(!limit(ip+':sub',3600000,5))return err(res,'Limit reached. Try in an hour.',429);
  let b;try{b=await parseBody(req);}catch{return err(res,'Bad request');}
  const name=san(b.name,100),email=san(b.email,200).toLowerCase(),type=san(b.type,100),message=san(b.message,2000);
  if(!name||!email||!type||!message)return err(res,'All fields required.');
  if(!validEmail(email))return err(res,'Invalid email.');
  const valid=['Fashion Editorial','Written Essay','Photography','Brand Profile','Music / Rave Culture','Illustration','Other'];
  if(!valid.includes(type))return err(res,'Invalid type.');
  const fp=path.join(DATA,'submissions.json'),list=rdj(fp)||[];
  list.push({id:crypto.randomUUID(),name,email,type,message,timestamp:new Date().toISOString(),ip});
  wrj(fp,list);
  console.log(`📬 ${name} <${email}> — ${type}`);
  jsn(res,{success:true,message:"Submission received. We'll be in touch."});
});

// POST /api/newsletter
route('POST','/api/newsletter',async(req,res,_,__,ip)=>{
  if(!limit(ip+':nl',3600000,10))return err(res,'Too many requests.',429);
  let b;try{b=await parseBody(req);}catch{return err(res,'Bad request');}
  
  const email=san(b.email,200).toLowerCase();
  if(!email||!validEmail(email))return err(res,'Valid email required.');
  
  // Cookie tracking
  const cookies = parseCookies(req);
  let userId = cookies['kaaand_user_id'];
  let cookieHeader = null;
  
  if (!userId) {
    userId = crypto.randomUUID();
    // Set a persistent cookie for 1 year
    cookieHeader = `kaaand_user_id=${userId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`;
  }
  
  const fp=path.join(DATA,'newsletter.json');
  const list=rdj(fp)||[];
  
  if(list.some(e=>e.email===email))return err(res,'Already subscribed.',409);
  
  list.push({
    id: crypto.randomUUID(),
    email,
    userId, // store the tracking cookie ID with the email
    ip,
    timestamp:new Date().toISOString()
  });
  
  wrj(fp,list);
  console.log(`📧 Newsletter Signup: ${email} (User ID: ${userId})`);
  
  const bData = JSON.stringify({success:true,message:"You're on the list."});
  const headers = {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(bData),
    'Cache-Control':'no-store'
  };
  
  if (cookieHeader) {
    headers['Set-Cookie'] = cookieHeader;
  }
  
  res.writeHead(200, headers);
  res.end(bData);
});

// Main handler
const server=http.createServer(async(req,res)=>{
  const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  const parsed=url.parse(req.url,true);
  const pathname=parsed.pathname.replace(/\/+$/,'')||'/';
  const method=req.method.toUpperCase();

  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Referrer-Policy','same-origin');

  if(pathname.startsWith('/api')){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(method==='OPTIONS'){res.writeHead(204);return res.end();}
    if(!limit(ip+':api',900000,200))return err(res,'Rate limit exceeded.',429);
  }

  for(const r of routes){
    if(r.m!==method)continue;
    const m=pathname.match(r.p);
    if(m){try{await r.h(req,res,m.slice(1),parsed.query,ip);}catch(e){console.error(e);err(res,'Server error.',500);}return;}
  }

  if(pathname.startsWith('/api'))return err(res,`No route: ${method} ${pathname}`,404);

  const safe=path.normalize(pathname).replace(/^(\.\.[/\\])+/,'');
  const full=path.join(PUB,safe);
  if(fs.existsSync(full)&&fs.statSync(full).isFile())return serve(res,full,req.headers['if-none-match']);
  const idx=path.join(PUB,'index.html');
  if(fs.existsSync(idx))return serve(res,idx,null);
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');
});

server.on('error',e=>{if(e.code==='EADDRINUSE'){console.error(`Port ${PORT} in use`);process.exit(1);}console.error(e);});
process.on('uncaughtException',e=>console.error('Uncaught:',e));
process.on('unhandledRejection',e=>console.error('Unhandled:',e));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n  KAAAND live on port ${PORT}\n  API: /api/articles\n`);
});
module.exports=server;

