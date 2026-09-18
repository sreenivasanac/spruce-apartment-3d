// Full-size bed (spruce_apt_photos/full_size_bedframe.jpg): black steel platform frame + channelled headboard,
// 54x75x12 mattress, fitted sheet, duvet folded back, two pillows.
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

const D = FURNITURE.bed;
const HW = D.frameW / 2, HL = D.frameL / 2;
const MATT_Z0 = -HL + D.post + 0.25; // mattress head end sits just clear of the headboard panel
const MATT_CZ = MATT_Z0 + D.mattL / 2;
const MATT_TOP = D.deckH + D.mattT;
const SHEET_TOP = MATT_TOP + D.sheetT;

const mesh = (geo, mat, name) => { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; o.name = name; return o; };
/** Steel section (inches) with a tiny rolled-edge radius, centred at x,y,z. */
const steel = (w, h, d, x, y, z, name) => {
  const o = mesh(new RoundedBoxGeometry(w, h, d, 2, D.steelR), MAT.blackMetal, name);
  o.position.set(x, y, z);
  return o;
};
/** n copies of a plain box as one draw call; pts = [[x,y,z]...] centres. */
function instanced(w, h, d, pts, mat, name) {
  const o = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, pts.length);
  pts.forEach((p, i) => o.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p)));
  o.castShadow = o.receiveShadow = true; o.name = name;
  return o;
}

// Diamond-quilt bump for the mattress ticking; tile = 4" (UVs of the rounded box are rescaled to tiles).
function quiltBump() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), img = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = ((x + y) / 128) % 1, v = ((x - y + 128) / 128) % 1; // diagonal cells
    const p = Math.sin(u * Math.PI) * Math.sin(v * Math.PI); // pillow per diamond, 0 on the stitch lines
    const s = 255 * Math.sqrt(p);
    img.data.set([s, s, s, 255], (y * 128 + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

let M;
function materials() {
  const cloth = (color, name, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, bumpMap: TEX.carpetBump, bumpScale: 0.25,
    sheen: 0.15, sheenRoughness: 0.85, sheenColor: new THREE.Color(color), side: THREE.DoubleSide, name, ...extra });
  M ??= {
    panel: cloth(0x38393c, 'bed-headboard-dark-gray-fabric', { sheenColor: new THREE.Color(0x70727a), bumpScale: 0.5 }),
    mattress: Object.assign(MAT.mattress.clone(), { bumpMap: quiltBump(), bumpScale: 0.6, name: 'bed-mattress-quilted' }),
    sheet: cloth(0xe9e6df, 'bed-fitted-sheet-ivory'),
    duvet: cloth(0x5b6d7e, 'bed-duvet-slate-blue'),
    duvetBack: cloth(0xdfe2e4, 'bed-duvet-underside-pale'),
    pillow: cloth(0xf1efea, 'bed-pillowcase-white'),
  };
}

// Irregular rumples: plane waves [kx, kz (rad/inch), relative amplitude] in unrelated directions (no checkerboard).
const WAVES = [[0.21, 0.09, 1], [-0.13, 0.27, 0.8], [0.37, -0.31, 0.45], [0.05, 0.52, 0.35]];

/** Scale a geometry's 0..1 UVs so one texture tile = `tile` inches (approximate: uses w x h for every face). */
function scaleUV(geo, w, h, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return geo;
}

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
  g.add(instanced(D.frameW - 2 * D.railT, D.slat, D.slat, Array.from({ length: D.slats }, (_, i) => [0, slatY, z0 + pitch * (i + 1)]), MAT.blackMetal, 'bed:slats'));
  // centre rail under the slats + its legs
  const cr = D.centreRail, crY = D.deckH - D.slat - cr.h / 2;
  g.add(steel(cr.w, cr.h, span, 0, crY, z0 + span / 2, 'bed:centre-rail'));
  const legH = D.deckH - D.slat - cr.h - D.foot.h;
  const legs = Array.from({ length: D.centreLegs }, (_, i) => [0, D.foot.h + legH / 2, z0 + (span * (i + 1)) / (D.centreLegs + 1)]);
  // foot corner legs sit a little in from the foot end, inside the side rails (photo)
  const cornerH = D.deckH - D.railH - D.foot.h, cx = HW - D.railT - D.leg / 2, cz = HL - D.footLegInset;
  const corners = [[-cx, D.foot.h + cornerH / 2, cz], [cx, D.foot.h + cornerH / 2, cz]];
  g.add(instanced(D.leg, legH, D.leg, legs, MAT.blackMetal, 'bed:centre-legs'));
  g.add(instanced(D.leg, cornerH + D.railH * 0.5, D.leg, corners.map(([x, y, z]) => [x, y + D.railH * 0.25, z]), MAT.blackMetal, 'bed:foot-legs'));
  const padXZ = [...legs, ...corners, [-(HW - D.post / 2), 0, -HL + D.post / 2], [HW - D.post / 2, 0, -HL + D.post / 2]];
  g.add(instanced(D.foot.w, D.foot.h, D.foot.w, padXZ.map(([x, , z]) => [x, D.foot.h / 2, z]), MAT.blackPlastic, 'bed:feet'));
  return g;
}

function headboard() {
  const g = group('bed:headboard');
  const P = D.panel, z = -HL + D.post / 2, px = HW - D.post / 2, inner = D.frameW - 2 * D.post;
  const postH = D.headH - D.foot.h;
  g.add(
    steel(D.post, postH, D.post, -px, D.foot.h + postH / 2, z, 'bed:post-left'),
    steel(D.post, postH, D.post, px, D.foot.h + postH / 2, z, 'bed:post-right'),
    steel(inner, D.post, D.post, 0, D.headH - D.post / 2, z, 'bed:head-top-bar'),
    steel(inner, P.bar, D.post, 0, P.top + P.bar / 2, z, 'bed:panel-top-bar'),
    steel(inner, P.bar, D.post, 0, P.bottom - P.bar / 2, z, 'bed:panel-bottom-bar'),
  );
  // upholstered panel: one rounded "channel" per vertical flute, merged into a single mesh; front flush with the post fronts
  const cw = inner / P.channels, ph = P.top - P.bottom, zc = -HL + D.post - P.t / 2;
  const flutes = Array.from({ length: P.channels }, (_, i) =>
    scaleUV(new RoundedBoxGeometry(cw, ph, P.t, 4, P.r), cw, ph, 15.75).translate(-inner / 2 + cw * (i + 0.5), P.bottom + ph / 2, zc));
  g.add(mesh(mergeGeometries(flutes), M.panel, 'bed:head-panel'));
  // USB / outlet module on the panel face (photo-index), sleeping-left end
  const u = P.usb, usb = mesh(new RoundedBoxGeometry(u.w, u.h, u.t, 2, 0.08), MAT.blackPlastic, 'bed:usb-module');
  usb.position.set(-inner / 2 + cw / 2, P.top - u.inset - u.h / 2, -HL + D.post + u.t / 2 - 0.02);
  g.add(usb);
  return g;
}

// ---------------------------------------------------------------- soft goods
/**
 * Arc-length s (from the centre line) across a slab edge of half-width `half` rounded with radius r,
 * then hanging straight down until the drop reaches `hang`, ending in a rolled hem (radius hemR, 0 = none).
 * Returns [coord, drop below the top, hanging 0..1]. sMax(...) gives the arc length of the hem edge.
 */
const sMax = (half, r, hang, hemR) => half - r + (Math.PI / 2) * r + (hang - r) + Math.PI * hemR;
function wrap(s, half, r, hang, hemR) {
  const a = Math.abs(s), sg = Math.sign(s), flat = half - r, arc = (Math.PI / 2) * r, str = hang - r;
  if (a <= flat) return [s, 0, 0];
  if (a <= flat + arc) { const t = (a - flat) / r; return [sg * (flat + r * Math.sin(t)), r * (1 - Math.cos(t)), t / (Math.PI / 2)]; }
  if (a <= flat + arc + str) return [sg * half, r + a - flat - arc, 1];
  const t = (a - flat - arc - str) / hemR; // hem rolls back toward the mattress
  return [sg * (half - hemR * (1 - Math.cos(t))), hang + hemR * Math.sin(t), 1];
}

/**
 * Draped cloth surface. stations = [{ z, y, dZ, hZ, s }] along the bed (y = top elevation on the centre line, dZ = how far this
 * station already hangs over the foot, hZ = hanging 0..1, s = arc length for UVs); across X the cloth wraps the mattress edge.
 */
function drapeGeo(stations, { half, r, hang, hemR, nx = 96, seed = 1 }) {
  const K = D.duvet, R = rng(seed), ph = Array.from({ length: 8 }, () => R() * 6.28);
  const smax = sMax(half, r, hang, hemR), pos = [], uv = [], idx = [];
  for (const st of stations) for (let i = 0; i <= nx; i++) {
    const s = -smax + (2 * smax * i) / nx;
    const sg = Math.sign(s); let [x0, dX, hX] = wrap(s, half, r, hang, hemR);
    x0 = sg * (half - (half - Math.abs(x0)) * (1 - st.hZ * hX)); // no rolled hem inside the corner fan (it would knot up)
    const top = (1 - hX) * (1 - st.hZ); // 1 on the flat top, 0 where hanging
    // low rumples on top, vertical pleats on the hanging parts (outward only so nothing cuts into the mattress)
    const rum = K.wrinkle * WAVES.reduce((a, [kx, kz, amp], n) => a + amp * Math.sin(x0 * kx + st.z * kz + ph[n]), 0);
    const pleatX = (0.55 + 0.45 * Math.sin(st.s * 0.42 + ph[4]) + 0.25 * Math.sin(st.s * 0.95 + ph[5])) * Math.min(1, dX / 5) * hX;
    const pleatZ = (0.55 + 0.45 * Math.sin(s * 0.38 + ph[6]) + 0.25 * Math.sin(s * 0.9 + ph[7])) * Math.min(1, st.dZ / 5) * st.hZ;
    // foot corners: the surplus cloth fans out around the corner as a soft cone with a diagonal pleat, hanging a little lower
    const lo = Math.min(dX, st.dZ), ang = Math.atan2(st.dZ, dX || 1e-6), fan = K.flare * lo;
    pos.push(
      x0 + sg * (pleatX * (1 - st.hZ) + fan * Math.cos(ang)),
      st.y + st.dZ - Math.max(dX, st.dZ) - K.cornerSag * lo + rum * top,
      st.z + (st.zIn ?? 0) * hX + pleatZ * (1 - hX) + fan * Math.sin(ang),
    );
    uv.push(m(s), m(st.s));
  }
  const row = nx + 1;
  for (let j = 0; j < stations.length - 1; j++) for (let i = 0; i < nx; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function bedding() {
  const g = group('bed:bedding');
  const K = D.duvet, hw = D.mattW / 2, hl = D.mattL / 2;
  // mattress + fitted sheet (sheet = slightly larger rounded shell that stops short of the mattress bottom)
  const matt = mesh(scaleUV(new RoundedBoxGeometry(D.mattW, D.mattT, D.mattL, 5, D.mattR), D.mattW, D.mattL, 4), M.mattress, 'bed:mattress');
  matt.position.set(0, D.deckH + D.mattT / 2, MATT_CZ);
  const sw = D.mattW + 2 * D.sheetT, sl = D.mattL + 2 * D.sheetT;
  const sheet = mesh(scaleUV(new RoundedBoxGeometry(sw, D.sheetDrop, sl, 5, D.mattR + D.sheetT), sw, sl, 39.37), M.sheet, 'bed:fitted-sheet');
  sheet.position.set(0, SHEET_TOP - D.sheetDrop / 2, MATT_CZ);
  g.add(matt, sheet);

  // duvet: main layer from under the fold-back to the foot, hanging over both sides and the foot
  const zFold = MATT_Z0 + K.foldAt, top = SHEET_TOP + K.th, half = hw + K.th, r = D.mattR + K.th, halfL = hl + K.th;
  const s0 = zFold + K.foldW - 3 - MATT_CZ, s1 = sMax(halfL, r, K.foot, K.hemR), nz = 120;
  const main = Array.from({ length: nz + 1 }, (_, j) => {
    const s = s0 + ((s1 - s0) * j) / nz, [z, dZ, hZ] = wrap(s, halfL, r, K.foot, K.hemR);
    return { z: MATT_CZ + z, y: top - dZ, dZ, hZ, s, zIn: hZ === 1 ? halfL - z : 0 }; // zIn undoes the foot hem roll at the corners
  });
  g.add(mesh(drapeGeo(main, { half, r, hang: K.side, hemR: K.hemR, seed: 5 }), M.duvet, 'bed:duvet'));

  // fold-back band: rolled nose toward the pillows, flat top showing the underside, rolled hem onto the main layer
  const band = [], nose = K.th, hem = K.th / 2;
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 10; band.push({ z: zFold - nose * Math.cos(a), y: SHEET_TOP + nose + nose * Math.sin(a), s: nose * (a + Math.PI / 2) }); }
  for (let i = 1; i <= 16; i++) band.push({ z: zFold + (K.foldW * i) / 16, y: SHEET_TOP + 2 * nose, s: Math.PI * nose + (K.foldW * i) / 16 });
  for (let i = 1; i <= 8; i++) { const a = (Math.PI * i) / 8; band.push({ z: zFold + K.foldW + hem * Math.sin(a), y: SHEET_TOP + 2 * nose - hem * (1 - Math.cos(a)), s: Math.PI * nose + K.foldW + hem * a }); }
  band.forEach((b) => Object.assign(b, { dZ: 0, hZ: 0 }));
  g.add(mesh(drapeGeo(band, { half: half + K.th, r: r + K.th, hang: K.side + K.th - 0.8, hemR: K.hemR, seed: 9 }), M.duvetBack, 'bed:duvet-foldback'));

  // pillows: two seamed height-field shells (plump centre, thickness -> 0 at the perimeter seam, dog-ear corners, flatter underside)
  const Pd = D.pillow, R = rng(3), UNDER = 0.85; // underside is flattened by the pillow's own weight
  [-1, 1].forEach((side, n) => {
    const ph = R() * 6.28;
    const shell = (up) => {
      const geo = new THREE.PlaneGeometry(1, 1, 48, 36), p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) * 2, v = p.getY(i) * 2; // -1..1
        const px = u * (Pd.w / 2) * (1 - Pd.waist * (1 - v * v)), pz = v * (Pd.d / 2) * (1 - Pd.waist * (1 - u * u));
        const edge = (1 - u ** 2) * (1 - v ** 2);
        const crease = 1 + 0.07 * Math.sin(u * 7 + v * 4 + ph) * Math.sin(v * 6 - u * 3 + ph * 2) * (1 - edge); // gathers near the seam
        const dent = up > 0 ? 1 - 0.2 * Math.exp(-((px / 7) ** 2 + (pz / 5) ** 2)) : 1; // where a head has been
        p.setXYZ(i, px, up * (Pd.h / 2) * (up > 0 ? 2 - UNDER : UNDER) * edge ** 0.42 * crease * dent, -pz * up); // -pz*up keeps both shells facing outward
        uv.setXY(i, m(px), m(pz));
      }
      geo.computeVertexNormals();
      return geo;
    };
    const geo = mergeGeometries([shell(1), shell(-1)]);
    const o = mesh(geo, M.pillow, `bed:pillow-${n ? 'right' : 'left'}`), tilt = THREE.MathUtils.degToRad(Pd.tiltDeg);
    o.rotation.set(tilt, (R() - 0.5) * 0.12, 0, 'YXZ');
    // rest the lower (foot-side) edge on the sheet and the raised edge against the panel
    o.position.set(side * (Pd.w / 2 + Pd.gap / 2), SHEET_TOP + (Pd.h / 2) * UNDER * Math.cos(tilt) - Pd.sink, MATT_Z0 + 0.5 + (Pd.d / 2) * Math.cos(tilt));
    g.add(o);
  });
  return g;
}

export function build() {
  materials();
  const root = group('bed', frame(), headboard(), bedding());
  root.scale.setScalar(m(1));
  return root;
}
