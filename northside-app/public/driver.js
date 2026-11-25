// Northside driver app: shows assigned orders and shares live GPS while delivering
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = n => 'R' + Number(n).toLocaleString('en-ZA');
const D = { token: sessionStorage.getItem('ns_drv') || '', name: sessionStorage.getItem('ns_drv_name') || '', orders: [], watch: null, last: 0, sim: null };
const SIM = new URLSearchParams(location.search).has('sim'); // demo/testing only: fake a drive to the customer

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + D.token } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && D.token) { logout(); throw new Error('Session expired, log in again.'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}
function logout() { D.token = ''; sessionStorage.clear(); stopGps(); location.reload(); }
$('#logout').onclick = logout;

function login() {
  $('#app').innerHTML = `<div class="panel"><h2 style="margin-top:0">Driver login</h2>
    <div class="field"><label>Mobile number</label><input class="input" id="ph" type="tel" autocomplete="username"></div>
    <div class="field"><label>PIN</label><input class="input" id="pin" type="password" inputmode="numeric" autocomplete="current-password"></div>
    <div class="error hidden" id="err"></div><button class="btn block" id="go">Log in</button></div>`;
  $('#go').onclick = async () => {
    try {
      const r = await fetch('/api/driver/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: $('#ph').value, pin: $('#pin').value }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      D.token = j.token; D.name = j.name; sessionStorage.setItem('ns_drv', j.token); sessionStorage.setItem('ns_drv_name', j.name); main();
    } catch (e) { $('#err').textContent = e.message; $('#err').classList.remove('hidden'); }
  };
}

// ---------- GPS ----------
async function pushLoc(lat, lng, heading) {
  D.last = Date.now();
  try { await api('/api/driver/location', { method: 'POST', body: JSON.stringify({ lat, lng, heading }) }); } catch { /* retry on next fix */ }
}
function startGps() {
  if (D.watch != null || D.sim) return;
  if (!navigator.geolocation) { alert('This phone has no GPS access in the browser.'); return; }
  D.watch = navigator.geolocation.watchPosition(p => {
    if (Date.now() - D.last > 4000) pushLoc(p.coords.latitude, p.coords.longitude, p.coords.heading);
    gpsBadge(true);
  }, e => { gpsBadge(false, e.code === 1 ? 'Location permission denied. Allow it in your browser settings.' : 'Waiting for GPS…'); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
}
function stopGps() { if (D.watch != null) navigator.geolocation.clearWatch(D.watch); D.watch = null; clearInterval(D.sim); D.sim = null; gpsBadge(false); }
function gpsBadge(on, msg) { const g = $('#gps'); if (!g) return; g.classList.toggle('on', on); $('span', g).textContent = on ? 'Sharing live location with customer' : (msg || 'Location sharing off'); }
function simulate(o) {
  stopGps();
  const from = { lat: -33.873, lng: 18.695 }, to = { lat: o.lat, lng: o.lng }; let k = 0; const N = 40;
  D.sim = setInterval(() => { k = Math.min(N, k + 1); const f = k / N; pushLoc(from.lat + (to.lat - from.lat) * f, from.lng + (to.lng - from.lng) * f, null); gpsBadge(true); if (k === N) clearInterval(D.sim); }, 1500);
}

// ---------- jobs ----------
async function load() {
  try { D.orders = await api('/api/driver/orders'); render(); } catch (e) { $('#jobs').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function render() {
  const active = D.orders.some(o => o.status === 'out_for_delivery');
  if (active) startGps(); else if (!D.sim) stopGps();
  $('#jobs').innerHTML = D.orders.length ? D.orders.map(o => `<div class="panel job">
    <div style="display:flex;justify-content:space-between;align-items:center"><h2>${esc(o.code)}</h2><span class="status ${o.status}">${esc(o.status.replace(/_/g, ' '))}</span></div>
    <div class="addr">${esc(o.address)}</div><div class="muted">${esc(o.suburb)}${o.notes ? ' · ' + esc(o.notes) : ''}</div>
    <div style="margin-top:8px"><b>${esc(o.customer.name)}</b> · <a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></div>
    <ul>${o.items.map(i => `<li>${i.qty}× ${esc(i.name)} <span class="muted">${esc(i.options.join(', '))}</span></li>`).join('')}</ul>
    <div><b>Collect ${R(o.total)}</b> · ${o.payment_method === 'cash' ? 'Cash' : o.payment_method === 'eft' ? 'EFT (check payment)' : 'Card machine'}</div>
    <div class="row"><a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}">Navigate</a>
    ${o.status === 'packed' ? `<button class="btn lime" data-pick="${o.id}">Picked up · start trip</button>` : ''}
    ${o.status === 'accepted' ? `<button class="btn" disabled>Waiting for packing</button>` : ''}</div>
    ${o.status === 'out_for_delivery' ? `<label class="check" style="display:flex;gap:10px;margin:14px 0 8px;font-size:14px"><input type="checkbox" id="id${o.id}" style="width:22px;height:22px"><span><b>ID checked.</b> Customer is 18+ and matches the order name.</span></label>
      <button class="btn block" data-done="${o.id}">Mark delivered</button>${SIM ? `<button class="btn ghost block" style="margin-top:8px" data-sim="${o.id}">Simulate drive (demo)</button>` : ''}` : ''}
  </div>`).join('') : '<div class="empty">No deliveries assigned yet.<br>New jobs appear here automatically.</div>';
  document.querySelectorAll('[data-pick]').forEach(b => b.onclick = async () => { b.disabled = true; try { await api(`/api/driver/orders/${b.dataset.pick}/pickup`, { method: 'POST' }); startGps(); load(); } catch (e) { alert(e.message); b.disabled = false; } });
  document.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => {
    const ok = $('#id' + b.dataset.done)?.checked;
    if (!ok) return alert('Check the customer’s ID first. No ID, no handover.');
    b.disabled = true; try { await api(`/api/driver/orders/${b.dataset.done}/delivered`, { method: 'POST', body: JSON.stringify({ id_checked: true }) }); load(); } catch (e) { alert(e.message); b.disabled = false; }
  });
  document.querySelectorAll('[data-sim]').forEach(b => b.onclick = () => simulate(D.orders.find(o => o.id === +b.dataset.sim)));
}

function main() {
  $('#logout').classList.remove('hidden');
  $('#app').innerHTML = `<p style="margin:0 0 12px">Hi ${esc(D.name.split(' ')[0])} 👋</p><div class="gps" id="gps"><i></i><span>Location sharing off</span></div><div id="jobs"><div class="empty">Loading…</div></div>`;
  load();
  const connect = () => {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?auth=' + encodeURIComponent(D.token));
    ws.onmessage = () => load();
    ws.onclose = e => { if (e.code !== 4001) setTimeout(connect, 3000); };
  };
  connect();
  setInterval(load, 60000);
}
D.token ? main() : login();
