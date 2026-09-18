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

const D = FURNITURE.futon;
const RAD = Math.PI / 180;

/** Heathered linen weave; tile = D.linenTile inches (UVs below are in tiles). kind: 'color' | 'bump'. */
function linenTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'), r = rng(kind === 'color' ? 21 : 21), s = 512;
  ctx.fillStyle = kind === 'color' ? '#30353f' : '#808080'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 14000; i++) { // short warp/weft slubs, light and dark
    const light = r() < 0.5, a = 0.05 + r() * 0.13, len = 6 + r() * 34, x = r() * s, y = r() * s, horiz = r() < 0.5;
    ctx.fillStyle = kind === 'color' ? `rgba(${light ? '120,126,142' : '10,11,15'},${a})` : `rgba(${light ? '255,255,255' : '0,0,0'},${a * 1.6})`;
    for (const o of [0, -s]) horiz ? ctx.fillRect(x + o, y, len, 1.5) : ctx.fillRect(x, y + o, 1.5, len); // wrap
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let FABRIC, CUP;
function materials() {
  FABRIC ??= new THREE.MeshPhysicalMaterial({ map: linenTex('color'), bumpMap: linenTex('bump'), bumpScale: 0.6, roughness: 0.95,
    sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x565c6c), name: 'futon-charcoal-linen' });
  CUP ??= Object.assign(MAT.blackPlastic.clone(), { side: THREE.DoubleSide, name: 'futon-cupholder-black' });
}

const mesh = (geo, mat, name) => { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; o.name = name; return o; };

/** Vertex coordinates along one axis: 3 tight segments across each rounded edge, n even ones between. */
function axisCoords(n, len, r) {
  const a = [];
  for (let i = 0; i <= 3; i++) a.push(-len / 2 + (r * i) / 3);
  for (let i = 1; i < n; i++) a.push(-len / 2 + r + ((len - 2 * r) * i) / n);
  for (let i = 0; i <= 3; i++) a.push(len / 2 - r + (r * i) / 3);
  return a;
}

/**
 * Upholstered pad: rounded box w × t × d whose TOP is a tufted height-field (cols × rows pillowed panels,
 * stitched seams at height 0, deeper dimples at interior seam crossings). Pillow peaks are at y=0, bottom at y=-t.
 * res = top-surface vertex spacing in inches.
 */
function padGeo(w, t, d, { cols = 1, rows = 1, puff = D.puff, r = D.edgeR, res = 0.5, dimple = D.dimple } = {}) {
  const tb = t - puff; // body box under the pillows
  r = Math.min(r, tb / 2 - 0.01);
  const nx = Math.max(2, Math.round((w - 2 * r) / res)), nz = Math.max(2, Math.round((d - 2 * r) / res)), ny = 2;
  const ax = axisCoords(nx, w, r), ay = axisCoords(ny, tb, r), az = axisCoords(nz, d, r);
  const g = new THREE.BoxGeometry(w, tb, d, nx + 6, ny + 6, nz + 6);
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  const gw = w - 2 * r, gd = d - 2 * r, v = new THREE.Vector3(), q = new THREE.Vector3();
  const idx = (c, len, n) => Math.round(((c + len / 2) / len) * (n + 6));
  for (let i = 0; i < P.count; i++) {
    v.set(ax[idx(P.getX(i), w, nx)], ay[idx(P.getY(i), tb, ny)], az[idx(P.getZ(i), d, nz)]);
    // round edges/corners: clamp to the inner box, push back out by r
    q.set(THREE.MathUtils.clamp(v.x, -w / 2 + r, w / 2 - r), THREE.MathUtils.clamp(v.y, -tb / 2 + r, tb / 2 - r), THREE.MathUtils.clamp(v.z, -d / 2 + r, d / 2 - r));
    const off = v.clone().sub(q); if (off.lengthSq() > 0) v.copy(q).add(off.setLength(r));
    const top = N.getY(i) > 0.5;
    if (top && Math.abs(v.x) < gw / 2 && Math.abs(v.z) < gd / 2) {
      const fu = ((v.x + gw / 2) / gw) * cols, fv = ((v.z + gd / 2) / gd) * rows;
      const a = 1 - (2 * (fu % 1) - 1) ** 2, b = 1 - (2 * (fv % 1) - 1) ** 2;
      let h = puff * Math.max(a * b, 0) ** 0.42;
      const cu = Math.round(fu), cv = Math.round(fv); // nearest seam crossing; dimple only at interior ones
      if (cu > 0 && cu < cols && cv > 0 && cv < rows) {
        const dx = (fu - cu) * (gw / cols), dz = (fv - cv) * (gd / rows);
        h -= dimple * Math.exp(-(dx * dx + dz * dz) / 1.6);
      }
      v.y += h;
    }
    // UVs in linen tiles, projected along the face's original axis
    const nX = Math.abs(N.getX(i)) > 0.5, nY = Math.abs(N.getY(i)) > 0.5;
    UV.setXY(i, (nX ? v.z : v.x) / D.linenTile, (nY ? v.z : v.y) / D.linenTile);
    P.setXYZ(i, v.x, v.y - tb / 2 - puff, v.z);
  }
  return smoothNormals(g);
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

/** Piping cord: closed rounded-rectangle loop in the XZ plane at height y. */
function piping(w, d, rc, y, name) {
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
  return mesh(new THREE.TubeGeometry(curve, 160, D.pipeR, 6, true), FABRIC, name);
}

/** Pad + piping cord around its top rim (cord sits on the 45° point of the rounded edge). */
function pipedPad(name, w, t, d, opts = {}) {
  const r = Math.min(opts.r ?? D.edgeR, (t - (opts.puff ?? D.puff)) / 2 - 0.01), k = r * (1 - Math.SQRT1_2);
  const g = group(name, mesh(padGeo(w, t, d, opts), FABRIC, `${name}:pad`));
  const rims = [-(opts.puff ?? D.puff) - k, ...(opts.bottomPipe ? [-t + k] : [])];
  rims.forEach((y, i) => g.add(piping(w - 2 * k, d - 2 * k, r * Math.SQRT1_2 + 0.05, y, `${name}:piping${i}`)));
  return g;
}

/** Chrome conical leg, top at y=h. */
function leg(h, name) {
  const g = group(name, mesh(new THREE.CylinderGeometry(D.legTopR, D.legBotR, h - 0.6, 28), MAT.chrome, `${name}:cone`),
    mesh(new THREE.CylinderGeometry(D.legTopR + 0.25, D.legTopR + 0.25, 0.3, 28), MAT.chrome, `${name}:plate`),
    mesh(new THREE.CylinderGeometry(D.legBotR + 0.1, D.legBotR + 0.1, 0.3, 28), MAT.blackPlastic, `${name}:glide`));
  g.children[0].position.y = 0.3 + (h - 0.6) / 2; g.children[1].position.y = h - 0.15; g.children[2].position.y = 0.15;
  return g;
}

/** Fold-down console: tufted face (y=0, flush with the backrest when stowed) over a slab with two real cup-holder wells. */
function buildConsole(len) {
  const w = D.consoleW - 0.3, faceT = D.consoleT - D.cupDepth, bev = 0.3;
  const face = pipedPad('futon:console:face', w, faceT, len, { cols: 2, rows: 2, puff: 0.45, r: 0.5, dimple: 0.25 });
  face.position.z = -len / 2;

  const rr = 0.9, hw = w / 2 - bev, shape = new THREE.Shape(); // rounded rect in (x, z), z from -len..0
  const z0 = -len + bev, z1 = -bev;
  shape.moveTo(-hw + rr, z0); shape.lineTo(hw - rr, z0); shape.absarc(hw - rr, z0 + rr, rr, -Math.PI / 2, 0);
  shape.lineTo(hw, z1 - rr); shape.absarc(hw - rr, z1 - rr, rr, 0, Math.PI / 2);
  shape.lineTo(-hw + rr, z1); shape.absarc(-hw + rr, z1 - rr, rr, Math.PI / 2, Math.PI);
  shape.lineTo(-hw, z0 + rr); shape.absarc(-hw + rr, z0 + rr, rr, Math.PI, 1.5 * Math.PI);
  const cupX = D.cupR + 0.55, cupZ = -len + D.cupR + 1.7;
  for (const sx of [-1, 1]) { const h = new THREE.Path(); h.absarc(sx * cupX, cupZ, D.cupR + bev, 0, 2 * Math.PI, true); shape.holes.push(h); }
  const slabG = new THREE.ExtrudeGeometry(shape, { depth: D.cupDepth - 2 * bev + 0.2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 4, curveSegments: 32 });
  const uv = slabG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / D.linenTile, uv.getY(i) / D.linenTile);
  slabG.rotateX(Math.PI / 2); // shape y -> z, extrusion -> -y
  const slab = mesh(slabG, FABRIC, 'futon:console:slab'); slab.position.y = -faceT - bev + 0.2; // overlaps 0.2" into the face pad (no seam gap)

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

  // pull strap at the free end: droops over the seat front when folded down, pokes up behind the bed when stowed
  const strap = group('futon:console:strap', mesh(new THREE.BoxGeometry(1, 0.12, 2.6), FABRIC, 'futon:console:strap:web'),
    mesh(new THREE.TorusGeometry(0.55, 0.13, 8, 24), FABRIC, 'futon:console:strap:loop'));
  strap.children[0].position.z = -1.3; strap.children[1].position.z = -3; strap.children[1].rotation.x = Math.PI / 2;
  strap.position.set(0, -D.consoleT + 0.5, -len + 0.3); strap.rotation.x = 75 * RAD;

  return group('futon:console', face, slab, cups, strap);
}

export function build() {
  materials();
  const theta = (90 - D.reclineDeg) * RAD; // back rotation from flat
  const rearExt = (a) => D.backT * Math.sin(a) + D.backL * Math.cos(a); // how far the back reaches behind the hinge
  const seatD = D.d - rearExt(theta), zHinge = -D.d / 2 + rearExt(theta);

  // seat: one tufted body, legs up to seat height, piping at the top rim
  const seat = pipedPad('futon:seat', D.bodyW, D.seatH - D.legH, seatD, { cols: D.seatGrid[0], rows: D.seatGrid[1] });
  seat.position.set(0, D.seatH, zHinge + seatD / 2);
  // fabric gusset along the hinge line: fills the crevice between the rounded seat and back edges in both modes
  const gusset = mesh(padGeo(D.bodyW - 1, D.gusset, D.gusset, { puff: 0.02, r: 0.8, res: 2 }), FABRIC, 'futon:gusset');
  gusset.position.set(0, D.seatH - 0.45, zHinge - 0.3);
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
  const band = mesh(padGeo(D.consoleW + 1.2, D.backT - D.puff - 0.15, D.backBand, { puff: 0.02, r: 0.45, res: 0.7 }), FABRIC, 'futon:back:band'); // continuous top rail above the console
  band.position.set(0, -D.puff - 0.15, -D.backL + D.backBand / 2); back.add(band);
  const consoleG = buildConsole(D.backL - D.backBand + 0.3); back.add(consoleG);
  // rear stay: chrome U-leg that carries the back in bed mode, folds flat against the underside in sofa mode
  const stayLen = D.seatH - D.backT - 0.5, stayX = D.bodyW / 2 - 8;
  const stay = group('futon:back:stay');
  for (const sx of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(D.stayR, D.stayR, stayLen, 16), MAT.chrome, 'futon:back:stay:leg'); c.position.set(sx * stayX, -stayLen / 2, 0); stay.add(c); }
  const bar = mesh(new THREE.CylinderGeometry(D.stayR, D.stayR, 2 * stayX, 16), MAT.chrome, 'futon:back:stay:bar'); bar.rotation.z = Math.PI / 2; bar.position.y = -stayLen + D.stayR; stay.add(bar);
  stay.position.set(0, -D.backT - 0.5, -D.backL + 4);
  const hingeBlock = mesh(new THREE.BoxGeometry(2 * stayX + 2, 0.6, 1.4), MAT.blackMetal, 'futon:back:stay:bracket'); hingeBlock.position.set(0, -D.backT - 0.25, -D.backL + 4);
  back.add(stay, hingeBlock);
  back.position.set(0, D.seatH, zHinge);

  // loose arm bolsters: overhang the seat ends and tip slightly outward, as in the photos
  const tau = D.armTiltDeg * RAD, armL = seatD - 1, arms = [];
  for (const sx of [-1, 1]) {
    const a = pipedPad(`futon:bolster:${sx < 0 ? 'left' : 'right'}`, D.armW, D.armT, armL, { puff: 0.5, r: 1, res: 0.7, bottomPipe: true });
    a.children[0].position.y = D.armT / 2; a.children.slice(1).forEach((p) => (p.position.y = D.armT / 2)); // centre the pad on its group origin
    const cx = D.w / 2 - (D.armW / 2) * Math.cos(tau) - (D.armT / 2) * Math.sin(tau);
    const s = (D.bodyW / 2 - cx + (D.armT / 2) * Math.sin(tau)) / Math.cos(tau); // bottom face rests on the seat's side edge
    a.position.set(sx * cx, D.seatH + s * Math.sin(tau) + (D.armT / 2) * Math.cos(tau) - 0.3, D.d / 2 - 0.5 - armL / 2);
    a.rotation.z = -sx * tau; arms.push(a);
  }

  const inner = group('futon:body', seat, gusset, legs, back, ...arms);
  inner.scale.setScalar(m(1));
  const root = group('futon', inner);

  // ---- sofa <-> bed ----
  let t = 0, goal = 0; // 0 = sofa, 1 = bed
  const pose = (k) => {
    const e = k * k * (3 - 2 * k), a = theta * (1 - e);
    back.rotation.x = a;
    consoleG.rotation.x = (Math.PI - theta) * (1 - e); // total 180°: lies on the seat, cup holders up
    stay.rotation.x = -(Math.PI / 2) * (1 - e);
    inner.position.z = m(rearExt(a) - rearExt(theta)); // keep the rear plane fixed (wall behind)
  };
  pose(0);
  root.userData.onClick = () => { goal = goal ? 0 : 1; };
  root.userData.tick = (dt) => { if (t !== goal) { t = THREE.MathUtils.clamp(t + Math.sign(goal - t) * dt / 1.2, 0, 1); pose(t); } };
  root.userData.setFlat = (flat) => { t = goal = flat ? 1 : 0; pose(t); }; // for tests / critics
  return root;
}
