# Northside: website, shop, driver app and CRM

One small Node server runs four apps:

| URL | Who | What |
|---|---|---|
| `/` | Everyone | Brand website: a live 3D gallery (three.js) where scrolling glides the camera between products on stone plinths, fullscreen snap sections, line-drawn delivery map, live delivery zones, 18+ gate |
| `/shop` | Customers | 3D-rendered product shots, tilt cards, drag-to-rotate 3D product view, options and prices, cart, checkout with map pin, **live order tracking** (accepted → packed → on the way → delivered), driver's live location and ETA |
| `/driver` | Drivers | Log in with phone + PIN, see assigned jobs, navigate, "Picked up" starts **live GPS sharing**, must tick "ID checked (18+)" before "Delivered" |
| `/admin` | You | Live orders board with sound + browser alerts, accept/reject, mark packed, assign driver, dispatch, live map of drivers, **CRM** (customers, spend, order history, tags, notes, activity), menu & price editor, drivers, delivery zones and fees, open/close store, CSV export, webhook to an external CRM |

## Run it

Needs Node 22.13 or newer.

```bash
cd northside-app
npm install
ADMIN_PASSWORD='pick-a-strong-one' npm start
# → http://localhost:3000        website
# → http://localhost:3000/shop   shop
# → http://localhost:3000/admin  admin / CRM
# → http://localhost:3000/driver driver app
```

First steps in `/admin`:
1. **Drivers**: add each driver with name, mobile number and a PIN.
2. **Menu & prices**: the menu ships with placeholder products and prices. Edit them, and hide what you don't stock. Product images are rendered in 3D automatically from the category/name (jar, pre-rolls, gummies, chocolate, brownies, grinder, papers, pouch). Set a Photo URL to use a real photo instead.
3. **Settings**: minimum order, free-delivery threshold, prep time, delivery fee per suburb, support WhatsApp number.

## How an order flows

1. Customer orders → admin hears a chime and sees it in **New**.
2. **Accept** → customer's screen updates to "Accepted" instantly.
3. Pick a driver in the dropdown, then **Mark packed** → customer sees "Packed".
4. Driver taps **Picked up · start trip** (or you press **Dispatch**) → customer sees "On the way". The driver's phone sends GPS every few seconds, and the customer and admin maps move live with the ETA counting down.
5. Driver checks ID, ticks the box, taps **Mark delivered** → order closes and the customer's CRM record updates (orders, spend, activity).

ETA = remaining prep time + road distance (straight line × 1.35) at the average speed in Settings.

## Feeding an external CRM

Admin → Settings → **CRM webhook URL**. Every event (`order.placed`, `order.accepted`, `order.packed`, `order.assigned`, `order.out_for_delivery`, `order.delivered`, `order.cancelled`) is POSTed as JSON with the full order and customer. Point it at a Zapier/Make/HubSpot/Google Sheets webhook. You can also export **customers.csv** and **orders.csv** from the Customers tab.

## Deploying

Any host that runs a Node server with a persistent disk works (Render, Railway, Fly.io, a VPS). Set:

- `ADMIN_PASSWORD`: required, otherwise it is `change-me`
- `PORT`: defaults to 3000
- `DATA_DIR`: folder for the SQLite database (put it on the persistent disk)

Use HTTPS: phones only share GPS with the driver app over https. Maps use CARTO's free Positron tiles (OpenStreetMap data). For heavy traffic, get a CARTO or other paid tile key and swap the URL in `store.js`/`admin.js`.

## Design

Warm beige + charcoal with a sand accent, Cormorant Garamond + Inter, all set as tokens in `public/base.css`. The 3D models and lighting live in `public/js/scenes.js`: golden-hour sun filtered through cannabis leaves (soft dappled shadows that sway gently), limewashed arches and travertine plinths. Devices without WebGL get a flat gradient fallback, and reduced-motion settings stop the camera drift and rotation.

## Tests

`npm test` runs the whole flow in three headless browsers (customer, admin, driver) plus API rule checks: under-18 blocked, minimum order, out-of-area, server-side pricing, admin auth, ID check required before delivery.

## Not included yet

- **Online card payments.** Orders are cash, card machine or EFT on delivery. Note that most payment gateways won't onboard cannabis merchants in South Africa.
- **SMS/WhatsApp notifications** to customers. The tracking link is shown after checkout and kept under "Orders" on their phone.
- Commercial sale of cannabis isn't licensed in South Africa yet. Get legal advice on your operating model before going live.
