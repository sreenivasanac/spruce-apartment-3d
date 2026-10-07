// Cabinet option A — rustic carved armoire (spruce_apt_photos/cabinet-1): two stacked 2-door modules with diamond/chevron
// carved centre panels, black iron bar pulls, a full-width plank-front drawer and a plinth. 31.5 x 13.78 x 70.08.
import * as THREE from 'three';
import { CABINETS, m } from '../../dimensions.js';
import { woodCanvas, canvasTexture, normalFromHeight } from '../../lib/woodgrain.js';
import { panel, std, barPull, hingedDoor, drawer, animateOpen } from './parts.js';

const C = CABINETS.rustic;
const OAK = { seed: 31, dark: [78, 50, 26], mid: [132, 90, 50], hi: [166, 120, 74], lines: 20, wobble: 0.8 };

function woodMat(horizontal, seed = 31) {
  let c = woodCanvas({ ...OAK, seed });
  if (horizontal) { // grain along U: draw the canvas rotated 90°
    const r = document.createElement('canvas'); r.width = r.height = c.width;
    const x = r.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0); c = r;
  }
  return std({ map: canvasTexture(c), roughness: 0.62, name: `rustic-oak${horizontal ? '-h' : ''}` });
}

/** Carved centre panel: wood + staggered V grooves (light bevel on the lower lip), plus a matching normal map. Size in inches. */
const carvedCache = new Map();
function carvedMat(wIn, hIn) {
  const key = `${wIn.toFixed(2)}x${hIn.toFixed(2)}`;
  if (!carvedCache.has(key)) carvedCache.set(key, makeCarved(wIn, hIn)); // all four door panels share one material (and one texture in the USDZ)
  return carvedCache.get(key);
}
function makeCarved(wIn, hIn) {
  const px = 44, W = Math.round(wIn * px), H = Math.round(hIn * px);
  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const hgt = document.createElement('canvas'); hgt.width = hgt.height = 512;
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  cx.drawImage(woodCanvas({ ...OAK, seed: 37 }), 0, 0, W, H);
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, 512, 512);
  const cell = 2.15, cols = Math.max(3, Math.round(wIn / cell)), cw = W / cols, rows = Math.round(hIn / (cell * 0.92)), ch = H / rows;
  const sx = 512 / W, sy = 512 / H;
  const vee = (ctx, x, y, w, h, kx = 1, ky = 1) => { ctx.beginPath(); ctx.moveTo((x - w * 0.3) * kx, y * ky); ctx.lineTo(x * kx, (y + h * 0.55) * ky); ctx.lineTo((x + w * 0.3) * kx, y * ky); ctx.stroke(); }; // short V chevrons, staggered rows (cabinet-1 close-ups)
  for (let r = -1; r <= rows; r++) for (let c = -1; c <= cols; c++) {
    const x = (c + 0.5 + (r % 2 ? 0.5 : 0)) * cw, y = r * ch + ch * 0.1;
    cx.lineCap = 'round';
    cx.strokeStyle = 'rgba(40,22,10,0.9)'; cx.lineWidth = px * 0.13; vee(cx, x, y, cw, ch);
    cx.strokeStyle = 'rgba(214,160,104,0.35)'; cx.lineWidth = px * 0.06; vee(cx, x, y + px * 0.12, cw, ch);
    hx.lineCap = 'round'; hx.strokeStyle = '#000'; hx.lineWidth = px * 0.13 * sx; vee(hx, x, y, cw, ch, sx, sy);
  }
  hx.filter = 'blur(2px)'; hx.drawImage(hgt, 0, 0); // soften groove walls before deriving normals
  return std({ map: canvasTexture(col), normalMap: canvasTexture(normalFromHeight(hgt, 3), false), roughness: 0.66, name: 'rustic-carved' });
}

export function build() {
  const g = new THREE.Group(); g.name = 'cabinet:rustic';
  const V = woodMat(false), Hm = woodMat(true), iron = std({ color: 0x17140f, metalness: 0.7, roughness: 0.45, name: 'black-iron' });
  const back = std({ color: 0x6f4320, roughness: 0.8, name: 'rustic-back' });
  const zF = C.d / 2, innerW = C.w - 2 * C.side, D = C.door;

  // carcass
  for (const s of [-1, 1]) g.add(panel(C.side, C.h - C.top, C.d, V, 'rustic:side', s * (C.w - C.side) / 2, (C.h - C.top) / 2, 0));
  g.add(panel(C.w, C.top, C.d, Hm, 'rustic:top', 0, C.h - C.top / 2, 0));
  g.add(panel(innerW, C.h - C.top, 0.25, back, 'rustic:back', 0, (C.h - C.top) / 2, -C.d / 2 + 0.3));
  g.add(panel(innerW, C.plinth, 0.75, Hm, 'rustic:plinth', 0, C.plinth / 2, zF - 0.6));
  const lowerY = C.plinth + C.drawer.h + 0.3, seamY = lowerY + D.h + C.gap, upperY = seamY + C.seam + C.gap;
  g.add(panel(C.w + 0.3, C.seam, C.d + 0.15, Hm, 'rustic:module-seam', 0, seamY + C.seam / 2, 0.075));
  for (const y of [C.plinth + C.drawer.h + 0.05, lowerY + D.h / 2, upperY + D.h / 2]) // fixed shelves / drawer deck
    g.add(panel(innerW, 0.6, C.d - 1.5, V, 'rustic:shelf', 0, y, -0.4));

  // doors: frame + carved panel, inset between the sides, flush with the carcass front
  const parts = [];
  const leaf = () => (w, h, hinge) => {
    const L = new THREE.Group(); L.name = 'rustic:leaf';
    L.add(panel(D.stile, h, D.t, V, 'rustic:stile', D.stile / 2, h / 2, -D.t / 2), panel(D.stile, h, D.t, V, 'rustic:stile', w - D.stile / 2, h / 2, -D.t / 2));
    L.add(panel(w - 2 * D.stile, D.rail, D.t, Hm, 'rustic:rail', w / 2, D.rail / 2, -D.t / 2), panel(w - 2 * D.stile, D.rail, D.t, Hm, 'rustic:rail', w / 2, h - D.rail / 2, -D.t / 2));
    const pw = w - 2 * D.stile + 0.1, ph = h - 2 * D.rail + 0.1;
    const carved = new THREE.Mesh(new THREE.PlaneGeometry(m(pw), m(ph)), carvedMat(pw, ph));
    carved.name = 'rustic:carved-panel'; carved.position.set(m(w / 2), m(h / 2), m(-0.18)); carved.receiveShadow = true;
    L.add(carved, panel(pw, ph, D.t - 0.2, V, 'rustic:panel-back', w / 2, h / 2, -D.t / 2 - 0.1));
    const px = hinge === 'L' ? w - C.pull.inset : C.pull.inset;
    L.add(barPull(C.pull.L, C.pull.proj, C.pull.dia, iron, 'rustic:pull', px, h / 2, 0));
    return L;
  };
  for (const [y0, tier] of [[lowerY, 'lower'], [upperY, 'upper']]) {
    for (const hinge of ['L', 'R']) {
      const w = D.w - C.gap, x = hinge === 'L' ? -innerW / 2 + C.gap / 2 : C.gap / 2;
      const d = hingedDoor({ x, y0, w, h: D.h, zFront: zF, hinge, maxDeg: 105, name: `rustic:door-${tier}-${hinge}`, build: leaf() });
      g.add(d); parts.push(d);
    }
  }
  // drawer: plank front with light inlay lines (2 horizontal, 2 vertical near the ends), centred bar pull
  const dr = drawer({ x: -C.drawer.w / 2 + C.gap / 2, y0: C.plinth + 0.05, w: C.drawer.w - C.gap, h: C.drawer.h - 0.1, zFront: zF, depth: C.drawer.depth, travel: C.drawer.travel, boxMat: Hm, name: 'rustic:drawer',
    front: (w, h) => {
      const F = new THREE.Group();
      F.add(panel(w, h, 0.75, Hm, 'rustic:drawer-front', w / 2, h / 2, -0.375));
      const inlay = std({ color: 0xc89a62, roughness: 0.6, name: 'rustic-inlay' });
      for (const k of [1 / 3, 2 / 3]) F.add(panel(w - 0.3, 0.09, 0.04, inlay, 'rustic:inlay', w / 2, h * k, 0.0));
      for (const x of [1.6, w - 1.6]) F.add(panel(0.09, h - 0.3, 0.04, inlay, 'rustic:inlay', x, h / 2, 0.0));
      F.add(barPull(5.2, 0.9, 0.36, iron, 'rustic:drawer-pull', w / 2, h / 2, 0, 'x'));
      return F;
    } });
  g.add(dr); parts.push(dr);
  animateOpen(g, parts);
  g.userData.info = C;
  return g;
}
