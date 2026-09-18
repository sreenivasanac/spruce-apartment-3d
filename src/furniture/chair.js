// Contract: build() returns a THREE.Group named 'chair', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it (FURNITURE.chair and FURNITURE.wifeChair share this model) and makes it draggable.
// Reference: spruce_apt_photos/office_chair1.jpg, office_chair2.jpg — white-frame mesh task chair w/ headrest.
// Everything below is modelled in INCHES inside 'chair:body', which is scaled by IN once.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { FURNITURE, IN } from '../dimensions.js';
import { MAT, TEX, rng } from '../materials.js';
import { group } from '../lib/build.js';

const rad = THREE.MathUtils.degToRad, lerp = THREE.MathUtils.lerp;
const merge = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
const mesh = (geom, mat, name) => { const o = new THREE.Mesh(geom, mat); o.castShadow = o.receiveShadow = true; o.name = name; return o; };
const cylG = (r, h, y0, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).translate(0, y0 + h / 2, 0);

/** Horizontal-rib mesh fabric: opaque ribs over a see-through weave. 4 ribs per tile. */
function ribTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(48,48,47,0.6)'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgb(124,124,122)';
  for (let i = 0; i < 4; i++) ctx.fillRect(0, i * 16 + 3, 64, 9);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Half-width of a W x H rounded rectangle (corner r) at height y. */
const halfW = (y, W, H, r) => { const dy = Math.min(y, H - y); return dy >= r ? W / 2 : W / 2 - r + Math.sqrt(Math.max(0, r * r - (r - dy) * (r - dy))); };

/**
 * Curved mesh panel (back / headrest): a rounded rectangle, tapered toward the bottom and bent by bend(x,y)->z.
 * Returns { frame: tube geometry around the rim, skin(v0,v1,zOff): surface geometry between two heights }.
 */
function panel(W, H, r, taper, bend, tubeR) {
  const tap = (y) => lerp(taper, 1, y / H);
  const P = (x, y, zOff = 0) => new THREE.Vector3(x * tap(y), y, bend(x * tap(y), y) + zOff);
  const rim = [], N = 28;
  for (let i = 0; i <= N; i++) { const y = H * (0.5 - 0.5 * Math.cos((Math.PI * i) / N)); rim.push(P(halfW(y, W, H, r), y)); } // right side, bottom -> top
  for (let i = 1; i < 4; i++) rim.push(P(lerp(W / 2 - r, -(W / 2 - r), i / 4), H)); // top edge
  for (let i = N; i >= 0; i--) { const y = H * (0.5 - 0.5 * Math.cos((Math.PI * i) / N)); rim.push(P(-halfW(y, W, H, r), y)); }
  for (let i = 1; i < 4; i++) rim.push(P(lerp(-(W / 2 - r), W / 2 - r, i / 4), 0)); // bottom edge
  const frame = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true, 'centripetal'), 240, tubeR, 10, true);
  const skin = (v0 = 0, v1 = 1, zOff = 0, ribPitch = 1) => {
    const g = new THREE.PlaneGeometry(1, 1, 20, 28), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const y = H * lerp(v0, v1, p.getY(i) + 0.5), q = P(p.getX(i) * 2 * halfW(y, W, H, r), y, zOff);
      p.setXYZ(i, q.x, q.y, q.z); uv.setXY(i, q.x / (4 * ribPitch), q.y / (4 * ribPitch));
    }
    g.computeVertexNormals();
    return g;
  };
  return { frame, skin, P };
}

/** Rounded-rectangle slab lying flat (cushion / seat pan): w along X, d along Z, top at y=0, puffy bevel. */
function cushion(w, d, r, t, bevel) {
  const s = new THREE.Shape(), x = w / 2 - bevel, z = d / 2 - bevel, k = r - bevel;
  s.moveTo(-x + k, -z); s.lineTo(x - k, -z); s.quadraticCurveTo(x, -z, x, -z + k); s.lineTo(x, z - k); s.quadraticCurveTo(x, z, x - k, z);
  s.lineTo(-x + k, z); s.quadraticCurveTo(-x, z, -x, z - k); s.lineTo(-x, -z + k); s.quadraticCurveTo(-x, -z, -x + k, -z);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments: 10 });
  return toCreasedNormals(g, rad(50)).rotateX(Math.PI / 2).translate(0, -bevel, 0); // extrusion now runs downward from y=0
}

/** Tube through points, widened along X into a flat band (the chair's moulded plastic straps). */
function band(points, tubeR, bandW, closed) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), 120, tubeR, 10, closed);
  const parts = [g];
  if (!closed) for (const p of [points[0], points[points.length - 1]]) parts.push(new THREE.SphereGeometry(tubeR, 10, 8).translate(p.x, p.y, p.z)); // rounded ends
  return merge(parts).scale(bandW / (2 * tubeR), 1, 1);
}

export function build() {
  const C = FURNITURE.chair, { seat: S, back: B, head: Hd, arm: A, base: Bs, caster: K, lift: L, mech: M } = C;
  const seatUnder = C.seatH - S.t - S.panT, mechBottom = seatUnder - M.h;

  // ---- materials (clones so the shared MAT entries stay untouched)
  const white = MAT.whitePlastic.clone(); white.roughness = 0.42; white.side = THREE.DoubleSide; white.name = 'chair-white-frame';
  const ribs = MAT.meshGray.clone(); ribs.color.set(0xffffff); ribs.map = ribTexture(); ribs.opacity = 1; ribs.name = 'chair-mesh-ribbed';
  const fabric = MAT.fabricGray.clone(); fabric.bumpMap = TEX.carpetBump.clone(); fabric.bumpMap.repeat.setScalar(0.35); fabric.bumpMap.needsUpdate = true; fabric.bumpScale = 0.5; fabric.name = 'chair-seat-fabric';

  // ---- 5-star base (one arm points to +Z) + hub
  const arm2d = new THREE.Shape();
  const tipR = Bs.r + 0.9, tipT = 1.1, rootT = 2.3;
  arm2d.moveTo(0.6, Bs.hubTop - rootT); arm2d.lineTo(0.6, Bs.hubTop - 0.15);
  arm2d.quadraticCurveTo(Bs.r * 0.55, Bs.hubTop - 0.1, tipR, Bs.tipTop - 0.25);
  arm2d.quadraticCurveTo(tipR + 0.3, Bs.tipTop - tipT / 2, tipR, Bs.tipTop - tipT);
  arm2d.quadraticCurveTo(Bs.r * 0.5, Bs.hubTop - rootT + 0.2, 0.6, Bs.hubTop - rootT);
  const bev = 0.35, armG = toCreasedNormals(new THREE.ExtrudeGeometry(arm2d, { depth: Bs.armW - 2 * bev, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 4, curveSegments: 16 }), rad(50)).translate(0, 0, -(Bs.armW - 2 * bev) / 2);
  const baseGs = [cylG(Bs.hubR, rootT + 0.5, Bs.hubTop - rootT - 0.2, 32)], casterGs = [], r = rng(25);
  // twin-wheel caster, axle along X, swivel stem at origin, wheels trail by `trail`
  const wheelR = K.dia / 2, trail = 0.55, off = (K.gap + K.w) / 2;
  const wheel = (sx) => new THREE.CylinderGeometry(wheelR, wheelR, K.w, 24).rotateZ(Math.PI / 2).translate(sx * off, wheelR, -trail);
  const hood = new THREE.CylinderGeometry(wheelR + 0.12, wheelR + 0.12, K.gap + 0.5, 20, 1, false, -Math.PI * 0.15, Math.PI * 0.8).rotateZ(Math.PI / 2).translate(0, wheelR, -trail);
  const casterG = merge([wheel(-1), wheel(1), hood, cylG(0.3, Bs.tipTop - tipT - wheelR + 0.3, wheelR, 12), cylG(0.22, K.gap + 2 * K.w - 0.2, 0, 8).rotateZ(Math.PI / 2).translate(0, wheelR, -trail)]);
  for (let k = 0; k < 5; k++) {
    const a = rad(90 + 72 * k);
    baseGs.push(armG.clone().rotateY(-a));
    casterGs.push(casterG.clone().rotateY(r() * Math.PI * 2).translate(Bs.r * Math.cos(a), 0, Bs.r * Math.sin(a)));
  }

  // ---- gas lift, tilt mechanism + lever
  const liftOuter = mesh(cylG(L.r, L.top - Bs.hubTop + 0.2, Bs.hubTop - 0.2), MAT.blackPlastic, 'chair:gaslift');
  const piston = mesh(cylG(L.pistonR, mechBottom - L.top, L.top), MAT.chrome, 'chair:gaslift-piston');
  const mechG = merge([
    new THREE.BoxGeometry(M.w, M.h, M.d).translate(0, mechBottom + M.h / 2, -0.5),
    new THREE.CylinderGeometry(0.22, 0.22, 6.5, 10).rotateZ(Math.PI / 2).translate(M.w / 2 + 3, mechBottom + 0.7, 1), // height lever
    new THREE.BoxGeometry(2.2, 0.35, 1.1).translate(M.w / 2 + 6.4, mechBottom + 0.7, 1),
  ]);

  // ---- seat: fabric cushion over a plastic pan
  const seatZ = 0.5;
  const seat = mesh(cushion(S.w, S.d, S.r, S.t, 1.1).translate(0, C.seatH, seatZ), fabric, 'chair:seat');
  const pan = mesh(cushion(S.w - 0.8, S.d - 0.8, S.r, S.panT + 0.3, 0.3).translate(0, C.seatH - S.t + 0.3, seatZ), MAT.blackPlastic, 'chair:seat-pan');

  // ---- back: reclined, lumbar-curved mesh panel in a white rim, solid white lumbar shell behind the lower third
  const backBend = (x, y) => B.wrap * (x / (B.w / 2)) ** 2 + B.lumbar * Math.exp(-(((y - B.h * 0.3) / (B.h * 0.28)) ** 2));
  const bp = panel(B.w, B.h, B.r, B.taper, backBend, B.tube);
  const back = group('chair:back', mesh(bp.frame, white, 'chair:back-frame'), mesh(bp.skin(0, 1, 0, 0.27), ribs, 'chair:back-mesh'), mesh(bp.skin(0, 0.36, -0.4), white, 'chair:lumbar-shell'));
  back.position.set(0, B.bottom, B.z); back.rotation.x = -rad(B.reclineDeg);
  back.updateMatrix();
  const backPt = (x, y, zOff) => bp.P(x, y, zOff).applyMatrix4(back.matrix); // back-local -> chair coords

  // ---- headrest: smaller panel, tilted forward, top exactly at C.h
  const hp = panel(Hd.w, Hd.h, Hd.r, 0.92, (x) => Hd.wrap * (x / (Hd.w / 2)) ** 2, B.tube * 0.85);
  const head = group('chair:headrest', mesh(hp.frame, white, 'chair:headrest-frame'), mesh(hp.skin(0, 1, 0, 0.27), ribs, 'chair:headrest-mesh'));
  const backTop = backPt(0, B.h, 0);
  head.rotation.x = rad(Hd.tiltDeg); head.position.set(0, 0, backTop.z + Hd.dz);
  head.position.y = C.h - new THREE.Box3().setFromObject(head).max.y; // drop the rim's top onto the overall height
  head.updateMatrix();
  const headPt = (x, y, zOff) => hp.P(x, y, zOff).applyMatrix4(head.matrix);

  // ---- white structure: spine (mechanism -> back -> headrest bracket), loop arms, arm bridge under the seat
  const spine = band([new THREE.Vector3(0, seatUnder - 0.6, -3), new THREE.Vector3(0, seatUnder - 0.5, -8), new THREE.Vector3(0, seatUnder + 1.2, S.d / -2 + seatZ - 1.5), backPt(0, 1.5, -1.5), backPt(0, B.h * 0.18, -1.15), backPt(0, B.h * 0.3, -1.05)], 0.6, 3.2, false);
  const bracket = band([backPt(0, B.h * 0.84, -0.8), backPt(0, B.h * 0.96, -1.2), backPt(0, B.h + 1.2, -1.6), headPt(0, Hd.h * 0.12, -1.4), headPt(0, Hd.h * 0.45, -0.75)], 0.45, 2, false);
  const armGs = [];
  const loop = [[-0.5, 0.93, 0], [-0.1, 1, 0], [0.3, 0.985, 0], [0.47, 0.87, 0], [0.42, 0.7, 0], [0.2, 0.38, 0], [-0.03, 0.1, 0], [-0.25, -0.05, 2], [-0.45, -0.05, 1.2], [-0.58, 0.22, 0], [-0.61, 0.6, 0]]; // [z / A.len, (y - seatUnder) / (top - seatUnder), inches tucked in under the seat]
  for (const sx of [-1, 1]) {
    const pts = loop.map(([zf, yf, tuck]) => new THREE.Vector3((-sx * tuck * 2 * A.tube) / A.bandW, yf * (A.topElev - A.tube - seatUnder), zf * A.len));
    armGs.push(band(pts, A.tube, A.bandW, true).rotateZ(-sx * rad(A.flareDeg)).translate(sx * A.x, seatUnder, seatZ));
  }
  armGs.push(new THREE.BoxGeometry(2 * (A.x - 2), 0.7, 2.6).translate(0, seatUnder - 0.45, seatZ - 0.35 * A.len)); // cross-bridge the loops bolt to, hidden under the seat

  const body = group('chair:body',
    mesh(merge(baseGs), white, 'chair:base'), mesh(merge(casterGs), MAT.blackPlastic, 'chair:casters'),
    liftOuter, piston, mesh(mechG, MAT.blackPlastic, 'chair:mechanism'),
    seat, pan, back, head,
    mesh(merge([spine, bracket]), white, 'chair:spine'), mesh(merge(armGs), white, 'chair:arms'),
  );
  body.scale.setScalar(IN);
  return group('chair', body);
}
