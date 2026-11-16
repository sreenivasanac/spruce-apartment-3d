// Outdoor resin storage shed for the deck (Duramax StoreAway-style horizontal garbage shed; user's Wayfair listing + seller photos).
// 51.2 W x 29.1 D x 43.31 H: dark plinth tray, plank-siding walls, corner posts, two outward-swinging plank doors with a hasp,
// and a lid hinged at the back that slopes down toward the back. Click (or F in walk mode) opens the doors and lifts the lid.
// Contract: origin bottom centre, front (doors) +Z, width along X.
import * as THREE from 'three';
import { FURNITURE, m } from '../dimensions.js';
import { canvasTexture, normalFromHeight } from '../lib/woodgrain.js';
import { rng } from '../materials.js';
import { panel, std, hingedDoor, animateOpen } from './cabinets/parts.js';
import { group } from '../lib/build.js';

const S = FURNITURE.shed;
const GRAY = 0x6c6f73, BASE = 0x2b2c2e, INSIDE = 0x1f2022;
const plankCache = new Map();

/** Resin "wood-plank" skin for a panel `hIn` tall: horizontal grooves every S.plankPitch + faint brushed grain streaks. */
function plankMat(hIn, color = GRAY, key = '') {
  const n = Math.max(1, Math.round(hIn / S.plankPitch)), id = `${n}${key}`;
  if (plankCache.has(id)) return plankCache.get(id);
  const s = 512, col = document.createElement('canvas'), h = document.createElement('canvas');
  col.width = col.height = h.width = h.height = s;
  const cx = col.getContext('2d', { willReadFrequently: true }), hx = h.getContext('2d', { willReadFrequently: true }), r = rng(17 + n);
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, s, s); hx.fillStyle = '#fff'; hx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) { // grain streaks along the planks
    const y = r() * s, x = r() * s, l = 20 + r() * 120, a = 0.04 + r() * 0.07;
    cx.fillStyle = `rgba(0,0,0,${a})`; cx.fillRect(x, y, l, 1.2);
    hx.fillStyle = `rgba(0,0,0,${a * 2})`; hx.fillRect(x, y, l, 1.2);
  }
  for (let i = 1; i < n; i++) { // V-groove between planks
    const y = (i / n) * s, gw = Math.max(2, (s / n) * 0.07), g = hx.createLinearGradient(0, y - gw, 0, y + gw);
    g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#000'); g.addColorStop(1, '#fff');
    hx.fillStyle = g; hx.fillRect(0, y - gw, s, 2 * gw);
    cx.fillStyle = 'rgba(0,0,0,0.22)'; cx.fillRect(0, y - gw * 0.3, s, gw * 0.6);
  }
  const mat = std({ color, map: canvasTexture(col), normalMap: canvasTexture(normalFromHeight(h, 3), false), roughness: 0.78, name: `shed-planks-${id}` });
  plankCache.set(id, mat);
  return mat;
}

/** Textured skin (w x h inches) on a wall face: plane centred at (x, y, z), rotated ry about Y. */
function skin(w, h, mat, x, y, z, ry, name) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(m(w), m(h)), mat);
  p.position.set(m(x), m(y), m(z)); p.rotation.y = ry; p.name = name; p.receiveShadow = true;
  return p;
}

export function build() {
  const g = group('shed');
  const gray = std({ color: GRAY, roughness: 0.75, name: 'shed-resin' });
  const base = std({ color: BASE, roughness: 0.8, name: 'shed-base' });
  const dark = std({ color: INSIDE, roughness: 0.9, name: 'shed-interior' });
  const W = S.w - 2 * S.bodyInset, D = S.d - 2 * S.bodyInset - S.lidOver, zF = S.d / 2 - S.bodyInset - S.lidOver, zB = zF - D; // body box
  const y0 = S.baseH, frontTop = S.h - S.lidT, backTop = S.backH - S.lidT, t = S.wallT;

  // plinth tray with corner feet
  g.add(panel(S.w, S.baseH, S.d - S.lidOver, base, 'shed:base', 0, S.baseH / 2, -S.lidOver / 2, 0.4));
  // walls (dark resin inside, plank skins outside); side walls are trapezoids in reality — approximated by the lower back height + a wedge
  const sideH = backTop - y0;
  for (const sx of [-1, 1]) {
    g.add(panel(t, sideH, D, dark, 'shed:side', sx * (W / 2 - t / 2), y0 + sideH / 2, (zF + zB) / 2));
    g.add(skin(D - 2, sideH, plankMat(sideH), sx * (W / 2 + 0.01), y0 + sideH / 2, (zF + zB) / 2, sx * Math.PI / 2, 'shed:side-planks'));
    // wedge that carries the side up to the sloping lid
    const wedge = new THREE.Shape([new THREE.Vector2(m(zB), m(backTop)), new THREE.Vector2(m(zF), m(backTop)), new THREE.Vector2(m(zF), m(frontTop))]);
    const wg = new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: m(t), bevelEnabled: false }), gray);
    wg.rotation.y = -Math.PI / 2; wg.position.x = m(sx * (W / 2) + (sx < 0 ? t : 0)); wg.name = 'shed:side-wedge'; wg.castShadow = true;
    g.add(wg);
    g.add(panel(S.postW, frontTop - y0, S.postW, gray, 'shed:corner-post', sx * (W / 2 - S.postW / 2 + 0.2), y0 + (frontTop - y0) / 2, zF - S.postW / 2 + 0.3, 0.3));
  }
  g.add(panel(W - 2 * t, sideH, t, dark, 'shed:back', 0, y0 + sideH / 2, zB + t / 2));
  g.add(skin(W - 1, sideH, plankMat(sideH), 0, y0 + sideH / 2, zB - 0.01, Math.PI, 'shed:back-planks'));
  g.add(panel(W - 2 * t, 0.6, D - t, dark, 'shed:floor', 0, y0 + 0.3, (zF + zB) / 2 + t / 2));
  const headerH = frontTop - y0 - S.door.h;
  g.add(panel(W - 2 * S.postW, headerH, S.postW, gray, 'shed:header', 0, frontTop - headerH / 2, zF - S.postW / 2 + 0.3, 0.2));

  // doors: plank leaves hinged at the outer posts, D-handles near the meeting stiles
  const parts = [], dw = S.door.w / 2 - 0.1, plank = plankMat(S.door.h, 0x707378, 'door');
  for (const hinge of ['L', 'R']) {
    const x = hinge === 'L' ? -S.door.w / 2 : 0.1;
    const d = hingedDoor({ x, y0: y0 + 0.2, w: dw, h: S.door.h - 0.2, zFront: zF + 0.3, hinge, maxDeg: 100, name: `shed:door-${hinge}`, build: (lw, lh, hg) => {
      const L = new THREE.Group(); L.name = 'shed:door-leaf';
      L.add(panel(lw, lh, S.doorT, gray, 'shed:door-slab', lw / 2, lh / 2, -S.doorT / 2, 0.2));
      L.add(skin(lw - 0.6, lh - 0.6, plank, lw / 2, lh / 2, 0.01, 0, 'shed:door-planks'));
      const hx = hg === 'L' ? lw - 2.2 : 2.2;
      const hm = std({ color: 0x1c1c1d, roughness: 0.6, name: 'shed-handle' });
      L.add(panel(0.9, S.handle.h, 0.6, hm, 'shed:handle-grip', hx, lh - 9, S.handle.proj, 0.3));
      for (const dy of [-1, 1]) L.add(panel(0.9, 0.8, S.handle.proj, hm, 'shed:handle-post', hx, lh - 9 + dy * (S.handle.h / 2 - 0.4), S.handle.proj / 2, 0.2));
      return L;
    } });
    g.add(d); parts.push(d);
  }
  // hasp (fixed to the header, between the doors)
  g.add(panel(4.4, 2.2, 1.2, std({ color: 0x3b3c3e, roughness: 0.6, name: 'shed-hasp' }), 'shed:hasp', 0, frontTop - headerH - 0.5, zF + 0.9, 0.3));

  // lid: hinged along the back edge, sloping down toward the back, plank grooves running side to side, front lip
  const run = D + S.lidOver + 0.8, rise = frontTop - backTop, slope = Math.atan2(rise, run), len = Math.hypot(run, rise);
  const lid = new THREE.Group(); lid.name = 'shed:lid';
  const lidW = S.w + 0.4;
  lid.add(panel(lidW, S.lidT, len, gray, 'shed:lid-slab', 0, S.lidT / 2, len / 2, 0.4));
  const top = skin(lidW - 1, len - 1, plankMat(len, 0x74777b, 'lid'), 0, S.lidT + 0.01, len / 2, 0, 'shed:lid-planks');
  top.rotation.set(-Math.PI / 2, 0, 0); lid.add(top);
  lid.add(panel(lidW, S.lidLip, 0.8, gray, 'shed:lid-lip', 0, -S.lidLip / 2 + S.lidT, len - 0.4, 0.3));
  lid.add(panel(lidW - 1, 0.5, len - 1, dark, 'shed:lid-underside', 0, -0.2, len / 2, 0.2));
  const pivot = new THREE.Group(); pivot.name = 'shed:lid-hinge';
  pivot.position.set(0, m(backTop), m(zB - 0.4)); pivot.add(lid);
  lid.rotation.x = -slope; // closed: front edge resting at frontTop
  pivot.userData.setOpen = (k) => { pivot.rotation.x = -THREE.MathUtils.degToRad(75) * k; };
  g.add(pivot); parts.push(pivot);

  animateOpen(g, parts);
  g.userData.tick = (dt) => g.userData.animate(dt);
  g.userData.onClick = () => { g.userData.setOpen(!g.userData.isOpen()); g.userData.actionLabel = `${g.userData.isOpen() ? 'Close' : 'Open'} the storage shed`; };
  g.userData.actionLabel = 'Open the storage shed';
  return g;
}
