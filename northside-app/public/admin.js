// Northside admin + CRM
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = n => 'R' + Number(n || 0).toLocaleString('en-ZA');
const tm = t => t ? new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '—';
const dt = t => t ? new Date(t).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm ago'; };
const LABEL = { placed: 'New', accepted: 'Accepted', packed: 'Packed', out_for_delivery: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled' };
const PAY = { cash: 'Cash', card_on_delivery: 'Card', eft: 'EFT' };
const A = { token: sessionStorage.getItem('ns_admin') || '', tab: 'orders', orders: new Map(), drivers: [], settings: null, fresh: new Set(), maps: [] };

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + A.token } });
  if (r.status === 401) { sessionStorage.removeItem('ns_admin'); A.token = ''; login(); throw new Error('Please log in again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2600); }

function login() {
  document.body.innerHTML = `<div class="login"><div class="brand" style="font-size:20px"><span class="mark"><span>N</span></span>NORTHSIDE ADMIN</div>
    <form id="lf"><div class="field" style="margin-top:20px"><label>Password</label><input class="input" type="password" id="pw" autocomplete="current-password" autofocus></div>
    <div class="error hidden" id="le"></div><button class="btn block">Log in</button></form></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      sessionStorage.setItem('ns_admin', j.token); location.reload();
    } catch (ex) { $('#le').textContent = ex.message; $('#le').classList.remove('hidden'); }
  };
}

// ---------- alerts ----------
let actx;
function beep() {
  try {
    actx = actx || new AudioContext();
    [0, .18, .36].forEach((d, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = [880, 1175, 1568][i]; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(.0001, actx.currentTime + d); g.gain.exponentialRampToValueAtTime(.25, actx.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d + .16); o.start(actx.currentTime + d); o.stop(actx.currentTime + d + .2); });
  } catch {}
}
function notifyNew(o) {
  beep();
  if ('Notification' in window && Notification.permission === 'granted') new Notification('New order ' + o.code, { body: `${o.customer.name} · ${o.suburb} · ${R(o.total)}` });
}
function updateBadge() {
  const n = [...A.orders.values()].filter(o => o.status === 'placed').length;
  document.title = (n ? `(${n}) ` : '') + 'Northside · Admin';
  const b = $('#nNew'); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); }
}

// ---------- shell ----------
function shell() {
  document.body.innerHTML = `<div class="shell"><aside>
    <div class="brand"><span class="mark"><span>N</span></span>NORTHSIDE</div>
    ${[['orders', 'Live orders'], ['map', 'Live map'], ['customers', 'Customers'], ['menu', 'Menu & prices'], ['drivers', 'Drivers'], ['settings', 'Settings']].map(([k, l]) => `<button data-tab="${k}">${l}${k === 'orders' ? '<span class="n hidden" id="nNew"></span>' : ''}</button>`).join('')}
    <div class="foot"><a href="/" target="_blank">Open store ↗</a><br><a href="/driver" target="_blank">Driver app ↗</a><br><a href="#" id="lo">Log out</a></div></aside>
    <main id="main"></main></div>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { A.tab = b.dataset.tab; tab(); });
  $('#lo').onclick = e => { e.preventDefault(); sessionStorage.removeItem('ns_admin'); location.reload(); };
  if ('Notification' in window && Notification.permission === 'default') document.addEventListener('click', () => Notification.requestPermission(), { once: true });
}
function tab() {
  A.maps.forEach(m => m.remove()); A.maps = [];
  $$('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === A.tab));
  ({ orders: viewOrders, map: viewMap, customers: viewCustomers, menu: viewMenu, drivers: viewDrivers, settings: viewSettings })[A.tab]();
}

// ---------- orders board ----------
async function storeToggle() {
  const open = A.settings.store_open;
  return `<div class="toggle">Store is ${open ? 'OPEN' : 'CLOSED'} <button id="tgl" style="background:${open ? 'var(--lime)' : 'var(--ink)'};color:${open ? 'var(--ink)' : '#fff'}">${open ? 'Close store' : 'Open store'}</button></div>`;
}
async function viewOrders() {
  const s = await api('/api/admin/stats').catch(() => null);
  $('#main').innerHTML = `<div class="head"><h1>Live orders</h1>${await storeToggle()}</div>
    ${s ? `<div class="stats"><div class="stat"><small>Orders today</small><b>${s.today.orders}</b></div><div class="stat"><small>Revenue today</small><b>${R(s.today.revenue)}</b></div>
      <div class="stat"><small>Active now</small><b>${s.today.active || 0}</b></div><div class="stat"><small>Avg delivery (7d)</small><b>${s.avg_delivery_minutes ?? '—'}${s.avg_delivery_minutes ? ' min' : ''}</b></div>
      <div class="stat"><small>Revenue (7d)</small><b>${R(s.week.revenue)}</b></div><div class="stat"><small>Customers</small><b>${s.customers}</b><span class="muted" style="font-size:12px">${s.repeat} repeat</span></div></div>` : ''}
    <div class="board" id="board"></div>`;
  $('#tgl').onclick = async () => { A.settings = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ store_open: !A.settings.store_open }) }); viewOrders(); };
  renderBoard();
}
function renderBoard() {
  const b = $('#board'); if (!b) return;
  const cols = [['placed', 'New'], ['accepted', 'Accepted'], ['packed', 'Packed'], ['out_for_delivery', 'On the way'], ['done', 'Done today']];
  const all = [...A.orders.values()].sort((a, b) => b.id - a.id);
  const drvOpts = sel => `<option value="">${sel ? 'Unassign driver' : 'Assign driver…'}</option>` + A.drivers.filter(d => d.active).map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  b.innerHTML = cols.map(([k, l]) => {
    const list = all.filter(o => k === 'done' ? ['delivered', 'cancelled'].includes(o.status) : o.status === k);
    return `<div class="col"><h3>${l}<span>${list.length}</span></h3>${list.map(o => `
      <div class="oc ${A.fresh.has(o.id) ? 'new' : ''}" data-open="${o.id}">
        <div class="r"><span class="code">${esc(o.code)}</span><span class="ago">${ago(o.created_at)}</span></div>
        <div class="r" style="margin-top:4px"><b>${esc(o.customer.name)}</b><span>${R(o.total)}</span></div>
        <div class="r muted" style="font-size:13px"><span>${esc(o.suburb)}</span><span>${PAY[o.payment_method]}</span></div>
        <div class="items">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</div>
        ${['accepted', 'packed', 'out_for_delivery'].includes(o.status) ? `<div class="muted" style="font-size:12px">ETA ${o.eta_minutes} min${o.driver ? ' · 🛵 ' + esc(o.driver.name) : ''}</div>` : ''}
        ${o.status === 'delivered' ? `<div class="muted" style="font-size:12px">Delivered ${tm(o.delivered_at)}${o.id_checked ? ' · ID ✓' : ''}</div>` : ''}
        ${o.status === 'cancelled' ? `<div class="muted" style="font-size:12px">Cancelled ${tm(o.cancelled_at)}</div>` : ''}
        ${['accepted', 'packed'].includes(o.status) ? `<select data-assign="${o.id}">${drvOpts(o.driver_id)}</select>` : ''}
        <div class="acts">
          ${o.status === 'placed' ? `<button class="btn lime" data-st="accepted" data-id="${o.id}">Accept</button><button class="btn danger" data-st="cancelled" data-id="${o.id}">Reject</button>` : ''}
          ${o.status === 'accepted' ? `<button class="btn" data-st="packed" data-id="${o.id}">Mark packed</button>` : ''}
          ${o.status === 'packed' ? `<button class="btn lime" data-st="out_for_delivery" data-id="${o.id}" ${o.driver_id ? '' : 'disabled title="Assign a driver first"'}>Dispatch</button>` : ''}
          ${o.status === 'out_for_delivery' ? `<button class="btn ghost" data-st="delivered" data-id="${o.id}">Mark delivered</button>` : ''}
        </div></div>`).join('') || '<div class="muted" style="font-size:13px;padding:6px">Nothing here</div>'}</div>`;
  }).join('');
  $$('[data-open]', b).forEach(el => el.onclick = e => { if (e.target.closest('button,select')) return; A.fresh.delete(+el.dataset.open); orderDrawer(+el.dataset.open); });
  $$('[data-st]', b).forEach(btn => btn.onclick = () => setStatus(+btn.dataset.id, btn.dataset.st));
  $$('[data-assign]', b).forEach(sel => sel.onchange = async () => { try { upsert(await api(`/api/admin/orders/${sel.dataset.assign}/assign`, { method: 'POST', body: JSON.stringify({ driver_id: sel.value ? +sel.value : null }) })); } catch (e) { toast(e.message); } });
}
async function setStatus(id, status) {
  let reason;
  if (status === 'cancelled') { reason = prompt('Reason for cancelling (shown to customer):', 'Sorry, we can’t fulfil this order right now.'); if (reason === null) return; }
  if (status === 'delivered' && !confirm('Mark as delivered? Only do this if the ID was checked.')) return;
  try { A.fresh.delete(id); upsert(await api(`/api/admin/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) })); } catch (e) { toast(e.message); }
}
function upsert(o) { A.orders.set(o.id, o); updateBadge(); if (A.tab === 'orders') renderBoard(); if (A.drawerOrder === o.id) orderDrawer(o.id); }

function drawer(html) {
  closeDrawer();
  const w = document.createElement('div'); w.className = 'drawer-wrap'; w.id = 'dw'; w.innerHTML = `<div class="drawer">${html}</div>`;
  w.onclick = e => { if (e.target === w) closeDrawer(); }; document.body.append(w); return $('.drawer', w);
}
function closeDrawer() { $('#dw')?.remove(); A.drawerOrder = null; A.drawerMap?.remove(); A.drawerMap = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

function orderDrawer(id) {
  const o = A.orders.get(id); if (!o) return;
  const keepScroll = $('#dw .drawer')?.scrollTop;
  const d = drawer(`<div class="r" style="display:flex;justify-content:space-between;align-items:center"><h2>${esc(o.code)}</h2><span class="st ${o.status}">${LABEL[o.status]}</span></div>
    <div class="muted">Placed ${dt(o.created_at)}</div>
    <div class="kv"><span>Customer</span><a href="#" id="toCust"><b>${esc(o.customer.name)}</b></a><span>Phone</span><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a>
      <span>Address</span><div>${esc(o.address)}<br>${esc(o.suburb)}</div>${o.notes ? `<span>Notes</span><div>${esc(o.notes)}</div>` : ''}
      <span>Payment</span><div>${PAY[o.payment_method]} · <b>${R(o.total)}</b></div><span>Driver</span><div>${o.driver ? esc(o.driver.name) : '—'}</div>
      ${['accepted', 'packed', 'out_for_delivery'].includes(o.status) ? `<span>ETA</span><div>${o.eta_minutes} min</div>` : ''}
      ${o.cancel_reason ? `<span>Cancel reason</span><div>${esc(o.cancel_reason)}</div>` : ''}${o.status === 'delivered' ? `<span>ID checked</span><div>${o.id_checked ? 'Yes' : 'Not recorded'}</div>` : ''}</div>
    <div class="minimap" id="mm"></div>
    <table><tr><th>Item</th><th>Qty</th><th style="text-align:right">Total</th></tr>${o.items.map(i => `<tr><td><b>${esc(i.name)}</b><br><span class="muted">${esc(i.options.join(' · '))}</span></td><td>${i.qty}</td><td style="text-align:right">${R(i.line_total)}</td></tr>`).join('')}
    <tr><td colspan="2">Delivery</td><td style="text-align:right">${R(o.delivery_fee)}</td></tr><tr><td colspan="2"><b>Total</b></td><td style="text-align:right"><b>${R(o.total)}</b></td></tr></table>
    <h3>Timeline</h3><ul class="tl">${[['Placed', o.created_at], ['Accepted', o.accepted_at], ['Packed', o.packed_at], ['Out for delivery', o.dispatched_at], ['Delivered', o.delivered_at], ['Cancelled', o.cancelled_at]].filter(x => x[1]).map(([l, t]) => `<li><span>${l}</span><span>${dt(t)}</span></li>`).join('')}</ul>
    <div style="display:flex;gap:8px;margin-top:16px">${!['delivered', 'cancelled'].includes(o.status) ? `<button class="btn danger" id="cxl">Cancel order</button>` : ''}<button class="btn ghost" id="cls">Close</button></div>`);
  A.drawerOrder = id;
  if (keepScroll) d.scrollTop = keepScroll;
  $('#cls', d).onclick = closeDrawer;
  $('#cxl', d) && ($('#cxl', d).onclick = () => setStatus(id, 'cancelled'));
  $('#toCust', d).onclick = e => { e.preventDefault(); customerDrawer(o.customer.id); };
  const m = L.map($('#mm', d), { zoomControl: false }).setView([o.lat, o.lng], 14); A.drawerMap = m;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(m);
  L.marker([o.lat, o.lng], { icon: L.divIcon({ className: '', html: '<div class="opin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).addTo(m);
  if (o.driver?.lat != null) { L.marker([o.driver.lat, o.driver.lng], { icon: L.divIcon({ className: '', html: '<div class="dpin">🛵</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(m); m.fitBounds([[o.lat, o.lng], [o.driver.lat, o.driver.lng]], { padding: [30, 30] }); }
}

// ---------- live map ----------
function viewMap() {
  $('#main').innerHTML = `<div class="head"><h1>Live map</h1><span class="muted">Drivers update every few seconds while on a trip</span></div><div id="bigmap"></div>`;
  const m = L.map('bigmap').setView([A.settings.base.lat, A.settings.base.lng], 12); A.maps.push(m); A.bigmap = m; A.layer = L.layerGroup().addTo(m);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  drawMap();
}
function drawMap() {
  if (A.tab !== 'map' || !A.layer) return;
  A.layer.clearLayers();
  L.circleMarker([A.settings.base.lat, A.settings.base.lng], { radius: 8, color: '#0B1410', fillColor: '#C6FF3D', fillOpacity: 1 }).bindTooltip('Dispatch').addTo(A.layer);
  for (const o of A.orders.values()) if (!['delivered', 'cancelled'].includes(o.status))
    L.marker([o.lat, o.lng], { icon: L.divIcon({ className: '', html: '<div class="opin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).bindTooltip(`${esc(o.code)} · ${esc(o.customer.name)} · ${LABEL[o.status]}`).on('click', () => orderDrawer(o.id)).addTo(A.layer);
  for (const d of A.drivers) if (d.lat != null && d.active)
    L.marker([d.lat, d.lng], { icon: L.divIcon({ className: '', html: '<div class="dpin">🛵</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindTooltip(`${esc(d.name)} · ${ago(d.loc_at)}`).addTo(A.layer);
}

// ---------- customers (CRM) ----------
async function viewCustomers(q = '') {
  $('#main').innerHTML = `<div class="head"><h1>Customers</h1><input class="input" id="cq" placeholder="Search name, phone, suburb, tag" style="max-width:320px" value="${esc(q)}">
    <button class="btn ghost sm" id="xc">Export customers CSV</button><button class="btn ghost sm" id="xo">Export orders CSV</button></div><div class="panel" id="ct">Loading…</div>`;
  const rows = await api('/api/admin/customers?q=' + encodeURIComponent(q));
  $('#ct').innerHTML = rows.length ? `<table><tr><th>Name</th><th>Phone</th><th>Suburb</th><th>Orders</th><th>Spent</th><th>Last order</th><th>Tags</th></tr>
    ${rows.map(c => `<tr class="click" data-c="${c.id}"><td><b>${esc(c.name)}</b></td><td>${esc(c.phone)}</td><td>${esc(c.suburb)}</td><td>${c.orders}</td><td>${R(c.spent)}</td><td>${dt(c.last_order)}</td><td>${esc(c.tags)}</td></tr>`).join('')}</table>` : '<div class="muted">No customers yet.</div>';
  $$('[data-c]').forEach(r => r.onclick = () => customerDrawer(+r.dataset.c));
  let t; $('#cq').oninput = e => { clearTimeout(t); t = setTimeout(() => viewCustomers(e.target.value).then(() => { const i = $('#cq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 300); };
  $('#xc').onclick = () => download('/api/admin/export/customers.csv', 'customers.csv');
  $('#xo').onclick = () => download('/api/admin/export/orders.csv', 'orders.csv');
}
async function download(url, name) {
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + A.token } }); const b = await r.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
async function customerDrawer(id) {
  const c = await api('/api/admin/customers/' + id);
  const done = c.orders.filter(o => o.status === 'delivered'), spent = done.reduce((t, o) => t + o.total, 0);
  const ageY = (() => { const d = new Date(c.dob); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; })();
  const d = drawer(`<h2>${esc(c.name)}</h2><div class="muted">Customer since ${dt(c.created_at)}</div>
    <div class="stats" style="margin-top:14px"><div class="stat"><small>Orders</small><b>${c.orders.length}</b></div><div class="stat"><small>Spent</small><b>${R(spent)}</b></div><div class="stat"><small>Avg order</small><b>${R(done.length ? Math.round(spent / done.length) : 0)}</b></div></div>
    <div class="kv"><span>Phone</span><div><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> · <a target="_blank" rel="noopener" href="https://wa.me/27${esc(c.phone.slice(1))}">WhatsApp</a></div>
      <span>Email</span><div>${esc(c.email) || '—'}</div><span>Age</span><div>${ageY} (DOB ${esc(c.dob)})</div><span>Address</span><div>${esc(c.address)}<br>${esc(c.suburb)}</div></div>
    <div class="field"><label>Tags (comma separated)</label><input class="input" id="tags" value="${esc(c.tags)}" placeholder="VIP, regular, prefers EFT"></div>
    <div class="field"><label>Notes</label><textarea class="input" id="notes" rows="4">${esc(c.notes)}</textarea></div>
    <button class="btn" id="sv">Save notes</button>
    <h3 style="margin-top:22px">Order history</h3>
    <table>${c.orders.map(o => `<tr class="click" data-o="${o.id}"><td>${esc(o.code)}</td><td>${dt(o.created_at)}</td><td><span class="st ${o.status}">${LABEL[o.status]}</span></td><td style="text-align:right">${R(o.total)}</td></tr>`).join('') || '<tr><td class="muted">No orders</td></tr>'}</table>
    <h3 style="margin-top:22px">Activity</h3><ul class="tl">${c.events.map(e => `<li><span>${esc(e.type.replace('.', ' · ').replace(/_/g, ' '))}</span><span>${dt(e.at)}</span></li>`).join('')}</ul>`);
  $('#sv', d).onclick = async () => { await api('/api/admin/customers/' + id, { method: 'PATCH', body: JSON.stringify({ tags: $('#tags', d).value, notes: $('#notes', d).value }) }); toast('Saved'); if (A.tab === 'customers') viewCustomers($('#cq')?.value || ''); };
  $$('[data-o]', d).forEach(r => r.onclick = () => { const o = c.orders.find(x => x.id === +r.dataset.o); A.orders.set(o.id, A.orders.get(o.id) || o); orderDrawer(o.id); });
}

// ---------- menu ----------
async function viewMenu() {
  const ps = await api('/api/admin/products');
  const price = p => { const req = p.options.filter(o => o.required && o.type === 'single'); const ps2 = req.length ? req[0].choices.map(c => c.price + p.base_price) : [p.base_price]; const lo = Math.min(...ps2), hi = Math.max(...ps2); return lo === hi ? R(lo) : `${R(lo)} – ${R(hi)}`; };
  $('#main').innerHTML = `<div class="head"><h1>Menu & prices</h1><button class="btn lime" id="np">+ Add product</button></div>
    <div class="panel"><table><tr><th>Product</th><th>Category</th><th>Price</th><th>Live</th><th></th></tr>
    ${ps.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.badge)} ${esc(p.strength)}</span></td><td>${esc(p.category)}</td><td>${price(p)}</td>
      <td><input type="checkbox" data-live="${p.id}" ${p.active ? 'checked' : ''} style="width:20px;height:20px;accent-color:#0B1410"></td><td><button class="btn ghost sm" data-ed="${p.id}">Edit</button></td></tr>`).join('')}</table></div>`;
  $('#np').onclick = () => productDrawer({ category: 'Flower', name: '', description: '', badge: '', strength: '', image: '', base_price: 0, options: [{ name: 'Size', type: 'single', required: true, choices: [{ label: '1g', price: 100 }] }], active: 1, sort: ps.length });
  $$('[data-ed]').forEach(b => b.onclick = () => productDrawer(ps.find(p => p.id === +b.dataset.ed)));
  $$('[data-live]').forEach(cb => cb.onchange = async () => { const p = ps.find(x => x.id === +cb.dataset.live); p.active = cb.checked ? 1 : 0; await api('/api/admin/products/' + p.id, { method: 'PUT', body: JSON.stringify(p) }); toast(cb.checked ? 'Now live on the store' : 'Hidden from the store'); });
}
function productDrawer(p) {
  const P = JSON.parse(JSON.stringify(p));
  const d = drawer('');
  const render = () => {
    d.innerHTML = `<h2>${P.id ? 'Edit product' : 'New product'}</h2>
      <div class="field"><label>Name</label><input class="input" data-f="name" value="${esc(P.name)}"></div>
      <div class="field"><label>Category</label><input class="input" data-f="category" list="cats" value="${esc(P.category)}"><datalist id="cats"><option>Flower<option>Pre-rolls<option>Edibles<option>Accessories</datalist></div>
      <div class="field"><label>Description</label><textarea class="input" data-f="description" rows="2">${esc(P.description)}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label>Badge</label><input class="input" data-f="badge" value="${esc(P.badge)}" placeholder="Sativa"></div><div class="field"><label>Strength / info</label><input class="input" data-f="strength" value="${esc(P.strength)}" placeholder="THC 20%"></div></div>
      <div class="field"><label>Photo URL (optional, https)</label><input class="input" data-f="image" value="${esc(P.image)}"></div>
      <div class="field"><label>Base price (R), added to option prices</label><input class="input" type="number" data-f="base_price" value="${P.base_price}"></div>
      <h3>Options</h3><p class="muted" style="font-size:13px">E.g. Size with 1g / 3.5g / 7g prices. "Single" = pick one; "Multi" = add-ons.</p>
      ${P.options.map((o, oi) => `<div class="optbox"><div style="display:grid;grid-template-columns:1fr 110px 110px 36px;gap:6px;margin-bottom:8px">
          <input class="input" data-on="${oi}" value="${esc(o.name)}" placeholder="Option name">
          <select class="input" data-ot="${oi}"><option value="single" ${o.type === 'single' ? 'selected' : ''}>Single</option><option value="multi" ${o.type === 'multi' ? 'selected' : ''}>Multi</option></select>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" data-or="${oi}" ${o.required ? 'checked' : ''}>Required</label>
          <button class="btn ghost sm" data-odel="${oi}">✕</button></div>
        ${o.choices.map((c, ci) => `<div class="choicerow"><input class="input" data-cl="${oi}.${ci}" value="${esc(c.label)}" placeholder="Choice"><input class="input" type="number" data-cp="${oi}.${ci}" value="${c.price}" placeholder="R"><button class="btn ghost sm" data-cdel="${oi}.${ci}">✕</button></div>`).join('')}
        <button class="btn ghost sm" data-cadd="${oi}">+ Choice</button></div>`).join('')}
      <button class="btn ghost sm" id="oadd">+ Add option group</button>
      <div class="error hidden" id="perr"></div>
      <div style="display:flex;gap:8px;margin-top:20px"><button class="btn lime" id="psv">Save</button><button class="btn ghost" id="pcl">Cancel</button></div>`;
    $$('[data-f]', d).forEach(i => i.oninput = () => P[i.dataset.f] = i.type === 'number' ? Number(i.value) : i.value);
    $$('[data-on]', d).forEach(i => i.oninput = () => P.options[i.dataset.on].name = i.value);
    $$('[data-ot]', d).forEach(i => i.onchange = () => P.options[i.dataset.ot].type = i.value);
    $$('[data-or]', d).forEach(i => i.onchange = () => P.options[i.dataset.or].required = i.checked);
    $$('[data-cl]', d).forEach(i => i.oninput = () => { const [a, b] = i.dataset.cl.split('.'); P.options[a].choices[b].label = i.value; });
    $$('[data-cp]', d).forEach(i => i.oninput = () => { const [a, b] = i.dataset.cp.split('.'); P.options[a].choices[b].price = Number(i.value); });
    $$('[data-odel]', d).forEach(b => b.onclick = () => { P.options.splice(+b.dataset.odel, 1); render(); });
    $$('[data-cdel]', d).forEach(b => b.onclick = () => { const [a, c] = b.dataset.cdel.split('.'); P.options[a].choices.splice(+c, 1); render(); });
    $$('[data-cadd]', d).forEach(b => b.onclick = () => { P.options[b.dataset.cadd].choices.push({ label: '', price: 0 }); render(); });
    $('#oadd', d).onclick = () => { P.options.push({ name: '', type: 'single', required: true, choices: [{ label: '', price: 0 }] }); render(); };
    $('#pcl', d).onclick = closeDrawer;
    $('#psv', d).onclick = async () => {
      try { await api('/api/admin/products' + (P.id ? '/' + P.id : ''), { method: P.id ? 'PUT' : 'POST', body: JSON.stringify(P) }); closeDrawer(); toast('Saved'); viewMenu(); }
      catch (e) { $('#perr', d).textContent = e.message; $('#perr', d).classList.remove('hidden'); }
    };
  };
  render();
}

// ---------- drivers ----------
async function viewDrivers() {
  A.drivers = await api('/api/admin/drivers');
  $('#main').innerHTML = `<div class="head"><h1>Drivers</h1></div>
    <div class="panel"><h3 style="margin-top:0">Add driver</h3><div style="display:grid;grid-template-columns:1fr 1fr 140px auto;gap:8px">
      <input class="input" id="dn" placeholder="Full name"><input class="input" id="dp" placeholder="Mobile number"><input class="input" id="dpin" placeholder="PIN (4–8 digits)" inputmode="numeric"><button class="btn" id="dadd">Add</button></div>
      <p class="muted" style="font-size:13px;margin-bottom:0">Drivers log in at <b>${location.origin}/driver</b> with their mobile number and PIN.</p></div>
    <div class="panel"><table><tr><th>Name</th><th>Phone</th><th>Last location</th><th>Active</th><th></th></tr>
    ${A.drivers.map(d => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.phone)}</td><td>${d.loc_at ? ago(d.loc_at) : '—'}</td><td><input type="checkbox" data-da="${d.id}" ${d.active ? 'checked' : ''} style="width:20px;height:20px;accent-color:#0B1410"></td><td><button class="btn ghost sm" data-rp="${d.id}">Reset PIN</button></td></tr>`).join('') || '<tr><td class="muted">No drivers yet</td></tr>'}</table></div>`;
  $('#dadd').onclick = async () => { try { await api('/api/admin/drivers', { method: 'POST', body: JSON.stringify({ name: $('#dn').value, phone: $('#dp').value, pin: $('#dpin').value }) }); toast('Driver added'); viewDrivers(); } catch (e) { toast(e.message); } };
  $$('[data-da]').forEach(cb => cb.onchange = () => api('/api/admin/drivers/' + cb.dataset.da, { method: 'PATCH', body: JSON.stringify({ active: cb.checked }) }).then(viewDrivers));
  $$('[data-rp]').forEach(b => b.onclick = async () => { const pin = prompt('New PIN (4–8 digits):'); if (!pin) return; try { await api('/api/admin/drivers/' + b.dataset.rp, { method: 'PATCH', body: JSON.stringify({ pin }) }); toast('PIN updated'); } catch (e) { toast(e.message); } });
}

// ---------- settings ----------
async function viewSettings() {
  const s = A.settings = await api('/api/admin/settings');
  $('#main').innerHTML = `<div class="head"><h1>Settings</h1></div>
    <div class="panel"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      ${[['store_name', 'Store name', 'text'], ['min_order', 'Minimum order (R)', 'number'], ['free_delivery_over', 'Free delivery over (R)', 'number'], ['prep_minutes', 'Prep time (min)', 'number'], ['avg_speed_kmh', 'Avg driving speed (km/h, for ETA)', 'number'], ['max_radius_km', 'Max delivery radius (km)', 'number'], ['whatsapp', 'Support WhatsApp number', 'text']]
      .map(([k, l, t]) => `<div class="field"><label>${l}</label><input class="input" type="${t}" data-s="${k}" value="${esc(s[k])}"></div>`).join('')}</div>
      <div class="field"><label>CRM webhook URL (optional, https). Every order event is POSTed here as JSON, e.g. a Zapier, Make or HubSpot webhook.</label><input class="input" data-s="webhook_url" value="${esc(s.webhook_url)}" placeholder="https://hooks.zapier.com/..."></div></div>
    <div class="panel"><h3 style="margin-top:0">Delivery zones</h3><table id="zt"><tr><th>Suburb</th><th>Fee (R)</th><th>Lat</th><th>Lng</th><th></th></tr>
      ${s.zones.map((z, i) => `<tr><td><input class="input" data-z="${i}.name" value="${esc(z.name)}"></td><td><input class="input" type="number" data-z="${i}.fee" value="${z.fee}"></td><td><input class="input" type="number" step="0.0001" data-z="${i}.lat" value="${z.lat}"></td><td><input class="input" type="number" step="0.0001" data-z="${i}.lng" value="${z.lng}"></td><td><button class="btn ghost sm" data-zd="${i}">✕</button></td></tr>`).join('')}</table>
      <button class="btn ghost sm" id="za" style="margin-top:8px">+ Add suburb</button></div>
    <button class="btn lime" id="ssv">Save settings</button>`;
  $$('[data-z]').forEach(i => i.oninput = () => { const [a, k] = i.dataset.z.split('.'); s.zones[a][k] = k === 'name' ? i.value : Number(i.value); });
  $$('[data-zd]').forEach(b => b.onclick = () => { s.zones.splice(+b.dataset.zd, 1); A.settings = s; saveSettings(s).then(viewSettings); });
  $('#za').onclick = () => { s.zones.push({ name: 'New suburb', fee: 50, lat: s.base.lat, lng: s.base.lng }); saveSettings(s).then(viewSettings); };
  $('#ssv').onclick = () => saveSettings(s).then(() => toast('Settings saved')).catch(e => toast(e.message));
}
async function saveSettings(s) {
  const body = { zones: s.zones };
  $$('[data-s]').forEach(i => body[i.dataset.s] = i.type === 'number' ? Number(i.value) : i.value);
  A.settings = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) });
}

// ---------- realtime ----------
function connect() {
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?auth=' + encodeURIComponent(A.token));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'order') {
      const isNew = !A.orders.has(m.order.id) && m.order.status === 'placed';
      if (isNew) { A.fresh.add(m.order.id); notifyNew(m.order); toast(`New order ${m.order.code} · ${R(m.order.total)}`); }
      upsert(m.order); drawMap();
    } else if (m.type === 'driver') { const i = A.drivers.findIndex(d => d.id === m.driver.id); i >= 0 ? A.drivers[i] = m.driver : A.drivers.push(m.driver); drawMap(); }
    else if (m.type === 'eta') { const o = A.orders.get(m.id); if (o) { o.eta_minutes = m.eta_minutes; if (A.tab === 'orders') renderBoard(); } }
  };
  ws.onclose = e => { if (e.code !== 4001) setTimeout(connect, 3000); };
}

(async function init() {
  if (!A.token) return login();
  try {
    shell();
    const [orders, drivers, settings] = await Promise.all([api('/api/admin/orders'), api('/api/admin/drivers'), api('/api/admin/settings')]);
    orders.forEach(o => A.orders.set(o.id, o)); A.drivers = drivers; A.settings = settings;
    updateBadge(); tab(); connect();
    setInterval(() => { if (A.tab === 'orders') renderBoard(); }, 60000); // refresh "x min ago"
  } catch (e) { if (A.token) document.body.innerHTML = `<div class="login">${esc(e.message)}</div>`; }
})();
