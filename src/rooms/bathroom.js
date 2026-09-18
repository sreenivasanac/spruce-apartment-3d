// tub/shower, toilet, vanity, mirror, bath accessories
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Layout (IMG_3942/3943/3950): tub across the E end of the bath (y 6..36), valve/shower head on the N wall (x = 6),
// toilet tank on the N wall, towel bar above it, paper holder on the bath S wall, vanity alcove faces +x off the hall.
// Soft shapes (fiberglass, porcelain) are lofts of plan-space rings with area-weighted smooth normals, so small
// bevel rings read as radiused edges. No lights here — the lighting item owns every fixture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BATH, DOORS, KITCHEN, X, Y, m } from '../dimensions.js';
import { MAT } from '../materials.js';
import { boxAt, group } from '../lib/build.js';

const UP = new THREE.Vector3(0, 1, 0);
const P = (x, y, elev) => new THREE.Vector3(m(x), m(elev), m(y)); // plan inches -> world
const lit = (mesh, name) => { mesh.castShadow = mesh.receiveShadow = true; if (name) mesh.name = name; return mesh; };

// ---------------------------------------------------------------- geometry helpers
/** Rounded-rectangle ring of 4k plan points [x, y, elev]; hw along x, hd along y. hw = hd = 0 gives a cap point. */
function ring(cx, cy, hw, hd, r, elev, k = 16) {
  r = Math.min(r, hw, hd);
  const pts = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], q) => {
    for (let i = 0; i < k; i++) {
      const a = (q + i / (k - 1)) * Math.PI / 2;
      pts.push([cx + sx * (hw - r) + r * Math.cos(a), cy + sy * (hd - r) + r * Math.sin(a), elev]);
    }
  });
  return pts;
}

/** Superellipse ring (same point count/order as ring()) — the elongated-bowl outline. */
function oval(cx, cy, hw, hd, elev, n = 2.35, k = 16) {
  return Array.from({ length: 4 * k }, (_, i) => {
    const a = (Math.floor(i / k) + (i % k) / (k - 1)) * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    return [cx + hw * Math.sign(c) * Math.abs(c) ** (2 / n), cy + hd * Math.sign(s) * Math.abs(s) ** (2 / n), elev];
  });
}

/** Skin consecutive rings (equal point counts). Rings traced +x -> +y: going up gives outward normals, going down inward. */
function loftGeo(rows) {
  const n = rows[0].length, pos = [], idx = [];
  rows.forEach((row) => row.forEach(([x, y, e]) => pos.push(m(x), m(e), m(y))));
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + ((j + 1) % n), c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals(); // area-weighted: big faces stay flat, bevel rings shade as radii
  return g;
}
const loft = (rows, mat, name) => lit(new THREE.Mesh(loftGeo(rows), mat), name);

/** Rounded box from plan min-corner + size (like boxAt), UVs box-projected in metres so textures tile physically. */
function rboxGeo(x0, y0, elev, w, d, h, r) {
  const g = new RoundedBoxGeometry(m(w), m(h), m(d), 3, m(Math.min(r, w / 2.01, d / 2.01, h / 2.01)));
  g.translate(m(x0 + w / 2), m(elev + h / 2), m(y0 + d / 2));
  const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return g;
}
const rbox = (x0, y0, elev, w, d, h, r, mat, name) => lit(new THREE.Mesh(rboxGeo(x0, y0, elev, w, d, h, r), mat), name);

/** Solid of revolution, profile [[radius, height]...] in inches, base at `at` (plan [x,y,elev]), axis along plan dir [dx,dy,dElev]. */
function latheGeo(profile, at, dir = [0, 0, 1], seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(m(r), m(h))), seg);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(dir[0], dir[2], dir[1]).normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(P(...at), q, new THREE.Vector3(1, 1, 1)));
}
const rodGeo = (r, from, to, seg = 20) => { // capped cylinder between two plan points
  const a = P(...from), b = P(...to), len = a.distanceTo(b) / 0.0254;
  return latheGeo([[0, 0], [r, 0], [r, len], [0, len]], from, [to[0] - from[0], to[1] - from[1], to[2] - from[2]], seg);
};
const tubeGeo = (pts, r, seg = 48) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => P(...p))), seg, m(r), 12);

/** One draw call per accessory: merge same-material parts. */
function merged(name, mat, ...geos) {
  return lit(new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat), name);
}

// ---------------------------------------------------------------- tub / shower
const T = BATH.tub;
const TX0 = X.northInt, TX1 = X.bathE, TY0 = Y.eastInt, TYF = Y.tubFront; // alcove: valve wall x = TX0, apron at y = TYF
const TCY = TY0 + T.w / 2; //                                                   fittings sit on the tub centre line
const WALL_X = TX0 + T.wallT; //                                                 finished face of the surround's valve wall

/** Plan outline of the surround's U-shaped shell. b = inset (top bevel), dn = soap-niche depth at this elevation. */
function surroundOutline(b, dn) {
  const L = T.l, W = T.w - b, tb = T.wallT - b, R = T.cornerR, rf = T.edgeR, o = 0.05, N = T.niche, k = 8, pts = [];
  const arc = (cx, cy, r, a0, a1) => { for (let i = 0; i < k; i++) { const a = (a0 + ((a1 - a0) * i) / (k - 1)) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  const s = (dn / N.depth) * 0.6; // niche sides taper in
  pts.push([o, o], [L - o, o], [L - o, W], [L - o - 0.05, W]);
  arc(L - tb + rf, W - rf, rf, 90, 180); //       radiused front edge, far end
  arc(L - tb - R, tb + R, R, 0, -90); //          coved back corner
  pts.push([N.fromValveWall + N.w / 2, tb], [N.fromValveWall + N.w / 2 - s, tb - dn], [N.fromValveWall - N.w / 2 + s, tb - dn], [N.fromValveWall - N.w / 2, tb]);
  arc(tb + R, tb + R, R, -90, -180);
  arc(tb - rf, W - rf, rf, 0, 90); //             radiused front edge, valve end
  pts.push([o + 0.05, W], [o, W]);
  return pts.map(([u, v]) => [TX0 + u, TY0 + v]);
}

function tubShower() {
  const N = T.niche, H = T.surroundH, bv = T.topBevel;
  const row = (elev, b, dn) => surroundOutline(b, dn).map(([x, y]) => [x, y, elev]);
  const shell = loftGeo([
    row(T.h - 0.3, 0, 0), row(N.bottom - 0.3, 0, 0), row(N.bottom, 0, 0.3), row(N.bottom + 0.1, 0, N.depth - 0.3), row(N.bottom + 0.45, 0, N.depth),
    row(N.top - 3.5, 0, N.depth), row(N.top - 0.4, 0, 0.25), row(N.top, 0, 0), // sloped niche head
    row(H - bv, 0, 0), row(H - bv * 0.3, bv * 0.7, 0), row(H, bv, 0),
  ]);
  // flat top ledge of the shell
  const top = surroundOutline(bv, 0).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-4);
  const tris = THREE.ShapeUtils.triangulateShape(top.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(top.flatMap(([x, y]) => [m(x), m(H), m(y)]), 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(top.length * 2), 2));
  cap.setIndex(tris.flat());
  cap.computeVertexNormals();
  if (cap.attributes.normal.getY(0) < 0) { cap.setIndex(tris.flatMap(([a, b, c]) => [a, c, b])); cap.computeVertexNormals(); }
  const surround = merged('bath:surround', MAT.fiberglass, shell, cap);

  // tub: apron (base strip, recessed panel, rolled band) -> rim -> basin, one continuous skin
  const cx = (TX0 + TX1) / 2, hw = T.l / 2 - 0.05;
  const outer = (front, elev, r = 0.4) => ring(cx, (TY0 + front) / 2, hw, (front - TY0) / 2, r, elev);
  const bx = cx, by = (TY0 + T.rimBack + TYF - T.rimFront) / 2, bhw = T.l / 2 - T.rimEnd, bhd = (T.w - T.rimBack - T.rimFront) / 2;
  const basin = (inx, iny, r, elev) => ring(bx, by, bhw - inx, bhd - iny, r, elev);
  const rec = TYF - T.apronRecess;
  const tub = loft([
    outer(TYF, 0), outer(TYF, T.apronBase), outer(rec, T.apronBase + 0.5), outer(rec, T.h - T.apronBand - 0.5), outer(TYF, T.h - T.apronBand),
    outer(TYF, T.h - 0.7), outer(TYF - 0.2, T.h - 0.2, 0.6), outer(TYF - 0.7, T.h, 0.8),
    basin(-0.5, -0.5, T.basinR + 0.5, T.h), basin(0, 0, T.basinR, T.h - 0.35), basin(0.25, 0.2, T.basinR, T.h - 1),
    basin(T.basinSlope, T.basinSlope * 0.6, T.basinR, T.floorElev + 1.6), basin(T.basinSlope + 1.6, T.basinSlope * 0.6 + 1.6, T.basinR - 0.5, T.floorElev),
    basin(bhw, bhd, 0, T.floorElev),
  ], MAT.fiberglass, 'bath:tub');

  // chrome: curved rod + flanges, gooseneck arm + head, valve trim, spout, overflow, drain, soap bar
  const R = BATH.showerRod, yRod = TYF - R.setback, f = R.flange;
  const rodPts = Array.from({ length: 17 }, (_, i) => { const u = i / 16; return [TX0 + 0.3 + (T.l - 0.6) * u, yRod + R.bow * (1 - (2 * u - 1) ** 2), R.elev]; });
  const rod = merged('bath:showerRod', MAT.chrome, tubeGeo(rodPts, R.dia / 2, 64),
    rboxGeo(TX0, yRod - f / 2, R.elev - f / 2, 0.5, f, f, 0.15), rboxGeo(TX1 - 0.5, yRod - f / 2, R.elev - f / 2, 0.5, f, f, 0.15));

  const S = BATH.showerHead, ar = S.armDia / 2, e0 = S.armElev, rise = S.elev + 5 - e0, reach = S.reach;
  const armPts = [[0, 0], [0.17, 0.02], [0.3, 0.3], [0.28, 0.68], [0.42, 0.96], [0.68, 1.04], [0.9, 0.9], [0.98, 0.7]] // gooseneck, normalised
    .map(([u, v]) => [WALL_X + u * (reach - 0.3), TCY, e0 + v * rise]);
  const end = armPts[armPts.length - 1], spray = new THREE.Vector3(0.34, 0, -0.94).normalize(), hr = S.dia / 2;
  const headAt = [end[0] + spray.x * 3, TCY, end[2] + spray.z * 3], back = [-spray.x, 0, -spray.z];
  const arm = merged('bath:showerArm', MAT.chrome, tubeGeo(armPts, ar),
    latheGeo([[1.25, 0], [1.25, 0.15], [0.9, 0.45], [ar, 0.6], [0, 0.6]], [WALL_X, TCY, e0], [1, 0, 0]),
    latheGeo([[0, 0.02], [hr - 0.1, 0.02], [hr, 0.12], [hr, 0.45], [hr - 0.5, 0.95], [hr - 1.5, 1.5], [0.75, 1.9], [0.5, 2.5], [0.7, 2.85], [0.5, 3.15], [0, 3.2]], headAt, back, 40));
  arm.userData.headElev = S.elev;
  const face = new THREE.Mesh(new THREE.CircleGeometry(m(hr - 0.25), 40), showerFaceMat());
  face.name = 'bath:showerHead:face';
  face.position.copy(P(...headAt)).addScaledVector(spray, m(0.005));
  face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spray);

  const v = BATH.valve, sp = BATH.spout, ov = BATH.overflow, vr = v.dia / 2, sr = sp.dia / 2;
  const slope = Math.atan2(T.basinSlope, T.h - 1 - T.floorElev - 1.6); // basin end-wall lean
  const ovX = TX0 + T.rimEnd + 0.25 + (T.h - 1 - ov.elev) * Math.tan(slope);
  const trim = merged('bath:valveTrim', MAT.chrome,
    latheGeo([[vr, 0], [vr, 0.12], [vr - 0.35, 0.4], [1.8, 0.75], [1.25, 0.85], [1.25, 2.9], [1.05, 3.1], [0, 3.15]], [WALL_X, TCY, v.elev], [1, 0, 0], 40),
    rodGeo(0.2, [WALL_X + 2.4, TCY, v.elev], [WALL_X + 2.6, TCY + 1.6, v.elev - 1.9]),
    latheGeo([[sr + 0.3, 0], [sr + 0.3, 0.3], [sr, 0.5], [sr, sp.l - 0.3], [sr - 0.2, sp.l], [0, sp.l]], [WALL_X, TCY, sp.elev], [1, 0, 0]),
    rodGeo(0.28, [WALL_X + sp.l - 1.2, TCY, sp.elev + sr - 0.1], [WALL_X + sp.l - 1.2, TCY, sp.elev + sr + 0.7]),
    latheGeo([[ov.dia / 2, 0], [ov.dia / 2, 0.22], [ov.dia / 2 - 0.4, 0.42], [0, 0.48]], [ovX - 0.1, TCY, ov.elev], [Math.cos(slope), 0, Math.sin(slope)]),
    latheGeo([[BATH.drain.dia / 2, 0], [BATH.drain.dia / 2, 0.08], [BATH.drain.dia / 2 - 0.4, 0.16], [0, 0.1]], [TX0 + BATH.drain.fromValveWall + T.basinSlope, by, T.floorElev - 0.03]),
    rodGeo(0.28, [TX0 + N.fromValveWall - N.w / 2 + 0.2, TY0 + T.wallT - 0.55, N.barElev], [TX0 + N.fromValveWall + N.w / 2 - 0.2, TY0 + T.wallT - 0.55, N.barElev]));
  return group('bath:tubShower', surround, tub, rod, arm, face, trim);
}

function showerFaceMat() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9cbcc'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#5d6063';
  for (let k = 1; k <= 5; k++) for (let i = 0; i < k * 7; i++) { // concentric nozzle rings
    const a = (i / (k * 7)) * Math.PI * 2 + k, r = k * 22;
    ctx.beginPath(); ctx.arc(128 + r * Math.cos(a), 128 + r * Math.sin(a), 4.2, 0, 7); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, metalness: 0.75, roughness: 0.28, name: 'shower-head-face' });
}

// ---------------------------------------------------------------- toilet + wall accessories
function toilet() {
  const o = BATH.toilet, cy = o.cy, wall = X.northInt;
  const xa = wall + o.tankGap, tcx = xa + o.tankD / 2, thw = o.tankD / 2, thd = o.w / 2, lidTop = o.tankH, lidBot = lidTop - o.lidT;
  const tip = wall + o.l, bcx = tip - o.bowlL / 2, bhw = o.bowlL / 2, bhd = o.bowlW / 2;
  const cap = (x, e) => ring(x, cy, 0, 0, 0, e);
  const tank = merged('bath:toilet:tank', MAT.porcelain,
    loftGeo([cap(tcx, o.tankBottom), ring(tcx, cy, thw - 0.75, thd - 1.1, 1.2, o.tankBottom), ring(tcx, cy, thw - 0.55, thd - 0.8, 1.5, o.tankBottom + 0.8),
      ring(tcx, cy, thw, thd, 1.6, lidBot - 0.05), cap(tcx, lidBot - 0.05)]),
    loftGeo([cap(tcx, lidBot), ring(tcx + 0.1, cy, thw + 0.35, thd + 0.4, 1.7, lidBot), ring(tcx + 0.1, cy, thw + 0.42, thd + 0.47, 1.7, lidBot + 0.3),
      ring(tcx + 0.1, cy, thw + 0.42, thd + 0.47, 1.7, lidTop - 0.45), ring(tcx + 0.1, cy, thw + 0.15, thd + 0.2, 1.5, lidTop - 0.05), cap(tcx + 0.1, lidTop)]));
  const bowl = merged('bath:toilet:bowl', MAT.porcelain,
    loftGeo([oval(bcx - 1.8, cy, bhw - 1.5, bhd - 2.7, 0, 3), oval(bcx - 1.8, cy, bhw - 1.3, bhd - 2.5, 0.5, 3), oval(bcx - 1.8, cy, bhw - 1.7, bhd - 2.8, o.rimH * 0.33, 3),
      oval(bcx - 1, cy, bhw - 0.9, bhd - 1.6, o.rimH * 0.63, 2.6), oval(bcx - 0.2, cy, bhw - 0.15, bhd - 0.3, o.rimH * 0.87),
      oval(bcx, cy, bhw, bhd, o.rimH - 0.5), oval(bcx, cy, bhw - 0.15, bhd - 0.15, o.rimH), cap(bcx, o.rimH)]),
    loftGeo([cap(xa + 5.5, o.rimH * 0.5), ring(xa + 5.5, cy, 3.6, 4.3, 1.5, o.rimH * 0.5), ring(xa + 5.5, cy, 4, 5, 1.5, o.tankBottom + 0.1), cap(xa + 5.5, o.tankBottom + 0.1)])); // tank deck
  const scx = tip - 0.05 - (bhw - 0.85), shw = bhw - 0.85, s0 = o.rimH + 0.05, lid0 = s0 + 0.8, top = o.seatH;
  const seat = merged('bath:toilet:seat', MAT.whitePlastic,
    loftGeo([cap(scx, s0), oval(scx, cy, shw, bhd, s0), oval(scx, cy, shw, bhd, s0 + 0.6), oval(scx, cy, shw - 0.1, bhd - 0.1, s0 + 0.7), cap(scx, s0 + 0.7)]),
    loftGeo([cap(scx, lid0), oval(scx, cy, shw - 0.1, bhd - 0.1, lid0), oval(scx, cy, shw - 0.1, bhd - 0.1, top - 0.3), oval(scx, cy, shw - 0.5, bhd - 0.5, top - 0.05), cap(scx, top)]),
    rboxGeo(scx - shw - 0.5, cy - 3.6, s0, 1.3, 1.7, 1.2, 0.3), rboxGeo(scx - shw - 0.5, cy + 1.9, s0, 1.3, 1.7, 1.2, 0.3)); // hinge caps
  const frontX = xa + o.tankD - 0.1, ly = cy + thd - 3, le = lidBot - 2.6;
  const lever = merged('bath:toilet:lever', MAT.chrome,
    latheGeo([[0.6, 0], [0.6, 0.2], [0.35, 0.4], [0, 0.45]], [frontX, ly, le], [1, 0, 0]), rboxGeo(frontX + 0.3, ly - 2.7, le - 0.3, 0.35, 3, 0.6, 0.15));

  const st = o.stop, sy = cy + st.dy;
  const stop = merged('bath:toilet:supplyStop', MAT.chrome,
    latheGeo([[1.1, 0], [1.1, 0.1], [0.5, 0.35], [0.32, 0.4], [0.32, 1.6], [0.5, 1.7], [0.5, 2.4], [0, 2.45]], [wall, sy, st.elev], [1, 0, 0]),
    latheGeo([[0.25, 0], [0.25, 0.5], [0.75, 0.6], [0.75, 0.85], [0, 0.9]], [wall + 2.05, sy, st.elev], [0, 1, 0])); // handle toward the door
  const line = lit(new THREE.Mesh(tubeGeo([[wall + 2.05, sy, st.elev + 0.4], [wall + 2.3, sy - 0.2, st.elev + 2], [wall + 3.6, sy - 1.5, st.elev + 1.2], [wall + 4.6, sy - 3.2, st.elev + 3.5], [wall + 4.4, sy - 4.2, o.tankBottom + 0.1]], 0.19, 40), MAT.stainless), 'bath:toilet:supplyLine');
  return group('bath:toilet', tank, bowl, seat, lever, stop, line);
}

/** Round wall post (escutcheon + stem), axis along dir, used by towel bar / ring / paper holder. */
const post = (at, dir, len, r = 0.4) => latheGeo([[1.05, 0], [1.05, 0.15], [0.7, 0.45], [r, 0.7], [r, len - 0.45], [r + 0.2, len - 0.2], [r + 0.2, len + 0.35], [0, len + 0.4]], at, dir);

function accessories() {
  const b = BATH.towelBar, wall = X.northInt, cy = BATH.toilet.cy, ya = cy - b.l / 2, yb = cy + b.l / 2;
  const towelBar = merged('bath:towelBar', MAT.chrome, post([wall, ya, b.elev], [1, 0, 0], b.standoff), post([wall, yb, b.elev], [1, 0, 0], b.standoff),
    rodGeo(b.dia / 2, [wall + b.standoff, ya, b.elev], [wall + b.standoff, yb, b.elev]));
  const p = BATH.paperHolder, py = Y.bathS - p.standoff;
  const paper = merged('bath:paperHolder', MAT.chrome, post([p.x, Y.bathS, p.elev], [0, -1, 0], p.standoff),
    rodGeo(0.3, [p.x, py, p.elev], [p.x + p.arm, py, p.elev]), latheGeo([[0.3, 0], [0.45, 0.1], [0.45, 0.4], [0, 0.5]], [p.x + p.arm, py, p.elev], [1, 0, 0]));
  const d = BATH.doorStop; // concave rubber wall bumper behind the open bath door
  const stop = lit(new THREE.Mesh(latheGeo([[d.dia / 2, 0], [d.dia / 2, d.t * 0.6], [d.dia / 2 - 0.25, d.t], [d.dia / 4, d.t * 0.6], [0, d.t * 0.5]],
    [X.bathE, Y.bathS - DOORS.bathDoor.w + d.leverBackset, d.elev], [-1, 0, 0]), MAT.whitePlastic), 'bath:doorStop');
  return group('bath:accessories', towelBar, paper, stop);
}

// ---------------------------------------------------------------- vanity alcove
function vanity() {
  const V = BATH.vanity, xw = X.northInt, ya = Y.vanityA, yb = Y.vanityB, cyv = (ya + yb) / 2;
  const face = xw + V.cabD, top = V.h + V.topT, g = group('bath:vanity');
  g.add(boxAt(xw, ya, V.toeKickH, V.cabD, V.w, V.h - V.toeKickH, MAT.cabinet, 'vanity:carcass'),
    boxAt(xw, ya, 0, V.cabD - V.toeKickRecess, V.w, V.toeKickH, MAT.toeKick, 'vanity:toeKick'));
  // fronts: scribe fillers, one false drawer front, two slab doors (thermofoil: eased edges)
  const fy0 = ya + V.filler + V.reveal, fw = V.w - 2 * (V.filler + V.reveal), dw = (fw - V.reveal) / 2;
  const doorTop = V.h - V.falseDrawerH - 2 * V.reveal, doorBot = V.toeKickH + V.reveal, fr = (y0, e0, w, h) => rboxGeo(face, y0, e0, V.doorT, w, h, 0.09);
  g.add(merged('vanity:fronts', MAT.cabinet, fr(ya, V.toeKickH, V.filler, V.h - V.toeKickH), fr(yb - V.filler, V.toeKickH, V.filler, V.h - V.toeKickH),
    fr(fy0, V.h - V.reveal - V.falseDrawerH, fw, V.falseDrawerH), fr(fy0, doorBot, dw, doorTop - doorBot), fr(fy0 + dw + V.reveal, doorBot, dw, doorTop - doorBot)));
  const L = KITCHEN.pullL, px = face + V.doorT, bar = px + V.pullStandoff, pe = doorTop - 2 - L / 2, pr = V.pullDia / 2;
  const pull = (y) => [rodGeo(pr, [bar, y, pe - L / 2], [bar, y, pe + L / 2]), rodGeo(pr * 0.8, [px, y, pe - L / 3], [bar, y, pe - L / 3]), rodGeo(pr * 0.8, [px, y, pe + L / 3], [bar, y, pe + L / 3])];
  g.add(merged('vanity:pulls', MAT.nickel, ...pull(cyv - V.reveal / 2 - 1.5), ...pull(cyv + V.reveal / 2 + 1.5)));

  // quartz top with undermount cut-out (extruded so the eased edge and the cut-out wall are real), splashes on 3 sides
  const s = V.sink, scx = xw + s.fromBack + s.d / 2, ez = 0.07, c = 0.03;
  const shape = new THREE.Shape([[xw + c, ya + c], [xw + V.d, ya + c], [xw + V.d, yb - c], [xw + c, yb - c]].map(([x, y]) => new THREE.Vector2(m(x), m(y))));
  shape.holes.push(new THREE.Path(ring(scx, cyv, s.d / 2, s.w / 2, s.r, 0).map(([x, y]) => new THREE.Vector2(m(x), m(y)))));
  const topGeo = new THREE.ExtrudeGeometry(shape, { depth: m(V.topT - 2 * ez), bevelEnabled: true, bevelThickness: m(ez), bevelSize: m(ez), bevelOffset: -m(ez), bevelSegments: 2, curveSegments: 8 });
  topGeo.rotateX(Math.PI / 2).translate(0, m(top - ez), 0);
  g.add(lit(new THREE.Mesh(topGeo, MAT.quartz), 'vanity:top'),
    rbox(xw, ya + c, top, V.splashT, V.w - 2 * c, V.backsplash, 0.06, MAT.quartz, 'vanity:backsplash'),
    rbox(xw + V.splashT, ya + c, top, V.d - V.splashT, V.splashT, V.backsplash, 0.06, MAT.quartz, 'vanity:sideSplash-bath'),
    rbox(xw + V.splashT, yb - c - V.splashT, top, V.d - V.splashT, V.splashT, V.backsplash, 0.06, MAT.quartz, 'vanity:sideSplash-linen'));
  const bowlRing = (inset, r, e) => ring(scx, cyv, s.d / 2 + 0.12 - inset, s.w / 2 + 0.12 - inset, r, e);
  g.add(loft([bowlRing(0, s.r, V.h + 0.02), bowlRing(0.05, s.r, V.h - 0.4), bowlRing(0.35, s.r, V.h - s.depth + 1.1), bowlRing(1.4, s.r, V.h - s.depth + 0.05),
    ring(scx - 1, cyv, 0, 0, 0, V.h - s.depth)], MAT.porcelain, 'vanity:sink'));

  const F = V.faucet, fx = xw + F.fromBack, fr2 = F.dia / 2, spoutE = top + F.h * 0.62;
  g.add(merged('vanity:faucet', MAT.chrome,
    latheGeo([[fr2 + 0.25, 0], [fr2 + 0.25, 0.12], [fr2, 0.25], [fr2, F.h - 0.15], [fr2 - 0.15, F.h], [0, F.h]], [fx, cyv, top]),
    rodGeo(0.48, [fx, cyv, spoutE], [fx + F.reach, cyv, spoutE - 0.7]),
    rodGeo(0.24, [fx - 0.2, cyv, top + F.h - 0.1], [fx - 1.2, cyv, top + F.h + 2.4]),
    latheGeo([[0.95, 0], [0.95, 0.06], [0.6, 0.12], [0, 0.08]], [scx - 1, cyv, V.h - s.depth]))); // sink drain

  // frameless mirror: planar reflection at reduced resolution, skipped for the AO/normal pre-passes
  const M = V.mirror, my = cyv - M.w / 2;
  g.add(boxAt(xw + 0.02, my, M.bottom, M.t, M.w, M.h, MAT.mirrorEdge, 'vanity:mirror'));
  const refl = new Reflector(new THREE.PlaneGeometry(m(M.w - 0.1), m(M.h - 0.1)), { textureWidth: 1024, textureHeight: 1216, clipBias: 0.002, multisample: 4, color: 0xb9bcba });
  refl.name = 'vanity:mirror:reflection';
  refl.rotation.y = Math.PI / 2;
  refl.position.copy(P(xw + 0.02 + M.t + 0.01, cyv, M.bottom + M.h / 2));
  const render = refl.onBeforeRender;
  refl.onBeforeRender = (r, sc, cam, ...rest) => { if (!sc.overrideMaterial) render.call(refl, r, sc, cam, ...rest); };
  const clip = (y, e) => rboxGeo(xw + 0.02, y - 0.35, e, M.t + 0.12, 0.7, 0.5, 0.05);
  g.add(refl, merged('vanity:mirrorClips', MAT.chrome, clip(my + 5, M.bottom - 0.2), clip(my + M.w - 5, M.bottom - 0.2), clip(my + 5, M.bottom + M.h - 0.3), clip(my + M.w - 5, M.bottom + M.h - 0.3)));

  const tr = V.towelRing, ty = yb - 2.2, ringGeo = new THREE.TorusGeometry(m(tr.dia / 2), m(0.17), 10, 40);
  ringGeo.translate(m(xw + tr.fromBack), m(tr.elev - tr.dia / 2 + 0.45), m(ty));
  g.add(merged('vanity:towelRing', MAT.chrome, post([xw + tr.fromBack, yb, tr.elev], [0, -1, 0], 1.9), ringGeo));
  return g;
}

export function build() {
  return group('bathroom', tubShower(), toilet(), accessories(), vanity());
}
