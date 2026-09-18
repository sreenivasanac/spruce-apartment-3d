// Shell: walls (with openings), floors, ceilings. Pure function of dimensions.js.
import * as THREE from 'three';
import { ENV, WALLS, ROOMS, X, Y, m } from './dimensions.js';
import { MAT } from './materials.js';
import { box, slab, group } from './lib/build.js';

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

export function buildShell() {
  const walls = group('walls');
  for (const w of WALLS) {
    const ext = w.id.startsWith('ext-');
    for (const [i, p] of wallPieces(w).entries()) {
      const len = p.b - p.a, hh = p.hi - p.lo;
      const b = w.axis === 'x' ? box(len, hh, w.t, MAT.wall) : box(w.t, hh, len, MAT.wall);
      b.name = `wall:${w.id}:${i}`;
      const mid = (p.a + p.b) / 2, cc = w.c + w.t / 2;
      b.position.set(m(w.axis === 'x' ? mid : cc), m(p.lo + hh / 2), m(w.axis === 'x' ? cc : mid));
      b.userData.exterior = ext;
      walls.add(b);
    }
  }
  // Accent paint: living-room south wall is a darker gray (IMG_3932, IMG_3948).
  const accent = box(0.1, ENV.ceiling, Y.westInt - Y.ponyB, MAT.wallAccent, 'accent:living-south');
  accent.position.set(m(X.southInt - 0.05), m(ENV.ceiling / 2), m((Y.westInt + Y.ponyB) / 2));
  accent.castShadow = false;
  walls.add(accent);

  const floors = group('floors',
    slab([0, 0, ENV.w, ENV.d], 0, MAT.lvp, true, 'floor:lvp'),
    slab(ROOMS.bedroom.r, 0.5, MAT.carpet, true, 'floor:carpet-bedroom'),
    slab(ROOMS.bedCloset.r, 0.5, MAT.carpet, true, 'floor:carpet-closet'),
  );

  const ceilings = group('ceilings',
    slab([0, 0, ENV.w, ENV.d], ENV.ceiling, MAT.ceiling, false, 'ceiling:main'),
    slab([X.stubA, 0, ENV.w, Y.ponyB], ENV.kitchenCeiling, MAT.ceiling, false, 'ceiling:kitchen-drop'),
  );
  // fascia of the dropped kitchen ceiling (two visible edges)
  const dropH = ENV.ceiling - ENV.kitchenCeiling;
  const f1 = box(0.5, dropH, Y.ponyB, MAT.ceiling, 'ceiling:kitchen-fascia-dining');
  f1.position.set(m(X.stubA + 0.25), m(ENV.kitchenCeiling + dropH / 2), m(Y.ponyB / 2));
  const f2 = box(ENV.w - X.stubA, dropH, 0.5, MAT.ceiling, 'ceiling:kitchen-fascia-living');
  f2.position.set(m((X.stubA + ENV.w) / 2), m(ENV.kitchenCeiling + dropH / 2), m(Y.ponyB - 0.25));
  ceilings.add(f1, f2);
  ceilings.traverse((o) => { if (o.isMesh) o.castShadow = true; });

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
