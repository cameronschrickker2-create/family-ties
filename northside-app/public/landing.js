// Northside website: hero 3D, suburb flash, live-route map, menu cards, promo video
import { createHero, renderThumbs, modelFor, webglOK } from '/js/scenes.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');
const API = window.NS_API || { config: '/api/config', menu: '/api/menu' };

// ---------- 18+ gate ----------
function age(dob) { const d = new Date(dob + 'T00:00:00'); if (isNaN(d)) return -1; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return a; }
if (!store.get('ns_age_ok', false)) {
  $('#gate').classList.remove('hidden'); $('#gateDob').max = new Date().toISOString().slice(0, 10);
  const err = m => { $('#gateErr').textContent = m; $('#gateErr').classList.remove('hidden'); };
  $('#gateYes').onclick = () => { const a = age($('#gateDob').value); if (a < 0) return err('Enter your date of birth.'); if (a < 18) return err('Sorry, Northside is 18+ only.'); store.set('ns_age_ok', true); store.set('ns_dob', $('#gateDob').value); $('#gate').classList.add('hidden'); };
  $('#gateNo').onclick = () => err('Sorry, Northside is 18+ only.');
}

// ---------- hero: typing label, timecode, 3D ----------
const LABEL = 'CAPE TOWN — NORTHERN SUBURBS';
const typeStart = performance.now(); const typer = setInterval(() => { const n = reduced ? LABEL.length : Math.min(LABEL.length, Math.floor((performance.now() - typeStart) / 55)); $('#typed').textContent = LABEL.slice(0, n); if (n >= LABEL.length) clearInterval(typer); }, 50);
const t0 = performance.now(); setInterval(() => { const s = (performance.now() - t0) / 1000; $('#tc').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map(v => String(v).padStart(2, '0')).join(':'); }, 1000);
let hero = null;
if (webglOK) {
  try {
    await document.fonts.load('400 40px Anton').catch(() => {});
    hero = createHero($('#hero3d'), { kind: 'jar', name: 'Cape Haze', sub: 'Indoor · Sativa', strain: 'sativa' });
  } catch (e) { console.warn('3D off', e); }
}

// ---------- tickers ----------
const AREAS = ['Brackenfell', 'Durbanville', 'Bellville', 'Kuils River', 'Kraaifontein', 'Parow', 'Goodwood', 'Plattekloof', 'Edgemead', 'Bothasig'];
document.querySelectorAll('[data-ticker]').forEach(el => { const s = ['Northside', ...AREAS].map(esc).join('  ●  ') + '  ●  '; el.textContent = s + s; });

// ---------- suburb flash (beat-synced like the ad: 112 BPM) ----------
const COORD = { Brackenfell: [-33.873, 18.695], Durbanville: [-33.832, 18.647], Bellville: [-33.900, 18.630], 'Kuils River': [-33.927, 18.684], Kraaifontein: [-33.849, 18.723], Parow: [-33.904, 18.587], Goodwood: [-33.910, 18.556], Plattekloof: [-33.866, 18.583], Edgemead: [-33.871, 18.554], Bothasig: [-33.862, 18.540] };
let FEES = {}; const FLASH = [...AREAS, '& Surrounds'];
let fi = 0, flashTimer = null;
function showFlash(i) {
  const name = FLASH[i], sec = $('#areas'), last = i === FLASH.length - 1;
  sec.classList.toggle('alt', !last && i % 2 === 1); sec.classList.toggle('cream', last);
  const h = $('#flashName'); h.textContent = name; h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit');
  $('#flashEcho').innerHTML = Array.from({ length: 7 }, () => `<span>${esc(name)}</span>`).join('');
  $('#flashIdx').textContent = `${String(i + 1).padStart(2, '0')} / ${FLASH.length}`;
  const c = COORD[name]; $('#flashCoord').textContent = c ? `${Math.abs(c[0]).toFixed(2)}°S ${c[1].toFixed(2)}°E` : '+ more on request';
  $('#flashFee').textContent = FEES[name] != null ? `Delivery R${FEES[name]}` : 'Northside →';
  $('#flashBar').style.width = ((i + 1) / FLASH.length * 100) + '%';
}
showFlash(0);
new IntersectionObserver(([e]) => {
  clearInterval(flashTimer);
  if (e.isIntersecting && !reduced) flashTimer = setInterval(() => { fi = (fi + 1) % FLASH.length; showFlash(fi); }, 60000 / 112 * 2);
}, { threshold: 0.5 }).observe($('#areas'));

// ---------- live-route map ----------
const P = (lat, lng) => [500 + (lng - 18.63) * 4300 * 0.83, 380 - (lat + 33.875) * 4300];
const d = a => 'M' + a.map(([la, ln]) => P(la, ln).map(v => v.toFixed(1)).join(',')).join(' L');
const ROADS = [[[-33.935, 18.48], [-33.915, 18.54], [-33.900, 18.60], [-33.887, 18.640], [-33.872, 18.680], [-33.858, 18.720], [-33.845, 18.78]], [[-33.97, 18.665], [-33.93, 18.672], [-33.90, 18.676], [-33.873, 18.690], [-33.84, 18.70], [-33.80, 18.71]], [[-33.80, 18.535], [-33.86, 18.540], [-33.90, 18.545], [-33.96, 18.55]], [[-33.79, 18.640], [-33.84, 18.647], [-33.88, 18.635], [-33.92, 18.62], [-33.96, 18.61]], [[-33.83, 18.56], [-33.85, 18.60], [-33.86, 18.64], [-33.865, 18.70], [-33.86, 18.76]]];
const ROUTE = [[-33.873, 18.695], [-33.866, 18.690], [-33.868, 18.665], [-33.880, 18.648], [-33.887, 18.630], [-33.884, 18.610], [-33.876, 18.596], [-33.866, 18.583]];
let streets = ''; for (let i = 0; i < 26; i++) { const y = i * 32 + 6; streets += `<line class="st" x1="0" y1="${y}" x2="1000" y2="${y - 120}"/>`; } for (let i = 0; i < 30; i++) { const x = i * 38; streets += `<line class="st" x1="${x}" y1="0" x2="${x + 90}" y2="760"/>`; }
const dest = P(...ROUTE.at(-1));
$('#map').innerHTML = `<g>${streets}</g>${ROADS.map(r => `<path class="rd" d="${d(r)}"/>`).join('')}
  ${Object.entries(COORD).map(([nm, ll]) => { const [x, y] = P(...ll); return `<circle class="pt" cx="${x}" cy="${y}" r="7"/><text class="lb" x="${x + 14}" y="${y - 12}">${esc(nm.toUpperCase())}</text>`; }).join('')}
  <path class="rt" id="route" d="${d(ROUTE)}" stroke-dasharray="0 99999"/>
  <path class="door" d="M${dest[0]},${dest[1]} m-22,-58 a22,22 0 1,1 44,0 c0,18 -22,40 -22,58 c0,-18 -22,-40 -22,-58z"/>
  <circle class="pulse" id="pulse" r="18"/><circle class="rider" id="rider" r="15"/>`;
const route = $('#route'), L = route.getTotalLength(); let mapOn = false, mt0 = 0;
new IntersectionObserver(([e]) => { mapOn = e.isIntersecting; if (mapOn) { mt0 = performance.now(); requestAnimationFrame(mapLoop); } }, { threshold: 0.25 }).observe($('#track'));
function mapLoop(now) {
  if (!mapOn) return;
  const cycle = 9000, t = reduced ? 0.65 : ((now - mt0) % cycle) / cycle;
  const p = Math.min(1, t / 0.85), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  route.setAttribute('stroke-dasharray', `${L * e} 99999`);
  const pt = route.getPointAtLength(L * e);
  ['rider', 'pulse'].forEach(id => { $('#' + id).setAttribute('cx', pt.x); $('#' + id).setAttribute('cy', pt.y); });
  const pul = (now / 900) % 1; $('#pulse').setAttribute('r', 15 + pul * 30); $('#pulse').style.opacity = 1 - pul;
  const secs = Math.round(14 * 60 * (1 - e)); $('#eta').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('#etaBar').style.width = Math.max(2, e * 100) + '%';
  if (!reduced) requestAnimationFrame(mapLoop);
}

// ---------- scroll: nav background + hero spin ----------
addEventListener('scroll', () => {
  $('#nav').classList.toggle('solid', scrollY > 40);
  const hv = Math.min(1, scrollY / innerHeight); hero?.setScroll(hv); hero?.setPaused(hv >= 1);
}, { passive: true });

// ---------- reveals ----------
document.querySelectorAll('.menu-head, .cat, .steps li, .watch-copy, .track-copy, .end > *').forEach(el => el.classList.add('rv'));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

// ---------- promo video sound ----------
$('#sound').onclick = () => { const v = $('#promo'); v.muted = !v.muted; if (!v.muted) { v.currentTime = 0; v.play(); } $('#sound').textContent = v.muted ? '🔊 Sound on' : '🔇 Sound off'; };

// ---------- live data: fees, prices, 3D menu pictures ----------
(async () => {
  try {
    const [cfg, menu] = await Promise.all([fetch(API.config).then(r => r.json()), fetch(API.menu).then(r => r.json())]);
    cfg.zones.forEach(z => { FEES[z.name] = z.fee; }); showFlash(fi);
    document.querySelectorAll('[data-from]').forEach(el => {
      const ps = menu.filter(p => p.category === el.dataset.from).map(p => p.base_price + p.options.filter(o => o.required && o.type === 'single').reduce((t, o) => t + Math.min(...o.choices.map(c => c.price)), 0));
      if (ps.length) el.textContent = 'R' + Math.min(...ps);
    });
    const fromP = p => p.base_price + p.options.filter(o => o.required && o.type === 'single').reduce((t, o) => t + Math.min(...o.choices.map(c => c.price)), 0);
    const flow = window.NSFlow?.mount($('#flow'), menu.map(p => ({ id: p.id, title: p.name, kicker: [p.category, p.badge].filter(Boolean).join(' · '), price: 'from R' + fromP(p), img: '', word: p.category })), { onOpen: it => { if (window.NS_SHOP) { location.hash = window.NS_SHOP; return; } location.href = '/shop?cat=' + encodeURIComponent(menu.find(p => p.id === it.id).category); } });
    if (webglOK) {
      renderThumbs(menu.map(modelFor), 560, 'dark').then(urls => menu.forEach((p, i) => flow?.setImage(p.id, urls[i]))).catch(() => {});
      const pics = [...document.querySelectorAll('[data-model]')];
      const picks = pics.map(el => menu.find(p => p.category === el.dataset.model)).filter(Boolean);
      const urls = await renderThumbs(picks.map(modelFor), 640, 'dark');
      pics.forEach((el, i) => { if (urls[i]) el.style.backgroundImage = `url(${urls[i]}), radial-gradient(circle at 50% 55%,#1E3A2B,#0B1410 70%)`; });
    }
  } catch (e) { console.warn(e); }
})();
