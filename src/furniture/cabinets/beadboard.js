// Cabinet option C — 72" beadboard pantry (spruce_apt_photos/cabinet-3): white, 6 shaker doors with vertical beadboard panels,
// 22" + 11" drawers with nickel cup pulls, crown cap + frieze, plinth, beadboard sides, spice racks on the right-hand doors.
// 38.6 x 13.8 x 70.9 (dimension sheet; listing text rounds to 39 x 13.8 x 71).
import * as THREE from 'three';
import { CABINETS, m } from '../../dimensions.js';
import { canvasTexture, normalFromHeight, woodCanvas } from '../../lib/woodgrain.js';
import { panel, std, knob, cupPull, hingedDoor, drawer, shakerLeaf, animateOpen } from './parts.js';

const C = CABINETS.beadboard;
const beadCache = new Map();

/** White beadboard material for a panel `wIn` wide: one V-groove every C.beadPitch inches (normal map + faint shading). */
function beadMat(wIn) {
  const n = Math.max(2, Math.round(wIn / C.beadPitch));
  if (beadCache.has(n)) return beadCache.get(n);
  const s = 512, h = document.createElement('canvas'), col = document.createElement('canvas');
  h.width = h.height = col.width = col.height = s;
  const hx = h.getContext('2d'), cx = col.getContext('2d');
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, s, s); cx.fillStyle = '#f2f1ec'; cx.fillRect(0, 0, s, s);
  for (let i = 1; i < n; i++) {
    const x = (i / n) * s, gw = Math.max(3, s / n * 0.09);
    const grad = hx.createLinearGradient(x - gw, 0, x + gw, 0);
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#000'); grad.addColorStop(1, '#fff');
    hx.fillStyle = grad; hx.fillRect(x - gw, 0, 2 * gw, s);
    cx.fillStyle = 'rgba(150,148,140,0.35)'; cx.fillRect(x - gw * 0.3, 0, gw * 0.6, s);
  }
  const mat = std({ map: canvasTexture(col), normalMap: canvasTexture(normalFromHeight(h, 4), false), roughness: 0.5, name: `bead-${n}` });
  beadCache.set(n, mat);
  return mat;
}

/** Shaker frame + beadboard panel (a textured plane over a recessed backer), spanning x 0..w, y 0..h, z -t..0. */
function beadLeaf(w, h, white, name) {
  const L = shakerLeaf(w, h, { t: C.doorT, stile: C.stile, mat: white, name });
  const pw = w - 2 * C.stile + 0.1, ph = h - 2 * C.stile + 0.1;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(m(pw), m(ph)), beadMat(pw));
  face.name = `${name}:bead`; face.position.set(m(w / 2), m(h / 2), m(-0.21)); face.receiveShadow = true;
  L.add(face);
  return L;
}

/** Natural-wood door rack with black retaining bars (back of the right-hand doors). x 0..w in leaf space, behind the door. */
function spiceRack(w, h, name) {
  const R = new THREE.Group(); R.name = name;
  const wood = std({ map: canvasTexture(woodCanvas({ seed: 5, dark: [190, 150, 105], mid: [221, 188, 146], hi: [236, 210, 172], lines: 10, contrast: 0.5 })), roughness: 0.6, name: 'rack-pine' });
  const bar = std({ color: 0x151515, metalness: 0.6, roughness: 0.4, name: 'rack-bar' });
  const z = -C.doorT - C.rack.d / 2, x0 = 1.8, x1 = w - 1.8;
  for (const x of [x0, x1]) R.add(panel(0.5, h - 3, C.rack.d, wood, `${name}:side`, x, h / 2, z));
  for (let i = 0; i < C.rack.shelves; i++) {
    const y = 1.5 + (i * (h - 4)) / C.rack.shelves;
    R.add(panel(x1 - x0, 0.45, C.rack.d, wood, `${name}:shelf`, (x0 + x1) / 2, y, z));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(m(0.12), m(0.12), m(x1 - x0), 8), bar);
    b.rotation.z = Math.PI / 2; b.position.set(m((x0 + x1) / 2), m(y + 2.2), m(z - C.rack.d / 2 + 0.2)); R.add(b);
  }
  return R;
}

export function build() {
  const g = new THREE.Group(); g.name = 'cabinet:beadboard';
  const white = std({ color: 0xf2f1ec, roughness: 0.46, name: 'beadboard-white' });
  const inside = std({ color: 0xebe9e3, roughness: 0.7, name: 'beadboard-interior' });
  const nickel = std({ color: 0xc9c7c2, metalness: 1, roughness: 0.3, name: 'beadboard-nickel' });
  const cw = C.w - 2 * C.topOver, zF = C.d / 2 - C.topOver, cd = zF + C.d / 2, zc = (zF - C.d / 2) / 2; // carcass; doors sit flush in the face frame
  const capT = 1.0, friezeTop = C.h - capT, G = C.gap;
  const lowerY = C.base + 0.3, drawerY = lowerY + C.lowerDoorH + 0.4, seamY = drawerY + C.drawerH + 0.15, upperY = seamY + 0.85;

  // carcass + face frame (white), beadboard skins on both sides
  for (const s of [-1, 1]) {
    g.add(panel(0.7, friezeTop - C.base, cd, white, 'beadboard:side', s * (cw - 0.7) / 2, (friezeTop + C.base) / 2, zc));
    const skin = new THREE.Mesh(new THREE.PlaneGeometry(m(cd - 2.6), m(friezeTop - C.base - 3)), beadMat(cd - 2.6));
    skin.name = 'beadboard:side-bead'; skin.rotation.y = s * Math.PI / 2; skin.position.set(m(s * (cw / 2 + 0.01)), m((friezeTop + C.base) / 2), m(zc)); g.add(skin);
  }
  g.add(panel(C.w, capT, C.d, white, 'beadboard:cap', 0, C.h - capT / 2, 0, 0.25));
  g.add(panel(cw, friezeTop - upperY - C.upperDoorH, 0.75, white, 'beadboard:frieze', 0, (friezeTop + upperY + C.upperDoorH) / 2, zF - 0.375));
  g.add(panel(cw + 2 * C.baseOver, C.base, cd + C.baseOver, white, 'beadboard:plinth', 0, C.base / 2, zc + C.baseOver / 2, 0.15));
  g.add(panel(cw - 1.4, friezeTop - C.base, 0.25, inside, 'beadboard:back', 0, (friezeTop + C.base) / 2, zc - cd / 2 + 0.3));
  g.add(panel(cw + 0.5, 0.7, cd + 0.25, white, 'beadboard:module-seam', 0, seamY + 0.35, zc + 0.125));
  const fw = (cw - 3 * C.leftDoorW - G - C.midStile) / 2; // side face-frame stile: three 11.2" door columns + centre stile fill the rest
  const xL = -cw / 2 + fw, xMid = xL + 2 * C.leftDoorW + G, xR = xMid + C.midStile, rw = cw / 2 - fw - xR;
  for (const s of [-1, 1]) g.add(panel(fw, friezeTop - C.base, 0.75, white, 'beadboard:face-stile', s * (cw - fw) / 2, (friezeTop + C.base) / 2, zF - 0.375));
  g.add(panel(C.midStile, friezeTop - C.base, 0.75, white, 'beadboard:mid-stile', xMid + C.midStile / 2, (friezeTop + C.base) / 2, zF - 0.375));
  g.add(panel(cw, 0.4, 0.75, white, 'beadboard:rail', 0, drawerY - 0.2, zF - 0.375));
  g.add(panel(0.7, friezeTop - C.base, cd - 1, inside, 'beadboard:divider', xMid + C.midStile / 2, (friezeTop + C.base) / 2, zc - 0.5));
  for (const y of [lowerY + 0.1, lowerY + 11.2, drawerY + C.drawerH + 0.1, upperY + 10.6, upperY + 21.2])
    g.add(panel(cw - 1.4, 0.6, cd - 1.4, inside, 'beadboard:shelf', 0, y, zc - 0.4));

  const parts = [];
  const door = (x, y0, w, h, hinge, name, rack) => {
    const d = hingedDoor({ x, y0, w, h, zFront: zF, hinge, name, build: (lw, lh, hg) => {
      const L = beadLeaf(lw, lh, white, `${name}:leaf`);
      L.add(knob(C.knob.dia, C.knob.proj, nickel, `${name}:knob`, hg === 'L' ? lw - 1.3 : 1.3, lh * 0.5, 0));
      if (rack) L.add(spiceRack(lw, lh, `${name}:rack`));
      return L;
    } });
    g.add(d); parts.push(d);
  };
  const dw = C.leftDoorW - G / 2;
  for (const [y0, h, tier] of [[upperY, C.upperDoorH, 'upper'], [lowerY, C.lowerDoorH, 'lower']]) {
    door(xL, y0, dw, h, 'L', `beadboard:door-${tier}-1`);
    door(xL + C.leftDoorW + G / 2, y0, dw, h, 'R', `beadboard:door-${tier}-2`);
    door(xR + G / 2, y0, rw - G, h, 'R', `beadboard:door-${tier}-3`, true);
  }
  const front = (n) => (w, h) => {
    const F = beadLeaf(w, h, white, 'beadboard:drawer-front');
    for (let i = 0; i < n; i++) F.add(cupPull(C.cup, nickel, 'beadboard:cup-pull', (w * (2 * i + 1)) / (2 * n), h * 0.55, 0));
    return F;
  };
  for (const [x, w, n, name] of [[xL, 2 * C.leftDoorW, 2, 'beadboard:drawer-wide'], [xR + G / 2, rw - G, 1, 'beadboard:drawer-narrow']]) {
    const dr = drawer({ x, y0: drawerY, w, h: C.drawerH - G, zFront: zF, depth: C.drawer.depth, travel: C.drawer.travel, boxMat: inside, name, front: front(n) });
    g.add(dr); parts.push(dr);
  }
  animateOpen(g, parts);
  g.userData.info = C;
  return g;
}
