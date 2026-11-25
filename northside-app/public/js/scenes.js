// Northside 3D: procedural product models, a lit gallery room, thumbnails and a turntable viewer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const PALETTE = { wall: 0xE6DCCD, floor: 0xD8CCBA, stone: 0xEDE6DA, charcoal: 0x262420, sand: 0xC9B48E, sage: 0x8C9A6E, terracotta: 0xC07A5A, cream: 0xF4EFE6 };

// ---------- helpers ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, ...o });
function shadowAll(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function stoneTex(seed = 1) {
  const r = rng(seed);
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#EAE2D5'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(150,128,100,${0.015 + r() * 0.035})`; x.lineWidth = 1 + r() * 5; x.beginPath(); const y = r() * h; x.moveTo(0, y); x.bezierCurveTo(w * .3, y + (r() - .5) * 30, w * .7, y + (r() - .5) * 30, w, y + (r() - .5) * 20); x.stroke(); }
    for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(120,100,80,${r() * 0.07})`; x.beginPath(); x.ellipse(r() * w, r() * h, r() * 3 + .5, r() * 1.5 + .3, 0, 0, 7); x.fill(); }
  });
}
function labelTex(title, sub) {
  return canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = '#F4EFE6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#262420'; x.textAlign = 'center';
    x.font = '500 30px Inter, sans-serif'; x.letterSpacing = '10px'; x.fillText('NORTHSIDE', w / 2, 70);
    x.font = 'italic 400 78px "Cormorant Garamond", serif'; x.letterSpacing = '0px'; x.fillText(title, w / 2, 160);
    x.font = '400 24px Inter, sans-serif'; x.letterSpacing = '6px'; x.fillText(sub.toUpperCase(), w / 2, 215);
    x.fillRect(w / 2 - 60, 88, 120, 2);
  });
}

// ---------- products ----------
function bud(color, seed) {
  // A bud = smooth core + many small rounded calyxes + a few orange pistils
  const r = rng(seed), g = new THREE.Group(), base = new THREE.Color(color);
  const mat = phys(0xffffff, { roughness: 0.78, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xF6F3EA), roughness: 0.7 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), phys(base.clone().multiplyScalar(0.8), { roughness: 0.9 }));
  core.scale.set(0.11, 0.2, 0.11); core.position.y = 0.2; g.add(core);
  const N = 150, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), mat, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const v = 1 - 2 * (i + 0.5) / N, th = i * 2.399963 + r() * 0.3, rr = Math.sqrt(1 - v * v);
    const taper = 0.75 + 0.25 * (1 - Math.abs(v - 0.15));
    const pos = new THREE.Vector3(Math.cos(th) * rr * 0.12 * taper, 0.2 + v * 0.21, Math.sin(th) * rr * 0.12 * taper);
    const s = 0.026 + r() * 0.02;
    e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e);
    m4.compose(pos, q, new THREE.Vector3(s, s * (1.2 + r() * 0.5), s)); inst.setMatrixAt(i, m4);
    c.copy(base).offsetHSL((r() - .5) * 0.04, (r() - .5) * 0.1, (r() - .5) * 0.1); inst.setColorAt(i, c);
  }
  g.add(inst);
  const hair = std(0xC98A4B, { roughness: 1 });
  for (let i = 0; i < 30; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 4), hair); const a = r() * 7, y = r() * 0.38; h.position.set(Math.cos(a) * 0.13, 0.03 + y, Math.sin(a) * 0.13); h.lookAt(h.position.clone().multiplyScalar(2)); h.rotateX(Math.PI / 2 + (r() - .5)); g.add(h); }
  return g;
}
const STRAIN_COLOR = { sativa: 0x8C9C63, indica: 0x6A6E52, hybrid: 0x7D8A5C, value: 0x939A6B };
function jar({ name = 'Cape Haze', sub = 'Indoor flower', strain = 'hybrid' } = {}) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.42, 0], [0.46, 0.04], [0.47, 0.9], [0.43, 0.96], [0.40, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.04, thickness: 0.25, ior: 1.45, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.2 }));
  glass.castShadow = true; g.add(glass);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 64), std(PALETTE.charcoal, { roughness: 0.35, metalness: 0.2 }));
  lid.position.y = 1.08; g.add(lid);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.012, 8, 64), std(PALETTE.sand, { metalness: 0.9, roughness: 0.25 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.98; g.add(ring);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.472, 0.472, 0.34, 64, 1, true, -Math.PI * 0.42, Math.PI * 0.84), std(0xffffff, { map: labelTex(name, sub), roughness: 0.8 }));
  label.position.y = 0.42; g.add(label);
  const c = STRAIN_COLOR[strain] || STRAIN_COLOR.hybrid;
  [[-0.17, 0.02, 0.06, 1, 0.3], [0.17, 0.02, -0.04, 2, -0.2], [0.0, 0.02, -0.19, 3, 0.1], [0.03, 0.33, 0.04, 4, 1.2]].forEach(([x, y, z, s, rz]) => { const b = bud(c, s * 17 + name.length); b.position.set(x, y, z); b.rotation.z = rz * 0.5; b.scale.setScalar(1.05); g.add(b); });
  return shadowAll(g);
}
function preroll() {
  // three pre-rolls standing in a short ceramic cup, gently fanned
  const g = new THREE.Group();
  const paper = std(0xF3EEE4, { roughness: 0.95 }), tip = std(0xB9A88A, { roughness: 0.9 });
  const cupProf = [[0, 0.0], [0.2, 0.0], [0.215, 0.02], [0.22, 0.34], [0.2, 0.34], [0.195, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProf, 64), std(PALETTE.charcoal, { roughness: 0.55 })); g.add(cup);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2215, 0.2215, 0.05, 64, 1, true), std(PALETTE.sand, { metalness: 0.85, roughness: 0.3 })); band.position.y = 0.27; g.add(band);
  [[-0.06, 0.02, -0.2, 0.12], [0.06, -0.03, 0.18, 0.08], [0.0, 0.07, 0.02, -0.16]].forEach(([x, z, rz, rx]) => {
    const one = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.LatheGeometry([[0.03, 0], [0.052, 0.78], [0.048, 0.82], [0.016, 0.88], [0, 0.9]].map(([px, py]) => new THREE.Vector2(px, py)), 48), paper);
    const filt = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.16, 32), tip); filt.position.y = 0.08;
    one.add(cone, filt); one.position.set(x, 0.05, z); one.rotation.set(rx, 0, rz); g.add(one);
  });
  return shadowAll(g);
}
function gummies() {
  const g = new THREE.Group(), r = rng(4), cols = [PALETTE.terracotta, PALETTE.sage, PALETTE.sand, 0xD9A37A, 0xA9B58A];
  const pos = [[0, 0, 0], [0.32, 0, 0.1], [-0.3, 0, 0.12], [0.08, 0, 0.36], [-0.12, 0, -0.3], [0.2, 0, -0.26], [0.05, 0.26, 0.05], [-0.18, 0.25, 0.1]];
  pos.forEach(([x, y, z], i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.24, 0.26, 4, 0.08), phys(cols[i % cols.length], { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, transmission: 0.15, thickness: 0.2, sheen: 0.4 }));
    m.position.set(x, 0.12 + y, z); m.rotation.set((r() - .5) * .5, r() * 3, (r() - .5) * .5); g.add(m);
  });
  return shadowAll(g);
}
function chocolate() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.08, 0.55, 3, 0.02), std(0x3B2A22, { roughness: 0.35 })); bar.position.y = 0.04; g.add(bar);
  const sq = std(0x412E25, { roughness: 0.3 });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.05, 0.22, 2, 0.015), sq); b.position.set(-0.44 + i * 0.22, 0.1, -0.13 + j * 0.26); g.add(b); }
  const sleeve = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.16, 0.6, 3, 0.02), std(PALETTE.cream, { roughness: 0.9 })); sleeve.position.set(0.32, 0.07, 0); g.add(sleeve);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.12), std(0xffffff, { map: labelTex('Dark 70%', '100mg') })); lab.rotation.x = -Math.PI / 2; lab.position.set(0.32, 0.152, 0); lab.rotation.z = Math.PI / 2; g.add(lab);
  g.rotation.y = -0.4; return shadowAll(g);
}
function brownie() {
  const g = new THREE.Group(), r = rng(3);
  for (let i = 0; i < 4; i++) {
    const geo = new RoundedBoxGeometry(0.3, 0.2, 0.3, 3, 0.04), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) > 0.08) p.setY(k, p.getY(k) + (r() - .5) * 0.03);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std(0x4A3125, { roughness: 0.9 })); m.position.set((i % 2) * 0.34 - 0.17, 0.1 + (i > 1 ? 0 : 0), Math.floor(i / 2) * 0.34 - 0.17); m.rotation.y = (r() - .5) * .3; g.add(m);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.03, 64), std(PALETTE.cream, { roughness: 0.3 })); plate.position.y = -0.015; g.add(plate);
  return shadowAll(g);
}
function grinder() {
  const g = new THREE.Group(), metal = std(PALETTE.charcoal, { metalness: 0.85, roughness: 0.32 }), accent = std(PALETTE.sand, { metalness: 0.9, roughness: 0.25 });
  [[0, 0.16, 0.32], [0.17, 0.14, 0.32], [0.32, 0.12, 0.33]].forEach(([y, h, r], i) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64), metal); c.position.y = y + h / 2; g.add(c); if (i < 2) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 64), accent); t.rotation.x = Math.PI / 2; t.position.y = y + h; g.add(t); } });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.05, 64), metal); top.position.y = 0.46; g.add(top);
  return shadowAll(g);
}
function papers() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.05, 0.3, 2, 0.01), std(i === 1 ? PALETTE.charcoal : PALETTE.cream, { roughness: 0.85 })); b.position.set(i * 0.04, 0.025 + i * 0.052, i * 0.03); b.rotation.y = (i - 1) * 0.12; g.add(b); }
  return shadowAll(g);
}
function pouch() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.16, 0.6, 6, 0.07), std(PALETTE.charcoal, { roughness: 1 })); b.position.y = 0.08; g.add(b);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.012, 0.012), std(PALETTE.sand, { metalness: 0.9, roughness: 0.3 })); zip.position.set(0, 0.165, -0.2); g.add(zip);
  return shadowAll(g);
}


// ---------- Leaf gobo: cannabis-leaf silhouettes that cast dappled "sunlight through leaves" shadows ----------
function leafCanvas(seed) {
  const r = rng(seed), S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineCap = 'round';
  const leaf = (cx, cy, size, rot) => {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    [[-90, 1], [-60, .86], [-120, .86], [-30, .62], [-150, .62], [0, .34], [180, .34]].forEach(([a, l]) => {
      x.save(); x.rotate(a * Math.PI / 180); const len = size * l, w = len * 0.16; x.beginPath(); x.moveTo(0, 0);
      const N = 16; for (let i = 1; i <= N; i++) { const t = i / N, hw = w * Math.pow(Math.sin(Math.PI * Math.min(t, .999)), .85) * (i % 2 ? 1 : .8); x.lineTo(len * t, -hw); }
      for (let i = N; i >= 0; i--) { const t = i / N, hw = w * Math.pow(Math.sin(Math.PI * Math.min(t, .999)), .85) * (i % 2 ? 1 : .8); x.lineTo(len * t, hw); }
      x.fill(); x.restore();
    });
    x.lineWidth = size * 0.035; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, size * 0.45); x.stroke(); x.restore();
  };
  // a few branches with leaves along them, leaving gaps of light between
  for (let b = 0; b < 4; b++) {
    let px = r() * S, py = -40, ang = Math.PI / 2 + (r() - .5) * 0.9; x.lineWidth = 7 + r() * 5;
    x.beginPath(); x.moveTo(px, py);
    const pts = [];
    for (let k = 0; k < 6; k++) { ang += (r() - .5) * 0.5; px += Math.cos(ang) * 200; py += Math.sin(ang) * 200; x.lineTo(px, py); pts.push([px, py, ang]); }
    x.stroke();
    pts.forEach(([lx, ly, la], k) => { const side = k % 2 ? 1 : -1; leaf(lx + side * 60, ly, 110 + r() * 90, la + side * (0.9 + r() * 0.5) - Math.PI / 2); });
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function makeGobo(size, seed, repeat = 1) {
  const tex = leafCanvas(seed); if (repeat !== 1) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false }));
  m.castShadow = true; m.receiveShadow = false;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  return m;
}
// put the gobo between the light and its target, facing the light; returns a sway(t) function for a gentle breeze
function placeGobo(gobo, light, at = 0.4) {
  const base = new THREE.Vector3();
  const update = t => {
    base.copy(light.target.position).lerp(light.position, at);
    gobo.position.copy(base); gobo.position.x += Math.sin(t * 0.5) * 0.08; gobo.position.y += Math.sin(t * 0.37 + 1) * 0.05;
    gobo.lookAt(light.position); gobo.rotateZ(Math.sin(t * 0.43) * 0.035);
  };
  update(0); return update;
}
function plasterTex(seed = 3) {
  const r = rng(seed);
  return canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#E8DECF'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const a = 0.025 + r() * 0.05; g.addColorStop(0, r() > .5 ? `rgba(255,250,240,${a})` : `rgba(160,140,115,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.save(); x.translate(r() * w, r() * h); x.scale(40 + r() * 160, 30 + r() * 120); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
  });
}

// Pick a model from a menu product
export function modelFor(p) {
  const n = (p.name || '').toLowerCase(), b = (p.badge || '').toLowerCase();
  if (p.category === 'Flower') return { kind: 'jar', name: p.name, sub: p.strength || 'Flower', strain: n.includes('value') ? 'value' : b.includes('sativa') ? 'sativa' : b.includes('indica') ? 'indica' : 'hybrid' };
  if (p.category === 'Pre-rolls') return { kind: 'preroll' };
  if (n.includes('chocolate')) return { kind: 'chocolate' };
  if (n.includes('brownie')) return { kind: 'brownie' };
  if (p.category === 'Edibles') return { kind: 'gummies' };
  if (n.includes('grinder')) return { kind: 'grinder' };
  if (n.includes('paper')) return { kind: 'papers' };
  if (n.includes('pouch')) return { kind: 'pouch' };
  return { kind: 'gummies' };
}
const BUILD = { jar, preroll, gummies, chocolate, brownie, grinder, papers, pouch };
export function buildModel(spec) { return (BUILD[spec.kind] || gummies)(spec); }

// ---------- shared renderer setup ----------
function setupRenderer(canvas, alpha = false) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
function envFor(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
}
function plinth(seed, h = 0.9, r = 0.62) {
  const tex = stoneTex(seed); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96), std(0xffffff, { map: tex, roughness: 0.75 }));
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true; return m;
}
export const webglOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Gallery: a long warm room, one plinth per station; scroll moves the camera ----------
export function createGallery(canvas, stations) {
  const renderer = setupRenderer(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(PALETTE.wall); scene.fog = new THREE.Fog(PALETTE.wall, 10, 26);
  envFor(renderer, scene);
  const GAP = 7, len = (stations.length + 2) * GAP;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, 20), std(PALETTE.floor, { roughness: 0.42, map: (() => { const t = stoneTex(5); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 4, 5); return t; })() }));
  floor.rotation.x = -Math.PI / 2; floor.position.x = len / 2 - GAP; floor.receiveShadow = true; scene.add(floor);
  const wtex = plasterTex(3); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(len / 9, 1);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 9), std(0xffffff, { map: wtex, roughness: 0.97 })); wall.position.set(len / 2 - GAP, 4.5, -3.2); wall.receiveShadow = true; scene.add(wall);
  const reveal = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.05), std(0x8F8170)); reveal.position.set(len / 2 - GAP, 0.02, -3.17); scene.add(reveal);
  // Golden-hour sun, low from the front-left, filtered through cannabis leaves
  scene.add(new THREE.HemisphereLight(0xFFF3E3, 0xC4B29A, 0.85));
  const sun = new THREE.DirectionalLight(0xFFD3A0, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 40 }); scene.add(sun, sun.target);
  const gobo = makeGobo(14, 21, 2.2); scene.add(gobo);
  const sway = placeGobo(gobo, sun, 0.42);
  const models = [];
  stations.forEach((spec, i) => {
    const x = i * GAP;
    // limewashed arch niche behind each plinth
    const sh = new THREE.Shape(); sh.moveTo(-1.45, 0); sh.lineTo(-1.45, 3.3); sh.absarc(0, 3.3, 1.45, Math.PI, 0, true); sh.lineTo(1.45, 0); sh.lineTo(-1.45, 0);
    const atex = plasterTex(10 + i); atex.wrapS = atex.wrapT = THREE.RepeatWrapping; atex.repeat.set(0.35, 0.22);
    const arch = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), std(0xD9CBB6, { map: atex, roughness: 1 })); arch.position.set(x, 0, -3.18); arch.receiveShadow = true; scene.add(arch);
    const p = plinth(i + 2, spec.plinthH || 0.95); p.position.x = x; scene.add(p);
    const m = buildModel(spec); m.position.set(x, (spec.plinthH || 0.95) + 0.001, 0); m.scale.setScalar(spec.scale || 1.1); scene.add(m); models.push(m);
    const key = new THREE.SpotLight(0xFFF4E6, 16, 12, Math.PI / 10, 0.7, 1.4); key.position.set(x + 2, 5, 4); key.target.position.set(x, 1.2, 0); scene.add(key, key.target);
  });
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  let target = 0, cur = 0, mx = 0, my = 0, smx = 0, smy = 0, raf, visible = true;
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  const clock = new THREE.Clock();
  let paused = false;
  function frame() {
    if (paused) { raf = null; return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    cur += (target - cur) * (reduced ? 1 : 1 - Math.pow(0.002, dt));
    smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;
    const x = cur * GAP, portrait = camera.aspect < 0.9;
    const dist = portrait ? 8.4 : 7.4, side = portrait ? 0 : -1.55;
    camera.position.set(x + side + smx * 0.6, 2.25 + smy * -0.25 + (portrait ? 0.4 : 0), dist);
    camera.lookAt(x + side, portrait ? 1.75 : 1.35, 0);
    sun.position.set(x - 7, 7.5, 7); sun.target.position.set(x, 1.2, -2.2); sway(reduced ? 0 : t);
    if (!reduced) models.forEach((m, i) => { m.rotation.y = t * 0.18 + i; });
    renderer.render(scene, camera);
    raf = visible ? requestAnimationFrame(frame) : null;
  }
  frame();
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible && !raf) { clock.getDelta(); frame(); } });
  return {
    setProgress(p) { target = p; },
    setPaused(v) { if (v === paused) return; paused = v; if (!v && !raf) { clock.getDelta(); frame(); } },
    renderer,
  };
}

// ---------- Thumbnails: render each product once on a stone plinth, return image URLs ----------
export async function renderThumbs(specs, size = 640, look = 'dark') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const renderer = setupRenderer(canvas, true); renderer.setPixelRatio(1); renderer.setSize(size, size, false);
  const scene = new THREE.Scene(); envFor(renderer, scene);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xFFF6EA, 0xBFAE96, 0.9));
  const key = new THREE.DirectionalLight(0xFFDDB3, 2.6); key.position.set(-3, 5, 3.5); key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(key, key.target);
  if (look === 'dark') { ground.material.opacity = 0.45; const lime = new THREE.DirectionalLight(0xC6FF3D, 3.2); lime.position.set(3, 1.5, -3); scene.add(lime); const back = new THREE.DirectionalLight(0xC6FF3D, 1.4); back.position.set(-3, 3, -2); scene.add(back); }
  else { const gobo = makeGobo(5, 7); scene.add(gobo); placeGobo(gobo, key, 0.45); }
  const rim = new THREE.DirectionalLight(0xFFE2BE, 1.0); rim.position.set(-3, 2, -3); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const out = [];
  for (const spec of specs) {
    const m = buildModel(spec); m.rotation.y = spec.kind === 'jar' ? 0.52 : -0.5; scene.add(m);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y * 1.2, s.z) * 1.0;
    cam.position.set(c.x + r * 1.5, c.y + r * 1.15, c.z + r * 2.6); cam.lookAt(c.x, c.y - s.y * 0.05, c.z);
    renderer.render(scene, cam);
    out.push(await new Promise(res => canvas.toBlob(b => res(URL.createObjectURL(b)), 'image/png')));
    scene.remove(m); m.traverse(o => { o.geometry?.dispose?.(); });
  }
  renderer.dispose(); renderer.forceContextLoss();
  return out;
}

// ---------- Turntable viewer for the product sheet (drag to rotate) ----------
export function createViewer(container, spec, look = 'dark') {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  container.appendChild(canvas);
  const renderer = setupRenderer(canvas, true);
  const scene = new THREE.Scene(); envFor(renderer, scene);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xFFF6EA, 0xBFAE96, 0.8));
  const key = new THREE.DirectionalLight(0xFFDDB3, 2.6); key.position.set(-3, 5, 3.5); key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(key, key.target);
  let sway = () => {}; const clock = new THREE.Clock();
  if (look === 'dark') { ground.material.opacity = 0.45; const lime = new THREE.DirectionalLight(0xC6FF3D, 3.2); lime.position.set(3, 1.5, -3); scene.add(lime); const back = new THREE.DirectionalLight(0xC6FF3D, 1.4); back.position.set(-3, 3, -2); scene.add(back); }
  else { const gobo = makeGobo(5, 7); scene.add(gobo); sway = placeGobo(gobo, key, 0.45); }
  const m = buildModel(spec); scene.add(m);
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y * 1.2, s.z);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(c.x + r * 1.4, c.y + r * 1.0, c.z + r * 2.5);
  const ctl = new OrbitControls(cam, canvas); ctl.target.copy(c); ctl.enableZoom = false; ctl.enablePan = false; ctl.enableDamping = true; ctl.autoRotate = !reduced; ctl.autoRotateSpeed = 1.6;
  ctl.minPolarAngle = 0.5; ctl.maxPolarAngle = 1.45;
  let alive = true;
  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(container);
  (function loop() { if (!alive) return; if (!reduced) sway(clock.getElapsedTime()); ctl.update(); renderer.render(scene, cam); requestAnimationFrame(loop); })();
  return { dispose() { alive = false; ro.disconnect(); ctl.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); } };
}

// ---------- Hero: one product floating in the dark, lime rim light, follows the pointer and scroll ----------
export function createHero(canvas, spec) {
  const renderer = setupRenderer(canvas, true); renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene(); envFor(renderer, scene); scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight(0xFFF3E3, 0x0B1410, 0.6));
  const key = new THREE.DirectionalLight(0xFFE6C8, 2.4); key.position.set(-3, 4, 4); scene.add(key);
  const lime = new THREE.DirectionalLight(0xC6FF3D, 5); lime.position.set(4, 1, -3); scene.add(lime);
  const lime2 = new THREE.PointLight(0xC6FF3D, 6, 6); lime2.position.set(-2, -1, -1.5); scene.add(lime2);
  const holder = new THREE.Group(); scene.add(holder);
  let model = buildModel(spec); holder.add(model);
  const fit = () => { const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3()); model.position.sub(c); };
  fit();
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50); cam.position.set(0, 0.5, 5.2); cam.lookAt(0, 0, 0);
  let mx = 0, my = 0, sx = 0, sy = 0, scroll = 0, alive = true, paused = false;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const clock = new THREE.Clock();
  (function loop() {
    if (!alive) return; if (paused) { requestAnimationFrame(loop); return; }
    const t = clock.getElapsedTime(); sx += (mx - sx) * 0.06; sy += (my - sy) * 0.06;
    holder.rotation.y = (reduced ? 0.6 : t * 0.5) + sx * 0.8 + scroll * 2.5;
    holder.rotation.x = 0.15 + sy * 0.3;
    holder.position.y = reduced ? 0 : Math.sin(t * 1.2) * 0.08;
    renderer.render(scene, cam); requestAnimationFrame(loop);
  })();
  return {
    setScroll(v) { scroll = v; },
    setPaused(v) { paused = v; },
    swap(next) { holder.remove(model); model = buildModel(next); holder.add(model); fit(); },
    dispose() { alive = false; ro.disconnect(); renderer.dispose(); },
  };
}
