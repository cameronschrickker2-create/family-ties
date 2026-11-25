// Preview shop: 3D-rendered product grid, tilt cards, drag-to-rotate product view
import { renderThumbs, createViewer, modelFor, webglOK } from './js/scenes.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = n => 'R' + Number(n).toLocaleString('en-ZA');
let menu = [], thumbs = {}, started = false, viewer = null;

const fromPrice = p => p.base_price + p.options.filter(o => o.required && o.type === 'single').reduce((t, o) => t + Math.min(...o.choices.map(c => c.price)), 0);
const ranged = p => p.options.some(o => o.required && new Set(o.choices.map(c => c.price)).size > 1);

function render() {
  const cats = [...new Set(menu.map(p => p.category))];
  $('#pgrid').innerHTML = cats.map(c => { const list = menu.filter(p => p.category === c); return `<h2 class="cat-title">${esc(c)}<small>${list.length} items</small></h2><div class="pgrid">${list.map(p => `
    <button class="pc" data-id="${p.id}"><div class="pth ${thumbs[p.id] ? '' : 'loading'}" data-thumb="${p.id}">${thumbs[p.id] ? `<img src="${thumbs[p.id]}" alt="${esc(p.name)}">` : ''}<span class="glare"></span></div>
    <span class="tl">${[p.badge, p.strength].filter(Boolean).map(esc).join(' · ') || esc(p.category)}</span><h3>${esc(p.name)}</h3><span class="pr">${ranged(p) ? 'From ' : ''}${R(fromPrice(p))}</span></button>`).join('')}</div>`; }).join('');
  document.querySelectorAll('.pc').forEach(el => {
    el.onclick = () => open(menu.find(p => p.id === +el.dataset.id));
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      el.onpointermove = e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; el.style.transition = 'transform .12s'; el.style.transform = `rotateY(${(x - .5) * 10}deg) rotateX(${(.5 - y) * 8}deg)`; el.style.setProperty('--gx', x * 100 + '%'); el.style.setProperty('--gy', y * 100 + '%'); };
      el.onpointerleave = () => { el.style.transition = ''; el.style.transform = ''; };
    }
  });
  const flow = window.NSFlow?.mount($('#pflow'), menu.map(p => ({ id: p.id, title: p.name, kicker: [p.category, p.badge].filter(Boolean).join(' · '), price: (ranged(p) ? 'from ' : '') + R(fromPrice(p)), img: thumbs[p.id] || '', word: p.category })), { onOpen: it => open(menu.find(p => p.id === it.id)) });
  if (!started && webglOK) {
    started = true;
    document.fonts.load('italic 400 40px "Cormorant Garamond"').catch(() => {}).then(() => renderThumbs(menu.map(modelFor), 560, 'dark')).then(urls => {
      menu.forEach((p, i) => { thumbs[p.id] = urls[i]; flow?.setImage(p.id, urls[i]); });
      document.querySelectorAll('[data-thumb]').forEach(el => { const u = thumbs[+el.dataset.thumb]; if (u && !el.querySelector('img')) { el.classList.remove('loading'); el.insertAdjacentHTML('afterbegin', `<img src="${u}" alt="">`); } });
    }).catch(e => console.warn(e));
  }
}

function close() { viewer?.dispose(); viewer = null; $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function open(p) {
  const sel = {}; p.options.forEach(o => { sel[o.name] = o.required && o.type === 'single' ? [o.choices[0].label] : []; });
  const price = () => p.base_price + p.options.reduce((t, o) => t + o.choices.filter(c => sel[o.name].includes(c.label)).reduce((a, c) => a + c.price, 0), 0);
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="sheet2" role="dialog" aria-modal="true" aria-label="${esc(p.name)}"><div class="stage2" id="stage2"><button class="x" aria-label="Close">×</button><span class="hint">Drag to rotate</span></div>
    <div class="side"><span class="eyebrow">${[p.badge, p.strength].filter(Boolean).map(esc).join(' · ')}</span><h2>${esc(p.name)}</h2><p class="muted" style="margin:0 0 10px;font-weight:300">${esc(p.description)}</p>
    ${p.options.map((o, oi) => `<div class="og"><b>${esc(o.name)}</b>${o.choices.map((c, ci) => `<label><input type="${o.type === 'single' ? 'radio' : 'checkbox'}" name="o${oi}" data-o="${oi}" data-c="${ci}" ${sel[o.name].includes(c.label) ? 'checked' : ''}><span>${esc(c.label)}</span><em>${c.price ? (o.type === 'multi' ? '+' : '') + R(c.price) : ''}</em></label>`).join('')}</div>`).join('')}
    <button class="btn block" id="add" style="margin-top:12px"></button><p class="prev" id="prev" hidden>Online ordering opens soon. 18+ only, ID checked on delivery.</p></div></div>`;
  const upd = () => { $('#add').textContent = `Add to cart · ${R(price())}`; };
  m.querySelectorAll('input[data-o]').forEach(i => i.onchange = () => { const o = p.options[i.dataset.o], c = o.choices[i.dataset.c]; if (o.type === 'single') sel[o.name] = [c.label]; else sel[o.name] = i.checked ? [...sel[o.name], c.label] : sel[o.name].filter(l => l !== c.label); upd(); });
  m.querySelector('.x').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#add').onclick = () => { $('#prev').hidden = false; };
  upd();
  if (webglOK) try { viewer = createViewer($('#stage2'), modelFor(p), 'dark'); } catch (e) { console.warn(e); }
}
addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

function route() {
  const show = location.hash === '#shop';
  $('#shopView').hidden = !show;
  document.documentElement.style.overflow = show ? 'hidden' : '';
  if (show && !$('#pgrid').children.length) render();
}
addEventListener('hashchange', route);
fetch('./menu.json').then(r => r.json()).then(d => { menu = d; route(); });
