// Northside customer store
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = n => 'R' + Number(n).toLocaleString('en-ZA');
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2600); }

const S = { config: null, menu: [], cart: store.get('ns_cart', []), suburb: store.get('ns_suburb', ''), cat: 'All', maps: [] };
const saveCart = () => { store.set('ns_cart', S.cart); renderCartBar(); };

// ---------- art ----------
const ART = {
  Flower: { bg: 'linear-gradient(135deg,#1E3A2B,#0B1410)', svg: '<svg viewBox="-60 -70 120 120"><g fill="#C6FF3D">' + [[-90, 1], [-58, .86], [-122, .86], [-28, .64], [-152, .64], [4, .36], [176, .36]].map(([a, l]) => `<ellipse rx="${28 * l}" ry="${6 * l}" cx="${28 * l}" transform="rotate(${a})"/>`).join('') + '<rect x="-2" y="0" width="4" height="22"/></g></svg>' },
  'Pre-rolls': { bg: 'linear-gradient(135deg,#C6FF3D,#9BD11B)', svg: '<svg viewBox="0 0 100 100"><g transform="rotate(30 50 50)"><path d="M42 84h16l8-62H34z" fill="#F6F4EC" stroke="#0B1410" stroke-width="3"/><rect x="41" y="72" width="18" height="12" fill="#0B1410"/><path d="M34 22q16-10 32 0" fill="#F6F4EC" stroke="#0B1410" stroke-width="3"/></g></svg>' },
  Edibles: { bg: 'linear-gradient(135deg,#FFE3D3,#FFC7A8)', svg: '<svg viewBox="0 0 100 100"><rect x="14" y="44" width="34" height="34" rx="10" fill="#FF6A2B" transform="rotate(-12 31 61)"/><rect x="40" y="22" width="34" height="34" rx="10" fill="#C6FF3D" transform="rotate(10 57 39)"/><rect x="52" y="52" width="34" height="34" rx="10" fill="#0B1410" transform="rotate(-4 69 69)"/></svg>' },
  Accessories: { bg: 'linear-gradient(135deg,#ECEEE8,#D7DBD2)', svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#0B1410"/><circle cx="50" cy="50" r="20" fill="none" stroke="#C6FF3D" stroke-width="4" stroke-dasharray="6 5"/><circle cx="50" cy="50" r="6" fill="#C6FF3D"/></svg>' },
};
const art = p => ART[p.category] || ART.Accessories;
function thumb(p, cls = 'thumb', extra = '') {
  const a = art(p);
  const style = p.image && /^https:\/\//.test(p.image) ? `background-image:url('${encodeURI(p.image)}')` : `background:${a.bg}`;
  return `<div class="${cls}" style="${style}">${p.image ? '' : a.svg}${extra}</div>`;
}
const fromPrice = p => {
  let min = p.base_price;
  for (const o of p.options) if (o.required && o.type === 'single') min += Math.min(...o.choices.map(c => c.price));
  return min;
};
const hasPriceRange = p => p.options.some(o => o.required && new Set(o.choices.map(c => c.price)).size > 1);

// ---------- pricing in the browser (display only; server re-prices) ----------
function linePrice(p, sel) {
  let unit = p.base_price;
  for (const o of p.options) [].concat(sel[o.name] || []).forEach(l => { const c = o.choices.find(c => c.label === l); if (c) unit += c.price; });
  return unit;
}
function cartLines() {
  return S.cart.map(l => { const p = S.menu.find(m => m.id === l.product_id); return p ? { ...l, p, unit: linePrice(p, l.selections) } : null; }).filter(Boolean);
}
function totals() {
  const lines = cartLines();
  const sub = lines.reduce((t, l) => t + l.unit * l.qty, 0);
  const zone = S.config.zones.find(z => z.name === S.suburb);
  const fee = !zone ? null : sub >= S.config.free_delivery_over ? 0 : zone.fee;
  return { lines, sub, fee, total: sub + (fee || 0) };
}

// ---------- age gate ----------
function age(dob) { const d = new Date(dob + 'T00:00:00'); if (isNaN(d)) return -1; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return a; }
function gate() {
  if (store.get('ns_age_ok', false)) return;
  $('#gate').classList.remove('hidden');
  $('#gateDob').max = new Date().toISOString().slice(0, 10);
  $('#gateYes').onclick = () => {
    const dob = $('#gateDob').value, a = age(dob), err = $('#gateErr');
    if (!dob || a < 0) { err.textContent = 'Please enter your date of birth.'; err.classList.remove('hidden'); return; }
    if (a < 18) { err.textContent = 'Sorry, you must be 18 or older to use Northside.'; err.classList.remove('hidden'); return; }
    store.set('ns_age_ok', true); store.set('ns_dob', dob); $('#gate').classList.add('hidden');
  };
  $('#gateNo').onclick = () => { $('#gateErr').textContent = 'Sorry, you must be 18 or older to use Northside.'; $('#gateErr').classList.remove('hidden'); };
}

// ---------- sheets ----------
function openSheet(html, onMount) { $('#sheet').innerHTML = html; $('#sheetWrap').classList.remove('hidden'); document.body.style.overflow = 'hidden'; onMount && onMount($('#sheet')); }
function closeSheet() { $('#sheetWrap').classList.add('hidden'); document.body.style.overflow = ''; }
$('#sheetWrap').addEventListener('click', e => { if (e.target.id === 'sheetWrap') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function suburbSheet(then) {
  openSheet(`<div class="body"><h2>Where should we deliver?</h2><p class="muted">We deliver across the Northern Suburbs.</p>
    ${S.config.zones.map(z => `<label class="choice"><input type="radio" name="sub" value="${esc(z.name)}" ${z.name === S.suburb ? 'checked' : ''}><span>${esc(z.name)}</span><b>${R(z.fee)} delivery</b></label>`).join('')}
    <button class="btn block" id="subOk" style="margin-top:12px">Save</button></div>`, el => {
    $('#subOk', el).onclick = () => { const v = $('input[name=sub]:checked', el)?.value; if (!v) return toast('Pick a suburb'); S.suburb = v; store.set('ns_suburb', v); $('#suburbLabel').textContent = v; closeSheet(); then ? then() : route(); };
  });
}
$('#deliverTo').onclick = () => suburbSheet();

function productSheet(p, editIndex = null) {
  const existing = editIndex != null ? S.cart[editIndex] : null;
  const sel = existing ? JSON.parse(JSON.stringify(existing.selections)) : {};
  if (!existing) p.options.forEach(o => { if (o.required && o.type === 'single') sel[o.name] = [o.choices[0].label]; });
  let qty = existing ? existing.qty : 1;
  openSheet(`${thumb(p, 'hero-img', '<button class="close" aria-label="Close">×</button>')}
    <div class="body"><div class="tags">${p.badge ? `<span class="chip lime">${esc(p.badge)}</span>` : ''}${p.strength ? `<span class="chip">${esc(p.strength)}</span>` : ''}</div>
    <h2 style="margin-top:10px">${esc(p.name)}</h2><p class="muted">${esc(p.description)}</p></div>
    ${p.options.map((o, oi) => `<div class="opt"><div class="opt-head"><b>${esc(o.name)}</b><span class="chip ${o.required ? 'dark' : ''}">${o.required ? 'Required' : 'Optional'}</span></div>
      ${o.choices.map((c, ci) => `<label class="choice"><input type="${o.type === 'single' ? 'radio' : 'checkbox'}" name="o${oi}" data-o="${oi}" data-c="${ci}" ${[].concat(sel[o.name] || []).includes(c.label) ? 'checked' : ''}><span>${esc(c.label)}</span><b>${c.price ? (o.type === 'multi' || !o.required ? '+' : '') + R(c.price) : ''}</b></label>`).join('')}</div>`).join('')}
    <div class="sheet-foot"><div class="stepper"><button id="qm" aria-label="Less">−</button><b id="qn">${qty}</b><button id="qp" aria-label="More">+</button></div>
    <button class="btn block" id="addBtn"></button></div>`, el => {
    const upd = () => { $('#qn', el).textContent = qty; $('#addBtn', el).textContent = `${existing ? 'Update' : 'Add to cart'} · ${R(linePrice(p, sel) * qty)}`; };
    el.querySelectorAll('input[data-o]').forEach(inp => inp.onchange = () => {
      const o = p.options[inp.dataset.o], c = o.choices[inp.dataset.c];
      if (o.type === 'single') sel[o.name] = [c.label];
      else { const cur = new Set(sel[o.name] || []); inp.checked ? cur.add(c.label) : cur.delete(c.label); sel[o.name] = [...cur]; }
      upd();
    });
    $('#qm', el).onclick = () => { qty = Math.max(1, qty - 1); upd(); };
    $('#qp', el).onclick = () => { qty = Math.min(20, qty + 1); upd(); };
    $('.close', el).onclick = closeSheet;
    $('#addBtn', el).onclick = () => {
      const line = { product_id: p.id, selections: sel, qty };
      if (existing) S.cart[editIndex] = line;
      else { const key = JSON.stringify([p.id, sel]); const same = S.cart.find(l => JSON.stringify([l.product_id, l.selections]) === key); same ? same.qty = Math.min(20, same.qty + qty) : S.cart.push(line); }
      saveCart(); closeSheet(); toast(existing ? 'Cart updated' : `Added ${p.name}`);
    };
    upd();
  });
}

function cartSheet() {
  const t = totals();
  if (!t.lines.length) { closeSheet(); return; }
  const min = S.config.min_order, short = Math.max(0, min - t.sub);
  openSheet(`<div class="body"><h2>Your cart</h2>
    ${t.lines.map((l, i) => `<div class="cart-line"><div class="info"><b>${l.qty}× ${esc(l.p.name)}</b><small>${esc(Object.values(l.selections).flat().join(' · '))}</small>
      <button class="btn ghost sm" data-edit="${i}" style="margin-top:6px">Edit</button></div><b>${R(l.unit * l.qty)}</b>
      <button class="btn ghost sm" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('')}
    <div class="totals"><div><span>Subtotal</span><b>${R(t.sub)}</b></div>
      <div><span>Delivery${S.suburb ? ' · ' + esc(S.suburb) : ''}</span><b>${t.fee == null ? 'Choose suburb' : t.fee === 0 ? 'Free' : R(t.fee)}</b></div>
      ${t.fee ? `<div class="muted" style="font-size:13px"><span>Free delivery over ${R(S.config.free_delivery_over)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${R(t.total)}</span></div></div>
    ${short ? `<div class="error">Add ${R(short)} more to reach the ${R(min)} minimum.</div>` : ''}
    <button class="btn block lime" id="goCheckout" ${short || !S.config.store_open ? 'disabled' : ''}>${S.config.store_open ? 'Go to checkout' : 'Store closed'}</button>
    <button class="btn block ghost" style="margin-top:8px" id="keep">Keep shopping</button></div>`, el => {
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.cart.splice(+b.dataset.rm, 1); saveCart(); cartSheet(); });
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const l = S.cart[+b.dataset.edit]; productSheet(S.menu.find(m => m.id === l.product_id), +b.dataset.edit); });
    $('#keep', el).onclick = closeSheet;
    $('#goCheckout', el).onclick = () => { closeSheet(); if (!S.suburb) return suburbSheet(() => location.hash = '#/checkout'); location.hash = '#/checkout'; };
  });
}
$('#openCart').onclick = cartSheet;
function renderCartBar() {
  const onShop = !location.hash || location.hash === '#/' || location.hash === '#';
  const lines = S.menu.length ? cartLines() : [];
  const n = lines.reduce((t, l) => t + l.qty, 0);
  $('#cartBar').classList.toggle('hidden', !n || !onShop);
  $('#cartCount').textContent = n;
  $('#cartTotal').textContent = R(lines.reduce((t, l) => t + l.unit * l.qty, 0));
}

// ---------- views ----------
function clearMaps() { S.maps.forEach(m => m.remove()); S.maps = []; if (S.ws) { S.ws.onclose = null; S.ws.close(); S.ws = null; } clearInterval(S.poll); }
function viewMenu() {
  const cats = ['All', ...new Set(S.menu.map(p => p.category))];
  const groups = cats.slice(1).filter(c => S.cat === 'All' || S.cat === c);
  $('#view').innerHTML = `
    <section class="hero"><span class="chip lime">Northern Suburbs delivery</span>
      <h1>The spot<br><em>comes to you.</em></h1><p>Top-shelf flower, pre-rolls and edibles, delivered discreetly.</p>
      <div class="meta"><span class="chip">⏱ ~${S.config.prep_minutes + 15}–${S.config.prep_minutes + 35} min</span><span class="chip">Free delivery over ${R(S.config.free_delivery_over)}</span><span class="chip">18+ · ID on delivery</span></div></section>
    ${S.config.store_open ? '' : '<div class="closed">We’re closed right now. You can browse the menu, and ordering opens again soon.</div>'}
    <nav class="cats">${cats.map(c => `<button class="${c === S.cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</nav>
    ${groups.map(c => `<h2 class="sec-title">${esc(c)}</h2><div class="grid">${S.menu.filter(p => p.category === c).map(p => `
      <button class="item" data-id="${p.id}"><div class="info"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>
      <div class="tags">${p.badge ? `<span class="chip">${esc(p.badge)}</span>` : ''}${p.strength ? `<span class="chip">${esc(p.strength)}</span>` : ''}</div>
      <span class="price">${hasPriceRange(p) ? 'from ' : ''}${R(fromPrice(p))}</span></div>${thumb(p, 'thumb', '<span class="add">+</span>')}</button>`).join('')}</div>`).join('')}
    <p class="legal">18+ only. For private adult use. ID is checked on every delivery.<br>Don’t drive or operate machinery under the influence. Keep out of reach of children and pets.<br>Know your local laws.</p>`;
  document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { S.cat = b.dataset.cat; viewMenu(); });
  document.querySelectorAll('.item').forEach(b => b.onclick = () => productSheet(S.menu.find(p => p.id === +b.dataset.id)));
}

function viewCheckout() {
  const t = totals();
  if (!t.lines.length) { location.hash = '#/'; return; }
  const me = store.get('ns_me', {}), zone = S.config.zones.find(z => z.name === S.suburb) || S.config.zones[0];
  $('#view').innerHTML = `<div class="page"><a href="#/" class="muted">← Back to menu</a><h1>Checkout</h1>
    <form id="co" novalidate>
    <div class="card"><h2>Delivery address</h2>
      <div class="field"><label for="suburb">Suburb</label><select class="input" id="suburb">${S.config.zones.map(z => `<option ${z.name === zone.name ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="line">Street address</label><input class="input" id="line" autocomplete="street-address" placeholder="12 Example Street, unit 4" value="${esc(me.line || '')}"></div>
      <label class="muted" style="font-size:13px;font-weight:600">Drag the pin to your exact door</label>
      <div class="pinmap" id="pinmap"></div>
      <button type="button" class="btn ghost sm" id="locate">📍 Use my current location</button>
      <div class="field" style="margin-top:14px"><label for="notes">Delivery notes (optional)</label><input class="input" id="notes" placeholder="Gate code, complex name, landmarks" maxlength="300"></div>
    </div>
    <div class="card"><h2>Your details</h2>
      <div class="field"><label for="name">Full name</label><input class="input" id="name" autocomplete="name" value="${esc(me.name || '')}"></div>
      <div class="row2"><div class="field"><label for="phone">Mobile number</label><input class="input" id="phone" type="tel" autocomplete="tel" placeholder="082 123 4567" value="${esc(me.phone || '')}"></div>
      <div class="field"><label for="dob">Date of birth</label><input class="input" id="dob" type="date" value="${esc(me.dob || store.get('ns_dob', ''))}" max="${new Date().toISOString().slice(0, 10)}"></div></div>
      <div class="field"><label for="email">Email (optional, for receipts)</label><input class="input" id="email" type="email" autocomplete="email" value="${esc(me.email || '')}"></div>
    </div>
    <div class="card"><h2>Payment</h2><div class="pay">
      <label><input type="radio" name="pay" value="cash" checked> Cash on delivery</label>
      <label><input type="radio" name="pay" value="card_on_delivery"> Card on delivery (card machine)</label>
      <label><input type="radio" name="pay" value="eft"> EFT (details sent after confirmation)</label></div></div>
    <div class="card"><h2>Order summary</h2>
      ${t.lines.map(l => `<div class="cart-line"><div class="info"><b>${l.qty}× ${esc(l.p.name)}</b><small>${esc(Object.values(l.selections).flat().join(' · '))}</small></div><b>${R(l.unit * l.qty)}</b></div>`).join('')}
      <div class="totals" id="tot"></div>
      <label class="check"><input type="checkbox" id="c18"><span><b>I am 18 or older</b> and will show a valid ID to the driver. No ID, no handover.</span></label>
      <label class="check"><input type="checkbox" id="cterms"><span>This order is for my private, personal use. I won’t drive under the influence.</span></label>
      <div class="error hidden" id="coErr"></div>
      <button class="btn lime block" id="place" type="submit">Place order</button></div>
    </form></div>`;
  const updTot = () => { const tt = totals(); $('#tot').innerHTML = `<div><span>Subtotal</span><b>${R(tt.sub)}</b></div><div><span>Delivery · ${esc(S.suburb)}</span><b>${tt.fee === 0 ? 'Free' : R(tt.fee)}</b></div><div class="grand"><span>Total</span><span>${R(tt.total)}</span></div>`; };
  S.suburb = zone.name; store.set('ns_suburb', zone.name); $('#suburbLabel').textContent = zone.name; updTot();
  const start = me.lat && me.suburb === zone.name ? [me.lat, me.lng] : [zone.lat, zone.lng];
  const map = L.map('pinmap', { zoomControl: true, attributionControl: true }).setView(start, 15); S.maps.push(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pin = L.marker(start, { draggable: true, icon: L.divIcon({ className: '', html: '<div class="home-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map);
  map.on('click', e => pin.setLatLng(e.latlng));
  $('#suburb').onchange = e => { const z = S.config.zones.find(z => z.name === e.target.value); S.suburb = z.name; store.set('ns_suburb', z.name); $('#suburbLabel').textContent = z.name; pin.setLatLng([z.lat, z.lng]); map.setView([z.lat, z.lng], 15); updTot(); };
  $('#locate').onclick = () => {
    if (!navigator.geolocation) return toast('Location not available on this device');
    navigator.geolocation.getCurrentPosition(p => { const ll = [p.coords.latitude, p.coords.longitude]; pin.setLatLng(ll); map.setView(ll, 17); }, () => toast('Couldn’t get your location. Drag the pin instead.'), { enableHighAccuracy: true, timeout: 10000 });
  };
  $('#co').onsubmit = async e => {
    e.preventDefault();
    const err = $('#coErr'); err.classList.add('hidden');
    const ll = pin.getLatLng();
    const body = {
      customer: { name: $('#name').value, phone: $('#phone').value, email: $('#email').value, dob: $('#dob').value },
      address: { suburb: $('#suburb').value, line: $('#line').value, notes: $('#notes').value, lat: ll.lat, lng: ll.lng },
      items: S.cart, payment_method: document.querySelector('input[name=pay]:checked').value,
      confirm_18: $('#c18').checked, confirm_terms: $('#cterms').checked,
    };
    if (age(body.customer.dob) >= 0 && age(body.customer.dob) < 18) { err.textContent = 'Sorry, you must be 18 or older to order.'; err.classList.remove('hidden'); return; }
    $('#place').disabled = true; $('#place').textContent = 'Placing order…';
    try {
      const r = await api('/api/orders', { method: 'POST', body: JSON.stringify(body) });
      store.set('ns_me', { ...body.customer, line: body.address.line, suburb: body.address.suburb, lat: ll.lat, lng: ll.lng });
      const mine = store.get('ns_orders', []); mine.unshift({ code: r.code, token: r.token, at: new Date().toISOString() }); store.set('ns_orders', mine.slice(0, 30));
      S.cart = []; saveCart(); location.hash = '#/track/' + r.token;
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); err.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('#place').disabled = false; $('#place').textContent = 'Place order'; }
  };
}

const STEPS = [['placed', 'Order received', 'We’ve got your order.'], ['accepted', 'Accepted', 'The store accepted your order.'], ['packed', 'Packed', 'Packed discreetly and sealed.'], ['out_for_delivery', 'On the way', 'Your driver is heading to you.'], ['delivered', 'Delivered', 'Enjoy, responsibly.']];
const HEAD = { placed: 'Waiting for the store to accept', accepted: 'Order accepted, packing now', packed: 'Packed and waiting for the driver', out_for_delivery: 'Your driver is on the way', delivered: 'Delivered. Enjoy!', cancelled: 'Order cancelled' };
function viewTrack(token) {
  $('#view').innerHTML = `<div class="page"><div class="empty">Loading your order…</div></div>`;
  let map, home, drv, line, fitted = false;
  const render = o => {
    const idx = STEPS.findIndex(s => s[0] === o.status);
    const fmt = t => t ? new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';
    if (!$('#trk')) {
      $('#view').innerHTML = `<div class="page" id="trk"><div class="track-head" id="th"></div><div class="trackmap" id="tmap"></div>
        <div class="card"><h2>Progress</h2><ul class="steps" id="steps"></ul></div><div class="card" id="sum"></div>
        ${S.config.whatsapp ? `<a class="btn ghost block" target="_blank" rel="noopener" href="https://wa.me/${esc(S.config.whatsapp.replace(/\D/g, '').replace(/^0/, '27'))}?text=${encodeURIComponent('Hi, about order ' + o.code)}">Need help? WhatsApp us</a>` : ''}</div>`;
      map = L.map('tmap', { zoomControl: false }); S.maps.push(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      home = L.marker([o.dest.lat, o.dest.lng], { icon: L.divIcon({ className: '', html: '<div class="home-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map);
      map.setView([o.dest.lat, o.dest.lng], 14);
    }
    const etaTime = o.eta_at ? fmt(o.eta_at) : '';
    $('#th').innerHTML = o.status === 'cancelled'
      ? `<div class="eta">Order ${esc(o.code)}</div><h1>Order cancelled</h1><div class="sub">${esc(o.cancel_reason || 'Contact us if you have questions.')}</div>`
      : o.status === 'delivered'
        ? `<div class="eta">Order ${esc(o.code)}</div><h1>Delivered</h1><div class="sub">at ${fmt(o.times.delivered)}. Thanks for ordering with Northside.</div>`
        : `<div class="eta">Estimated arrival</div><div class="big">${o.eta_minutes} min</div><h1>${esc(HEAD[o.status])}</h1><div class="sub">Arriving around ${etaTime} · Order ${esc(o.code)}</div>
           <div class="bar">${[1, 2, 3, 4].map(i => `<i class="${idx >= i ? 'done' : idx === i - 1 ? 'now' : ''}"></i>`).join('')}</div>`;
    $('#steps').innerHTML = STEPS.map(([k, t, d], i) => `<li class="${o.status !== 'cancelled' && i <= idx ? 'done' : ''} ${i === idx + 1 && o.status !== 'cancelled' ? 'now' : ''}"><span class="dot">${i <= idx && o.status !== 'cancelled' ? '✓' : ''}</span><div><b>${t}</b>${d}<br><time>${fmt(o.times[k])}</time></div></li>`).join('');
    $('#sum').innerHTML = `<h2>Order ${esc(o.code)}</h2>${o.items.map(i => `<div class="cart-line"><div class="info"><b>${i.qty}× ${esc(i.name)}</b><small>${esc(i.options.join(' · '))}</small></div><b>${R(i.line_total)}</b></div>`).join('')}
      <div class="totals"><div><span>Subtotal</span><b>${R(o.subtotal)}</b></div><div><span>Delivery · ${esc(o.suburb)}</span><b>${o.delivery_fee ? R(o.delivery_fee) : 'Free'}</b></div><div class="grand"><span>Total · ${o.payment_method === 'cash' ? 'Cash' : o.payment_method === 'eft' ? 'EFT' : 'Card'} on delivery</span><span>${R(o.total)}</span></div></div>
      <p class="muted" style="font-size:13px;margin:0">Have your ID ready. The driver will check that you’re 18+.</p>`;
    if (o.driver && o.driver.lat != null) {
      const ll = [o.driver.lat, o.driver.lng];
      if (!drv) drv = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="driver-pin">🛵</div>', iconSize: [36, 36], iconAnchor: [18, 18] }), zIndexOffset: 1000 }).addTo(map).bindTooltip(esc(o.driver.name), { permanent: false });
      else drv.setLatLng(ll);
      if (!line) line = L.polyline([ll, [o.dest.lat, o.dest.lng]], { color: '#0B1410', weight: 4, dashArray: '2 10', lineCap: 'round' }).addTo(map);
      else line.setLatLngs([ll, [o.dest.lat, o.dest.lng]]);
      if (!fitted) { map.fitBounds(L.latLngBounds([ll, [o.dest.lat, o.dest.lng]]).pad(0.35)); fitted = true; }
    } else if (drv) { drv.remove(); drv = null; line?.remove(); line = null; }
  };
  const load = () => api('/api/track/' + encodeURIComponent(token)).then(render).catch(e => { if (!$('#trk')) $('#view').innerHTML = `<div class="page"><div class="empty">${esc(e.message)}</div></div>`; });
  load();
  const connect = () => {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?track=' + encodeURIComponent(token));
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'order') render(m.order); };
    ws.onclose = () => { if (S.ws === ws) setTimeout(() => { if (S.ws === ws) { S.ws = connect(); } }, 3000); };
    return ws;
  };
  S.ws = connect();
  S.poll = setInterval(load, 30000); // fallback + keeps ETA fresh
}

function viewOrders() {
  const mine = store.get('ns_orders', []);
  $('#view').innerHTML = `<div class="page"><a href="#/" class="muted">← Back to menu</a><h1>My orders</h1>
    ${mine.length ? mine.map(o => `<a class="card" style="display:block;text-decoration:none" href="#/track/${esc(o.token)}"><b>${esc(o.code)}</b><div class="muted">${new Date(o.at).toLocaleString('en-ZA')}</div></a>`).join('') : '<div class="empty">No orders on this device yet.</div>'}</div>`;
}

function route() {
  clearMaps();
  const h = location.hash || '#/';
  const m = h.match(/^#\/track\/([\w-]+)/);
  if (m) viewTrack(m[1]);
  else if (h.startsWith('#/checkout')) viewCheckout();
  else if (h.startsWith('#/orders')) viewOrders();
  else viewMenu();
  renderCartBar(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

(async function init() {
  gate();
  try {
    [S.config, S.menu] = await Promise.all([api('/api/config'), api('/api/menu')]);
  } catch (e) { $('#view').innerHTML = `<div class="empty">Couldn’t load the store. ${esc(e.message)}</div>`; return; }
  $('#storeName').textContent = S.config.store_name.toUpperCase();
  if (S.suburb && !S.config.zones.some(z => z.name === S.suburb)) S.suburb = '';
  $('#suburbLabel').textContent = S.suburb || 'Choose suburb';
  S.cart = S.cart.filter(l => S.menu.some(p => p.id === l.product_id));
  route();
})();
