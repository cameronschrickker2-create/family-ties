// Northside website: 3D gallery driven by scroll, reveals, line-drawn route plan
import { createGallery, webglOK } from '/js/scenes.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---------- 18+ gate (shared with the shop) ----------
function age(dob) { const d = new Date(dob + 'T00:00:00'); if (isNaN(d)) return -1; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return a; }
if (!store.get('ns_age_ok', false)) {
  $('#gate').classList.remove('hidden'); $('#gateDob').max = new Date().toISOString().slice(0, 10);
  const err = m => { $('#gateErr').textContent = m; $('#gateErr').classList.remove('hidden'); };
  $('#gateYes').onclick = () => { const a = age($('#gateDob').value); if (a < 0) return err('Please enter your date of birth.'); if (a < 18) return err('Sorry, you must be 18 or older to enter Northside.'); store.set('ns_age_ok', true); store.set('ns_dob', $('#gateDob').value); $('#gate').classList.add('hidden'); };
  $('#gateNo').onclick = () => err('Sorry, you must be 18 or older to enter Northside.');
}

// ---------- 3D gallery ----------
const STATIONS = [
  { kind: 'jar', name: 'Cape Haze', sub: 'Indoor · Sativa', strain: 'sativa', scale: 1.15 },
  { kind: 'jar', name: 'Mountain Kush', sub: 'Indoor · Indica', strain: 'indica', scale: 1.15 },
  { kind: 'preroll', scale: 1.3 },
  { kind: 'gummies', scale: 1.6 },
];
const stationEls = [...document.querySelectorAll('[data-station]')];
let gallery = null;
if (webglOK) {
  try {
    await Promise.all([document.fonts.load('italic 400 40px "Cormorant Garamond"'), document.fonts.load('500 20px Inter')]).catch(() => {});
    gallery = createGallery($('#gl'), STATIONS);
  } catch (e) { console.warn('3D unavailable', e); document.body.classList.add('no-gl'); }
} else document.body.classList.add('no-gl');

function progress() {
  const y = scrollY + innerHeight * 0.5;
  const tops = stationEls.map(el => el.offsetTop + el.offsetHeight / 2);
  if (y <= tops[0]) return 0;
  for (let i = 1; i < tops.length; i++) if (y < tops[i]) return i - 1 + (y - tops[i - 1]) / (tops[i] - tops[i - 1]);
  return tops.length - 1;
}
const sections = [...document.querySelectorAll('.s')];
function onScroll() {
  gallery?.setProgress(progress());
  const lastStation = stationEls.at(-1); gallery?.setPaused(scrollY > lastStation.offsetTop + lastStation.offsetHeight + 10);
  // which section is under the header / mid-screen
  const mid = scrollY + innerHeight * 0.5, top = scrollY + 40;
  const idx = Math.max(0, sections.findIndex(s => mid >= s.offsetTop && mid < s.offsetTop + s.offsetHeight));
  const under = sections.find(s => top >= s.offsetTop && top < s.offsetTop + s.offsetHeight);
  $('.nav').classList.toggle('on-dark', !!under?.classList.contains('dark'));
  $('.rail').classList.toggle('on-dark', sections[idx]?.classList.contains('dark'));
  $('#railNum').textContent = String(idx + 1).padStart(2, '0');
  $('#railBar').style.transform = `scaleY(${(idx + 1) / sections.length})`;
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

// ---------- reveals ----------
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.id === 'how') $('#plan').classList.add('drawn'); } }), { threshold: 0.3 });
sections.forEach(s => io.observe(s));

// ---------- line-drawn route plan (real coordinates of the Northern Suburbs) ----------
const P = (lat, lng) => [500 + (lng - 18.63) * 4300 * 0.83, 360 - (lat + 33.875) * 4300];
const pts = a => 'M' + a.map(([la, ln]) => P(la, ln).map(v => v.toFixed(1)).join(',')).join(' L');
const ROADS = [
  [[-33.935, 18.48], [-33.915, 18.54], [-33.900, 18.60], [-33.887, 18.640], [-33.872, 18.680], [-33.858, 18.720], [-33.845, 18.78]],
  [[-33.97, 18.665], [-33.93, 18.672], [-33.90, 18.676], [-33.873, 18.690], [-33.84, 18.70], [-33.80, 18.71]],
  [[-33.80, 18.535], [-33.86, 18.540], [-33.90, 18.545], [-33.96, 18.55]],
  [[-33.79, 18.640], [-33.84, 18.647], [-33.88, 18.635], [-33.92, 18.62], [-33.96, 18.61]],
  [[-33.83, 18.56], [-33.85, 18.60], [-33.86, 18.64], [-33.865, 18.70], [-33.86, 18.76]],
];
const SUBS = { Brackenfell: [-33.873, 18.695], Durbanville: [-33.832, 18.647], Bellville: [-33.900, 18.630], 'Kuils River': [-33.927, 18.684], Kraaifontein: [-33.849, 18.723], Parow: [-33.904, 18.587], Goodwood: [-33.910, 18.556], Plattekloof: [-33.866, 18.583], Edgemead: [-33.871, 18.554], Bothasig: [-33.862, 18.540] };
const ROUTE = [[-33.873, 18.695], [-33.866, 18.690], [-33.868, 18.665], [-33.880, 18.648], [-33.887, 18.630], [-33.884, 18.610], [-33.876, 18.596], [-33.866, 18.583]];
const end = P(...ROUTE.at(-1));
let grid = ''; for (let x = 0; x <= 1000; x += 50) grid += `<line x1="${x}" y1="0" x2="${x}" y2="760"/>`; for (let y = 0; y <= 760; y += 50) grid += `<line x1="0" y1="${y}" x2="1000" y2="${y}"/>`;
$('#plan').innerHTML = `<g class="grid">${grid}</g>
  ${ROADS.map(r => `<path class="road dr" pathLength="1" d="${pts(r)}"/>`).join('')}
  <path class="route dr" pathLength="1" d="${pts(ROUTE)}"/>
  ${Object.entries(SUBS).map(([n, ll]) => { const [x, y] = P(...ll); return `<circle class="pt" cx="${x}" cy="${y}" r="5"/><text class="lbl" x="${x + 12}" y="${y - 10}">${n.toUpperCase()}</text>`; }).join('')}
  <circle class="home-ring" cx="${end[0]}" cy="${end[1]}" r="9"/><circle class="home" cx="${end[0]}" cy="${end[1]}" r="7"/>`;

// ---------- live data: delivery zones + "from" prices ----------
(async () => {
  try {
    const [cfg, menu] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/menu').then(r => r.json())]);
    $('#zones').innerHTML = cfg.zones.map(z => `<div class="zone"><b>${esc(z.name)}</b><span>R${z.fee}</span></div>`).join('');
    $('#zoneNote').textContent = `Free delivery on orders over R${cfg.free_delivery_over} · Minimum order R${cfg.min_order} · Delivered from Brackenfell`;
    document.querySelectorAll('[data-from]').forEach(el => {
      const prices = menu.filter(p => p.category === el.dataset.from).map(p => p.base_price + p.options.filter(o => o.required && o.type === 'single').reduce((t, o) => t + Math.min(...o.choices.map(c => c.price)), 0));
      if (prices.length) el.textContent = 'R' + Math.min(...prices);
    });
  } catch { /* static copy stays */ }
})();
