/* ── KAAAND — Frontend App ── */
'use strict';

// ── STATE ─────────────────────────────────────────────────
const state = {
  articles: [],
  brands: [],
  tracks: [],
  currentArticle: null,
  currentFilter: 'all',
  loading: false,
};

// ── API CLIENT ────────────────────────────────────────────
const api = {
  base: '/api',
  async get(path) {
    const res = await fetch(this.base + path);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async post(path, data) {
    const res = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initCursor();
  initNav();
  initLoader();
  await loadAll();
  initCover();
  initScrollReveal();
  initInterstitials();
  initMobileNav();
  initKeyboard();
});

// ── LOADER ────────────────────────────────────────────────
function initLoader() {
  setTimeout(() => {
    document.getElementById('loader').classList.add('out');
    setTimeout(() => {
      const l = document.getElementById('loader');
      if (l) l.remove();
    }, 700);
  }, 1800);
}

// ── LOAD ALL DATA ─────────────────────────────────────────
async function loadAll() {
  try {
    const [arts, brnds, trks, stats] = await Promise.all([
      api.get('/articles'),
      api.get('/brands'),
      api.get('/tracks'),
      api.get('/stats'),
    ]);
    state.articles = arts.articles;
    state.brands = brnds.brands;
    state.tracks = trks.tracks;
    renderArticles();
    renderBrands();
    renderTracks();
    updateStats(stats);
  } catch (e) {
    console.error('Load error:', e);
    toast('Failed to load content. Refresh to try again.');
  }
}

// ── CURSOR ────────────────────────────────────────────────
function initCursor() {
  const cur = document.getElementById('cursor');
  if (!cur || window.matchMedia('(pointer: coarse)').matches) return;
  let mx = -100, my = -100, cx = -100, cy = -100;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  const moveCursor = () => {
    cx += (mx - cx) * 0.12;
    cy += (my - cy) * 0.12;
    cur.style.left = cx + 'px';
    cur.style.top = cy + 'px';
    requestAnimationFrame(moveCursor);
  };
  moveCursor();
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('a, button, .article-card, .brand-card, .track-row, [data-hover]');
    cur.classList.toggle('big', !!el);
  });
}

// ── NAV ───────────────────────────────────────────────────
function initNav() {
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('solid', window.scrollY > 60);
  }, { passive: true });

  // Hamburger
  const btn = document.querySelector('.nav-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (btn && drawer) {
    btn.addEventListener('click', () => {
      drawer.classList.toggle('open');
      btn.querySelectorAll('span').forEach((s, i) => {
        if (drawer.classList.contains('open')) {
          if (i === 0) s.style.transform = 'rotate(45deg) translate(4px,4px)';
          if (i === 1) s.style.opacity = '0';
          if (i === 2) s.style.transform = 'rotate(-45deg) translate(4px,-4px)';
        } else {
          s.style.transform = ''; s.style.opacity = '';
        }
      });
    });
    // close on outside click
    document.addEventListener('click', e => {
      if (!drawer.contains(e.target) && !btn.contains(e.target)) {
        drawer.classList.remove('open');
        btn.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      }
    });
  }
}

// Navigate to section
window.goTo = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 84;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
  document.querySelectorAll('#mobile-drawer button').forEach(b => b.classList.remove('active'));
};

// ── COVER ─────────────────────────────────────────────────
function initCover() {
  const cover = document.getElementById('cover');
  if (!cover) return;
  setTimeout(() => cover.classList.add('loaded'), 100);
}

// ── STATS ─────────────────────────────────────────────────
function updateStats(stats) {
  const map = {
    'stat-articles': stats.articles,
    'stat-brands': stats.brands,
    'stat-tracks': stats.tracks,
    'stat-issue': '00',
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) animateCount(el, typeof val === 'number' ? val : null, val);
  });
}
function animateCount(el, target, display) {
  if (target === null) { el.textContent = display; return; }
  let current = 0;
  const step = Math.ceil(target / 20);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 50);
}

// ── ARTICLES ─────────────────────────────────────────────
function renderArticles(filter = 'all') {
  const grid = document.getElementById('article-grid');
  if (!grid) return;

  let arts = state.articles;
  if (filter !== 'all') {
    arts = arts.filter(a => a.category.toLowerCase() === filter.toLowerCase());
  }

  document.getElementById('art-count').textContent = `${arts.length} article${arts.length !== 1 ? 's' : ''}`;

  if (!arts.length) {
    grid.innerHTML = `<div class="no-results">No articles in this category yet.</div>`;
    return;
  }

  grid.innerHTML = arts.map((a, i) => {
    const featured = a.featured && filter === 'all' && i === 0;
    return `
    <div class="article-card reveal ${featured ? 'featured' : ''}" 
         data-slug="${a.slug}" 
         onclick="openArticle('${a.slug}')">
      <div class="card-photo">
        <img src="${a.image}" alt="${a.title}" loading="${i < 3 ? 'eager' : 'lazy'}">
        <div class="card-photo-overlay"></div>
      </div>
      <div class="card-body">
        <div class="card-cat">${a.category}</div>
        <div class="card-title">${a.title}</div>
        <div class="card-rule"></div>
        <div class="card-excerpt">${a.lead}</div>
        <div class="card-meta"><span>${a.author}</span><span>${a.readTime}</span></div>
      </div>
    </div>`;
  }).join('');

  // Re-observe reveals
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// Filter handler
window.filterArticles = function(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.currentFilter = cat;
  renderArticles(cat);
};

// ── ARTICLE READER ────────────────────────────────────────
window.openArticle = async function(slug) {
  const reader = document.getElementById('reader');
  const list = document.getElementById('article-list-wrap');
  if (!reader) return;

  // Show skeleton
  reader.classList.add('visible');
  document.getElementById('reader-content').innerHTML = `
    <div style="padding:40px">
      <div class="skeleton" style="height:14px;width:60%;margin-bottom:12px;"></div>
      <div class="skeleton" style="height:14px;width:80%;margin-bottom:12px;"></div>
      <div class="skeleton" style="height:14px;width:50%;"></div>
    </div>`;

  reader.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const article = await api.get(`/articles/${slug}`);
    state.currentArticle = article;

    // Hero
    const hero = document.getElementById('reader-hero');
    hero.style.backgroundImage = `url(${article.image})`;
    document.getElementById('r-kicker').textContent = article.category;
    document.getElementById('r-title').textContent = article.title;
    document.getElementById('r-byline').innerHTML =
      [article.author, article.date, article.readTime].map(b => `<span>${b}</span>`).join('');

    // Tags sidebar
    document.getElementById('r-tags').innerHTML =
      article.tags.map(t => `<span class="sidebar-tag">${t}</span>`).join('');

    // Content
    let content = `<div class="reader-lead">${article.lead}</div>`;
    article.body.forEach((block, i) => {
      if (block.type === 'p') {
        content += `<p${i === 0 ? ' class="drop"' : ''}>${block.text}</p>`;
      } else if (block.type === 'h3') {
        content += `<h3>${block.text}</h3>`;
      } else if (block.type === 'pullquote') {
        content += `<div class="reader-pullquote">${block.text}</div>`;
      }
    });
    content += `<div class="reader-tags">${article.tags.map(t => `<span class="reader-tag">${t}</span>`).join('')}</div>`;
    document.getElementById('reader-content').innerHTML = content;

    // Related
    const related = state.articles.filter(a => a.slug !== slug).slice(0, 3);
    document.getElementById('reader-related').innerHTML = related.map(a => `
      <div class="article-card" onclick="openArticle('${a.slug}')">
        <div class="card-photo" style="aspect-ratio:4/3;">
          <img src="${a.image}" alt="${a.title}" loading="lazy">
          <div class="card-photo-overlay"></div>
        </div>
        <div class="card-body">
          <div class="card-cat">${a.category}</div>
          <div class="card-title" style="font-size:18px;">${a.title}</div>
          <div class="card-meta" style="margin-top:8px;"><span>${a.author}</span></div>
        </div>
      </div>`).join('');

    // Scroll to reader
    reader.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (e) {
    document.getElementById('reader-content').innerHTML = `<p style="padding:40px;color:var(--dim)">Failed to load article. Please try again.</p>`;
    toast('Could not load article.');
  }
};

window.closeReader = function() {
  document.getElementById('reader').classList.remove('visible');
  document.getElementById('editorial').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ── BRANDS ───────────────────────────────────────────────
function renderBrands() {
  const grid = document.getElementById('brands-grid');
  if (!grid || !state.brands.length) return;

  grid.innerHTML = state.brands.map((b, i) => `
    <div class="brand-card reveal reveal-delay-${(i % 3) + 1}" onclick="openBrand('${b.id}')">
      <div class="brand-logo">${b.abbr}</div>
      <div class="brand-city">${b.city}</div>
      <div class="brand-name">${b.name}</div>
      <div class="brand-desc">${b.desc}</div>
    </div>`).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

window.openBrand = async function(id) {
  const overlay = document.getElementById('brand-overlay');
  overlay.classList.add('open');

  try {
    const brand = await api.get(`/brands/${id}`);
    document.getElementById('bpanel-tag').textContent = `Exhibit B — ${brand.city}`;
    document.getElementById('brand-detail').innerHTML = `
      <div class="bp-city">${brand.city}</div>
      <div class="bp-name">${brand.name}</div>
      <div class="bp-desc">${brand.desc}</div>
      <div class="bp-story">${brand.story}</div>
      <div class="bp-meta">
        ${[
          { l: 'Founded', v: brand.founded },
          { l: 'Category', v: brand.category },
          { l: 'Price Range', v: brand.price },
          { l: 'Stockists', v: brand.stockists },
        ].map(m => `<div class="bp-cell"><div class="bp-label">${m.l}</div><div class="bp-val">${m.v}</div></div>`).join('')}
      </div>`;
  } catch (e) {
    document.getElementById('brand-detail').innerHTML = `<p style="color:var(--dim)">Could not load brand.</p>`;
  }
};

window.closeBrand = function() {
  document.getElementById('brand-overlay').classList.remove('open');
};

// ── MUSIC ─────────────────────────────────────────────────
function renderTracks() {
  const list = document.getElementById('track-list');
  if (!list || !state.tracks.length) return;

  list.innerHTML = state.tracks.map((t, i) => `
    <div class="track-row ${i === 0 ? 'playing' : ''}" id="tr${t.id}" 
         onclick="playTrack(${t.id}, '${t.spotify}')">
      <div class="tr-num">${String(t.id).padStart(2,'0')}</div>
      <div class="tr-info">
        <div class="tr-name">${t.title}</div>
        <div class="tr-artist">${t.artist}</div>
        <div class="tr-bar"></div>
      </div>
      <div class="tr-genre">${t.genre}</div>
    </div>`).join('');

  // Append player
  list.innerHTML += `
    <div class="music-player">
      <iframe id="spotify-player" 
        src="${state.tracks[0].spotify}" 
        height="80" allowfullscreen
        allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture"
        loading="lazy" frameborder="0"></iframe>
    </div>`;
}

window.playTrack = function(id, url) {
  document.querySelectorAll('.track-row').forEach(r => r.classList.remove('playing'));
  const row = document.getElementById('tr' + id);
  if (row) row.classList.add('playing');
  const player = document.getElementById('spotify-player');
  if (player) player.src = url;
};

// ── SUBMIT FORM ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('submit-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const msg = document.getElementById('form-msg');
    btn.disabled = true; btn.textContent = 'Sending...';
    msg.className = 'form-msg'; msg.textContent = '';

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      type: form.type.value,
      message: form.message.value.trim(),
    };

    try {
      const res = await api.post('/submit', data);
      if (res.success) {
        msg.textContent = '✓ ' + res.message;
        msg.className = 'form-msg success';
        form.reset();
        toast('Submission received. We\'ll be in touch.');
      } else {
        msg.textContent = '✗ ' + (res.error || 'Something went wrong.');
        msg.className = 'form-msg error';
        btn.disabled = false; btn.textContent = 'Send It →';
      }
    } catch (e) {
      msg.textContent = '✗ Network error. Try again.';
      msg.className = 'form-msg error';
      btn.disabled = false; btn.textContent = 'Send It →';
    }
  });
});

// ── NEWSLETTER ────────────────────────────────────────────
window.submitNewsletter = async function() {
  const input = document.getElementById('nl-email');
  const btn = document.getElementById('nl-btn');
  const email = input.value.trim();
  if (!email) return;

  btn.disabled = true; btn.textContent = 'Adding...';
  try {
    const res = await api.post('/newsletter', { email });
    if (res.success) {
      input.value = '';
      toast('You\'re on the list.');
    } else {
      toast(res.error || 'Could not subscribe.');
    }
  } catch (e) {
    toast('Network error.');
  }
  btn.disabled = false; btn.textContent = 'Subscribe →';
};

// ── SCROLL REVEAL ─────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

function initScrollReveal() {
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// ── INTERSTITIALS ─────────────────────────────────────────
function initInterstitials() {
  // Parallax on interstitial backgrounds
  const intObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelector('.interstitial-bg')?.style &&
          (e.target.querySelector('.interstitial-bg').style.transform = 'scale(1)');
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.interstitial').forEach(el => intObs.observe(el));
}

// ── MOBILE NAV ────────────────────────────────────────────
function initMobileNav() {
  const sections = ['cover', 'editorial', 'brands-section', 'music-section', 'submit-section'];
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > 0.4) {
        const raw = e.target.id.replace('-section', '');
        document.querySelectorAll('.mn-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.section === raw || b.dataset.section === e.target.id);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
}

// ── KEYBOARD ─────────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeBrand();
      if (document.getElementById('reader').classList.contains('visible')) closeReader();
    }
  });
}

// ── TOAST ─────────────────────────────────────────────────
function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}
