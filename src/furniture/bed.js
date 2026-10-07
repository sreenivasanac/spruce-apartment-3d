// Full-size bed (spruce_apt_photos/full_size_bedframe.jpg): black steel platform frame + channelled headboard,
// 54x75x12 mattress, fitted sheet, quilted duvet folded back, two pillows.
// Contract: build() returns a THREE.Group named 'bed', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT (foot) facing +Z, head = -Z, width along X.
// apartment.js positions/rotates it from FURNITURE.bed.pos/rot and makes it draggable.
//
// Everything is modelled in INCHES inside one group scaled by m(1) (single conversion). Cloth UVs are in metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, TEX, rng } from '../materials.js';
import { group } from '../lib/build.js';

const D = FURNITURE.bed, P = D.panel, K = D.duvet;
const HW = D.frameW / 2, HL = D.frameL / 2;
const PANEL_FRONT = -HL + P.backInset + P.t; // pad back sits inside the post back, front stands proud of the posts (photo)
const MATT_Z0 = PANEL_FRONT + D.mattGap; // mattress head end just clear of the upholstered panel
const MATT_CZ = MATT_Z0 + D.mattL / 2;
const MATT_TOP = D.deckH + D.mattT;
const SHEET_TOP = MATT_TOP + D.sheetT;

const mesh = (geo, mat, name) => { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; o.name = name; return o; };
/** Steel section (inches) with a tiny rolled-edge radius, centred at x,y,z. */
const steel = (w, h, d, x, y, z, name) => {
  const o = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(D.steelR, w / 3, h / 3, d / 3)), M.steel, name);
  o.position.set(x, y, z);
  return o;
};
/** n copies of one geometry as a single draw call; pts = [[x,y,z]...] centres. */
function instanced(geo, pts, mat, name) {
  const o = new THREE.InstancedMesh(geo, mat, pts.length);
  pts.forEach((p, i) => o.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p)));
  o.castShadow = o.receiveShadow = true; o.name = name;
  return o;
}

/** Tiling grayscale bump texture from a height function fn(u, v) -> 0..1. */
function bumpTex(fn, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = 255 * fn(x / size, y / size);
    img.data.set([s, s, s, 255], (y * size + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const arch = (f) => Math.sin(f * Math.PI);
const quiltH = (u, v) => Math.sqrt(arch((u + v) % 1) * arch((u - v + 1) % 1)); // diamond ticking, 0 on the stitch lines
const stitchH = (u) => arch(u) ** 0.3; // vertical stitched channels of the mattress border
const weaveH = (u, v) => { // plain weave, 8 threads per tile: warp and weft alternate on top
  const i = Math.floor(u * 8), j = Math.floor(v * 8), fu = u * 8 - i, fv = v * 8 - j;
  return (i + j) % 2 ? arch(fu) * (0.55 + 0.45 * arch(fv)) : arch(fv) * (0.55 + 0.45 * arch(fu));
};

let M;
function materials() {
  const cloth = (color, name, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, bumpMap: TEX.carpetBump, bumpScale: 0.25,
    sheen: 0.15, sheenRoughness: 0.85, sheenColor: new THREE.Color(color), side: THREE.DoubleSide, name, ...extra });
  M ??= {
    // satin black powder-coat; the IBL is dim, so reflections are boosted to give the tube edges/faces some definition
    steel: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.3, envMapIntensity: 2.5, name: 'bed-satin-black-powdercoat' }),
    bolt: new THREE.MeshStandardMaterial({ color: 0x8d8f92, roughness: 0.35, metalness: 0.9, envMapIntensity: 2, name: 'bed-zinc-bolt' }),
    panel: cloth(0x5d5d62, 'bed-headboard-charcoal-woven', { roughness: 1, bumpMap: bumpTex(weaveH), bumpScale: 0.6, sheen: 0.35, sheenColor: new THREE.Color(0x8a8b92), side: THREE.FrontSide }),
    mattress: Object.assign(MAT.mattress.clone(), { bumpMap: bumpTex(quiltH), bumpScale: 0.6, name: 'bed-mattress-quilted' }),
    border: Object.assign(MAT.mattress.clone(), { bumpMap: bumpTex(stitchH, 64), bumpScale: 0.5, name: 'bed-mattress-border' }),
    sheet: cloth(0xe9e6df, 'bed-fitted-sheet-ivory'),
    duvet: cloth(0x5b6d7e, 'bed-duvet-slate-blue', { bumpScale: 0.08 }),
    duvetBack: cloth(0xdfe2e4, 'bed-duvet-underside-pale', { bumpScale: 0.08 }),
    pillow: cloth(0xf1efea, 'bed-pillowcase-white'),
  };
}

// Irregular rumples: plane waves [kx, kz (rad/inch), relative amplitude] in unrelated directions (no checkerboard).
const WAVES = [[0.21, 0.09, 1], [-0.13, 0.27, 0.8], [0.37, -0.31, 0.45], [0.05, 0.52, 0.35]];
const rumple = (a, b, ph) => WAVES.reduce((s, [ka, kb, amp], n) => s + amp * Math.sin(a * ka + b * kb + ph[n]), 0);

/** Scale a geometry's 0..1 UVs so one texture tile = `tile` inches (approximate: uses w x h for every face). */
function scaleUV(geo, w, h, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return geo;
}

/** Closed centripetal spline tube through pts ([x,y,z] inches) - piping / tape edges. */
const piping = (pts, r, segs) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), true, 'centripetal'), segs, r, 5, true);

// ---------------------------------------------------------------- frame
function frame() {
  const g = group('bed:frame');
  const railY = D.deckH - D.railH / 2, railX = HW - D.railT / 2, sideL = D.frameL - D.post;
  g.add(
    steel(D.railT, D.railH, sideL, -railX, railY, D.post / 2, 'bed:rail-left'),
    steel(D.railT, D.railH, sideL, railX, railY, D.post / 2, 'bed:rail-right'),
    steel(D.frameW - 2 * D.railT, D.railH, D.railT, 0, railY, HL - D.railT / 2, 'bed:rail-foot'),
    steel(D.frameW - 2 * D.post, D.railH, D.railT, 0, railY, -HL + D.post / 2, 'bed:rail-head'),
  );
  // slats: square tube between the side rails, tops flush with the deck height
  const slatY = D.deckH - D.slat / 2, z0 = -HL + D.post, span = D.frameL - D.post - D.railT, pitch = span / (D.slats + 1);
  const slatZ = Array.from({ length: D.slats }, (_, i) => z0 + pitch * (i + 1));
  g.add(instanced(new THREE.BoxGeometry(D.frameW - 2 * D.railT, D.slat, D.slat), slatZ.map((z) => [0, slatY, z]), M.steel, 'bed:slats'));
  // centre rail under the slats, bolted to the head/foot rails through flat end plates (photo: flat bracket at the foot rail)
  const cr = D.centreRail, B = D.bracket, crY = D.deckH - D.slat - cr.h / 2;
  const crA = -HL + D.post / 2 + D.railT / 2 + B.t, crB = HL - D.railT - B.t; // between the two plates
  g.add(steel(cr.w, cr.h, crB - crA, 0, crY, (crA + crB) / 2, 'bed:centre-rail'));
  g.add(instanced(new THREE.BoxGeometry(B.w, B.h, B.t), [[0, crY, crA - B.t / 2], [0, crY, crB + B.t / 2]], M.steel, 'bed:centre-brackets'));
  const legH = D.deckH - D.slat - cr.h - D.foot.h;
  const legs = Array.from({ length: D.centreLegs }, (_, i) => [0, D.foot.h + legH / 2, z0 + (span * (i + 1)) / (D.centreLegs + 1)]);
  // foot corner legs sit a little in from the foot end, inside the side rails (photo)
  const cornerH = D.deckH - D.railH - D.foot.h, cx = HW - D.railT - D.leg / 2, cz = HL - D.footLegInset;
  const corners = [[-cx, D.foot.h + cornerH / 2, cz], [cx, D.foot.h + cornerH / 2, cz]];
  g.add(instanced(new THREE.BoxGeometry(D.leg, legH, D.leg), legs, M.steel, 'bed:centre-legs'));
  g.add(instanced(new THREE.BoxGeometry(D.leg, cornerH + D.railH * 0.5, D.leg), corners.map(([x, y, z]) => [x, y + D.railH * 0.25, z]), M.steel, 'bed:foot-legs'));
  const padXZ = [...legs, ...corners, [-(HW - D.post / 2), 0, -HL + D.post / 2], [HW - D.post / 2, 0, -HL + D.post / 2]];
  g.add(instanced(new THREE.BoxGeometry(D.foot.w, D.foot.h, D.foot.w), padXZ.map(([x, , z]) => [x, D.foot.h / 2, z]), MAT.blackPlastic, 'bed:feet'));
  // button-head bolts: on the side-rail inner faces under each slat end (axis X), under the centre rail at each slat and on the end plates
  const bo = D.bolt, bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(bo.r, bo.r, bo.h, 12), M.bolt, D.slats * 3 + 4);
  const X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), Z = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const one = new THREE.Vector3(1, 1, 1), inX = HW - D.railT - bo.h / 2, by = D.deckH - D.slat - bo.below;
  const at = [
    ...slatZ.flatMap((z) => [[-inX, by, z, X], [inX, by, z, X], [0, crY - cr.h / 2 - bo.h / 2, z, null]]),
    ...[-1, 1].flatMap((s) => [[s * (B.w / 2 - 2 * bo.r), crY, crA + bo.h / 2, Z], [s * (B.w / 2 - 2 * bo.r), crY, crB - bo.h / 2, Z]]),
  ];
  at.forEach(([x, y, z, q], i) => bolts.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q ?? new THREE.Quaternion(), one)));
  bolts.name = 'bed:bolts'; bolts.castShadow = true;
  g.add(bolts);
  return g;
}

function headboard() {
  const g = group('bed:headboard');
  const z = -HL + D.post / 2, px = HW - D.post / 2, inner = D.frameW - 2 * D.post;
  const postH = D.headH - D.foot.h;
  g.add(
    steel(D.post, postH, D.post, -px, D.foot.h + postH / 2, z, 'bed:post-left'),
    steel(D.post, postH, D.post, px, D.foot.h + postH / 2, z, 'bed:post-right'),
    steel(inner, D.post, D.post, 0, D.headH - D.post / 2, z, 'bed:head-top-bar'),
    steel(inner, P.bar, D.post, 0, P.top + P.bar / 2, z, 'bed:panel-top-bar'),
    steel(inner, P.bar, D.post, 0, P.bottom - P.bar / 2, z, 'bed:panel-bottom-bar'),
  );
  // upholstered pad: one backing slab + a flat channel per flute separated by narrow stitched seam grooves, merged into a single mesh
  const cw = inner / P.channels, ph = P.top - P.bottom, zc = PANEL_FRONT - P.t / 2, yc = P.bottom + ph / 2;
  const parts = Array.from({ length: P.channels }, (_, i) =>
    scaleUV(new RoundedBoxGeometry(cw - P.seam, ph, P.t, 3, P.r), cw, ph, P.weaveTile).translate(-inner / 2 + cw * (i + 0.5), yc, zc));
  parts.push(scaleUV(new THREE.BoxGeometry(inner, ph - 2 * P.r, P.t - P.seamDepth).toNonIndexed(), inner, ph, P.weaveTile).translate(0, yc, zc - P.seamDepth / 2));
  g.add(mesh(mergeGeometries(parts), M.panel, 'bed:head-panel'));
  // USB / outlet module on the panel face (photo-index), sleeping-left end
  const u = P.usb, usb = mesh(new RoundedBoxGeometry(u.w, u.h, u.t, 2, 0.08), MAT.blackPlastic, 'bed:usb-module');
  usb.position.set(-inner / 2 + cw / 2, P.top - u.inset - u.h / 2, PANEL_FRONT + u.t / 2 - 0.02);
  g.add(usb);
  return g;
}

// ---------------------------------------------------------------- soft goods
// The duvet is ONE continuous grid in flat cloth coordinates (a across, b along, inches from the mattress centre) that is wrapped over the
// sheet-covered mattress: flat on top, quarter-round roll-over at the edges, straight drop down the sides/foot. The cloth patch beyond BOTH flat
// edges (the foot corners) is mapped radially around the corner, so the surplus cloth becomes a flared cone fold - no slit, no spike.
// The visible surface is the base surface lifted along its normal by the duvet thickness + quilting/rumples; the hem closes with a half-round roll.
const R0 = D.mattR + D.sheetT, ARC = (Math.PI / 2) * R0, HEM = K.th / 2;
const FLAT_X = D.mattW / 2 + D.sheetT - R0, FLAT_Z = D.mattL / 2 + D.sheetT - R0; // half-extents of the flat top
/** Arc length from the flat edge to the start of the hem roll, for a hem tip `hang` inches below the duvet top. */
const reach = (hang) => ARC + hang - K.th - R0 - HEM;
const EX = reach(K.side), EZ = reach(K.foot);

/** Base point p, outward normal n, drop below the sheet top and corner weight s2 (1 on the corner diagonal) for cloth coords (a, b); t = hem roll angle. */
function drape(a, b, t) {
  const sg = Math.sign(a) || 1, ex = Math.max(0, Math.abs(a) - FLAT_X), ez = Math.max(0, b - FLAT_Z);
  const phi = Math.atan2(ez, ex), c = Math.cos(phi), s = Math.sin(phi), s2 = (2 * s * c) ** 2;
  const rho = Math.max(ex / EX, ez / EZ); // 0 at the flat edge .. 1 at the hem, also inside the rectangular corner patch
  const e = rho * (EX * c * c + EZ * s * s + K.cornerBulge * s2) + HEM * Math.sin(t); // corner hem is rounded and hangs a touch lower
  const tt = Math.min(e / R0, Math.PI / 2), out = R0 * Math.sin(tt), drop = R0 * (1 - Math.cos(tt)) + Math.max(0, e - ARC);
  return { p: [sg * (Math.min(Math.abs(a), FLAT_X) + out * c), SHEET_TOP - drop, MATT_CZ + Math.min(b, FLAT_Z) + out * s],
    n: [sg * Math.sin(tt) * c, Math.cos(tt), Math.sin(tt) * s], drop, s2, sg };
}

/** Sample positions along one cloth axis: every quilt/16 (so stitch lines fall on grid lines) + the ends; hemmed ends add the roll steps (t > 0). */
function axis(lo, hi, hemLo, hemHi) {
  const step = K.quilt / 16, out = [], hem = (s) => Array.from({ length: 6 }, (_, k) => ({ s, t: (Math.PI * (k + 1)) / 6 }));
  if (hemLo) out.push(...hem(lo).reverse());
  out.push({ s: lo, t: 0 });
  for (let k = Math.ceil(lo / step + 0.3); k * step < hi - 0.3 * step; k++) out.push({ s: k * step, t: 0 });
  out.push({ s: hi, t: 0 });
  if (hemHi) out.push(...hem(hi));
  return out;
}

/** Grid surface: fn(col, row) -> [x, y, z, u, v]. */
function gridGeo(cols, rows, fn) {
  const pos = [], uv = [], idx = [], nc = cols.length;
  for (const r of rows) for (const c of cols) { const v = fn(c, r); pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4]); }
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nc - 1; i++) {
    const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Box-quilt loft: 0 on the stitch lines (every K.quilt inches), K.puff in the middle of a box. */
const puff = (a, b) => K.puff * (Math.abs(Math.sin(Math.PI * (a / K.quilt + 0.5))) * Math.abs(Math.sin((Math.PI * b) / K.quilt))) ** 0.35;
const lifted = (d, h, sink = 0) => [d.p[0] + d.n[0] * h, d.p[1] + d.n[1] * h - sink, d.p[2] + d.n[2] * h];

function duvet() {
  const R = rng(5), ph = Array.from({ length: 10 }, () => R() * 6.28);
  const cols = axis(-FLAT_X - EX, FLAT_X + EX, true, true), bFold = K.foldAt - D.mattL / 2;
  /** Vertical pleats on the hanging parts (outward only), fading in below the roll-over; pc runs along the hem. */
  const pleats = (d, a, b) => { const pc = b * (1 - d.s2) - d.sg * a * d.s2; return K.pleat * (0.5 + 0.35 * Math.sin(pc * 0.42 + ph[4]) + 0.2 * Math.sin(pc * 0.95 + ph[5])) * Math.min(1, d.drop / 5); };
  const hemWave = (d, a, b) => K.hemWave * Math.sin(a * 0.23 + b * 0.19 + ph[6]) * Math.min(1, d.drop / K.foot) ** 2; // hem is never dead level

  // main layer: from under the fold-back to the foot, hanging over both sides and the foot
  const rows = axis(bFold + K.foldW * 0.4, FLAT_Z + EZ, false, true);
  const main = gridGeo(cols, rows, (c, r) => {
    const a = c.s, b = r.s, t = Math.max(c.t, r.t), f = (1 + Math.cos(t)) / 2, d = drape(a, b, t);
    const top = 1 - Math.min(1, d.drop / (2 * R0));
    const free = THREE.MathUtils.smoothstep(b, bFold + K.foldW - 2, bFold + K.foldW + 1); // pressed flat where the fold-back lies on it
    const h = (K.th + (puff(a, b) + K.wrinkle * rumple(a, b, ph) * top) * free + pleats(d, a, b)) * f + K.flare * Math.max(0, d.drop - R0) * d.s2;
    return [...lifted(d, Math.max(h, 0.03), hemWave(d, a, b)), m(a), m(b)];
  });

  // fold-back: the head end turned back toward the foot, pale underside up - rolled nose (radius = duvet thickness, so the fold is two layers
  // thick), softly sagging flat, half-round hem resting on the main layer; the crease also runs down the hanging sides. Fold lines are wavy.
  const n = Math.round(K.foldW / (K.quilt / 16)), band = [];
  for (let i = 0; i <= 10; i++) { const al = -Math.PI / 2 + (Math.PI * i) / 10; band.push({ fr: 0, dz: -K.th * Math.cos(al), h: K.th * (1 + Math.sin(al)), s: K.th * (al + Math.PI / 2) }); }
  for (let i = 1; i <= n; i++) band.push({ fr: i / n, dz: (-HEM * i) / n, h: 2 * K.th - K.foldSag * Math.sin((Math.PI * i) / n), s: Math.PI * K.th + (K.foldW * i) / n });
  for (let i = 1; i <= 6; i++) { const t = (Math.PI * i) / 6; band.push({ fr: 1, dz: -HEM + HEM * Math.sin(t), h: K.th + HEM * (1 + Math.cos(t)), s: Math.PI * K.th + K.foldW + HEM * t }); }
  const fold = gridGeo(cols, band, (c, r) => {
    const a = c.s, f = (1 + Math.cos(c.t)) / 2;
    const zA = bFold + K.foldWave * (Math.sin(a * 0.09 + ph[7]) + 0.4 * Math.sin(a * 0.23 + ph[8])), zB = bFold + K.foldW + K.foldWave * Math.sin(a * 0.12 + ph[9]);
    const b = zA + r.fr * (zB - zA) + r.dz, d = drape(a, b, c.t), onTop = Math.min(1, r.h / K.th);
    const h = r.h - K.th * (1 - f) + (puff(a, r.fr * K.foldW + K.quilt / 2) + K.wrinkle * rumple(a + 40, b + 25, ph)) * f * onTop * (r.fr < 1 ? 1 : 0.5) + pleats(d, a, b) * f;
    return [...lifted(d, Math.max(h, 0.03), hemWave(d, a, b)), m(a), m(r.s)];
  });
  return [mesh(main, M.duvet, 'bed:duvet'), mesh(fold, M.duvetBack, 'bed:duvet-foldback')];
}

function pillows() {
  const Pd = D.pillow, R = rng(3), UNDER = 0.85; // underside is flattened by the pillow's own weight
  /** Plan outline for u,v in -1..1 (slightly waisted rectangle with dog-ear corners). */
  const plan = (u, v) => [u * (Pd.w / 2) * (1 - Pd.waist * (1 - v * v)), v * (Pd.d / 2) * (1 - Pd.waist * (1 - u * u))];
  return [-1, 1].map((side, n) => {
    const ph = R() * 6.28, dent = { x: (R() - 0.5) * 9, z: (R() - 0.5) * 4, k: 0.14 + 0.16 * R() }; // where a head has been - different per pillow
    // two seamed height-field shells: plump centre, thickness -> 0 at the perimeter seam, gathers near the seam, low crumple everywhere
    const shell = (up) => {
      const geo = new THREE.PlaneGeometry(1, 1, 48, 36), p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) * 2, v = p.getY(i) * 2, [px, pz] = plan(u, v);
        const edge = (1 - u ** 2) * (1 - v ** 2);
        const crease = 1 + 0.11 * Math.sin(u * 7 + v * 4 + ph) * Math.sin(v * 6 - u * 3 + ph * 2) * (1 - edge) + 0.06 * Math.sin(u * 2.3 + ph) * Math.sin(v * 1.7 - ph);
        const head = up > 0 ? 1 - dent.k * Math.exp(-(((px - dent.x) / 7) ** 2 + ((pz - dent.z) / 5) ** 2)) : 1;
        p.setXYZ(i, px, up * (Pd.h / 2) * (up > 0 ? 2 - UNDER : UNDER) * edge ** 0.42 * crease * head, -pz * up); // -pz*up keeps both shells facing outward
        uv.setXY(i, m(px), m(pz));
      }
      return geo;
    };
    const seam = Array.from({ length: 80 }, (_, i) => { const q = i / 20, k = Math.floor(q), f = (q - k) * 2 - 1; return [[f, -1], [1, f], [-f, 1], [-1, -f]][k]; })
      .map(([u, v]) => { const [px, pz] = plan(u, v); return [px, 0, pz]; });
    const geo = mergeGeometries([shell(1), shell(-1), piping(seam, Pd.piping, 160)]);
    // lean the head edge up against the panel, skew each pillow a little differently, then rest it ON the sheet / clear of the panel by its real extents
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(Pd.tiltDeg), THREE.MathUtils.degToRad(Pd.yawDeg[n]), 0, 'YXZ')));
    geo.computeVertexNormals(); geo.computeBoundingBox();
    const bb = geo.boundingBox, o = mesh(geo, M.pillow, `bed:pillow-${n ? 'right' : 'left'}`);
    o.position.set(side < 0 ? -Pd.gap / 2 - bb.max.x : Pd.gap / 2 - bb.min.x, SHEET_TOP - Pd.sink - bb.min.y, MATT_Z0 + Pd.headGap - bb.min.z);
    return o;
  });
}

function bedding() {
  const g = group('bed:bedding');
  // mattress: quilted panels top/bottom, vertically stitched border, piped tape edges where they meet (mostly hidden by the fitted sheet)
  const matt = mesh(scaleUV(new RoundedBoxGeometry(D.mattW, D.mattT, D.mattL, 5, D.mattR), D.mattW, D.mattL, 4), [M.border, M.border, M.mattress, M.mattress, M.border, M.border], 'bed:mattress');
  matt.position.set(0, D.deckH + D.mattT / 2, MATT_CZ);
  const k = D.mattR * (1 - Math.SQRT1_2), hx = D.mattW / 2 - k, hz = D.mattL / 2 - k, cr = D.mattR * Math.SQRT1_2; // tape edge rides the middle of the rounded edge
  const loop = (y) => [0, 1, 2, 3].flatMap((q) => Array.from({ length: 7 }, (_, i) => { const a = (q + i / 6) * (Math.PI / 2), sx = q === 1 || q === 2 ? -1 : 1, sz = q < 2 ? 1 : -1;
    return [sx * (hx - cr) + cr * Math.cos(a), y, MATT_CZ + sz * (hz - cr) + cr * Math.sin(a)]; }));
  g.add(matt, mesh(mergeGeometries([piping(loop(MATT_TOP - k), D.pipeR, 240), piping(loop(D.deckH + k), D.pipeR, 240)]), M.mattress, 'bed:mattress-piping'));
  // fitted sheet = slightly larger rounded shell over the whole border (its elastic hem is tucked under the mattress, out of sight)
  const sw = D.mattW + 2 * D.sheetT, sl = D.mattL + 2 * D.sheetT;
  const sheet = mesh(scaleUV(new RoundedBoxGeometry(sw, D.sheetDrop, sl, 5, R0), sw, sl, 39.37), M.sheet, 'bed:fitted-sheet');
  sheet.position.set(0, SHEET_TOP - D.sheetDrop / 2, MATT_CZ);
  g.add(sheet, ...duvet(), ...pillows());
  return g;
}

export function build() {
  materials();
  const root = group('bed', frame(), headboard(), bedding());
  root.scale.setScalar(m(1));
  return root;
}
