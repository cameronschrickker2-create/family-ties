// Northside: ordering store, driver app and admin CRM in one server.
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');
const { db, getSettings, saveSettings } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
if (ADMIN_PASSWORD === 'change-me') console.warn('[warn] ADMIN_PASSWORD not set; using "change-me". Set it before going live.');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin'); next(); });
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules/leaflet/dist')));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- helpers ----------
const now = () => new Date().toISOString();
const rid = (n = 24) => crypto.randomBytes(n).toString('base64url');
const STATUSES = ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];
const NEXT = { placed: ['accepted', 'cancelled'], accepted: ['packed', 'cancelled'], packed: ['out_for_delivery', 'cancelled'], out_for_delivery: ['delivered', 'cancelled'], delivered: [], cancelled: [] };
const STAMP = { accepted: 'accepted_at', packed: 'packed_at', out_for_delivery: 'dispatched_at', delivered: 'delivered_at', cancelled: 'cancelled_at' };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const wrap = fn => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };

function km(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('27')) d = '0' + d.slice(2);
  if (!/^0\d{9}$/.test(d)) throw new HttpError(400, 'Enter a valid South African mobile number, e.g. 082 123 4567.');
  return d;
}
function ageFrom(dob) {
  const d = new Date(dob + 'T00:00:00Z');
  if (isNaN(d)) return -1;
  const t = new Date();
  let a = t.getUTCFullYear() - d.getUTCFullYear();
  if (t.getUTCMonth() < d.getUTCMonth() || (t.getUTCMonth() === d.getUTCMonth() && t.getUTCDate() < d.getUTCDate())) a--;
  return a;
}
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
function hashPin(pin, salt = rid(12)) { return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex'); }
function checkPin(pin, stored) {
  const [salt, h] = String(stored).split(':');
  const a = Buffer.from(crypto.scryptSync(String(pin), salt, 32).toString('hex')), b = Buffer.from(h || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- auth ----------
const sessions = new Map(); // token -> {role, id, exp}
function issue(role, id = 0) { const t = rid(); sessions.set(t, { role, id, exp: Date.now() + 12 * 3600e3 }); return t; }
function session(token) { const s = sessions.get(token); if (!s || s.exp < Date.now()) { sessions.delete(token); return null; } return s; }
const need = role => (req, res, next) => {
  const s = session((req.get('authorization') || '').replace(/^Bearer /, ''));
  if (!s || s.role !== role) return res.status(401).json({ error: 'Please log in again.' });
  req.auth = s; next();
};
const hits = new Map();
function limit(key, max, windowMs) {
  const t = Date.now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  if (arr.length > max) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
}

// ---------- data access ----------
const getOrder = id => db.prepare('SELECT * FROM orders WHERE id=?').get(id);
const getDriver = id => id ? db.prepare('SELECT id,name,phone,active,lat,lng,heading,loc_at FROM drivers WHERE id=?').get(id) : null;
function logEvent(order_id, customer_id, type, data = {}) {
  db.prepare('INSERT INTO events(order_id,customer_id,type,data,at) VALUES(?,?,?,?,?)').run(order_id, customer_id, type, JSON.stringify(data), now());
}

function etaMinutes(o, s = getSettings()) {
  if (o.status === 'delivered' || o.status === 'cancelled') return 0;
  const dest = { lat: o.lat, lng: o.lng };
  const travel = from => Math.round((km(from, dest) * 1.35) / s.avg_speed_kmh * 60) + 2;
  if (o.status === 'out_for_delivery') {
    const d = getDriver(o.driver_id);
    const fresh = d && d.lat != null && (Date.now() - new Date(d.loc_at)) < 5 * 60e3;
    return Math.max(1, travel(fresh ? d : s.base));
  }
  const prep = { placed: s.prep_minutes + 5, accepted: s.prep_minutes, packed: 4 }[o.status] || s.prep_minutes;
  return prep + travel(s.base);
}

function publicOrder(o) {
  const d = o.status === 'out_for_delivery' ? getDriver(o.driver_id) : null;
  const eta = etaMinutes(o);
  return {
    code: o.code, status: o.status, items: JSON.parse(o.items), subtotal: o.subtotal, delivery_fee: o.delivery_fee, total: o.total,
    suburb: o.suburb, dest: { lat: o.lat, lng: o.lng }, payment_method: o.payment_method, cancel_reason: o.cancel_reason,
    times: { placed: o.created_at, accepted: o.accepted_at, packed: o.packed_at, out_for_delivery: o.dispatched_at, delivered: o.delivered_at, cancelled: o.cancelled_at },
    eta_minutes: eta, eta_at: eta ? new Date(Date.now() + eta * 60e3).toISOString() : null,
    driver: d ? { name: d.name.split(' ')[0], lat: d.lat, lng: d.lng, heading: d.heading, loc_at: d.loc_at } : null,
    base: getSettings().base,
  };
}
function adminOrder(o) {
  const c = db.prepare('SELECT id,name,phone,email,dob FROM customers WHERE id=?').get(o.customer_id);
  return { ...o, items: JSON.parse(o.items), customer: c, driver: getDriver(o.driver_id), eta_minutes: etaMinutes(o) };
}

// ---------- realtime ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const subs = { admin: new Set(), track: new Map(), driver: new Map() };
wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  if (q.get('track')) {
    const tok = q.get('track');
    if (!subs.track.has(tok)) subs.track.set(tok, new Set());
    subs.track.get(tok).add(ws);
    ws.on('close', () => subs.track.get(tok)?.delete(ws));
  } else if (q.get('auth')) {
    const s = session(q.get('auth'));
    if (!s) return ws.close(4001, 'unauthorised');
    if (s.role === 'admin') { subs.admin.add(ws); ws.on('close', () => subs.admin.delete(ws)); }
    if (s.role === 'driver') {
      if (!subs.driver.has(s.id)) subs.driver.set(s.id, new Set());
      subs.driver.get(s.id).add(ws); ws.on('close', () => subs.driver.get(s.id)?.delete(ws));
    }
  } else ws.close();
});
setInterval(() => wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }), 30e3).unref();
const send = (set, msg) => { const m = JSON.stringify(msg); set?.forEach(ws => ws.readyState === 1 && ws.send(m)); };

async function webhook(type, payload) {
  const url = getSettings().webhook_url;
  if (!url || !/^https:\/\//.test(url)) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, at: now(), ...payload }), signal: AbortSignal.timeout(5000) });
  } catch (e) { console.warn('[webhook]', type, e.message); }
}
function broadcastOrder(o, type = 'order.updated') {
  const full = adminOrder(o);
  send(subs.admin, { type: 'order', order: full });
  send(subs.track.get(o.token), { type: 'order', order: publicOrder(o) });
  if (o.driver_id) send(subs.driver.get(o.driver_id), { type: 'order', order: full });
  webhook(type, { order: full });
}

// ---------- pricing (server is the source of truth) ----------
function priceItems(items) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Your cart is empty.');
  if (items.length > 30) throw new HttpError(400, 'Too many items.');
  return items.map(it => {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(Number(it.product_id));
    if (!p) throw new HttpError(400, 'An item in your cart is no longer available. Please remove it.');
    const qty = Math.max(1, Math.min(20, Math.floor(Number(it.qty) || 1)));
    const sel = it.selections || {};
    let unit = p.base_price; const chosen = [];
    for (const opt of JSON.parse(p.options)) {
      let picked = [].concat(sel[opt.name] || []).map(String);
      if (opt.type === 'single') picked = picked.slice(0, 1);
      const valid = picked.map(l => opt.choices.find(c => c.label === l)).filter(Boolean);
      if (opt.required && !valid.length) throw new HttpError(400, `Choose a ${opt.name.toLowerCase()} for ${p.name}.`);
      valid.forEach(c => { unit += c.price; chosen.push(`${opt.name}: ${c.label}`); });
    }
    return { product_id: p.id, name: p.name, category: p.category, options: chosen, selections: sel, qty, unit_price: unit, line_total: unit * qty };
  });
}

// ================= PUBLIC API =================
app.get('/api/config', (req, res) => {
  const s = getSettings();
  res.json({ store_name: s.store_name, store_open: s.store_open, min_order: s.min_order, free_delivery_over: s.free_delivery_over, zones: s.zones, base: s.base, whatsapp: s.whatsapp, prep_minutes: s.prep_minutes });
});
app.get('/api/menu', (req, res) => {
  res.json(db.prepare('SELECT id,category,name,description,badge,strength,image,base_price,options FROM products WHERE active=1 ORDER BY sort,id').all()
    .map(p => ({ ...p, options: JSON.parse(p.options) })));
});

app.post('/api/orders', wrap((req, res) => {
  limit('order:' + req.ip, 8, 10 * 60e3);
  const s = getSettings(), b = req.body || {};
  if (!s.store_open) throw new HttpError(409, 'We are closed right now. Please try again later.');
  if (b.confirm_18 !== true || b.confirm_terms !== true) throw new HttpError(400, 'Please confirm you are 18 or older and accept the terms.');
  const c = b.customer || {}, a = b.address || {};
  const name = str(c.name, 80), phone = normPhone(c.phone), email = str(c.email, 120), dob = str(c.dob, 10);
  if (name.length < 2) throw new HttpError(400, 'Please enter your name.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'That email address looks wrong.');
  const age = ageFrom(dob);
  if (age < 0 || age > 120) throw new HttpError(400, 'Please enter your date of birth.');
  if (age < 18) throw new HttpError(403, 'Sorry, you must be 18 or older to order.');
  const zone = s.zones.find(z => z.name === a.suburb);
  if (!zone) throw new HttpError(400, 'Please choose a suburb in our delivery area.');
  const lat = Number(a.lat), lng = Number(a.lng);
  if (!isFinite(lat) || !isFinite(lng)) throw new HttpError(400, 'Please drop a pin on your delivery location.');
  if (km(s.base, { lat, lng }) > s.max_radius_km) throw new HttpError(400, 'That pin is outside our delivery area.');
  const line = str(a.line, 200);
  if (line.length < 4) throw new HttpError(400, 'Please enter your street address.');
  const payment = ['cash', 'card_on_delivery', 'eft'].includes(b.payment_method) ? b.payment_method : null;
  if (!payment) throw new HttpError(400, 'Please choose a payment method.');

  const items = priceItems(b.items);
  const subtotal = items.reduce((t, i) => t + i.line_total, 0);
  if (subtotal < s.min_order) throw new HttpError(400, `Minimum order is R${s.min_order}.`);
  const fee = subtotal >= s.free_delivery_over ? 0 : zone.fee;

  let cust = db.prepare('SELECT * FROM customers WHERE phone=?').get(phone);
  if (cust) {
    db.prepare('UPDATE customers SET name=?, email=COALESCE(NULLIF(?,\'\'),email), dob=?, address=?, suburb=? WHERE id=?').run(name, email, dob, line, zone.name, cust.id);
  } else {
    const r = db.prepare('INSERT INTO customers(phone,name,email,dob,address,suburb,created_at) VALUES(?,?,?,?,?,?,?)').run(phone, name, email, dob, line, zone.name, now());
    cust = { id: Number(r.lastInsertRowid) };
    logEvent(null, cust.id, 'customer.created', { name });
  }
  const code = 'NS-' + crypto.randomInt(1000, 9999) + crypto.randomBytes(1).toString('hex').toUpperCase();
  const r = db.prepare(`INSERT INTO orders(code,token,customer_id,items,subtotal,delivery_fee,total,address,suburb,lat,lng,notes,payment_method,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, rid(18), cust.id, JSON.stringify(items), subtotal, fee, subtotal + fee, line, zone.name, lat, lng, str(a.notes, 300), payment, now());
  const o = getOrder(Number(r.lastInsertRowid));
  logEvent(o.id, cust.id, 'order.placed', { total: o.total });
  broadcastOrder(o, 'order.placed');
  res.status(201).json({ code: o.code, token: o.token });
}));

app.get('/api/track/:token', wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE token=?').get(req.params.token);
  if (!o) throw new HttpError(404, 'Order not found.');
  res.json(publicOrder(o));
}));

// ================= ADMIN API =================
app.post('/api/admin/login', wrap((req, res) => {
  limit('admin:' + req.ip, 10, 15 * 60e3);
  const a = Buffer.from(String(req.body?.password || '')), b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Wrong password.');
  res.json({ token: issue('admin') });
}));
const admin = express.Router();
admin.use(need('admin'));

admin.get('/orders', (req, res) => {
  const scope = req.query.scope || 'board';
  let rows;
  if (scope === 'board') rows = db.prepare(`SELECT * FROM orders WHERE status NOT IN ('delivered','cancelled') OR created_at >= ? ORDER BY id DESC`).all(new Date(Date.now() - 18 * 3600e3).toISOString());
  else rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 500').all();
  res.json(rows.map(adminOrder));
});
admin.post('/orders/:id/status', wrap((req, res) => {
  const o = getOrder(Number(req.params.id));
  if (!o) throw new HttpError(404, 'Order not found.');
  const to = req.body?.status;
  if (!STATUSES.includes(to) || !NEXT[o.status].includes(to)) throw new HttpError(409, `Can't move an order from ${o.status} to ${to}.`);
  if (to === 'out_for_delivery' && !o.driver_id) throw new HttpError(409, 'Assign a driver first.');
  db.prepare(`UPDATE orders SET status=?, ${STAMP[to]}=?, cancel_reason=? WHERE id=?`).run(to, now(), to === 'cancelled' ? str(req.body.reason, 200) : o.cancel_reason, o.id);
  logEvent(o.id, o.customer_id, 'order.' + to, { by: 'admin', reason: req.body.reason || undefined });
  const u = getOrder(o.id); broadcastOrder(u, 'order.' + to); res.json(adminOrder(u));
}));
admin.post('/orders/:id/assign', wrap((req, res) => {
  const o = getOrder(Number(req.params.id));
  if (!o) throw new HttpError(404, 'Order not found.');
  if (['delivered', 'cancelled'].includes(o.status)) throw new HttpError(409, 'Order is closed.');
  const d = req.body?.driver_id ? db.prepare('SELECT * FROM drivers WHERE id=? AND active=1').get(Number(req.body.driver_id)) : null;
  if (req.body?.driver_id && !d) throw new HttpError(400, 'Driver not found.');
  db.prepare('UPDATE orders SET driver_id=? WHERE id=?').run(d ? d.id : null, o.id);
  logEvent(o.id, o.customer_id, 'order.assigned', { driver: d?.name || null });
  const u = getOrder(o.id); broadcastOrder(u, 'order.assigned'); res.json(adminOrder(u));
}));

admin.get('/customers', (req, res) => {
  const q = '%' + str(req.query.q, 60) + '%';
  res.json(db.prepare(`SELECT c.*, COUNT(o.id) orders, COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.total END),0) spent, MAX(o.created_at) last_order
    FROM customers c LEFT JOIN orders o ON o.customer_id=c.id
    WHERE c.name LIKE ? OR c.phone LIKE ? OR c.suburb LIKE ? OR c.tags LIKE ?
    GROUP BY c.id ORDER BY last_order DESC NULLS LAST LIMIT 500`).all(q, q, q, q));
});
admin.get('/customers/:id', wrap((req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(Number(req.params.id));
  if (!c) throw new HttpError(404, 'Customer not found.');
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC').all(c.id).map(adminOrder);
  const events = db.prepare('SELECT * FROM events WHERE customer_id=? ORDER BY id DESC LIMIT 100').all(c.id);
  res.json({ ...c, orders, events });
}));
admin.patch('/customers/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE customers SET notes=?, tags=? WHERE id=?').run(str(req.body.notes, 2000), str(req.body.tags, 200), id);
  logEvent(null, id, 'customer.note', {});
  res.json({ ok: true });
}));

admin.get('/products', (req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY sort,id').all().map(p => ({ ...p, options: JSON.parse(p.options) }))));
function validProduct(b) {
  const opts = Array.isArray(b.options) ? b.options.map(o => ({
    name: str(o.name, 40), type: o.type === 'multi' ? 'multi' : 'single', required: !!o.required,
    choices: (o.choices || []).map(c => ({ label: str(c.label, 60), price: Math.round(Number(c.price) || 0) })).filter(c => c.label),
  })).filter(o => o.name && o.choices.length) : [];
  if (!str(b.name)) throw new HttpError(400, 'Product needs a name.');
  return [str(b.category, 40) || 'Other', str(b.name, 80), str(b.description, 300), str(b.badge, 30), str(b.strength, 40), str(b.image, 500), Math.round(Number(b.base_price) || 0), JSON.stringify(opts), b.active ? 1 : 0, Math.round(Number(b.sort) || 0)];
}
admin.post('/products', wrap((req, res) => {
  const r = db.prepare('INSERT INTO products(category,name,description,badge,strength,image,base_price,options,active,sort) VALUES(?,?,?,?,?,?,?,?,?,?)').run(...validProduct(req.body));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));
admin.put('/products/:id', wrap((req, res) => {
  db.prepare('UPDATE products SET category=?,name=?,description=?,badge=?,strength=?,image=?,base_price=?,options=?,active=?,sort=? WHERE id=?').run(...validProduct(req.body), Number(req.params.id));
  res.json({ ok: true });
}));

admin.get('/drivers', (req, res) => res.json(db.prepare('SELECT id,name,phone,active,lat,lng,loc_at FROM drivers ORDER BY name').all()));
admin.post('/drivers', wrap((req, res) => {
  const pin = str(req.body.pin, 12);
  if (!/^\d{4,8}$/.test(pin)) throw new HttpError(400, 'PIN must be 4–8 digits.');
  const r = db.prepare('INSERT INTO drivers(name,phone,pin_hash) VALUES(?,?,?)').run(str(req.body.name, 60), normPhone(req.body.phone), hashPin(pin));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));
admin.patch('/drivers/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  if ('active' in req.body) db.prepare('UPDATE drivers SET active=? WHERE id=?').run(req.body.active ? 1 : 0, id);
  if (req.body.pin) { if (!/^\d{4,8}$/.test(req.body.pin)) throw new HttpError(400, 'PIN must be 4–8 digits.'); db.prepare('UPDATE drivers SET pin_hash=? WHERE id=?').run(hashPin(req.body.pin), id); }
  res.json({ ok: true });
}));

admin.get('/settings', (req, res) => res.json(getSettings()));
admin.put('/settings', wrap((req, res) => {
  const b = req.body || {}, patch = {};
  if ('store_open' in b) patch.store_open = !!b.store_open;
  for (const k of ['min_order', 'free_delivery_over', 'prep_minutes', 'avg_speed_kmh', 'max_radius_km']) if (k in b) patch[k] = Math.max(0, Number(b[k]) || 0);
  for (const k of ['store_name', 'whatsapp']) if (k in b) patch[k] = str(b[k], 60);
  if ('webhook_url' in b) { const u = str(b.webhook_url, 500); if (u && !/^https:\/\//.test(u)) throw new HttpError(400, 'Webhook URL must start with https://'); patch.webhook_url = u; }
  if (Array.isArray(b.zones)) patch.zones = b.zones.map(z => ({ name: str(z.name, 40), fee: Math.round(Number(z.fee) || 0), lat: Number(z.lat), lng: Number(z.lng) })).filter(z => z.name && isFinite(z.lat) && isFinite(z.lng));
  res.json(saveSettings(patch));
}));

admin.get('/stats', (req, res) => {
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const today = db.prepare(`SELECT COUNT(*) orders, COALESCE(SUM(CASE WHEN status!='cancelled' THEN total END),0) revenue,
    SUM(status NOT IN ('delivered','cancelled')) active, SUM(status='delivered') delivered FROM orders WHERE created_at>=?`).get(since.toISOString());
  const week = db.prepare(`SELECT COUNT(*) orders, COALESCE(SUM(CASE WHEN status!='cancelled' THEN total END),0) revenue FROM orders WHERE created_at>=?`).get(d7);
  const avgDel = db.prepare(`SELECT AVG((julianday(delivered_at)-julianday(created_at))*1440) m FROM orders WHERE delivered_at IS NOT NULL AND created_at>=?`).get(d7);
  const top = db.prepare(`SELECT json_extract(j.value,'$.name') name, SUM(json_extract(j.value,'$.qty')) qty FROM orders, json_each(orders.items) j WHERE created_at>=? AND status!='cancelled' GROUP BY name ORDER BY qty DESC LIMIT 5`).all(d7);
  const suburbs = db.prepare(`SELECT suburb, COUNT(*) n FROM orders WHERE created_at>=? GROUP BY suburb ORDER BY n DESC`).all(d7);
  const customers = db.prepare('SELECT COUNT(*) n FROM customers').get().n;
  const repeat = db.prepare('SELECT COUNT(*) n FROM (SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*)>1)').get().n;
  res.json({ today, week, avg_delivery_minutes: avgDel.m ? Math.round(avgDel.m) : null, top, suburbs, customers, repeat });
});

const csv = rows => { if (!rows.length) return ''; const k = Object.keys(rows[0]); const e = v => { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }; return [k.join(','), ...rows.map(r => k.map(x => e(r[x])).join(','))].join('\n'); };
admin.get('/export/orders.csv', (req, res) => {
  res.type('text/csv').attachment('orders.csv').send(csv(db.prepare(`SELECT o.code,o.created_at,o.status,c.name customer,c.phone,o.suburb,o.address,o.subtotal,o.delivery_fee,o.total,o.payment_method,o.delivered_at FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC`).all()));
});
admin.get('/export/customers.csv', (req, res) => {
  res.type('text/csv').attachment('customers.csv').send(csv(db.prepare(`SELECT c.name,c.phone,c.email,c.suburb,c.address,c.tags,c.notes,c.created_at,COUNT(o.id) orders,COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.total END),0) spent,MAX(o.created_at) last_order FROM customers c LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id`).all()));
});
app.use('/api/admin', admin);

// ================= DRIVER API =================
app.post('/api/driver/login', wrap((req, res) => {
  limit('driver:' + req.ip, 10, 15 * 60e3);
  let phone; try { phone = normPhone(req.body?.phone); } catch { throw new HttpError(401, 'Wrong phone or PIN.'); }
  const d = db.prepare('SELECT * FROM drivers WHERE phone=? AND active=1').get(phone);
  if (!d || !checkPin(req.body?.pin, d.pin_hash)) throw new HttpError(401, 'Wrong phone or PIN.');
  res.json({ token: issue('driver', d.id), name: d.name });
}));
const drv = express.Router();
drv.use(need('driver'));
drv.get('/orders', (req, res) => {
  res.json(db.prepare(`SELECT * FROM orders WHERE driver_id=? AND status IN ('accepted','packed','out_for_delivery') ORDER BY id`).all(req.auth.id).map(adminOrder));
});
const mine = (req) => { const o = getOrder(Number(req.params.id)); if (!o || o.driver_id !== req.auth.id) throw new HttpError(404, 'Order not found.'); return o; };
drv.post('/orders/:id/pickup', wrap((req, res) => {
  const o = mine(req);
  if (o.status !== 'packed') throw new HttpError(409, 'This order is not packed yet.');
  db.prepare('UPDATE orders SET status=?, dispatched_at=? WHERE id=?').run('out_for_delivery', now(), o.id);
  logEvent(o.id, o.customer_id, 'order.out_for_delivery', { by: 'driver' });
  const u = getOrder(o.id); broadcastOrder(u, 'order.out_for_delivery'); res.json(adminOrder(u));
}));
drv.post('/orders/:id/delivered', wrap((req, res) => {
  const o = mine(req);
  if (o.status !== 'out_for_delivery') throw new HttpError(409, 'Start the trip first.');
  if (req.body?.id_checked !== true) throw new HttpError(400, 'Check the customer\'s ID (18+) before handing over.');
  db.prepare('UPDATE orders SET status=?, delivered_at=?, id_checked=1 WHERE id=?').run('delivered', now(), o.id);
  logEvent(o.id, o.customer_id, 'order.delivered', { by: 'driver', id_checked: true });
  const u = getOrder(o.id); broadcastOrder(u, 'order.delivered'); res.json(adminOrder(u));
}));
drv.post('/location', wrap((req, res) => {
  const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(400, 'Bad location.');
  const heading = isFinite(Number(req.body.heading)) ? Number(req.body.heading) : null;
  db.prepare('UPDATE drivers SET lat=?, lng=?, heading=?, loc_at=? WHERE id=?').run(lat, lng, heading, now(), req.auth.id);
  const d = getDriver(req.auth.id);
  send(subs.admin, { type: 'driver', driver: d });
  for (const o of db.prepare(`SELECT * FROM orders WHERE driver_id=? AND status='out_for_delivery'`).all(d.id)) {
    send(subs.track.get(o.token), { type: 'order', order: publicOrder(o) });
    send(subs.admin, { type: 'eta', id: o.id, eta_minutes: etaMinutes(o) });
  }
  res.json({ ok: true });
}));
app.use('/api/driver', drv);

// ---------- errors & pages ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'That phone number is already in use.' });
  console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
app.get(/^\/(?!api|ws).*/, (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

if (require.main === module) server.listen(PORT, () => console.log(`Northside running on http://localhost:${PORT}  (store /, admin /admin, driver /driver)`));
module.exports = { server };
