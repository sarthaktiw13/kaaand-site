'use strict';

// ── STATE ─────────────────────────────────────────────────
const state = { articles:[], brands:[], tracks:[], currentFilter:'all' };

// ── API ───────────────────────────────────────────────────
const api = {
  base:'/api',
  async get(path) {
    const r = await fetch(this.base + path);
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  },
  async post(path, data) {
    const r = await fetch(this.base + path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    return r.json();
  }
};

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initCursor();
  initNav();
  initLoader();
  await loadAll();
  initCover();
  initScrollReveal();
  initMobileNav();
  initKeyboard();
  initThreeCover();
  initThreeVinyl();
});

// ── LOADER ────────────────────────────────────────────────
function initLoader() {
  setTimeout(() => {
    document.getElementById('loader').classList.add('out');
    setTimeout(() => { const l=document.getElementById('loader'); if(l)l.remove(); }, 700);
  }, 1900);
}

// ── LOAD DATA ─────────────────────────────────────────────
async function loadAll() {
  try {
    const [arts, brnds, trks, stats] = await Promise.all([
      api.get('/articles'), api.get('/brands'), api.get('/tracks'), api.get('/stats')
    ]);
    state.articles = arts.articles;
    state.brands   = brnds.brands;
    state.tracks   = trks.tracks;
    renderArticles();
    renderBrands();
    renderTracks();
    updateStats(stats);
  } catch(e) {
    console.error('Load error:', e);
    toast('Failed to load content.');
  }
}

// ── CURSOR ────────────────────────────────────────────────
function initCursor() {
  const cur = document.getElementById('cursor');
  if (!cur || window.matchMedia('(pointer:coarse)').matches) return;
  let mx=-100, my=-100, cx=-100, cy=-100;
  document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; });
  const loop = () => {
    cx += (mx-cx)*0.11; cy += (my-cy)*0.11;
    cur.style.left = cx+'px'; cur.style.top = cy+'px';
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('mouseover', e => {
    cur.classList.toggle('big', !!e.target.closest('a,button,.article-card,.brand-card,.track-row'));
  });
}

// ── NAV ───────────────────────────────────────────────────
function initNav() {
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => { nav.classList.toggle('solid', window.scrollY > 60); }, {passive:true});
  const btn = document.querySelector('.nav-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (btn && drawer) {
    btn.addEventListener('click', () => {
      const open = drawer.classList.toggle('open');
      const spans = btn.querySelectorAll('span');
      if (open) {
        spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
      } else {
        spans.forEach(s => { s.style.transform=''; s.style.opacity=''; });
      }
    });
    document.addEventListener('click', e => {
      if (!drawer.contains(e.target) && !btn.contains(e.target)) {
        drawer.classList.remove('open');
        btn.querySelectorAll('span').forEach(s => { s.style.transform=''; s.style.opacity=''; });
      }
    });
  }
}
window.goTo = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({top, behavior:'smooth'});
};

// ── COVER ─────────────────────────────────────────────────
function initCover() {
  setTimeout(() => document.getElementById('cover').classList.add('loaded'), 100);
}

// ── STATS ─────────────────────────────────────────────────
function updateStats(stats) {
  const map = {'stat-articles':stats.articles,'stat-brands':stats.brands,'stat-tracks':stats.tracks,'stat-issue':'00'};
  Object.entries(map).forEach(([id,val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof val === 'number') {
      let c=0; const step=Math.ceil(val/20);
      const iv = setInterval(() => { c=Math.min(c+step,val); el.textContent=c; if(c>=val)clearInterval(iv); }, 55);
    } else { el.textContent = val; }
  });
  // subscriber count in newsletter
  if (stats.subscribers !== undefined) {
    const el = document.getElementById('nl-count');
    if (el) el.textContent = stats.subscribers || '0';
  }
}

// ── ARTICLES ─────────────────────────────────────────────
function renderArticles(filter='all') {
  const grid = document.getElementById('article-grid');
  if (!grid) return;
  let arts = state.articles;
  if (filter !== 'all') arts = arts.filter(a => a.category.toLowerCase() === filter.toLowerCase());
  const el = document.getElementById('art-count');
  if (el) el.textContent = arts.length + ' article' + (arts.length!==1?'s':'');
  if (!arts.length) { grid.innerHTML='<div class="no-results">Nothing in this category yet.</div>'; return; }
  grid.innerHTML = arts.map((a,i) => {
    const feat = a.featured && filter==='all' && i===0;
    return `<div class="article-card reveal ${feat?'featured':''}" onclick="openArticle('${a.slug}')">
      <div class="card-photo"><img src="${a.image}" alt="${a.title}" loading="${i<3?'eager':'lazy'}"><div class="card-photo-overlay"></div></div>
      <div class="card-body">
        <div class="card-cat">${a.category}</div>
        <div class="card-title">${a.title}</div>
        <div class="card-rule"></div>
        <div class="card-excerpt">${a.lead}</div>
        <div class="card-meta"><span>${a.author}</span><span>${a.readTime}</span></div>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
}

window.filterArticles = function(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.currentFilter = cat;
  renderArticles(cat);
};

// ── READER ───────────────────────────────────────────────
window.openArticle = async function(slug) {
  const reader = document.getElementById('reader');
  const wrap   = document.getElementById('article-list-wrap');
  if (!reader) return;
  reader.classList.add('visible');
  document.getElementById('reader-content').innerHTML = '<div style="padding:48px"><div class="skeleton" style="height:14px;width:60%;margin-bottom:14px;"></div><div class="skeleton" style="height:14px;width:80%;margin-bottom:14px;"></div><div class="skeleton" style="height:14px;width:50%;"></div></div>';
  reader.scrollIntoView({behavior:'smooth', block:'start'});
  try {
    const a = await api.get('/articles/'+slug);
    const hero = document.getElementById('reader-hero');
    hero.style.backgroundImage = `url(${a.image})`;
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
    document.getElementById('r-kicker').textContent  = a.category;
    document.getElementById('r-title').textContent   = a.title;
    document.getElementById('r-byline').innerHTML    = [a.author,a.date,a.readTime].map(b=>`<span>${b}</span>`).join('');
    document.getElementById('r-tags').innerHTML      = a.tags.map(t=>`<span class="sidebar-tag">${t}</span>`).join('');
    let html = `<div class="reader-lead">${a.lead}</div>`;
    a.body.forEach((b,i) => {
      if (b.type==='p')          html += `<p${i===0?' class="drop"':''}>${b.text}</p>`;
      else if (b.type==='h3')    html += `<h3>${b.text}</h3>`;
      else if (b.type==='pullquote') html += `<div class="reader-pullquote">${b.text}</div>`;
    });
    html += `<div class="reader-tags">${a.tags.map(t=>`<span class="reader-tag">${t}</span>`).join('')}</div>`;
    document.getElementById('reader-content').innerHTML = html;
    const rel = state.articles.filter(x=>x.slug!==slug).slice(0,3);
    document.getElementById('reader-related').innerHTML = rel.map(x=>`
      <div class="article-card" onclick="openArticle('${x.slug}')">
        <div class="card-photo" style="aspect-ratio:4/3"><img src="${x.image}" alt="${x.title}" loading="lazy"><div class="card-photo-overlay"></div></div>
        <div class="card-body"><div class="card-cat">${x.category}</div><div class="card-title" style="font-size:20px">${x.title}</div><div class="card-meta" style="margin-top:10px"><span>${x.author}</span></div></div>
      </div>`).join('');
    reader.scrollIntoView({behavior:'smooth', block:'start'});
  } catch(e) {
    document.getElementById('reader-content').innerHTML = '<p style="padding:48px;color:var(--dim)">Failed to load article.</p>';
    toast('Could not load article.');
  }
};

window.closeReader = function() {
  document.getElementById('reader').classList.remove('visible');
  document.getElementById('editorial').scrollIntoView({behavior:'smooth', block:'start'});
};

// ── BRANDS ───────────────────────────────────────────────
function renderBrands() {
  const grid = document.getElementById('brands-grid');
  if (!grid || !state.brands.length) return;
  grid.innerHTML = state.brands.map((b,i) => `
    <div class="brand-card reveal reveal-delay-${(i%3)+1}" onclick="openBrand('${b.id}')">
      <div class="brand-logo">${b.abbr}</div>
      <div class="brand-city">${b.city}</div>
      <div class="brand-name">${b.name}</div>
      <div class="brand-desc">${b.desc}</div>
    </div>`).join('');
  grid.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
}

window.openBrand = async function(id) {
  document.getElementById('brand-overlay').classList.add('open');
  try {
    const b = await api.get('/brands/'+id);
    document.getElementById('bpanel-tag').textContent = 'Exhibit B — '+b.city;
    document.getElementById('brand-detail').innerHTML = `
      <div class="bp-city">${b.city}</div><div class="bp-name">${b.name}</div>
      <div class="bp-desc">${b.desc}</div><div class="bp-story">${b.story}</div>
      <div class="bp-meta">${[{l:'Founded',v:b.founded},{l:'Category',v:b.category},{l:'Price Range',v:b.price},{l:'Stockists',v:b.stockists}]
        .map(m=>`<div class="bp-cell"><div class="bp-label">${m.l}</div><div class="bp-val">${m.v}</div></div>`).join('')}</div>`;
  } catch(e) { document.getElementById('brand-detail').innerHTML='<p style="color:var(--dim)">Could not load.</p>'; }
};
window.closeBrand = function() { document.getElementById('brand-overlay').classList.remove('open'); };

// ── TRACKS ───────────────────────────────────────────────
function renderTracks() {
  const list = document.getElementById('track-list');
  if (!list || !state.tracks.length) return;
  list.innerHTML = state.tracks.map((t,i) => `
    <div class="track-row ${i===0?'playing':''}" id="tr${t.id}" onclick="playTrack(${t.id},'${t.spotify}')">
      <div class="tr-num">${String(t.id).padStart(2,'0')}</div>
      <div class="tr-info"><div class="tr-name">${t.title}</div><div class="tr-artist">${t.artist}</div><div class="tr-bar"></div></div>
      <div class="tr-genre">${t.genre}</div>
    </div>`).join('') +
    `<div class="music-player"><iframe id="spotify-player" src="${state.tracks[0].spotify}" height="80" allowfullscreen allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" loading="lazy" frameborder="0"></iframe></div>`;
}
window.playTrack = function(id, url) {
  document.querySelectorAll('.track-row').forEach(r=>r.classList.remove('playing'));
  const row = document.getElementById('tr'+id);
  if (row) row.classList.add('playing');
  const p = document.getElementById('spotify-player');
  if (p) p.src = url;
};

// ── NEWSLETTER ───────────────────────────────────────────
window.submitNL = async function() {
  const input = document.getElementById('nl-email');
  const btn   = document.getElementById('nl-btn');
  const msg   = document.getElementById('nl-msg');
  const email = (input.value||'').trim();
  if (!email) { msg.textContent='Enter your email.'; msg.className='nl-msg err'; return; }
  btn.disabled=true; btn.querySelector('.nl-btn-text').textContent='Adding...';
  msg.textContent=''; msg.className='nl-msg';
  try {
    const res = await api.post('/newsletter', {email});
    if (res.success) {
      input.value='';
      msg.textContent='✓ You\'re on the list.';
      msg.className='nl-msg ok';
      toast('Welcome to KAAAND.');
      // bump count
      const cEl = document.getElementById('nl-count');
      if (cEl && cEl.textContent !== '—') cEl.textContent = parseInt(cEl.textContent||0)+1;
    } else {
      msg.textContent='✗ '+(res.error||'Try again.');
      msg.className='nl-msg err';
    }
  } catch(e) { msg.textContent='✗ Network error.'; msg.className='nl-msg err'; }
  btn.disabled=false; btn.querySelector('.nl-btn-text').textContent='Subscribe to KAAAND';
};

// Enter key on newsletter input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('nl-email');
  if (inp) inp.addEventListener('keydown', e => { if(e.key==='Enter') window.submitNL(); });
});

// ── SUBMIT FORM ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('submit-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const msg = document.getElementById('form-msg');
    btn.disabled=true; btn.textContent='Sending...';
    msg.className='form-msg'; msg.textContent='';
    try {
      const res = await api.post('/submit', {
        name:form.name.value.trim(), email:form.email.value.trim(),
        type:form.type.value, message:form.message.value.trim()
      });
      if (res.success) { msg.textContent='✓ '+res.message; msg.className='form-msg success'; form.reset(); toast('Submission received.'); }
      else { msg.textContent='✗ '+(res.error||'Something went wrong.'); msg.className='form-msg error'; btn.disabled=false; btn.textContent='Send It →'; }
    } catch(e) { msg.textContent='✗ Network error.'; msg.className='form-msg error'; btn.disabled=false; btn.textContent='Send It →'; }
  });
});

// ── SCROLL REVEAL ─────────────────────────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){e.target.classList.add('visible');revealObs.unobserve(e.target);} });
}, {threshold:0.1, rootMargin:'0px 0px -40px 0px'});
function initScrollReveal() {
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
}

// ── MOBILE NAV ACTIVE STATE ───────────────────────────────
function initMobileNav() {
  const sections = ['cover','editorial','brands-section','music-section','newsletter-section','submit-section'];
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > 0.4) {
        const raw = e.target.id.replace('-section','');
        document.querySelectorAll('.mn-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.section===raw || b.dataset.section===e.target.id);
        });
      }
    });
  }, {threshold:0.4});
  sections.forEach(id => { const el=document.getElementById(id); if(el)obs.observe(el); });
}

// ── KEYBOARD ─────────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeBrand(); closeReader(); }
  });
}

// ── TOAST ─────────────────────────────────────────────────
function toast(msg, duration=3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), duration);
}

// ══════════════════════════════════════════════════════════
//  THREE.JS — COVER PARTICLE FIELD
// ══════════════════════════════════════════════════════════
function initThreeCover() {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('cover-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.z = 5;

  // Particle geometry — 3 layers at different depths
  const COUNT = window.matchMedia('(max-width:700px)').matches ? 800 : 1800;
  const positions = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);
  const colors    = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    // Spread in a wide 3D space
    positions[i*3]   = (Math.random()-0.5)*18;
    positions[i*3+1] = (Math.random()-0.5)*12;
    positions[i*3+2] = (Math.random()-0.5)*10 - 2;
    sizes[i] = Math.random() * 2.5 + 0.5;

    // Mostly dim white, occasional red accent
    if (Math.random() < 0.06) {
      colors[i*3]   = 0.55; // red particles
      colors[i*3+1] = 0.18;
      colors[i*3+2] = 0.12;
    } else {
      const b = Math.random() * 0.18 + 0.04;
      colors[i*3]=b; colors[i*3+1]=b*0.9; colors[i*3+2]=b*0.8;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size:0.04, vertexColors:true, transparent:true,
    opacity:0.7, sizeAttenuation:true, blending:THREE.AdditiveBlending,
    depthWrite:false,
  });

  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Mouse parallax
  let mx=0, my=0, tmx=0, tmy=0;
  document.addEventListener('mousemove', e => {
    mx = (e.clientX/window.innerWidth  - 0.5) * 0.6;
    my = (e.clientY/window.innerHeight - 0.5) * 0.4;
  });

  const resize = () => {
    const cover = document.getElementById('cover');
    if (!cover) return;
    const w = cover.clientWidth, h = cover.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let frame = 0;
  const animate = () => {
    if (!document.getElementById('cover-canvas')) return;
    requestAnimationFrame(animate);
    frame++;
    tmx += (mx-tmx)*0.04;
    tmy += (my-tmy)*0.04;
    particles.rotation.y = frame*0.0003 + tmx*0.3;
    particles.rotation.x = frame*0.0001 - tmy*0.2;

    // Subtle drift — shift each particle's y position
    const pos = geo.attributes.position.array;
    for (let i=0; i<COUNT; i++) {
      pos[i*3+1] += Math.sin(frame*0.008 + i*0.5)*0.0005;
    }
    geo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  };
  animate();
}

// ══════════════════════════════════════════════════════════
//  THREE.JS — NEWSLETTER 3D VINYL RECORD
// ══════════════════════════════════════════════════════════
function initThreeVinyl() {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('vinyl-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.5, 6);
  camera.lookAt(0, 0, 0);

  // ── LIGHTING ──
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xe8ddd0, 1.8);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8b2e1e, 0.6);
  fill.position.set(-4, 2, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x4a1a0e, 0.4);
  rim.position.set(0, -3, -3);
  scene.add(rim);

  // ── VINYL RECORD ──
  // Outer groove area — dark black disc
  const vinylGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.06, 128, 1, false);
  // Create dark iridescent vinyl material using canvas texture
  const vinylCanvas = document.createElement('canvas');
  vinylCanvas.width = 512; vinylCanvas.height = 512;
  const vCtx = vinylCanvas.getContext('2d');

  // Base black
  vCtx.fillStyle = '#050403';
  vCtx.fillRect(0,0,512,512);

  // Groove rings — concentric circles
  for (let r = 30; r < 256; r += 2.5) {
    const alpha = 0.04 + Math.random()*0.04;
    vCtx.beginPath();
    vCtx.arc(256,256,r,0,Math.PI*2);
    vCtx.strokeStyle = `rgba(232,221,208,${alpha.toFixed(3)})`;
    vCtx.lineWidth = 0.6;
    vCtx.stroke();
  }

  // Subtle iridescent sheen sweep
  const grad = vCtx.createConicalGradient ? null : null;
  for (let a=0; a<360; a+=2) {
    const rad = a*Math.PI/180;
    const hue = (a * 1.2 + 180) % 360;
    vCtx.beginPath();
    vCtx.moveTo(256,256);
    vCtx.arc(256,256,256,rad,rad+0.04);
    vCtx.lineTo(256,256);
    vCtx.fillStyle = `hsla(${hue},15%,${20+Math.sin(a*0.1)*8}%,0.04)`;
    vCtx.fill();
  }

  const vinylTex = new THREE.CanvasTexture(vinylCanvas);
  const vinylMat = new THREE.MeshStandardMaterial({
    map: vinylTex, metalness:0.7, roughness:0.25,
    envMapIntensity:1,
  });

  const vinylMesh = new THREE.Mesh(vinylGeo, vinylMat);
  vinylMesh.castShadow = true;
  scene.add(vinylMesh);

  // ── LABEL (centre circle) ──
  const labelGeo = new THREE.CylinderGeometry(0.78, 0.78, 0.065, 64, 1, false);
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256; labelCanvas.height = 256;
  const lCtx = labelCanvas.getContext('2d');

  // Red label background
  lCtx.fillStyle = '#8b2e1e';
  lCtx.fillRect(0,0,256,256);

  // Subtle radial texture
  for (let i=0; i<40; i++) {
    const r = Math.random()*128;
    const a = Math.random()*Math.PI*2;
    lCtx.beginPath();
    lCtx.arc(128+Math.cos(a)*r, 128+Math.sin(a)*r, Math.random()*12+3, 0, Math.PI*2);
    lCtx.fillStyle = `rgba(0,0,0,${(Math.random()*0.08).toFixed(3)})`;
    lCtx.fill();
  }

  // KAAAND text
  lCtx.fillStyle = '#e8ddd0';
  lCtx.font = 'bold 28px sans-serif';
  lCtx.letterSpacing = '6px';
  lCtx.textAlign = 'center';
  lCtx.textBaseline = 'middle';
  lCtx.fillText('KAAAND', 128, 110);

  lCtx.font = '13px sans-serif';
  lCtx.letterSpacing = '3px';
  lCtx.fillStyle = 'rgba(232,221,208,0.6)';
  lCtx.fillText('ISSUE 00', 128, 140);
  lCtx.fillText('2026', 128, 160);

  // Center hole ring
  lCtx.beginPath();
  lCtx.arc(128,128,8,0,Math.PI*2);
  lCtx.fillStyle = '#050403';
  lCtx.fill();
  lCtx.beginPath();
  lCtx.arc(128,128,10,0,Math.PI*2);
  lCtx.strokeStyle = 'rgba(232,221,208,0.2)';
  lCtx.lineWidth=1.5; lCtx.stroke();

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.MeshStandardMaterial({ map:labelTex, metalness:0.1, roughness:0.6 });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.y = 0.002;
  scene.add(labelMesh);

  // ── CENTER HOLE ──
  const holeMat = new THREE.MeshBasicMaterial({ color:0x050403 });
  const holeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 16), holeMat);
  scene.add(holeMesh);

  // ── FLOATING PARTICLES around the vinyl ──
  const PCNT = 300;
  const pPos = new Float32Array(PCNT*3);
  const pCol = new Float32Array(PCNT*3);
  for (let i=0; i<PCNT; i++) {
    const angle = Math.random()*Math.PI*2;
    const dist  = 2.5 + Math.random()*3.5;
    pPos[i*3]   = Math.cos(angle)*dist;
    pPos[i*3+1] = (Math.random()-0.5)*3;
    pPos[i*3+2] = Math.sin(angle)*dist * 0.4;
    const red = Math.random() < 0.2;
    const b = Math.random()*0.15+0.04;
    pCol[i*3]   = red ? 0.55 : b;
    pCol[i*3+1] = red ? 0.18 : b*0.9;
    pCol[i*3+2] = red ? 0.12 : b*0.8;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol,3));
  const pMat = new THREE.PointsMaterial({ size:0.06, vertexColors:true, transparent:true, opacity:0.6, sizeAttenuation:true, blending:THREE.AdditiveBlending, depthWrite:false });
  const pPoints = new THREE.Points(pGeo, pMat);
  scene.add(pPoints);

  // ── MOUSE HOVER TILT ──
  let targetTiltX=0, targetTiltY=0.3, currentTiltX=0, currentTiltY=0;
  let isHovering = false;
  const section = document.getElementById('newsletter-section');
  if (section) {
    section.addEventListener('mousemove', e => {
      const rect = section.getBoundingClientRect();
      const nx = (e.clientX-rect.left)/rect.width  - 0.5;
      const ny = (e.clientY-rect.top) /rect.height - 0.5;
      targetTiltX = ny * 0.5;
      targetTiltY = nx * 0.8 + 0.3;
      isHovering = true;
    });
    section.addEventListener('mouseleave', () => { isHovering=false; targetTiltX=0; targetTiltY=0.3; });
  }

  // ── RESIZE ──
  const resize = () => {
    const sec = document.getElementById('newsletter-section');
    if (!sec) return;
    const w=sec.clientWidth, h=Math.max(sec.clientHeight, 600);
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ── ANIMATE ──
  let frame=0;
  const animate = () => {
    if (!document.getElementById('vinyl-canvas')) return;
    requestAnimationFrame(animate);
    frame++;

    // Spinning record
    vinylMesh.rotation.y = frame * 0.012;
    labelMesh.rotation.y = frame * 0.012;
    holeMesh.rotation.y  = frame * 0.012;

    // Tilt
    currentTiltX += (targetTiltX-currentTiltX)*0.05;
    currentTiltY += (targetTiltY-currentTiltY)*0.05;
    vinylMesh.rotation.x = currentTiltX - 0.3;
    labelMesh.rotation.x = currentTiltX - 0.3;
    holeMesh.rotation.x  = currentTiltX - 0.3;
    vinylMesh.rotation.z = currentTiltY * 0.1;

    // Gentle float
    const floatY = Math.sin(frame*0.018)*0.12;
    vinylMesh.position.y = floatY;
    labelMesh.position.y = floatY + 0.002;
    holeMesh.position.y  = floatY;

    // Particles orbit slowly
    pPoints.rotation.y = frame * 0.004;
    pPoints.position.y = floatY * 0.3;

    renderer.render(scene, camera);
  };
  animate();
}
