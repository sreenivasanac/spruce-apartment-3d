// Contract: build() returns a THREE.Group named 'chair', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it (FURNITURE.chair and FURNITURE.wifeChair share this model) and makes it draggable.
// Reference: spruce_apt_photos/office_chair1.jpg, office_chair2.jpg — white-frame mesh task chair w/ headrest.
// Everything below is modelled in INCHES inside 'chair:body', which is scaled by IN once.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { FURNITURE, IN } from '../dimensions.js';
import { MAT, TEX, rng } from '../materials.js';
import { group } from '../lib/build.js';

const rad = THREE.MathUtils.degToRad, { lerp, smoothstep } = THREE.MathUtils, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const merge = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
const mesh = (geom, mat, name) => { const o = new THREE.Mesh(geom, mat); o.castShadow = o.receiveShadow = true; o.name = name; return o; };
const cylG = (r, h, y0, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).translate(0, y0 + h / 2, 0);

/** Horizontal-rib mesh fabric: light warm-gray ribs over a nearly opaque weave. 4 ribs per tile. */
function ribTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = 'rgba(120,120,116,0.94)'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgb(176,175,170)';
  for (let i = 0; i < 4; i++) ctx.fillRect(0, i * 16 + 3, 64, 9);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Lumbar-shell perforations: 3 staggered rows of dark vertical slots on white. One tile = slot.pitch x 3 rows. */
function slotTexture(slot) {
  const c = document.createElement('canvas'), W = 64, H = 256, rowH = H / 3;
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6a6a6c';
  const sw = (slot.w / slot.pitch) * W, sh = (slot.h / slot.rowH) * rowH;
  for (let row = 0; row < 3; row++) for (const ox of [-W, 0, W]) { ctx.beginPath(); ctx.roundRect(ox + (row % 2 ? W / 2 : 0) + (W - sw) / 2, row * rowH + (rowH - sh) / 2, sw, sh, sw / 2); ctx.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.anisotropy = 16; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Half-width of a W x H rounded rectangle (corner r) at height y. */
const halfW = (y, W, H, r) => { const dy = Math.min(y, H - y); return dy >= r ? W / 2 : W / 2 - r + Math.sqrt(Math.max(0, r * r - (r - dy) * (r - dy))); };

/** Closed loop swept with an elliptical section: half-width a in the panel plane, half-depth b across it (a thin moulded bezel, not a pipe). */
function bezel(rim, a, b) {
  const n = 200, seg = 12, pts = new THREE.CatmullRomCurve3(rim, true, 'centripetal').getSpacedPoints(n), Z = V3(0, 0, 1), pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const T = pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize(), R = V3().crossVectors(T, Z).normalize(), N = V3().crossVectors(R, T);
    for (let j = 0; j < seg; j++) { const th = (j / seg) * 2 * Math.PI, v = pts[i].clone().addScaledVector(R, a * Math.cos(th)).addScaledVector(N, b * Math.sin(th)); pos.push(v.x, v.y, v.z); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < seg; j++) {
    const i1 = (i + 1) % n, j1 = (j + 1) % seg, A = i * seg + j, B = i1 * seg + j, C = i1 * seg + j1, D = i * seg + j1;
    idx.push(A, B, D, B, C, D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/**
 * Curved mesh panel (back / headrest): a rounded rectangle, tapered toward the bottom and bent by bend(x,y)->z.
 * Returns { frame: bezel geometry around the rim, skin(v0, v1, zOff, tile, faceRear): surface between two heights, P }.
 * v1 may be a function of s in [-1,1] (across the width) for a shaped top edge; UVs = inches / tile.
 */
function panel(W, H, r, taper, bend, rimW, rimD) {
  const tap = (y) => lerp(taper, 1, y / H);
  const P = (x, y, zOff = 0) => V3(x * tap(y), y, bend(x * tap(y), y) + zOff);
  const rim = [], N = 28;
  for (let i = 0; i <= N; i++) { const y = H * (0.5 - 0.5 * Math.cos((Math.PI * i) / N)); rim.push(P(halfW(y, W, H, r), y)); } // right side, bottom -> top
  for (let i = 1; i < 4; i++) rim.push(P(lerp(W / 2 - r, -(W / 2 - r), i / 4), H)); // top edge
  for (let i = N; i >= 0; i--) { const y = H * (0.5 - 0.5 * Math.cos((Math.PI * i) / N)); rim.push(P(-halfW(y, W, H, r), y)); }
  for (let i = 1; i < 4; i++) rim.push(P(lerp(-(W / 2 - r), W / 2 - r, i / 4), 0)); // bottom edge
  const skin = (v0 = 0, v1 = 1, zOff = 0, tile = [1, 1], faceRear = false) => {
    const g = new THREE.PlaneGeometry(1, 1, 24, 32), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) * 2, top = typeof v1 === 'function' ? v1(s) : v1, y = H * lerp(v0, top, p.getY(i) + 0.5), q = P((s / 2) * 2 * halfW(y, W, H, r), y, zOff);
      p.setXYZ(i, q.x, q.y, q.z); uv.setXY(i, q.x / tile[0], (q.y - H * v0) / tile[1]);
    }
    if (faceRear) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; } // single-sided on purpose: the AO pass culls back faces, so every sheet gets a front AND a rear wall
    g.computeVertexNormals();
    return g;
  };
  return { frame: bezel(rim, rimW / 2, rimD / 2), skin, P };
}

/** Rounded-rectangle slab lying flat (seat pan): w along X, d along Z, top at y=0. */
function slabG(w, d, r, t, bevel) {
  const s = new THREE.Shape(), x = w / 2 - bevel, z = d / 2 - bevel, k = r - bevel;
  s.moveTo(-x + k, -z); s.lineTo(x - k, -z); s.quadraticCurveTo(x, -z, x, -z + k); s.lineTo(x, z - k); s.quadraticCurveTo(x, z, x - k, z);
  s.lineTo(-x + k, z); s.quadraticCurveTo(-x, z, -x, z - k); s.lineTo(-x, -z + k); s.quadraticCurveTo(-x, -z, -x + k, -z);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments: 10 });
  return toCreasedNormals(g, rad(50)).rotateX(Math.PI / 2).translate(0, -bevel, 0); // extrusion now runs downward from y=0
}

/**
 * Upholstered seat cushion, top crown at y=0: rounded-rect footprint, domed top (S.crown), soft rolled edge that grows into a
 * waterfall at the front (+Z), thinner toward the rear.
 */
function cushion(S) {
  const g = new THREE.BoxGeometry(S.w, S.t, S.d, 28, 4, 28).translate(0, -S.t / 2, 0), p = g.attributes.position, hx = S.w / 2 - S.r, hz = S.d / 2 - S.r;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const qx = Math.max(Math.abs(x) - hx, 0), qz = Math.max(Math.abs(z) - hz, 0), ql = Math.hypot(qx, qz);
    if (ql > S.r) { x = Math.sign(x) * (hx + (qx / ql) * S.r); z = Math.sign(z) * (hz + (qz / ql) * S.r); } // round the plan corners
    // top surface height at (x,z): crown, rolled edge (waterfall at the front), rear thinning; side rows are re-spaced under it
    const edge = ql > 0 ? S.r - Math.min(ql, S.r) : Math.min(S.w / 2 - Math.abs(x), S.d / 2 - Math.abs(z));
    const roll = lerp(S.roll, S.waterfall, smoothstep(z, 0, S.d / 2)), k = 1 - Math.min(edge, roll) / roll;
    const top = -S.crown * (1 - (1 - (x / (S.w / 2)) ** 2) * (1 - (z / (S.d / 2)) ** 2)) - roll * (1 - Math.sqrt(1 - k * k)) - S.rearDrop * smoothstep(-z, 0, S.d / 2);
    y = -S.t + ((y + S.t) / S.t) * (top + S.t);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Open tube through points, widened along X into a flat moulded ribbon; ends are meant to be buried in other parts. */
function band(points, tubeR, bandW) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 120, tubeR, 10, false).scale(bandW / (2 * tubeR), 1, 1);
}

export function build() {
  const C = FURNITURE.chair, { seat: S, back: B, head: Hd, arm: A, base: Bs, caster: K, lift: L, mech: M } = C;
  const seatUnder = C.seatH - S.t - S.panT, mechBottom = seatUnder - M.h;

  // ---- materials (clones so the shared MAT entries stay untouched)
  const white = MAT.whitePlastic.clone(); white.roughness = 0.42; white.side = THREE.DoubleSide; white.name = 'chair-white-frame';
  const shellMat = MAT.whitePlastic.clone(); Object.assign(shellMat, { roughness: 0.42, side: THREE.FrontSide, transparent: false, depthWrite: true, map: slotTexture(B.slot), name: 'chair-lumbar-shell' });
  const ribs = MAT.meshGray.clone(); ribs.color.set(0xffffff); ribs.map = ribTexture(); ribs.opacity = 1; ribs.side = THREE.FrontSide; ribs.name = 'chair-mesh-ribbed';
  const ribs2 = ribs.clone(); ribs2.map = ribs.map.clone(); ribs2.map.offset.y = 0.125; ribs2.name = 'chair-mesh-ribbed-inner'; // second woven layer, shifted half a rib
  const fabric = MAT.fabricGray.clone(); fabric.color.set(0x8e8e8b); fabric.bumpMap = TEX.carpetBump.clone(); fabric.bumpMap.repeat.setScalar(0.35); fabric.bumpMap.needsUpdate = true; fabric.bumpScale = 0.5; fabric.name = 'chair-seat-fabric';
  const underside = MAT.fabricGray.clone(); underside.color.set(0x77777a); underside.name = 'chair-seat-underside';

  // ---- 5-star base (one arm points to +Z) + hub: slim arched oval-section spokes with caster sockets
  const arm2d = new THREE.Shape(), tipR = Bs.r + 0.7, { tipT, rootT } = Bs;
  arm2d.moveTo(0.6, Bs.hubTop - rootT); arm2d.lineTo(0.6, Bs.hubTop - 0.15);
  arm2d.quadraticCurveTo(Bs.r * 0.55, Bs.hubTop + 0.2, tipR, Bs.tipTop - 0.25);
  arm2d.quadraticCurveTo(tipR + 0.3, Bs.tipTop - tipT / 2, tipR, Bs.tipTop - tipT);
  arm2d.quadraticCurveTo(Bs.r * 0.5, Bs.hubTop - rootT + 0.5, 0.6, Bs.hubTop - rootT);
  const bev = Bs.bevel, armD = Bs.armW - 2 * bev;
  const armG = toCreasedNormals(new THREE.ExtrudeGeometry(arm2d, { depth: armD, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 6, curveSegments: 16 }), rad(50)).translate(0, 0, -armD / 2);
  const baseGs = [cylG(Bs.hubR, rootT + 0.5, Bs.hubTop - rootT - 0.2, 32)], casterGs = [], r = rng(25);
  // twin-wheel caster, axle along X, swivel stem at origin, wheels trail by `trail`
  const wheelR = K.dia / 2, trail = 0.55, off = (K.gap + K.w) / 2;
  const wheel = (sx) => new THREE.CylinderGeometry(wheelR, wheelR, K.w, 24).rotateZ(Math.PI / 2).translate(sx * off, wheelR, -trail);
  const hood = new THREE.CylinderGeometry(wheelR + 0.12, wheelR + 0.12, K.gap + 0.5, 20, 1, false, -Math.PI * 0.15, Math.PI * 0.8).rotateZ(Math.PI / 2).translate(0, wheelR, -trail);
  const casterG = merge([wheel(-1), wheel(1), hood, cylG(0.3, Bs.tipTop - tipT - wheelR + 0.3, wheelR, 12), cylG(0.22, K.gap + 2 * K.w - 0.2, 0, 8).rotateZ(Math.PI / 2).translate(0, wheelR, -trail)]);
  for (let k = 0; k < 5; k++) {
    const a = rad(90 + 72 * k), cx = Bs.r * Math.cos(a), cz = Bs.r * Math.sin(a);
    baseGs.push(armG.clone().rotateY(-a), cylG(Bs.socketR, tipT + 0.35, Bs.tipTop - tipT - 0.3, 16).translate(cx, 0, cz));
    casterGs.push(casterG.clone().rotateY(r() * Math.PI * 2).translate(cx, 0, cz));
  }

  // ---- gas lift (white telescoping shroud over the black sleeve, short chrome piston), tilt mechanism, lever + tension knob
  baseGs.push(cylG(L.shroudR, L.shroudTop - Bs.hubTop, Bs.hubTop, 32), cylG(L.shroudR - 0.15, 0.5, L.shroudTop, 32));
  const liftOuter = mesh(cylG(L.r, L.top - L.shroudTop, L.shroudTop), MAT.blackPlastic, 'chair:gaslift');
  const piston = mesh(cylG(L.pistonR, mechBottom - L.top, L.top), MAT.chrome, 'chair:gaslift-piston');
  const mechG = merge([
    new RoundedBoxGeometry(M.w, M.h, M.d, 3, 0.5).translate(0, mechBottom + M.h / 2, -0.5),
    new THREE.CylinderGeometry(0.22, 0.22, 6.5, 10).rotateZ(Math.PI / 2).translate(M.w / 2 + 3, mechBottom + 0.7, 1), // height lever
    new RoundedBoxGeometry(2.2, 0.35, 1.1, 2, 0.15).translate(M.w / 2 + 6.4, mechBottom + 0.7, 1),
    cylG(M.knobR, M.knobH, mechBottom - M.knobH, 20).translate(0, 0, M.d / 2 - 0.5 - M.knobR - 0.4), // tilt-tension knob under the front
  ]);

  // ---- seat: domed fabric cushion over a gray fabric-wrapped pan
  const seatZ = 0.5;
  const seat = mesh(cushion(S).translate(0, C.seatH, seatZ), fabric, 'chair:seat');
  const pan = mesh(slabG(S.w - 0.8, S.d - 0.8, S.r, S.panT + 0.3, 0.3).translate(0, C.seatH - S.t + 0.3, seatZ), underside, 'chair:seat-pan');

  // ---- back: reclined, lumbar-curved double-layer mesh in a thin white bezel; opaque perforated lumbar shell behind the lower third
  const backBend = (x, y) => B.wrap * (x / (B.w / 2)) ** 2 + B.lumbar * Math.exp(-(((y - B.h * 0.3) / (B.h * 0.28)) ** 2));
  const bp = panel(B.w, B.h, B.r, B.taper, backBend, B.rimW, B.rimD), ribTile = [4 * B.ribPitch, 4 * B.ribPitch];
  const shellTop = (s) => lerp(B.shellTop[0], B.shellTop[1], s * s); // scooped: highest at the centre, falling toward the sides
  const slotRows = 3 * B.slot.rowH, shellTile = [B.slot.pitch, slotRows];
  const shell = mesh(merge([bp.skin(0.02, shellTop, -B.shellOff, shellTile), bp.skin(0.02, shellTop, -B.shellOff - 0.06, shellTile, true)]), shellMat, 'chair:lumbar-shell');
  shellMat.map.offset.y = -(B.h * B.shellTop[1] * 0.35) / slotRows; // ClampToEdge in V: the 3 slot rows sit mid-shell, plain white above/below
  const backMesh = mesh(bp.skin(0, 1, 0, ribTile), ribs, 'chair:back-mesh'), backMesh2 = mesh(bp.skin(0, 1, -B.meshGap, ribTile, true), ribs2, 'chair:back-mesh-inner');
  backMesh.renderOrder = backMesh2.renderOrder = 2; // transparent weave draws after the opaque shell
  const back = group('chair:back', mesh(bp.frame, white, 'chair:back-frame'), shell, backMesh2, backMesh);
  back.position.set(0, B.bottom, B.z); back.rotation.x = -rad(B.reclineDeg);
  back.updateMatrix();
  const backPt = (x, y, zOff) => bp.P(x, y, zOff).applyMatrix4(back.matrix); // back-local -> chair coords

  // ---- headrest: smaller panel, tilted forward, floating Hd.gap above the back's top rim
  const hp = panel(Hd.w, Hd.h, Hd.r, 0.92, (x) => Hd.wrap * (x / (Hd.w / 2)) ** 2, Hd.rimW, Hd.rimD);
  const headMesh = mesh(hp.skin(0, 1, 0, ribTile), ribs, 'chair:headrest-mesh'), headMesh2 = mesh(hp.skin(0, 1, -B.meshGap, ribTile, true), ribs2, 'chair:headrest-mesh-inner');
  headMesh.renderOrder = headMesh2.renderOrder = 2;
  const head = group('chair:headrest', mesh(hp.frame, white, 'chair:headrest-frame'), headMesh2, headMesh);
  const backTop = backPt(0, B.h, 0);
  head.rotation.x = rad(Hd.tiltDeg); head.position.set(0, 0, backTop.z + Hd.dz);
  head.position.y = new THREE.Box3().setFromObject(back).max.y + Hd.gap - new THREE.Box3().setFromObject(head).min.y;
  head.updateMatrix();
  const headPt = (x, y, zOff) => hp.P(x, y, zOff).applyMatrix4(head.matrix);

  // ---- white structure
  // spine: broad moulded shell flowing from the mechanism under the seat up INTO the lumbar shell (widens toward the top)
  const spine = band([V3(0, seatUnder - 0.6, -3), V3(0, seatUnder - 0.5, -8), V3(0, seatUnder + 1.2, S.d / -2 + seatZ - 1.5), backPt(0, 1.5, -1.5), backPt(0, B.h * 0.12, -B.shellOff - 0.1)], B.spineT / 2, B.spineW[0]);
  const sp = spine.attributes.position, spineTopY = backPt(0, B.h * 0.12, 0).y;
  for (let i = 0; i < sp.count; i++) sp.setX(i, sp.getX(i) * lerp(1, B.spineW[1] / B.spineW[0], smoothstep(sp.getY(i), seatUnder, spineTopY)));
  // headrest gooseneck: slider clamp on the back's top rim -> slim curved strap -> round pivot knob on the headrest's lower rim
  const pivot = headPt(0, 0.3, -(Hd.rimD / 2 + Hd.pivotDia / 2 - 0.1)), clampAt = backPt(0, B.h, -0.5);
  const neck = band([backPt(0, B.h - 0.6, -0.55), backPt(0, B.h + 0.6, -0.9), clampAt.clone().lerp(pivot, 0.5).add(V3(0, 0, -0.7)), pivot.clone().add(V3(0, -0.5, -0.25)), pivot], Hd.neckT / 2, Hd.neckW);
  const [cw, ch, cd] = Hd.clamp;
  const neckGs = [neck, new RoundedBoxGeometry(cw, ch, cd, 2, 0.2).rotateX(-rad(B.reclineDeg)).translate(clampAt.x, clampAt.y, clampAt.z),
    new THREE.CylinderGeometry(Hd.pivotDia / 2, Hd.pivotDia / 2, Hd.pivotLen, 20).rotateZ(Math.PI / 2).translate(pivot.x, pivot.y, pivot.z)];
  // arms: flat ribbon anchored on the back frame at arm height -> forward as the armrest -> tight rounded tip -> diagonal return down/back under the seat
  const armGs = [], topY = A.topElev - A.padT - A.tube, tipZ = seatZ + A.tipZ * A.len, endZ = seatZ - A.rootZ * A.len, kx = A.bandW / (2 * A.tube);
  for (const sx of [-1, 1]) {
    const start = backPt(sx * B.w / 2, B.h * 0.2, 0), end = V3(sx * (A.x - 2.5), seatUnder - 0.2, endZ), p7 = V3(sx * A.x, topY - 1.75 * A.tipR, tipZ - 0.45 * A.tipR);
    const pts = [start, V3(sx * (A.x - 0.8), topY, start.z + 2), V3(sx * A.x, topY, start.z + 4), V3(sx * A.x, topY, tipZ - 2 * A.tipR), V3(sx * A.x, topY, tipZ - A.tipR),
      V3(sx * A.x, topY - 0.3 * A.tipR, tipZ - 0.3 * A.tipR), V3(sx * A.x, topY - A.tipR, tipZ), p7, p7.clone().lerp(end, 0.45), p7.clone().lerp(end, 0.85).setX(sx * (A.x - 0.6)), end];
    pts.forEach((q) => { q.x = (q.x - sx * A.x) / kx; }); // band() stretches X about 0: pre-shrink, then move out to A.x
    armGs.push(band(pts, A.tube, A.bandW).translate(sx * A.x, 0, 0));
    const padLen = tipZ - A.tipR * 0.6 - (start.z + 3); // flat, slightly wider arm pad on the top run
    armGs.push(slabG(A.padW, padLen, A.padW / 2, A.padT + A.tube, 0.2).translate(sx * A.x, A.topElev, start.z + 3 + padLen / 2));
  }
  armGs.push(new THREE.BoxGeometry(2 * (A.x - 2), 0.7, 2.6).translate(0, seatUnder - 0.45, endZ)); // cross-bridge the arm roots bolt to, hidden under the seat

  const body = group('chair:body',
    mesh(merge(baseGs), white, 'chair:base'), mesh(merge(casterGs), MAT.blackPlastic, 'chair:casters'),
    liftOuter, piston, mesh(mechG, MAT.blackPlastic, 'chair:mechanism'),
    seat, pan, back, head,
    mesh(merge([spine, ...neckGs]), white, 'chair:spine'), mesh(merge(armGs), white, 'chair:arms'),
  );
  body.scale.setScalar(IN);
  return group('chair', body);
}
