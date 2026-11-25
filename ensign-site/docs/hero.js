// Ensign Studio hero: a photoreal man in a dark, reflective studio, watching HD brand screens drift past.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// ---------- brand library (real clients + clearly tagged concepts) ----------
const BRANDS = [
  { name: 'Northside', tag: 'Client · delivery', bg: '#0B1410', fg: '#F2EEDF', ac: '#3CF0A0', motif: 'pin', line: 'The Northern Suburbs, delivered' },
  { name: 'IsiMork Electrical', short: 'IsiMork', tag: 'Client · electrical', bg: '#111317', fg: '#F5F5F0', ac: '#FFD23F', motif: 'bolt', line: 'Wired right, first time' },
  { name: 'CleanSlate', tag: 'Client · car wash', bg: '#EEF4FF', fg: '#0E2A66', ac: '#2F6BFF', motif: 'bubbles', line: 'Book a wash in a minute' },
  { name: 'Your brand', tag: 'Next · you', bg: '#C9472B', fg: '#FFFFFF', ac: '#FCE9E2', motif: 'flag', line: 'Flown high, seen far' },
  { name: 'Rise & Crumb', tag: 'Concept · bakery', bg: '#F4E7D3', fg: '#3B2416', ac: '#C8742E', motif: 'ring', line: 'Baked before sunrise' },
  { name: 'Ironveld', tag: 'Concept · gym', bg: '#1A1B1E', fg: '#EDEDED', ac: '#FF7A00', motif: 'bars', line: 'Train like it counts' },
  { name: 'Kaap Roast', tag: 'Concept · coffee', bg: '#22352B', fg: '#F2E9DA', ac: '#E8B04B', motif: 'bean', line: 'Small-batch, Cape-roasted' },
  { name: 'Fynn & Co', tag: 'Concept · salon', bg: '#F7D9DF', fg: '#4A1C2B', ac: '#C2456A', motif: 'ring', line: 'Hair, done properly' },
  { name: 'Tidewater', tag: 'Concept · surf school', bg: '#0F3B47', fg: '#EAF6F4', ac: '#5FD3C6', motif: 'wave', line: 'First wave, guaranteed' },
  { name: 'Volt Cycles', tag: 'Concept · e-bikes', bg: '#F2F24A', fg: '#111111', ac: '#111111', motif: 'wheel', line: 'Ride further, sweat less' },
  { name: 'Harbour Dental', tag: 'Concept · dentist', bg: '#F3F8FC', fg: '#13324A', ac: '#2C8BC9', motif: 'tooth', line: 'Gentle care, bright smiles' },
  { name: 'Bloomfield', tag: 'Concept · florist', bg: '#E9F1E4', fg: '#24412A', ac: '#E46A8C', motif: 'petal', line: 'Flowers, same day' },
];
const KINDS = ['site', 'app', 'mark', 'social'];

// ---------- 2D drawing helpers ----------
const F = { d: (w, s) => `${w} ${s}px Unbounded, "Arial Black", sans-serif`, s: (w, s) => `${w} ${s}px Inter, system-ui, sans-serif` };
function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
function motif(x, m, cx, cy, s, c, bg) {
  x.save(); x.fillStyle = c; x.strokeStyle = c; x.lineCap = 'round';
  if (m === 'pin') { x.beginPath(); x.arc(cx, cy - s * .15, s * .38, Math.PI * .82, Math.PI * .18); x.lineTo(cx, cy + s * .55); x.closePath(); x.fill(); x.fillStyle = bg; x.beginPath(); x.arc(cx, cy - s * .15, s * .15, 0, 7); x.fill(); }
  else if (m === 'bolt') { x.beginPath(); x.moveTo(cx + s * .12, cy - s * .55); x.lineTo(cx - s * .28, cy + s * .06); x.lineTo(cx - s * .02, cy + s * .06); x.lineTo(cx - s * .14, cy + s * .55); x.lineTo(cx + s * .28, cy - s * .08); x.lineTo(cx + s * .02, cy - s * .08); x.closePath(); x.fill(); }
  else if (m === 'bubbles') { x.lineWidth = s * .06; [[0, -.1, .32], [.32, .28, .17], [-.3, .3, .12]].forEach(([a, b, r]) => { x.beginPath(); x.arc(cx + a * s, cy + b * s, r * s, 0, 7); x.stroke(); }); }
  else if (m === 'flag') { x.fillRect(cx - s * .42, cy - s * .55, s * .07, s * 1.1); x.beginPath(); x.moveTo(cx - s * .35, cy - s * .5); x.lineTo(cx + s * .45, cy - s * .5); x.lineTo(cx + s * .28, cy - s * .24); x.lineTo(cx + s * .45, cy + .02 * s); x.lineTo(cx - s * .35, cy + .02 * s); x.fill(); }
  else if (m === 'ring') { x.lineWidth = s * .1; x.beginPath(); x.arc(cx, cy, s * .36, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, s * .12, 0, 7); x.fill(); }
  else if (m === 'bars') { for (let i = 0; i < 3; i++) { const h = s * (.4 + i * .25); x.fillRect(cx - s * .4 + i * s * .3, cy + s * .45 - h, s * .2, h); } }
  else if (m === 'bean') { x.beginPath(); x.ellipse(cx, cy, s * .3, s * .42, .4, 0, 7); x.fill(); x.strokeStyle = bg; x.lineWidth = s * .05; x.beginPath(); x.moveTo(cx - s * .12, cy - s * .32); x.quadraticCurveTo(cx + s * .15, cy, cx - s * .08, cy + s * .34); x.stroke(); }
  else if (m === 'wave') { x.lineWidth = s * .08; for (let k = 0; k < 3; k++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, X = cx - s * .5 + t * s, Y = cy - s * .2 + k * s * .22 + Math.sin(t * Math.PI * 2) * s * .08; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); } }
  else if (m === 'wheel') { x.lineWidth = s * .07; x.beginPath(); x.arc(cx, cy, s * .4, 0, 7); x.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * s * .4, cy + Math.sin(a) * s * .4); x.stroke(); } }
  else if (m === 'tooth') { x.beginPath(); x.moveTo(cx - s * .32, cy - s * .3); x.quadraticCurveTo(cx, cy - s * .5, cx + s * .32, cy - s * .3); x.lineTo(cx + s * .22, cy + s * .45); x.lineTo(cx + s * .06, cy + s * .1); x.lineTo(cx - s * .06, cy + s * .1); x.lineTo(cx - s * .22, cy + s * .45); x.closePath(); x.fill(); }
  else if (m === 'petal') { for (let i = 0; i < 5; i++) { x.save(); x.translate(cx, cy); x.rotate(i * Math.PI * 2 / 5); x.beginPath(); x.ellipse(0, -s * .22, s * .13, s * .24, 0, 0, 7); x.fill(); x.restore(); } x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, s * .09, 0, 7); x.fill(); }
  x.restore();
}
function tagline(x, b, X, Y, S) { x.font = F.s(500, S); x.fillStyle = b.fg; x.globalAlpha = .55; x.fillText(b.tag, X, Y); x.globalAlpha = 1; }
function drawPanel(b, kind, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const u = W / 1600;
  x.fillStyle = b.bg; x.fillRect(0, 0, W, H); x.textBaseline = 'alphabetic';
  const nm = b.short || b.name;
  if (kind === 'site') {
    // browser chrome + landing page
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, W, 64 * u);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc((34 + i * 30) * u, 32 * u, 9 * u, 0, 7); x.fill(); });
    x.fillStyle = 'rgba(255,255,255,.16)'; rr(x, 160 * u, 16 * u, 620 * u, 32 * u, 16 * u); x.fill();
    x.font = F.s(500, 18 * u); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(`${nm.toLowerCase().replace(/[^a-z]+/g, '')}.co.za`, 186 * u, 39 * u);
    motif(x, b.motif, 120 * u, 140 * u, 70 * u, b.ac, b.bg);
    x.font = F.d(600, 30 * u); x.fillStyle = b.fg; x.fillText(nm, 180 * u, 152 * u);
    x.font = F.s(500, 22 * u); x.globalAlpha = .7; ['Menu', 'About', 'Book'].forEach((t, i) => x.fillText(t, (1020 + i * 120) * u, 150 * u)); x.globalAlpha = 1;
    x.fillStyle = b.ac; rr(x, 1380 * u, 112 * u, 160 * u, 56 * u, 28 * u); x.fill(); x.fillStyle = b.bg; x.font = F.s(600, 22 * u); x.fillText('Order', 1418 * u, 148 * u);
    tagline(x, b, 90 * u, 330 * u, 26 * u);
    x.font = F.d(600, 104 * u); x.fillStyle = b.fg; const words = b.line.split(' '); const half = Math.ceil(words.length / 2);
    x.fillText(words.slice(0, half).join(' '), 84 * u, 460 * u); x.fillStyle = b.ac; x.fillText(words.slice(half).join(' '), 84 * u, 580 * u);
    x.fillStyle = b.ac; rr(x, 90 * u, 650 * u, 260 * u, 76 * u, 38 * u); x.fill(); x.fillStyle = b.bg; x.font = F.s(600, 28 * u); x.fillText('Get started', 128 * u, 700 * u);
    x.globalAlpha = .9; motif(x, b.motif, 1260 * u, 520 * u, 360 * u, b.ac, b.bg); x.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(127,127,127,.16)'; rr(x, (90 + i * 480) * u, 800 * u, 440 * u, 150 * u, 22 * u); x.fill(); x.fillStyle = b.fg; x.globalAlpha = .75; x.font = F.s(600, 24 * u); x.fillText(['Fast', 'Local', 'Trusted'][i], (120 + i * 480) * u, 870 * u); x.globalAlpha = .45; x.font = F.s(400, 20 * u); x.fillText('A line about why it matters', (120 + i * 480) * u, 910 * u); x.globalAlpha = 1; }
  } else if (kind === 'app') {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, b.bg); g.addColorStop(1, b.bg); x.fillStyle = g; x.fillRect(0, 0, W, H);
    tagline(x, b, 90 * u, 120 * u, 26 * u);
    x.font = F.d(600, 88 * u); x.fillStyle = b.fg; x.fillText(nm, 84 * u, 240 * u);
    x.font = F.s(400, 30 * u); x.globalAlpha = .7; x.fillText(b.line, 90 * u, 300 * u); x.globalAlpha = 1;
    // phone
    const px = 960 * u, py = 90 * u, pw = 440 * u, ph = 860 * u;
    x.fillStyle = '#0B0C0F'; rr(x, px, py, pw, ph, 60 * u); x.fill();
    x.save(); rr(x, px + 16 * u, py + 16 * u, pw - 32 * u, ph - 32 * u, 46 * u); x.clip();
    x.fillStyle = b.bg; x.fillRect(px, py, pw, ph);
    x.fillStyle = b.ac; x.fillRect(px, py, pw, 260 * u);
    motif(x, b.motif, px + pw / 2, py + 150 * u, 130 * u, b.bg, b.ac);
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(127,127,127,.18)'; rr(x, px + 40 * u, py + (300 + i * 112) * u, pw - 80 * u, 92 * u, 20 * u); x.fill(); x.fillStyle = b.ac; x.beginPath(); x.arc(px + 90 * u, py + (346 + i * 112) * u, 24 * u, 0, 7); x.fill(); x.fillStyle = b.fg; x.globalAlpha = .7; x.fillRect(px + 130 * u, py + (334 + i * 112) * u, 160 * u, 12 * u); x.globalAlpha = .35; x.fillRect(px + 130 * u, py + (356 + i * 112) * u, 110 * u, 10 * u); x.globalAlpha = 1; }
    x.fillStyle = b.ac; rr(x, px + 40 * u, py + ph - 130 * u, pw - 80 * u, 72 * u, 36 * u); x.fill();
    x.restore();
    x.font = F.s(600, 26 * u); x.fillStyle = b.fg; ['Live order tracking', 'Online booking', 'Loyalty and offers'].forEach((t, i) => { x.fillStyle = b.ac; x.beginPath(); x.arc(102 * u, (560 + i * 80) * u, 10 * u, 0, 7); x.fill(); x.fillStyle = b.fg; x.fillText(t, 130 * u, (569 + i * 80) * u); });
  } else if (kind === 'mark') {
    motif(x, b.motif, W / 2, 380 * u, 380 * u, b.ac, b.bg);
    x.font = F.d(600, 96 * u); x.fillStyle = b.fg; x.textAlign = 'center'; x.fillText(nm, W / 2, 720 * u); x.textAlign = 'left';
    tagline(x, b, 90 * u, 110 * u, 26 * u);
    [b.bg, b.fg, b.ac].forEach((col, i) => { x.fillStyle = col; rr(x, (500 + i * 210) * u, 800 * u, 180 * u, 110 * u, 18 * u); x.fill(); x.strokeStyle = 'rgba(127,127,127,.4)'; x.lineWidth = 2 * u; x.stroke(); x.fillStyle = b.fg; x.globalAlpha = .7; x.font = F.s(500, 20 * u); x.fillText(col.toUpperCase(), (500 + i * 210) * u, 945 * u); x.globalAlpha = 1; });
  } else { // social post
    x.fillStyle = 'rgba(127,127,127,.12)'; x.fillRect(0, 0, W, H);
    const s = 860 * u, sx = (W - s) / 2, sy = 70 * u;
    x.fillStyle = b.bg; rr(x, sx, sy, s, s, 28 * u); x.fill(); x.strokeStyle = 'rgba(127,127,127,.35)'; x.lineWidth = 3 * u; x.stroke();
    motif(x, b.motif, sx + s * .72, sy + s * .3, s * .38, b.ac, b.bg);
    x.font = F.d(600, 76 * u); x.fillStyle = b.fg; const w2 = b.line.split(' '); const h2 = Math.ceil(w2.length / 2);
    x.fillText(w2.slice(0, h2).join(' '), sx + 56 * u, sy + s * .66); x.fillStyle = b.ac; x.fillText(w2.slice(h2).join(' '), sx + 56 * u, sy + s * .66 + 86 * u);
    x.font = F.s(600, 26 * u); x.fillStyle = b.fg; x.globalAlpha = .7; x.fillText(`@${nm.toLowerCase().replace(/[^a-z]+/g, '')}`, sx + 56 * u, sy + s - 50 * u); x.globalAlpha = 1;
    tagline(x, b, 60 * u, 110 * u, 26 * u);
  }
  return c;
}
function roundedAlpha(W, H, r) { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; rr(x, 0, 0, W, H, r); x.fill(); const t = new THREE.CanvasTexture(c); return t; }

// ---------- scene ----------
export async function startHero({ canvas, man, onBrand = () => {}, reduced = false, textEdge = () => 0 }) {
  const small = Math.min(innerWidth, innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const BG = new THREE.Color(0x11151C);
  const scene = new THREE.Scene(); scene.background = BG; scene.fog = new THREE.Fog(0x11151C, 13, 30);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  // reflective floor, darkened so reflections read as polished stone
  const mirror = new Reflector(new THREE.PlaneGeometry(80, 80), { textureWidth: small ? 512 : 1024, textureHeight: small ? 512 : 1024, color: 0x8a8f99 });
  mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0x11151C, transparent: true, opacity: .72 }));
  veil.rotation.x = -Math.PI / 2; veil.position.y = .005; scene.add(veil);
  // fine floor grid
  const grid = new THREE.GridHelper(60, 60, 0x2B3240, 0x1E242F); grid.position.y = .01; grid.material.transparent = true; grid.material.opacity = .35; scene.add(grid);
  // soft light pools
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xF2704E, transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, .02, 0); scene.add(pool);
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x3A4A66, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  haze.position.set(0, 4, -10); scene.add(haze);

  // ---------- panels ----------
  const PW = 2.6, PH = 1.625, TW = small ? 960 : 1600, TH = small ? 600 : 1000;
  await document.fonts.ready.catch(() => {});
  const alpha = roundedAlpha(512, 320, 22);
  const rows = [
    { z: -2.2, y: 2.35, s: 1.0, speed: .28, dir: 1 },
    { z: -5.6, y: 3.55, s: 1.15, speed: .18, dir: -1 },
    { z: -9.5, y: 4.9, s: 1.3, speed: .12, dir: 1 },
  ];
  const all = [];
  const order = [];
  BRANDS.forEach((b, bi) => KINDS.forEach((k, ki) => order.push({ b, k, key: bi * 4 + ki })));
  // spread the cards across rows so each row mixes brands and kinds
  const per = small ? [8, 8, 6] : [12, 12, 10];
  let n = 0;
  rows.forEach((row, ri) => {
    row.items = []; row.gap = PW * row.s * 1.12; row.span = per[ri] * row.gap;
    for (let i = 0; i < per[ri]; i++) {
      const it = order[(n++ * 7) % order.length];
      const tex = new THREE.CanvasTexture(drawPanel(it.b, it.k, TW, TH)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const g = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(PW * row.s, PH * row.s), new THREE.MeshBasicMaterial({ map: tex, alphaMap: alpha, transparent: true, toneMapped: false }));
      const rimGeo = new THREE.PlaneGeometry(PW * row.s + .04, PH * row.s + .04);
      const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, alphaMap: alpha, transparent: true, opacity: .08, depthWrite: false })); rim.position.z = -.005;
      g.add(rim, face); scene.add(g);
      row.items.push({ g, face, rim, b: it.b, base: i * row.gap });
      all.push(g);
    }
  });

  // ---------- the man ----------
  const manTex = await new THREE.TextureLoader().loadAsync(man); manTex.colorSpace = THREE.SRGBColorSpace; manTex.anisotropy = 8;
  const MH = 2.15, MW = MH * manTex.image.width / manTex.image.height;
  const manMesh = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ map: manTex, transparent: true, alphaTest: .02, toneMapped: false, color: 0xE4E7EE }));
  manMesh.geometry.translate(0, MH / 2, 0); scene.add(manMesh);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .42), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: .6, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; scene.add(shadow);

  // ---------- layout ----------
  let portrait = false, manX = 0;
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; portrait = cam.aspect < .9; cam.updateProjectionMatrix();
    manX = portrait ? .25 : 2.1;
    manMesh.position.set(manX, 0, 2.4); shadow.position.x = manX + .05; shadow.position.z = 2.45; pool.position.x = manX;
  }
  new ResizeObserver(layout).observe(canvas); layout();

  // ---------- interaction ----------
  let scrub = 0, vel = 0, drag = null, mx = 0, my = 0, shown = '';
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: scrub, t: performance.now() }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag) { const d = (e.clientX - drag.x) / canvas.clientWidth * 8; vel = (drag.s + d - scrub) * 8; scrub = drag.s + d; } });
  const end = () => { drag = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); vel -= e.deltaX * .01; } }, { passive: false });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  let visible = true; new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(loop); }).observe(canvas);
  const clock = new THREE.Clock(); let sx = 0, sy = 0; const pv = new THREE.Vector3();
  function loop() {
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (!drag) { scrub += vel * dt; vel *= Math.pow(.05, dt); }
    const drift = reduced ? 0 : t;
    sx += (mx - sx) * .04; sy += (my - sy) * .04;
    const cx = portrait ? .2 : 1.0;
    cam.position.set(cx + sx * .8, 2.0 - sy * .3 + (portrait ? .6 : 0), portrait ? 14.5 : 11.5); cam.lookAt(cx + sx * .3, portrait ? 2.6 : 2.25, 0);
    let best = null, bestD = 1e9;
    rows.forEach((row, ri) => row.items.forEach(it => {
      const raw = it.base + (drift * row.speed + scrub * (1 - ri * .25)) * row.dir;
      const x = ((raw % row.span) + row.span) % row.span - row.span / 2 + manX * .6;
      it.g.position.set(x, row.y, row.z);
      it.g.rotation.y = -x * .035;
      // fade screens that sit behind the headline: measured on screen, so it holds at any width
      let fade = 1;
      if (!portrait) { const edge = textEdge(); if (edge) { pv.set(x + PW * row.s * .5, row.y, row.z).project(cam); const sxp = (pv.x + 1) / 2 * canvas.clientWidth; fade = Math.min(1, Math.max(.08, (sxp - edge + 40) / 340)); } }
      it.face.material.opacity = fade; it.rim.visible = fade > .6;
      if (ri === 0) { const d = Math.abs(x - manX); if (d < bestD) { bestD = d; best = it; } }
    }));
    rows[0].items.forEach(it => { const on = it === best; it.rim.material.opacity += ((on ? .9 : .08) - it.rim.material.opacity) * .15; it.rim.material.color.set(on ? 0xF2704E : 0xFFFFFF); const s = on ? 1.06 : 1; it.g.scale.x += (s - it.g.scale.x) * .12; it.g.scale.y = it.g.scale.x; });
    if (best && best.b.name !== shown) { shown = best.b.name; onBrand(shown); }
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
