// End-to-end test: customer orders, admin accepts/packs/dispatches, driver delivers with live GPS.
// Run: npm test   (screenshots go to $SHOTS or ./test/shots)
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { chromium } = require('playwright');

const PORT = 3999, BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-'));
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.DATA_DIR = tmp;
process.env.ADMIN_PASSWORD = 'test-pass';
process.env.PORT = PORT;
fs.mkdirSync(SHOTS, { recursive: true });

const { server } = require('../server');
const j = async (p, opts = {}, token) => {
  const r = await fetch(BASE + p, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const step = m => console.log('✓', m);

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const menu = (await j('/api/menu')).body;
  const haze = menu.find(p => p.name === 'Cape Haze');
  const baseOrder = {
    customer: { name: 'Test Customer', phone: '082 555 1234', dob: '1995-04-02' },
    address: { suburb: 'Durbanville', line: '1 Test Road', lat: -33.832, lng: 18.647 },
    items: [{ product_id: haze.id, qty: 1, selections: { Size: ['7g'] } }],
    payment_method: 'cash', confirm_18: true, confirm_terms: true,
  };

  // ---- API rules ----
  const teen = new Date(); teen.setFullYear(teen.getFullYear() - 17);
  let r = await j('/api/orders', { method: 'POST', body: JSON.stringify({ ...baseOrder, customer: { ...baseOrder.customer, dob: teen.toISOString().slice(0, 10) } }) });
  assert.equal(r.status, 403); step('under-18 order rejected');
  r = await j('/api/orders', { method: 'POST', body: JSON.stringify({ ...baseOrder, confirm_18: false }) });
  assert.equal(r.status, 400); step('order without 18+ confirmation rejected');
  r = await j('/api/orders', { method: 'POST', body: JSON.stringify({ ...baseOrder, items: [{ product_id: haze.id, qty: 1, selections: { Size: ['1g'] } }] }) });
  assert.equal(r.status, 400); assert.match(r.body.error, /Minimum/); step('minimum order enforced');
  r = await j('/api/orders', { method: 'POST', body: JSON.stringify({ ...baseOrder, address: { ...baseOrder.address, suburb: 'Sea Point' } }) });
  assert.equal(r.status, 400); step('out-of-area suburb rejected');
  r = await j('/api/orders', { method: 'POST', body: JSON.stringify({ ...baseOrder, items: [{ product_id: haze.id, qty: 1, selections: { Size: ['7g'] }, unit_price: 1, line_total: 1 }] }) });
  assert.equal(r.status, 201);
  const tampered = (await j('/api/track/' + r.body.token)).body;
  assert.equal(tampered.subtotal, 760); step('server re-prices items (client price ignored): R760');
  assert.equal((await j('/api/admin/orders')).status, 401); step('admin API requires login');
  assert.equal((await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'nope' }) })).status, 401); step('wrong admin password rejected');
  const adminTok = (await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'test-pass' }) })).body.token;
  await j(`/api/admin/orders/1/status`, { method: 'POST', body: JSON.stringify({ status: 'cancelled', reason: 'test' }) }, adminTok);
  r = await j('/api/admin/drivers', { method: 'POST', body: JSON.stringify({ name: 'Sipho Dlamini', phone: '083 111 2222', pin: '4321' }) }, adminTok);
  assert.equal(r.status, 201); step('driver created');

  // ---- browsers ----
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const cust = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
  const adm = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const drv = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  for (const [n, p] of [['customer', cust], ['admin', adm], ['driver', drv]]) p.on('pageerror', e => { console.error(`[${n} page error]`, e.message); process.exitCode = 1; });
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, name + '.png') });

  // website
  await cust.goto(BASE + '/');
  await cust.waitForSelector('#gate:not(.hidden)');
  await shot(cust, '01-age-gate');
  await cust.fill('#gateDob', '2012-01-01'); await cust.click('#gateYes');
  await cust.waitForSelector('#gateErr:not(.hidden)'); step('age gate blocks a 14-year-old');
  await cust.fill('#gateDob', '1995-04-02'); await cust.click('#gateYes');
  await cust.waitForSelector('#gate.hidden', { state: 'attached' });
  await cust.waitForFunction(() => /Delivery R\d+/.test(document.querySelector('#flashFee').textContent), null, { timeout: 30000 });
  step('website loads with live delivery fees: ' + await cust.textContent('#flashFee'));
  await cust.waitForSelector('.flow-item');
  assert.equal(await cust.$$eval('.flow-item', z => z.length), 12); step('website carousel lists the full menu');
  await cust.click('.hero a:has-text("Order now")');
  await cust.waitForURL('**/shop');
  await cust.waitForSelector('.item');
  await cust.waitForSelector('.thumb img', { timeout: 30000 }); step('shop shows 3D-rendered product images');
  await shot(cust, '02-menu');
  await cust.click('.item:has-text("Table Mountain Kush")');
  await cust.click('label.choice:has-text("7g")');
  await cust.click('label.choice:has-text("Rolling papers")');
  await cust.waitForSelector('#stage canvas'); step('product sheet has live 3D viewer');
  await cust.waitForTimeout(1500);
  await shot(cust, '03-product-options');
  assert.match(await cust.textContent('#addBtn'), /R845/); step('options priced in sheet: 7g + papers = R845');
  await cust.click('#addBtn');
  await cust.click('.item:has-text("Fruit Gummies")');
  await cust.click('label.choice:has-text("10mg")');
  await cust.click('#qp');
  await cust.click('#addBtn');
  await cust.click('#openCart');
  await cust.waitForSelector('#goCheckout');
  await shot(cust, '04-cart');
  await cust.click('#goCheckout');
  await cust.click('label.choice:has-text("Durbanville")'); await cust.click('#subOk');
  await cust.waitForSelector('#co');
  await cust.fill('#line', '14 Wellington Road');
  await cust.fill('#name', 'Lindiwe Mokoena');
  await cust.fill('#phone', '0721234567');
  await cust.fill('#email', 'lindiwe@example.com');
  await cust.check('input[value=card_on_delivery]');
  await cust.click('#place');
  await cust.waitForSelector('#coErr:not(.hidden)'); step('checkout blocks without 18+ / terms ticks');
  await cust.check('#c18'); await cust.check('#cterms');
  await cust.waitForTimeout(600);
  await shot(cust, '05-checkout');
  await cust.click('#place');
  await cust.waitForSelector('#trk');
  await cust.waitForSelector('text=Waiting for the store to accept');
  await cust.waitForTimeout(800);
  await shot(cust, '06-track-placed'); step('order placed → tracking page');

  // admin
  await adm.goto(BASE + '/admin');
  await adm.fill('#pw', 'test-pass'); await adm.click('button:has-text("Log in")');
  await adm.waitForSelector('.oc:has-text("Lindiwe")');
  await shot(adm, '07-admin-new-order'); step('admin sees new order');
  await adm.click('.oc:has-text("Lindiwe") button:has-text("Accept")');
  await cust.waitForSelector('text=Order accepted, packing now'); step('customer sees ACCEPTED live');
  await shot(cust, '08-track-accepted');
  await adm.selectOption('.oc:has-text("Lindiwe") select', { label: 'Sipho Dlamini' });
  await adm.waitForSelector('.oc:has-text("Lindiwe"):has-text("Sipho")');
  await adm.click('.oc:has-text("Lindiwe") button:has-text("Mark packed")');
  await cust.waitForSelector('text=Packed and waiting for the driver'); step('customer sees PACKED live');

  // driver
  await drv.goto(BASE + '/driver');
  await drv.fill('#ph', '0831112222'); await drv.fill('#pin', '4321'); await drv.click('#go');
  await drv.waitForSelector('button:has-text("Picked up")');
  await shot(drv, '09-driver-job');
  await drv.click('button:has-text("Picked up")');
  await cust.waitForSelector('text=Your driver is on the way'); step('customer sees OUT FOR DELIVERY live');
  const drvTok = (await j('/api/driver/login', { method: 'POST', body: JSON.stringify({ phone: '0831112222', pin: '4321' }) })).body.token;
  const etas = [];
  for (const [lat, lng] of [[-33.866, 18.690], [-33.852, 18.672], [-33.840, 18.655]]) {
    await j('/api/driver/location', { method: 'POST', body: JSON.stringify({ lat, lng }) }, drvTok);
    await cust.waitForTimeout(700);
    etas.push(Number((await cust.textContent('.track-head .big')).replace(/\D/g, '')));
  }
  assert.ok(await cust.$('.driver-pin'), 'driver marker visible');
  assert.ok(etas[0] > etas[2], `ETA should drop as driver approaches: ${etas}`); step(`live location + ETA updates: ${etas.join(' → ')} min`);
  await cust.waitForTimeout(1500);
  await shot(cust, '10-track-live-map');
  await adm.click('[data-tab=map]'); await adm.waitForSelector('.dpin'); await adm.waitForTimeout(1500);
  await shot(adm, '11-admin-live-map'); step('admin live map shows driver');
  await adm.click('[data-tab=orders]');

  await drv.waitForSelector('button:has-text("Mark delivered")');
  r = await j('/api/driver/orders/2/delivered', { method: 'POST', body: JSON.stringify({}) }, drvTok);
  assert.equal(r.status, 400); step('delivery refused without ID check');
  await drv.check('input[id^=id]');
  await shot(drv, '12-driver-id-check');
  await drv.click('button:has-text("Mark delivered")');
  await cust.waitForSelector('.track-head h1:has-text("Delivered")'); step('customer sees DELIVERED');
  await shot(cust, '13-track-delivered');

  await adm.click('[data-tab=customers]');
  await adm.waitForSelector('tr:has-text("Lindiwe")');
  await adm.click('tr:has-text("Lindiwe")');
  await adm.waitForSelector('.drawer h2:has-text("Lindiwe")');
  await adm.fill('#tags', 'VIP, Durbanville'); await adm.click('#sv');
  await adm.waitForTimeout(500);
  await shot(adm, '14-admin-crm-customer'); step('CRM customer profile + notes');
  const csv = await (await fetch(BASE + '/api/admin/export/customers.csv', { headers: { authorization: 'Bearer ' + adminTok } })).text();
  assert.match(csv, /Lindiwe Mokoena/); step('customers CSV export');
  await adm.keyboard.press('Escape');
  await adm.click('[data-tab=menu]'); await adm.waitForSelector('[data-ed]'); await shot(adm, '15-admin-menu');
  await adm.click('[data-tab=orders]'); await adm.waitForSelector('.oc'); await adm.keyboard.press('Escape'); await adm.waitForTimeout(400);
  await shot(adm, '16-admin-board');

  await browser.close(); server.close();
  console.log(process.exitCode ? '\nFAILED (page errors above)' : '\nALL CHECKS PASSED');
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('✗', e); process.exit(1); });
