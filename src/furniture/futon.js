// Charcoal linen click-clack futon (spruce_apt_photos/futon2.jpg = sofa, futon3.jpg = flat bed).
// Contract: build() returns a THREE.Group named 'futon', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.futon.pos/rot and makes it draggable.
//
// Everything below is modelled in INCHES inside one group that is scaled by m(1) (single conversion).
// Click toggles sofa <-> bed: the back hinges about the seat's rear-top edge, the centre console
// (folded DOWN onto the seat in sofa mode, cup holders up) folds back into the backrest, the rear stay
// swings down, and the whole piece slides forward so the back never passes through the wall behind it.
import * as THREE from 'three';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { group } from '../lib/build.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const D = FURNITURE.futon;
const RAD = Math.PI / 180;

/** Heathered linen weave; tile = D.linenTile inches (UVs below are in tiles). kind: 'color' | 'bump'. */
function linenTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d', { willReadFrequently: true }), r = rng(21), s = 512;
  ctx.fillStyle = kind === 'color' ? '#3d4046' : '#808080'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 14000; i++) { // short warp/weft slubs, light and dark — same cool-neutral hue as the base, nothing brighter than ~#5a5e66
    const light = r() < 0.5, a = 0.05 + r() * 0.13, len = 6 + r() * 34, x = r() * s, y = r() * s, horiz = r() < 0.5;
    ctx.fillStyle = kind === 'color' ? `rgba(${light ? '90,94,102' : '24,25,28'},${a * 1.5})` : `rgba(${light ? '255,255,255' : '0,0,0'},${a * 1.6})`;
    for (const o of [0, -s]) horiz ? ctx.fillRect(x + o, y, len, 1.5) : ctx.fillRect(x, y + o, 1.5, len); // wrap
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Top-stitch thread: 8 dashes per tile (thread / fabric gap); mip-maps average it to a fine lighter line at a distance. */
function stitchTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#34373c'; ctx.fillRect(0, 0, 64, 4);
  ctx.fillStyle = `#${D.stitch.color.toString(16).padStart(6, '0')}`; for (let i = 0; i < 8; i++) ctx.fillRect(i * 8, 0, 5, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let FABRIC, CUP, STITCH;
function materials() {
  FABRIC ??= new THREE.MeshPhysicalMaterial({ map: linenTex('color'), bumpMap: linenTex('bump'), bumpScale: 0.45, roughness: 0.95,
    sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x50535a), name: 'futon-charcoal-linen' });
  CUP ??= Object.assign(MAT.blackPlastic.clone(), { side: THREE.DoubleSide, name: 'futon-cupholder-black' });
  STITCH ??= new THREE.MeshStandardMaterial({ map: stitchTex(), roughness: 0.9, name: 'futon-top-stitch' });
}

const mesh = (geo, mat, name) => { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; o.name = name; return o; };
const clamp = THREE.MathUtils.clamp;

/** Vertex coordinates along one axis: 3 tight segments across each rounded edge, ~res spacing between, dense rows across every seam valley. */
function axisCoords(len, r, res, seams = []) {
  const lo = -len / 2 + r, hi = len / 2 - r, n = Math.max(2, Math.round((hi - lo) / res));
  const fine = seams.flatMap((s) => [0, 0.08, 0.3, 0.6, 1].flatMap((k) => [s - k * D.seamW, s + k * D.seamW])).filter((c) => c > lo + 0.05 && c < hi - 0.05);
  const even = Array.from({ length: n - 1 }, (_, i) => lo + ((hi - lo) * (i + 1)) / n).filter((c) => fine.every((f) => Math.abs(f - c) > 0.3));
  const a = [...fine, ...even];
  for (let i = 0; i <= 3; i++) a.push(-len / 2 + (r * i) / 3, len / 2 - (r * i) / 3);
  return [...new Set(a.map((c) => Math.round(c * 1e4) / 1e4))].sort((p, q) => p - q);
}

/**
 * Tufted top height above the seam plane: flat panels (height puff) that roll down into narrow stitched valleys
 * (D.seamW each side, crisp crease at the thread) and pinch into a dimple only where two interior seams cross.
 */
function tuftH(x, z, gw, gd, cols, rows, puff, dimple) {
  if (Math.abs(x) >= gw / 2 || Math.abs(z) >= gd / 2) return 0;
  const cw = gw / cols, cd = gd / rows, fu = (x + gw / 2) / cw, fv = (z + gd / 2) / cd, cu = Math.round(fu), cv = Math.round(fv);
  const dx = Math.abs(fu - cu) * cw, dz = Math.abs(fv - cv) * cd;
  const f = (dist) => 1 - (1 - clamp((dist - D.stitch.w * 0.6) / D.seamW, 0, 1)) ** 2;
  let h = puff * f(dx) * f(dz);
  if (cu > 0 && cu < cols && cv > 0 && cv < rows) h -= dimple * Math.exp(-(dx * dx + dz * dz) / 0.5);
  return h;
}

/**
 * Upholstered pad: rounded box w × t × d whose TOP is a tufted height-field (cols × rows panels, see tuftH).
 * Panel tops are at y=0, bottom at y=-t. res = vertex spacing in inches; deform(v) optionally reshapes the finished pad (bolsters).
 */
function padGeo(w, t, d, { cols = 1, rows = 1, puff = D.puff, r = D.edgeR, res = 1, resY, dimple = D.dimple, deform } = {}) {
  const tb = t - puff; // body box under the panels
  r = Math.min(r, tb / 2 - 0.01);
  const gw = w - 2 * r, gd = d - 2 * r, tufted = cols * rows > 1 || puff > 0.1;
  const seamsOf = (n, g) => (tufted ? Array.from({ length: n + 1 }, (_, i) => -g / 2 + (g * i) / n) : []);
  const ax = axisCoords(w, r, res, seamsOf(cols, gw)), ay = axisCoords(tb, r, resY ?? tb), az = axisCoords(d, r, res, seamsOf(rows, gd));
  const g = new THREE.BoxGeometry(w, tb, d, ax.length - 1, ay.length - 1, az.length - 1);
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  const v = new THREE.Vector3(), q = new THREE.Vector3(), flat = new THREE.Vector3();
  const pick = (a, c, len) => a[Math.round(((c + len / 2) / len) * (a.length - 1))];
  for (let i = 0; i < P.count; i++) {
    v.set(pick(ax, P.getX(i), w), pick(ay, P.getY(i), tb), pick(az, P.getZ(i), d)); flat.copy(v);
    // round edges/corners: clamp to the inner box, push back out by r
    q.set(clamp(v.x, -w / 2 + r, w / 2 - r), clamp(v.y, -tb / 2 + r, tb / 2 - r), clamp(v.z, -d / 2 + r, d / 2 - r));
    const off = v.clone().sub(q); if (off.lengthSq() > 0) v.copy(q).add(off.setLength(r));
    if (N.getY(i) > 0.5) v.y += tuftH(v.x, v.z, gw, gd, cols, rows, puff, dimple);
    // box-projected UVs in linen tiles, taken from the UN-rounded position so the weave runs straight (not squeezed) over the bevels
    const nX = Math.abs(N.getX(i)) > 0.5, nY = Math.abs(N.getY(i)) > 0.5;
    UV.setXY(i, (nX ? flat.z : flat.x) / D.linenTile, (nY ? flat.z : flat.y) / D.linenTile);
    v.y -= tb / 2 + puff;
    deform?.(v);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  return smoothNormals(g);
}

/** Thread ribbons lying in the interior seam valleys of a padGeo top (same arguments), merged into one mesh. */
function stitches(name, w, t, d, { cols = 1, rows = 1, puff = D.puff, r = D.edgeR, dimple = D.dimple } = {}) {
  r = Math.min(r, (t - puff) / 2 - 0.01);
  const gw = w - 2 * r, gd = d - 2 * r, parts = [];
  const line = (alongX, c, len) => {
    const g = new THREE.PlaneGeometry(len, D.stitch.w, Math.ceil(len / 0.5), 1).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / (D.stitch.pitch * 8));
    if (!alongX) g.rotateY(Math.PI / 2);
    g.translate(alongX ? 0 : c, 0, alongX ? c : 0);
    const P = g.attributes.position; // follow the height-field at the seam centre (dips into the crossing dimples)
    for (let i = 0; i < P.count; i++) P.setY(i, tuftH(alongX ? P.getX(i) : c, alongX ? c : P.getZ(i), gw, gd, cols, rows, puff, dimple) - puff + 0.02);
    parts.push(g);
  };
  for (let i = 1; i < cols; i++) line(false, -gw / 2 + (gw * i) / cols, gd);
  for (let j = 1; j < rows; j++) line(true, -gd / 2 + (gd * j) / rows, gw);
  const o = mesh(mergeGeometries(parts), STITCH, name); o.castShadow = false;
  return o;
}

/** Box-projected linen UVs (in tiles) for arbitrary geometry: project along the dominant normal axis. */
function boxUV(g) {
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
    const [u, w] = nx > ny && nx > nz ? [P.getZ(i), P.getY(i)] : ny > nz ? [P.getX(i), P.getZ(i)] : [P.getX(i), P.getY(i)];
    UV.setXY(i, u / D.linenTile, w / D.linenTile);
  }
  return g;
}

/** Area-weighted normals shared across coincident vertices (BoxGeometry duplicates them per face). */
function smoothNormals(g) {
  const P = g.attributes.position, I = g.index, acc = new Map();
  const key = (i) => `${Math.round(P.getX(i) * 500)},${Math.round(P.getY(i) * 500)},${Math.round(P.getZ(i) * 500)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < I.count; f += 3) {
    const ids = [I.getX(f), I.getX(f + 1), I.getX(f + 2)];
    a.fromBufferAttribute(P, ids[0]); b.fromBufferAttribute(P, ids[1]); c.fromBufferAttribute(P, ids[2]);
    const n = b.sub(a).cross(c.sub(a)); // length = 2·area
    for (const id of ids) { const k = key(id); acc.set(k, (acc.get(k) ?? new THREE.Vector3()).add(n)); }
  }
  const N = g.attributes.normal;
  for (let i = 0; i < P.count; i++) { const n = acc.get(key(i)).clone().normalize(); N.setXYZ(i, n.x, n.y, n.z); }
  return g;
}

/** Piping cord: closed rounded-rectangle loop in the XZ plane at height y (deform = same reshaping as its pad). */
function piping(w, d, rc, y, name, deform) {
  const pts = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], k) => {
    for (let j = 0; j <= 4; j++) {
      const a = (k + j / 4) * Math.PI / 2;
      pts.push(new THREE.Vector3(sx * (w / 2 - rc) + rc * Math.cos(a), y, sz * (d / 2 - rc) + rc * Math.sin(a)));
    }
  });
  const dense = []; // add points on the straights so the spline cannot bow
  pts.forEach((p, i) => { const nxt = pts[(i + 1) % pts.length]; dense.push(p); if (p.distanceTo(nxt) > 2 * rc) for (let s = 1; s < 4; s++) dense.push(p.clone().lerp(nxt, s / 4)); });
  const curve = new THREE.CatmullRomCurve3(dense, true, 'centripetal');
  const g = new THREE.TubeGeometry(curve, 160, D.pipeR, 8, true);
  const uv = g.attributes.uv, L = curve.getLength(); // weave at true scale along the cord instead of one tile stretched round the loop
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * L) / D.linenTile, (uv.getY(i) * 2 * Math.PI * D.pipeR) / D.linenTile);
  if (deform) { const P = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { deform(v.fromBufferAttribute(P, i)); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); }
  return mesh(g, FABRIC, name);
}

/** Pad + piping cord on the tangent (45°) line of its rounded top rim (+ bottom rim with bottomPipe) + top-stitching on tufted pads. */
function pipedPad(name, w, t, d, opts = {}) {
  const puff = opts.puff ?? D.puff, r = Math.min(opts.r ?? D.edgeR, (t - puff) / 2 - 0.01), k = r * (1 - Math.SQRT1_2);
  const g = group(name, mesh(padGeo(w, t, d, opts), FABRIC, `${name}:pad`));
  const rims = [-puff - k, ...(opts.bottomPipe ? [-t + k] : [])];
  rims.forEach((y, i) => g.add(piping(w - 2 * k, d - 2 * k, r * Math.SQRT1_2 + 0.05, y, `${name}:piping${i}`, opts.deform)));
  if ((opts.cols ?? 1) * (opts.rows ?? 1) > 1) g.add(stitches(`${name}:stitching`, w, t, d, opts));
  return g;
}

/**
 * Loose-pillow shaping for an arm bolster pad (pad coords: top y=0, bottom y=-t): crowned top, bulging sides and ends,
 * ends pinched toward the piping seams, and the part overhanging the seat end (outward = sx) sagging.
 */
function bolsterDeform(w, t, d, sx) {
  const B = D.bolster, x0 = w / 2 - (D.w - D.bodyW) / 2;
  return (v) => {
    const u = v.x / (w / 2), s = v.z / (d / 2), yn = (v.y + t / 2) / (t / 2), s4 = s ** 4, side = Math.max(0, 1 - yn * yn);
    v.y += B.crown * ((yn + 1) / 2) ** 2 * Math.max(0, 1 - u * u) * (1 - s * s);
    v.x += u * B.bulge * side * (1 - s4);
    v.z += s * B.endBulge * Math.max(0, 1 - u * u) * side;
    v.y = -t / 2 + (v.y + t / 2) * (1 - B.pinch * s4);
    v.y -= B.droop * clamp((sx * v.x - x0) / (w / 2 - x0), 0, 1.5) ** 2;
  };
}

/** Mirror-chrome conical leg, top at y=h: mounting plate, cone, wide round foot disc with a radiused edge (no visible glide). */
function leg(h, name) {
  const R = D.footR, T = D.footT, e = 0.09;
  const foot = new THREE.LatheGeometry([[0, 0], [R - e, 0], [R - e / 3, e / 3], [R, e], [R, T - e], [R - e / 3, T - e / 3], [R - e, T], [0, T]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  const g = group(name, mesh(new THREE.CylinderGeometry(D.legTopR, D.legBotR, h - T - 0.3, 32), MAT.futonChrome, `${name}:cone`),
    mesh(new THREE.CylinderGeometry(D.legTopR + 0.25, D.legTopR + 0.25, 0.3, 32), MAT.futonChrome, `${name}:plate`),
    mesh(foot, MAT.futonChrome, `${name}:foot`));
  g.children[0].position.y = T + (h - T - 0.3) / 2; g.children[1].position.y = h - 0.15;
  return g;
}

/**
 * Fold-down console, one piped upholstered body: 2×2 tufted face (y=0, flush with the backrest when stowed) bonded to the
 * cup-holder tray (two real wells); piping round the face perimeter, a cross seam divides the tray side.
 */
function buildConsole(len) {
  const w = D.consoleW - 0.3, faceT = D.consoleT - D.cupDepth, bev = 0.3;
  const face = pipedPad('futon:console:face', w, faceT, len, { cols: 2, rows: 2, r: 0.5, dimple: 0.25 });
  face.position.z = -len / 2;

  const rr = 0.9, hw = w / 2, shape = new THREE.Shape(); // rounded rect in (x, z), z from -len..0 (the bevel adds bev back)
  const z0 = -len + bev, z1 = -bev;
  shape.moveTo(-hw + bev + rr, z0); shape.lineTo(hw - bev - rr, z0); shape.absarc(hw - bev - rr, z0 + rr, rr, -Math.PI / 2, 0);
  shape.lineTo(hw - bev, z1 - rr); shape.absarc(hw - bev - rr, z1 - rr, rr, 0, Math.PI / 2);
  shape.lineTo(-hw + bev + rr, z1); shape.absarc(-hw + bev + rr, z1 - rr, rr, Math.PI / 2, Math.PI);
  shape.lineTo(-hw + bev, z0 + rr); shape.absarc(-hw + bev + rr, z0 + rr, rr, Math.PI, 1.5 * Math.PI);
  const cupX = D.cupR + 0.55, cupZ = -len + D.cupR + 1.7;
  for (const sx of [-1, 1]) { const h = new THREE.Path(); h.absarc(sx * cupX, cupZ, D.cupR + bev, 0, 2 * Math.PI, true); shape.holes.push(h); }
  const slabG = new THREE.ExtrudeGeometry(shape, { depth: D.cupDepth - 2 * bev + 0.4, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 4, curveSegments: 32 });
  slabG.rotateX(Math.PI / 2); // shape y -> z, extrusion -> -y
  const slab = mesh(boxUV(slabG), FABRIC, 'futon:console:slab'); slab.position.y = -faceT - bev + 0.4; // sunk 0.4" into the face pad: no air gap, the joint reads as a sewn seam
  const seam = mesh(new THREE.CylinderGeometry(0.13, 0.13, w - 2 * bev - 0.2, 8), FABRIC, 'futon:console:seam'); // cross seam between the upholstered part and the cup-holder tray
  seam.rotation.z = Math.PI / 2; seam.position.set(0, -D.consoleT + 0.04, -len * D.consoleSeamFrac);

  const cups = group('futon:console:cupholders');
  for (const sx of [-1, 1]) {
    const wall = mesh(new THREE.CylinderGeometry(D.cupR, D.cupR * 0.94, D.cupDepth - 0.1, 40, 1, true), CUP, 'futon:cupholder:wall');
    wall.position.set(sx * cupX, -D.consoleT + (D.cupDepth - 0.1) / 2, cupZ); // widest at the mouth (local -y = up when folded down)
    wall.rotation.x = Math.PI;
    const floor = mesh(new THREE.CircleGeometry(D.cupR, 40), CUP, 'futon:cupholder:floor');
    floor.rotation.x = Math.PI / 2; floor.position.set(sx * cupX, -D.consoleT + D.cupDepth - 0.12, cupZ);
    const lip = mesh(new THREE.TorusGeometry(D.cupR + 0.12, 0.14, 10, 48), CUP, 'futon:cupholder:lip');
    lip.rotation.x = Math.PI / 2; lip.position.set(sx * cupX, -D.consoleT - 0.02, cupZ);
    cups.add(wall, floor, lip);
  }

  // pull strap at the free end: hangs off the front lip when folded down, pokes up at the wall side of the bed when stowed
  const strap = group('futon:console:strap', mesh(new THREE.BoxGeometry(1, 0.12, 2.6), FABRIC, 'futon:console:strap:web'),
    mesh(new THREE.TorusGeometry(0.55, 0.13, 8, 24), FABRIC, 'futon:console:strap:loop'));
  strap.children[0].position.z = -1.3; strap.children[1].position.z = -3; strap.children[1].rotation.x = Math.PI / 2;
  strap.position.set(0, -D.consoleT + 0.5, -len + 0.3); strap.rotation.x = 75 * RAD;

  return group('futon:console', face, slab, seam, cups, strap);
}

export function build() {
  materials();
  const theta = (90 - D.reclineDeg) * RAD; // back rotation from flat
  const rearExt = (a) => D.backT * Math.sin(a) + D.backL * Math.cos(a); // how far the back reaches behind the hinge
  const seatD = D.d - rearExt(theta), zHinge = -D.d / 2 + rearExt(theta);

  // seat: one tufted body on the legs, piping at the top rim and along the bottom edge of the fascia
  const seat = pipedPad('futon:seat', D.bodyW, D.seatH - D.legH, seatD, { cols: D.seatGrid[0], rows: D.seatGrid[1], bottomPipe: true });
  seat.position.set(0, D.seatH, zHinge + seatD / 2);
  // fabric gusset along the hinge line: fills the crevice between the rounded seat and back edges; stays inside the seat's rear face
  const gusset = mesh(padGeo(D.bodyW - 1, D.gusset, D.gusset, { puff: 0.02, r: 0.6, res: 2 }), FABRIC, 'futon:gusset');
  gusset.position.set(0, D.seatH - 0.3, zHinge + D.gusset / 2 - 0.35);
  const legs = group('futon:legs');
  for (const sx of [-1, 1]) for (const z of [zHinge + 3, D.d / 2 - 3]) { const l = leg(D.legH + 0.05, 'futon:leg'); l.position.set(sx * (D.bodyW / 2 - 3.5), 0, z); legs.add(l); }

  // back (local frame: hinge line = origin, length along -z, upholstered face = +y)
  const sideW = (D.bodyW - D.consoleW) / 2, back = group('futon:back');
  for (const sx of [-1, 1]) {
    const p = pipedPad(`futon:back:${sx < 0 ? 'left' : 'right'}`, sideW, D.backT, D.backL, { cols: D.backGrid[0], rows: D.backGrid[1] });
    p.position.set(sx * (D.consoleW + sideW) / 2, 0, -D.backL / 2); back.add(p);
  }
  const recess = mesh(padGeo(D.consoleW + 1, D.backT - D.consoleT, D.backL, { puff: 0.05, r: 0.6, res: 2 }), FABRIC, 'futon:back:recess');
  recess.position.set(0, -D.consoleT, -D.backL / 2); back.add(recess);
  // continuous rails across the console bay: top rail above the console, bottom rail below its pivot
  [['futon:back:band', D.backBand, -D.backL + D.backBand / 2], ['futon:back:band:low', D.consoleHingeUp, -D.consoleHingeUp / 2]].forEach(([name, l, z]) => {
    const band = mesh(padGeo(D.consoleW + 1.2, D.backT - D.puff - 0.15, l, { puff: 0.02, r: 0.45, res: 0.7 }), FABRIC, name);
    band.position.set(0, -D.puff - 0.15, z); back.add(band);
  });
  const consoleLen = D.backL - D.backBand - D.consoleHingeUp + 0.3;
  const consoleG = buildConsole(consoleLen); consoleG.position.z = -D.consoleHingeUp; back.add(consoleG);
  // rear stay: chrome U-leg that carries the back in bed mode, folds flat against the underside in sofa mode
  const stayLen = D.seatH - D.backT - D.stayR - 0.05, stayX = D.bodyW / 2 - 8;
  const stay = group('futon:back:stay');
  for (const sx of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(D.stayR, D.stayR, stayLen, 16), MAT.futonChrome, 'futon:back:stay:leg'); c.position.set(sx * stayX, -stayLen / 2, 0); stay.add(c); }
  const bar = mesh(new THREE.CylinderGeometry(D.stayR, D.stayR, 2 * stayX, 16), MAT.futonChrome, 'futon:back:stay:bar'); bar.rotation.z = Math.PI / 2; bar.position.y = -stayLen + D.stayR; stay.add(bar);
  stay.position.set(0, -D.backT - D.stayR - 0.05, -D.backL + 4); // tube touches the back's underside when folded
  const hingeBlock = mesh(new THREE.BoxGeometry(2 * stayX + 2, 0.5, 1.4), MAT.blackMetal, 'futon:back:stay:bracket'); hingeBlock.position.set(0, -D.backT - 0.2, -D.backL + 4);
  back.add(stay, hingeBlock);
  back.position.set(0, D.seatH, zHinge);

  // click-clack ratchet hinges: round-ended black steel straps on the seat frame and on the back at both ends, tucked just under the hinge line;
  // the pin rides on the back strap and stays over the (longer-reaching) seat strap in every pose
  const H = D.hingePlate, hinges = group('futon:hinges');
  const strap = new THREE.Shape(); // capsule, length along shape-x
  strap.moveTo(-H.l / 2 + H.w / 2, -H.w / 2); strap.lineTo(H.l / 2 - H.w / 2, -H.w / 2); strap.absarc(H.l / 2 - H.w / 2, 0, H.w / 2, -Math.PI / 2, Math.PI / 2);
  strap.lineTo(-H.l / 2 + H.w / 2, H.w / 2); strap.absarc(-H.l / 2 + H.w / 2, 0, H.w / 2, Math.PI / 2, 1.5 * Math.PI);
  const strapG = new THREE.ExtrudeGeometry(strap, { depth: H.t, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, -H.t / 2).rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const x = sx * (D.bodyW / 2 + H.t / 2 + 0.02), yBack = -D.edgeR - H.w / 2;
    const onSeat = mesh(strapG, MAT.blackMetal, 'futon:hinge:seat-plate'); onSeat.position.set(x, D.seatH - 0.2 - H.w / 2, zHinge + H.l / 2 - 2);
    const onBack = mesh(strapG, MAT.blackMetal, 'futon:hinge:back-plate'); onBack.position.set(x + sx * H.t, yBack, -H.l / 2 + H.w / 2);
    const pin = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16), MAT.futonChrome, 'futon:hinge:pin'); pin.rotation.z = Math.PI / 2; pin.position.set(x + sx * (1.5 * H.t + 0.06), yBack, 0);
    hinges.add(onSeat); back.add(onBack, pin);
  }

  // loose arm bolsters: overstuffed pillows that overhang the seat ends and tip slightly outward; left/right sit a little differently
  const tau = D.armTiltDeg * RAD, B = D.bolster, padW = D.armW - 2 * B.bulge, padT = D.armT - B.crown, armL = seatD - 1 - 2 * B.endBulge, arms = [];
  [-1, 1].forEach((sx, i) => {
    const a = pipedPad(`futon:bolster:${sx < 0 ? 'left' : 'right'}`, padW, padT, armL, { puff: 0.02, r: 1, res: 0.7, resY: 0.6, bottomPipe: true, deform: bolsterDeform(padW, padT, armL, sx) });
    a.children.forEach((c) => (c.position.y = -D.armT / 2 + padT)); // pad bottom at -armT/2 of the group origin, crown tops out at +armT/2
    const cx = D.w / 2 - (D.armW / 2) * Math.cos(tau) - (D.armT / 2) * Math.sin(tau) - (armL / 2) * Math.sin(Math.abs(B.yawDeg[i]) * RAD); // yawed ends stay inside the overall width
    const s = (D.bodyW / 2 - cx + (D.armT / 2) * Math.sin(tau)) / Math.cos(tau); // bottom face rests on the seat's side edge
    a.position.set(sx * cx, D.seatH + s * Math.sin(tau) + (D.armT / 2) * Math.cos(tau) - 0.3, D.d / 2 - 0.5 - B.endBulge - armL / 2 + B.shift[i]);
    a.rotation.set(0, B.yawDeg[i] * RAD, -sx * tau); arms.push(a);
  });

  const inner = group('futon:body', seat, gusset, legs, hinges, back, ...arms);
  inner.scale.setScalar(m(1));
  const root = group('futon', inner);

  // ---- sofa <-> bed ----
  const consoleTilt = Math.asin((D.consoleHingeUp * Math.sin(theta)) / consoleLen); // free end rests on the seat, pivot sits consoleHingeUp up the back
  let t = 0, goal = 0; // 0 = sofa, 1 = bed
  const pose = (k) => {
    const e = k * k * (3 - 2 * k), a = theta * (1 - e);
    back.rotation.x = a;
    consoleG.rotation.x = (Math.PI + consoleTilt - theta) * (1 - e); // folded over onto the seat, cup holders up, rear (pivot) end high
    stay.rotation.x = -(Math.PI / 2) * (1 - e);
    inner.position.z = m(rearExt(a) - rearExt(theta)); // keep the rear plane fixed (wall behind)
  };
  pose(0);
  root.userData.onClick = () => { goal = goal ? 0 : 1; };
  root.userData.tick = (dt) => { if (t !== goal) { t = THREE.MathUtils.clamp(t + Math.sign(goal - t) * dt / 1.2, 0, 1); pose(t); } };
  root.userData.setFlat = (flat) => { t = goal = flat ? 1 : 0; pose(t); }; // for tests / critics
  return root;
}
