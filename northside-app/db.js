// Database schema, seed data and settings (built-in node:sqlite, no native deps)
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, 'northside.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  badge TEXT DEFAULT '', strength TEXT DEFAULT '', image TEXT DEFAULT '',
  base_price INTEGER NOT NULL DEFAULT 0, options TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT DEFAULT '', dob TEXT NOT NULL,
  address TEXT DEFAULT '', suburb TEXT DEFAULT '', notes TEXT DEFAULT '', tags TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, lat REAL, lng REAL, heading REAL, loc_at TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  items TEXT NOT NULL, subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL, total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  address TEXT NOT NULL, suburb TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  notes TEXT DEFAULT '', payment_method TEXT NOT NULL,
  driver_id INTEGER REFERENCES drivers(id), cancel_reason TEXT DEFAULT '', id_checked INTEGER DEFAULT 0,
  created_at TEXT NOT NULL, accepted_at TEXT, packed_at TEXT, dispatched_at TEXT, delivered_at TEXT, cancelled_at TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER, customer_id INTEGER, type TEXT NOT NULL, data TEXT DEFAULT '{}', at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_customer ON events(customer_id);
`);

// ---- Settings -------------------------------------------------------------
const DEFAULT_SETTINGS = {
  store_name: 'Northside',
  store_open: true,
  min_order: 200,
  free_delivery_over: 800,
  prep_minutes: 15,
  avg_speed_kmh: 30,
  base: { lat: -33.873, lng: 18.695, label: 'Brackenfell dispatch' },
  whatsapp: '',
  webhook_url: '',
  // Service area: suburb -> delivery fee (ZAR) and centre point for the map pin
  zones: [
    { name: 'Brackenfell', fee: 30, lat: -33.873, lng: 18.695 },
    { name: 'Kraaifontein', fee: 35, lat: -33.849, lng: 18.723 },
    { name: 'Kuils River', fee: 35, lat: -33.927, lng: 18.684 },
    { name: 'Durbanville', fee: 45, lat: -33.832, lng: 18.647 },
    { name: 'Bellville', fee: 45, lat: -33.900, lng: 18.630 },
    { name: 'Plattekloof', fee: 55, lat: -33.866, lng: 18.583 },
    { name: 'Parow', fee: 55, lat: -33.904, lng: 18.587 },
    { name: 'Goodwood', fee: 60, lat: -33.910, lng: 18.556 },
    { name: 'Edgemead', fee: 60, lat: -33.871, lng: 18.554 },
    { name: 'Bothasig', fee: 60, lat: -33.862, lng: 18.540 },
  ],
  max_radius_km: 25,
};

function getSettings() {
  const s = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    try { s[row.key] = JSON.parse(row.value); } catch { /* ignore bad row */ }
  }
  return s;
}
function saveSettings(patch) {
  const stmt = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS) stmt.run(k, JSON.stringify(v));
  return getSettings();
}

// ---- Seed menu (placeholder prices in ZAR, edit in Admin > Menu) ------------
const size = (choices) => ({ name: 'Size', type: 'single', required: true, choices });
const SEED = [
  ['Flower', 'Cape Haze', 'Bright, citrusy sativa-leaning indoor. Daytime favourite.', 'Sativa', 'THC 22–24%', [size([['1g', 120], ['3.5g', 400], ['7g', 760], ['14g', 1400]]), { name: 'Add papers', type: 'multi', required: false, choices: [['Rolling papers + tips', 25]] }]],
  ['Flower', 'Table Mountain Kush', 'Earthy, heavy indica. Wind-down strain.', 'Indica', 'THC 24–26%', [size([['1g', 130], ['3.5g', 430], ['7g', 820], ['14g', 1500]]), { name: 'Add papers', type: 'multi', required: false, choices: [['Rolling papers + tips', 25]] }]],
  ['Flower', 'Northside Hybrid', 'Balanced house hybrid, sweet berry nose.', 'Hybrid', 'THC 20–22%', [size([['1g', 100], ['3.5g', 340], ['7g', 640], ['14g', 1200]])]],
  ['Flower', 'Greenhouse Value', 'Sun-grown greenhouse. Great everyday value.', 'Hybrid', 'THC 16–18%', [size([['3.5g', 220], ['7g', 400], ['14g', 750], ['28g', 1400]])]],
  ['Pre-rolls', 'Classic Pre-roll (1g)', 'Rolled fresh with our house flower.', 'Pre-roll', '1g each', [{ name: 'Pack', type: 'single', required: true, choices: [['Single', 70], ['3-pack', 190], ['5-pack', 300]] }, { name: 'Strain', type: 'single', required: true, choices: [['Sativa', 0], ['Indica', 0], ['Hybrid', 0]] }]],
  ['Pre-rolls', 'Infused Pre-roll', 'Flower + concentrate. Not for beginners.', 'Strong', '1g each', [{ name: 'Pack', type: 'single', required: true, choices: [['Single', 150], ['3-pack', 420]] }]],
  ['Edibles', 'Fruit Gummies (10 pack)', 'Vegan gummies. Start low, go slow.', 'Edible', '', [{ name: 'Flavour', type: 'single', required: true, choices: [['Mango', 0], ['Mixed berry', 0], ['Watermelon', 0]] }, { name: 'Strength', type: 'single', required: true, choices: [['5mg per piece', 180], ['10mg per piece', 260]] }]],
  ['Edibles', 'Dark Chocolate Bar', '70% dark chocolate, 10 squares.', 'Edible', '100mg bar', [{ name: 'Bar', type: 'single', required: true, choices: [['1 bar', 220], ['2 bars', 400]] }]],
  ['Edibles', 'Brownie Bites (4 pack)', 'Fudgy, small, consistent.', 'Edible', '10mg each', [{ name: 'Pack', type: 'single', required: true, choices: [['4 pack', 160]] }]],
  ['Accessories', 'Metal Grinder', '4-piece aluminium grinder.', '', '', [{ name: 'Colour', type: 'single', required: true, choices: [['Black', 120], ['Lime', 120]] }]],
  ['Accessories', 'Papers + Tips', 'King size slim papers with tips.', '', '', [{ name: 'Qty', type: 'single', required: true, choices: [['1 booklet', 40], ['3 booklets', 100]] }]],
  ['Accessories', 'Smell-proof Pouch', 'Carbon-lined, zips closed.', '', '', [{ name: 'Size', type: 'single', required: true, choices: [['Small', 90], ['Large', 140]] }]],
];
if (db.prepare('SELECT COUNT(*) n FROM products').get().n === 0) {
  const ins = db.prepare('INSERT INTO products(category,name,description,badge,strength,base_price,options,sort) VALUES(?,?,?,?,?,?,?,?)');
  SEED.forEach(([cat, name, desc, badge, strength, opts], i) => {
    const options = opts.map(o => ({ ...o, choices: o.choices.map(([label, price]) => ({ label, price })) }));
    ins.run(cat, name, desc, badge, strength, 0, JSON.stringify(options), i);
  });
}

module.exports = { db, getSettings, saveSettings };
