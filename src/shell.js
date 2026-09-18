// Shell: walls (with openings), floors, ceilings. Pure function of dimensions.js.
import * as THREE from 'three';
import { ENV, WALLS, ROOMS, m } from './dimensions.js';
import { MAT } from './materials.js';
import { box, boxAt, slab, group } from './lib/build.js';

/** Split a wall into solid boxes around its openings. Returns [{a,b,lo,hi}] pieces along the wall axis. */
export function wallPieces(w) {
  const h = w.h ?? ENV.ceiling, out = [];
  let cur = w.a;
  for (const o of [...w.openings].sort((p, q) => p.a - q.a)) {
    if (o.a > cur) out.push({ a: cur, b: o.a, lo: 0, hi: h });
    if (o.sill > 0) out.push({ a: o.a, b: o.b, lo: 0, hi: o.sill });
    if (o.head < h) out.push({ a: o.a, b: o.b, lo: o.head, hi: h });
    cur = o.b;
  }
  if (cur < w.b) out.push({ a: cur, b: w.b, lo: 0, hi: h });
  return out;
}

/** 2D collision rectangles [x0,y0,x1,y1] (inches): every wall piece that blocks a walking person. */
export function wallColliders() {
  const rects = [];
  for (const w of WALLS) for (const p of wallPieces(w)) {
    if (p.lo > 0 && p.lo >= 78) continue; // door headers don't block
    rects.push(w.axis === 'x' ? [p.a, w.c, p.b, w.c + w.t] : [w.c, p.a, w.c + w.t, p.b]);
  }
  return rects;
}

/** Six-face material list for a wall piece (BoxGeometry order +x -x +y -y +z -z): paint, accent paint, or exterior stucco per side. */
function faceMats(w, accented) {
  const mats = Array(6).fill(MAT.wall);
  const [hi, lo] = w.axis === 'x' ? [4, 5] : [0, 1]; // hi = face at c+t, lo = face at c
  if (accented) mats[w.accent.side === 'hi' ? hi : lo] = MAT.wallAccent;
  if (w.id.startsWith('ext-')) mats[w.c === 0 ? lo : hi] = MAT.stuccoExt; // outside face of the envelope
  return mats;
}

export function buildShell() {
  const walls = group('walls');
  for (const w of WALLS) {
    const ext = w.id.startsWith('ext-');
    const ac = w.accent && { a: w.accent.a ?? w.a, b: w.accent.b ?? w.b };
    // split pieces at the accent limits so a face is either fully accent or fully greige (no overlay planes -> no z-fighting)
    const pieces = wallPieces(w).flatMap((p) => {
      const cuts = ac ? [ac.a, ac.b].filter((v) => v > p.a && v < p.b) : [];
      const bounds = [p.a, ...cuts, p.b];
      return bounds.slice(0, -1).map((s, k) => ({ ...p, a: s, b: bounds[k + 1] }));
    });
    for (const [i, p] of pieces.entries()) {
      const len = p.b - p.a, hh = p.hi - p.lo;
      const accented = !!ac && p.a >= ac.a && p.b <= ac.b;
      const mats = faceMats(w, accented);
      const b = w.axis === 'x' ? box(len, hh, w.t, mats) : box(w.t, hh, len, mats);
      b.name = `${accented ? 'accent' : 'wall'}:${w.id}:${i}`;
      const mid = (p.a + p.b) / 2, cc = w.c + w.t / 2;
      b.position.set(m(w.axis === 'x' ? mid : cc), m(p.lo + hh / 2), m(w.axis === 'x' ? cc : mid));
      b.userData.exterior = ext;
      walls.add(b);
    }
  }

  // Carpet has real thickness (pile stands proud of the LVP at the bedroom entry, IMG_3937) — boxes, not floating planes.
  const carpet = (r, name) => boxAt(r[0], r[1], 0, r[2] - r[0], r[3] - r[1], ENV.carpetT, MAT.carpet, name);
  const floors = group('floors',
    slab([0, 0, ENV.w, ENV.d], 0, MAT.lvp, true, 'floor:lvp'),
    boxAt(0, 0, -ENV.floorSlabT - 0.05, ENV.w, ENV.d, ENV.floorSlabT, MAT.stuccoExt, 'floor:slab'),
    carpet(ROOMS.bedroom.r, 'floor:carpet-bedroom'),
    carpet(ROOMS.bedCloset.r, 'floor:carpet-closet'),
  );
  floors.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  // One continuous ceiling plane: IMG_3933/3934 show no soffit or drop anywhere between dining, kitchen and living.
  const ceiling = slab([0, 0, ENV.w, ENV.d], ENV.ceiling, MAT.ceiling, false, 'ceiling:main');
  // Solid roof above it. Shadows are taken from its TOP face so low sun can't leak along the wall/ceiling junction.
  const roofMat = MAT.stuccoExt.clone();
  roofMat.shadowSide = THREE.FrontSide;
  const roof = boxAt(0, 0, ENV.ceiling + 0.05, ENV.w, ENV.d, ENV.roofT, roofMat, 'ceiling:roof');
  const ceilings = group('ceilings', ceiling, roof);

  const shell = group('shell', walls, floors, ceilings);
  shell.userData.ceilings = ceilings; // dollhouse/plan views hide this
  return shell;
}

/** Sum of interior room areas + gross envelope, sq ft — shown in the plan overlay and checked by critics. */
export function areaReport() {
  const gross = (ENV.w * ENV.d) / 144;
  const rooms = Object.fromEntries(Object.entries(ROOMS).map(([k, v]) => [k, Math.round(((v.r[2] - v.r[0]) * (v.r[3] - v.r[1])) / 144 * 10) / 10]));
  return { grossSqFt: Math.round(gross * 10) / 10, rooms };
}
