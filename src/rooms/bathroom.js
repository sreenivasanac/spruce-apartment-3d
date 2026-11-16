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
import { BATH, DOORS, ENV, KITCHEN, X, Y, m } from '../dimensions.js';
import { MAT } from '../materials.js';
import { boxAt, group } from '../lib/build.js';

const UP = new THREE.Vector3(0, 1, 0);
const P = (x, y, elev) => new THREE.Vector3(m(x), m(elev), m(y)); // plan inches -> world
const CHROME = MAT.bathChrome, SATIN = MAT.bathSatin; // brighter than MAT.chrome / MAT.nickel: the bath has one dim dome and little to reflect
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
const tubeGeo = (pts, r, seg = 48) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => P(...p)), false, 'centripetal'), seg, m(r), 12);

/** One draw call per accessory: merge same-material parts. */
function merged(name, mat, ...geos) {
  return lit(new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat), name);
}

// ---------------------------------------------------------------- tub / shower
const T = BATH.tub;
const TX0 = X.northInt, TX1 = X.bathE, TY0 = Y.eastInt, TYF = Y.tubFront; // alcove: valve wall x = TX0, apron at y = TYF
const TCY = TY0 + T.w / 2; //                                                   fittings sit on the tub centre line
const WALL_X = TX0 + T.wallT; //                                                 finished face of the surround's valve wall

/** Plan outline of the surround's U-shaped shell -> [x, y, inNiche]. b = inset (top bevel), dn = soap-niche depth at this row.
 *  Guard points N.r either side of each niche arris keep the smooth-normal blend local (soft radius, no shading seams on the flat wall). */
function surroundOutline(b, dn) {
  const L = T.l, W = T.w - b, tb = T.wallT - b, R = T.cornerR, rf = T.edgeR, o = 0.05, N = T.niche, k = 14, pts = [];
  const arc = (cx, cy, r, a0, a1) => { for (let i = 0; i < k; i++) { const a = (a0 + ((a1 - a0) * i) / (k - 1)) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  const c = N.fromValveWall, hw = N.w / 2, g = N.r, s = (dn / N.depth) * N.jambTaper; // jambs taper in toward the back
  pts.push([o, o], [L - o, o], [L - o, W], [L - o - 0.05, W]);
  arc(L - tb + rf, W - rf, rf, 90, 180); //       radiused front edge, far end
  arc(L - tb - R, tb + R, R, 0, -90); //          coved back corner
  pts.push([c + hw + g, tb], [c + hw, tb], [c + hw - s, tb - dn, 1], [c + hw - s - g, tb - dn, 1], [c - hw + s + g, tb - dn, 1], [c - hw + s, tb - dn, 1], [c - hw, tb], [c - hw - g, tb]);
  arc(tb + R, tb + R, R, -90, -180);
  arc(tb - rf, W - rf, rf, 0, 90); //             radiused front edge, valve end
  pts.push([o + 0.05, W], [o, W]);
  return pts.map(([u, v, n]) => [TX0 + u, TY0 + v, n]);
}

/** Flattened-underside oval ring in the y/elev plane at plan x (traced +y -> +elev so lofting toward +x faces outward). */
const xRing = (x, ce, ry, re, flat = 1, n = 24) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return [x, TCY + ry * Math.cos(a), ce + re * Math.max(Math.sin(a), -flat)];
});

function tubShower() {
  const N = T.niche, H = T.surroundH, bv = T.topBevel, B = N.bottom, D = N.depth, g = N.r, lip = N.lipH;
  // e = elevation of the wall points, eN = elevation of the recessed niche points (the dish lip rises, then drops to the dish floor)
  const row = (e, b, dn, eN = e) => surroundOutline(b, dn).map(([x, y, n]) => [x, y, n ? eN : e]);
  const shell = loftGeo([
    row(T.h - 0.3, 0, 0), row(B - 2 * g, 0, 0), row(B - g, 0, 0),
    row(B, 0, 0.1, B + lip * 0.7), row(B + 0.1, 0, 0.35, B + lip), row(B + 0.2, 0, 0.6, B + lip * 0.3), // raised lip at the dish front
    row(B + 0.3, 0, D - g, B + 0.1), row(B + 0.3 + g, 0, D, B + 0.1 + g), row(N.scoopFrom, 0, D), //       dish floor, coved into the back
    row(N.top - g, 0, D * g / (N.top - N.scoopFrom)), row(N.top, 0, 0), row(N.top + g, 0, 0), //           long scoop fading to nothing at the head
    row(H - bv, 0, 0), row(H - bv * 0.3, bv * 0.7, 0), row(H, bv, 0),
  ]);
  // flat top ledge of the shell (hidden under the furring except for the lip)
  const top = surroundOutline(bv, 0).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-4);
  const tris = THREE.ShapeUtils.triangulateShape(top.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(top.flatMap(([x, y]) => [m(x), m(H), m(y)]), 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(top.length * 2), 2));
  cap.setIndex(tris.flat());
  cap.computeVertexNormals();
  if (cap.attributes.normal.getY(0) < 0) { cap.setIndex(tris.flatMap(([a, b, c]) => [a, c, b])); cap.computeVertexNormals(); }
  const surround = merged('bath:surround', MAT.fiberglass, shell, cap);

  // painted drywall furred over the nailing flange: wall above the surround + a ridge beside the tub on both side walls,
  // so the fiberglass face is nearly flush and only a `lip` stands proud (IMG_3943/3950)
  const F = T.furring, ft = T.wallT - F.lip, fy = TYF + F.w, side = (x0) => [rboxGeo(x0, TY0, H, ft, fy - TY0, ENV.ceiling - H, fr), rboxGeo(x0, TYF, 0, ft, F.w, H, fr)], fr = 0.01; // fr: near-sharp so coplanar pieces show no seam
  const furring = merged('bath:furring', MAT.wallKnockdown, ...side(TX0), ...side(TX1 - ft), rboxGeo(TX0 + ft, TY0, H, T.l - 2 * ft, ft, ENV.ceiling - H, fr));
  const caulk = rbox(TX0 + ft, TYF, 0, T.l - 2 * ft, T.caulk, T.caulk, T.caulk * 0.45, MAT.whitePlastic, 'bath:tubCaulk'); // white strip along the apron base (IMG_3944)

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

  // chrome: curved rod + flanges (on the furred wall faces), inverted-J arm + head, valve trim, spout, overflow, drain, soap bar
  const R = BATH.showerRod, yRod = TYF - R.setback, f = R.flange, rx0 = TX0 + ft, rx1 = TX1 - ft;
  const rodPts = Array.from({ length: 17 }, (_, i) => { const u = i / 16; return [rx0 + 0.3 + (rx1 - rx0 - 0.6) * u, yRod + R.bow * (1 - (2 * u - 1) ** 2), R.elev]; });
  const rod = merged('bath:showerRod', CHROME, tubeGeo(rodPts, R.dia / 2, 64),
    rboxGeo(rx0, yRod - f / 2, R.elev - f / 2, 0.5, f, f, 0.15), rboxGeo(rx1 - 0.5, yRod - f / 2, R.elev - f / 2, 0.5, f, f, 0.15));

  // arm: short stub out of the flange, elbow, straight riser, tight bend over the top, stopping `tilt` short of vertical so the head faces into the tub
  const S = BATH.showerHead, ar = S.armDia / 2, e0 = S.armElev, tilt = S.tilt * Math.PI / 180, eb = 1; // eb = elbow radius
  const arcPts = (cu, cv, r, a0, a1, n) => Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / (n - 1); return [cu + r * Math.cos(a), cv + r * Math.sin(a)]; });
  const armPts = [[0, 0], ...arcPts(S.stub - eb, eb, eb, -Math.PI / 2, 0, 5), ...arcPts(S.stub + S.bendR, S.riser, S.bendR, Math.PI, tilt, 11)]
    .map(([u, v]) => [WALL_X + u, TCY, e0 + v]);
  const end = armPts[armPts.length - 1], spray = new THREE.Vector3(Math.sin(tilt), 0, -Math.cos(tilt)), hr = S.dia / 2;
  const headAt = [end[0] + spray.x * S.neck, TCY, end[2] + spray.z * S.neck], back = [-spray.x, 0, -spray.z];
  const arm = merged('bath:showerArm', CHROME, tubeGeo(armPts, ar, 80),
    latheGeo([[1.25, 0], [1.25, 0.15], [0.9, 0.45], [ar, 0.6], [0, 0.6]], [WALL_X, TCY, e0], [1, 0, 0]),
    latheGeo([[0, 0.02], [hr - 0.1, 0.02], [hr, 0.12], [hr, 0.45], [hr - 0.5, 0.95], [hr - 1.5, 1.5], [0.75, 1.9], [0.5, 2.5], [0.7, 2.85], [0.5, 3.15], [0, 3.2]], headAt, back, 40));
  arm.userData.headElev = headAt[2];
  const face = new THREE.Mesh(new THREE.CircleGeometry(m(hr - 0.25), 40), showerFaceMat());
  face.name = 'bath:showerHead:face';
  face.position.copy(P(...headAt)).addScaledVector(spray, m(0.005));
  face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spray);

  const v = BATH.valve, sp = BATH.spout, ov = BATH.overflow, vr = v.dia / 2, kr = v.knobDia / 2, sr = sp.dia / 2, nr = sp.noseDia / 2, sx = WALL_X + sp.l;
  const slope = Math.atan2(T.basinSlope, T.h - 1 - T.floorElev - 1.6); // basin end-wall lean
  const ovX = TX0 + T.rimEnd + 0.25 + (T.h - 1 - ov.elev) * Math.tan(slope);
  const screw = (sgn) => latheGeo([[v.screwDia / 2, 0], [v.screwDia / 2, 0.06], [v.screwDia / 4, 0.14], [0, 0.15]], [WALL_X + 0.5, TCY + sgn * v.screwAt * 0.87, v.elev - v.screwAt * 0.5], [1, 0, 0], 12);
  const trim = merged('bath:valveTrim', CHROME,
    latheGeo([[vr, 0], [vr, 0.12], [vr - 0.35, 0.4], [1.8, 0.75], [kr + 0.1, 0.85], [kr, 1], [kr, v.knobL - 0.25], [kr - 0.25, v.knobL], [0, v.knobL + 0.05]], [WALL_X, TCY, v.elev], [1, 0, 0], 40),
    screw(1), screw(-1), // two trim screws at 4 and 8 o'clock
    latheGeo([[0.38, 0], [0.3, 1.2], [0.34, 2.3], [0.2, 2.5], [0, 2.5]], [WALL_X + v.knobL - 0.7, TCY, v.elev - kr + 0.2], [0.25, 0, -1], 16), // short lever under the knob
    // cast spout: wall flange, body tapering to a flared nose, flattened underside, pull-up diverter
    loftGeo([xRing(WALL_X, sp.elev, sr + 0.3, sr + 0.3), xRing(WALL_X + 0.3, sp.elev, sr + 0.3, sr + 0.3), xRing(WALL_X + 0.55, sp.elev, sr, sr, 0.8),
      xRing(sx - 1.6, sp.elev - 0.1, sr - 0.12, sr - 0.15, 0.75), xRing(sx - 0.5, sp.elev - 0.15, nr, nr - 0.1, 0.7), xRing(sx - 0.12, sp.elev - 0.15, nr - 0.05, nr - 0.15, 0.7),
      xRing(sx, sp.elev - 0.15, 0, 0)]),
    latheGeo([[sp.diverterDia / 2 - 0.08, 0], [sp.diverterDia / 2 - 0.08, 0.55], [sp.diverterDia / 2, 0.6], [sp.diverterDia / 2, 0.95], [0, 1]], [sx - 1.1, TCY, sp.elev + nr - 0.35]),
    latheGeo([[ov.dia / 2, 0], [ov.dia / 2, 0.22], [ov.dia / 2 - 0.4, 0.42], [0, 0.48]], [ovX - 0.1, TCY, ov.elev], [Math.cos(slope), 0, Math.sin(slope)]),
    latheGeo([[BATH.drain.dia / 2, 0], [BATH.drain.dia / 2, 0.08], [BATH.drain.dia / 2 - 0.4, 0.16], [0, 0.1]], [TX0 + BATH.drain.fromValveWall + T.basinSlope, by, T.floorElev - 0.03]),
    rodGeo(0.28, [TX0 + N.fromValveWall - N.w / 2 + 0.5, TY0 + T.wallT - 0.55, N.barElev], [TX0 + N.fromValveWall + N.w / 2 - 0.5, TY0 + T.wallT - 0.55, N.barElev]));
  return group('bath:tubShower', surround, furring, caulk, tub, rod, arm, face, trim);
}

function showerFaceMat() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d', { willReadFrequently: true });
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
  // tank flares wider toward the top and its front face is bowed (IMG_3943); tr = tank ring, grow = extra half-size
  const tr = (grow, r, e, bow = o.tankBow) => ring(tcx, cy, thw + grow, thd + grow, r, e).map(([x, y, el]) => [x > tcx ? x + bow * (1 - ((y - cy) / (thd + grow)) ** 2) : x, y, el]);
  const tp = o.tankTaper, lo = o.lidOverhang;
  const tank = merged('bath:toilet:tank', MAT.porcelain,
    loftGeo([cap(tcx, o.tankBottom), tr(-tp - 0.3, 1.2, o.tankBottom), tr(-tp, 1.5, o.tankBottom + 0.8), tr(0, 1.6, lidBot - 0.05), cap(tcx, lidBot - 0.05)]),
    loftGeo([cap(tcx, lidBot), tr(lo - 0.1, 1.7, lidBot), tr(lo, 1.7, lidBot + 0.3), tr(lo, 1.7, lidTop - 0.5), tr(lo - 0.35, 1.5, lidTop - 0.05), cap(tcx, lidTop)]));
  const bowl = merged('bath:toilet:bowl', MAT.porcelain,
    loftGeo([oval(bcx - 1.8, cy, bhw - 1.3, bhd - 1.9, 0, 3), oval(bcx - 1.8, cy, bhw - 1.3, bhd - 1.9, o.footH * 0.7, 3), oval(bcx - 1.8, cy, bhw - 1.45, bhd - 2.1, o.footH, 3), // bolt-down foot
      oval(bcx - 1.8, cy, bhw - 1.9, bhd - 3.2, o.footH + 0.4, 3), oval(bcx - 1.8, cy, bhw - 1.7, bhd - 2.8, o.rimH * 0.33, 3),
      oval(bcx - 1, cy, bhw - 0.9, bhd - 1.6, o.rimH * 0.63, 2.6), oval(bcx - 0.2, cy, bhw - 0.15, bhd - 0.3, o.rimH * 0.87),
      oval(bcx, cy, bhw, bhd, o.rimH - 0.5), oval(bcx, cy, bhw - 0.15, bhd - 0.15, o.rimH), cap(bcx, o.rimH)]),
    loftGeo([cap(xa + 5.5, o.rimH * 0.5), ring(xa + 5.5, cy, 3.6, 4.3, 1.5, o.rimH * 0.5), ring(xa + 5.5, cy, 4, 5, 1.5, o.tankBottom + 0.1), cap(xa + 5.5, o.tankBottom + 0.1)])); // tank deck
  const scx = tip - 0.05 - (bhw - 0.85), shw = bhw - 0.85, s0 = o.rimH + 0.05, lid0 = s0 + 0.8, top = o.seatH;
  const seat = merged('bath:toilet:seat', MAT.whitePlastic,
    loftGeo([cap(scx, s0), oval(scx, cy, shw, bhd, s0), oval(scx, cy, shw, bhd, s0 + 0.6), oval(scx, cy, shw - 0.1, bhd - 0.1, s0 + 0.7), cap(scx, s0 + 0.7)]),
    loftGeo([cap(scx, lid0), oval(scx, cy, shw - 0.1, bhd - 0.1, lid0), oval(scx, cy, shw - 0.1, bhd - 0.1, top - 0.3), oval(scx, cy, shw - 0.5, bhd - 0.5, top - 0.05), cap(scx, top)]),
    rboxGeo(scx - shw - 0.5, cy - 3.6, s0, 1.3, 1.7, 1.2, 0.3), rboxGeo(scx - shw - 0.5, cy + 1.9, s0, 1.3, 1.7, 1.2, 0.3)); // hinge caps
  const frontX = xa + o.tankD - 0.1 + o.tankBow * 0.5, ly = cy + thd - 3, le = lidBot - 2.6;
  const lever = merged('bath:toilet:lever', CHROME,
    latheGeo([[0.6, 0], [0.6, 0.2], [0.35, 0.4], [0, 0.45]], [frontX, ly, le], [1, 0, 0]), rboxGeo(frontX + 0.3, ly - 2.7, le - 0.3, 0.35, 3, 0.6, 0.15));

  const st = o.stop, sy = cy + st.dy;
  const stop = merged('bath:toilet:supplyStop', CHROME,
    latheGeo([[1.1, 0], [1.1, 0.1], [0.5, 0.35], [0.32, 0.4], [0.32, 1.6], [0.5, 1.7], [0.5, 2.4], [0, 2.45]], [wall, sy, st.elev], [1, 0, 0]),
    latheGeo([[0.25, 0], [0.25, 0.5], [0.75, 0.6], [0.75, 0.85], [0, 0.9]], [wall + 2.05, sy, st.elev], [0, 1, 0])); // handle toward the door
  const line = lit(new THREE.Mesh(tubeGeo([[wall + 2.05, sy, st.elev + 0.4], [wall + 2.3, sy - 0.2, st.elev + 2], [wall + 3.6, sy - 1.5, st.elev + 1.2], [wall + 4.6, sy - 3.2, st.elev + 3.5], [wall + 4.4, sy - 4.2, o.tankBottom + 0.1]], 0.19, 40), MAT.stainless), 'bath:toilet:supplyLine');
  const bc = o.bolt, boltCap = (sgn) => latheGeo([[bc.dia / 2, 0], [bc.dia / 2, bc.h * 0.4], [bc.dia * 0.35, bc.h * 0.85], [0, bc.h]], [wall + bc.fromWall, cy + sgn * bc.dy, o.footH - 0.05], [0, 0, 1], 16);
  const bolts = merged('bath:toilet:boltCaps', MAT.whitePlastic, boltCap(1), boltCap(-1));
  return group('bath:toilet', tank, bowl, seat, lever, bolts, stop, line);
}

/** Round wall post (escutcheon + stem), axis along dir, used by towel bar / ring / paper holder. */
const post = (at, dir, len, r = BATH.post.stemDia / 2, e = BATH.post.escDia / 2) => latheGeo([[e, 0], [e, 0.15], [e - 0.35, 0.45], [r, 0.7], [r, len - 0.45], [r + 0.2, len - 0.2], [r + 0.2, len + 0.35], [0, len + 0.4]], at, dir);

function accessories() {
  const b = BATH.towelBar, wall = X.northInt, ya = b.cy - b.l / 2, yb = b.cy + b.l / 2; // between the furring ridge and the door wall, not centred on the toilet
  const towelBar = merged('bath:towelBar', SATIN, post([wall, ya, b.elev], [1, 0, 0], b.standoff), post([wall, yb, b.elev], [1, 0, 0], b.standoff),
    rodGeo(b.dia / 2, [wall + b.standoff, ya, b.elev], [wall + b.standoff, yb, b.elev]));
  const p = BATH.paperHolder, py = Y.bathS - p.standoff;
  const paper = merged('bath:paperHolder', SATIN, post([p.x, Y.bathS, p.elev], [0, -1, 0], p.standoff),
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
  const L = KITCHEN.pullL, px = face + V.doorT, bar = px + V.pullStandoff, pe = doorTop - V.pullDrop - L / 2, pr = V.pullDia / 2;
  const pull = (y) => [rodGeo(pr, [bar, y, pe - L / 2], [bar, y, pe + L / 2]), rodGeo(pr * 0.8, [px, y, pe - L / 3], [bar, y, pe - L / 3]), rodGeo(pr * 0.8, [px, y, pe + L / 3], [bar, y, pe + L / 3])];
  g.add(merged('vanity:pulls', SATIN, ...pull(cyv - V.reveal / 2 - V.pullInset), ...pull(cyv + V.reveal / 2 + V.pullInset)));

  // quartz top with undermount cut-out (extruded so the eased edge and the cut-out wall are real), splashes on 3 sides
  const s = V.sink, scx = xw + s.fromBack + s.d / 2, ez = 0.07, c = 0.03;
  const quartz = MAT.quartz.clone(); // same stone as the kitchen, finer fleck scale for the close-up vanity view (IMG_3941)
  quartz.map = MAT.quartz.map.clone(); quartz.map.repeat.setScalar(V.quartzRepeat); quartz.map.needsUpdate = true; quartz.name = 'quartz-gray-vanity';
  const shape = new THREE.Shape([[xw + c, ya + c], [xw + V.d, ya + c], [xw + V.d, yb - c], [xw + c, yb - c]].map(([x, y]) => new THREE.Vector2(m(x), m(y))));
  shape.holes.push(new THREE.Path(ring(scx, cyv, s.d / 2, s.w / 2, s.r, 0).map(([x, y]) => new THREE.Vector2(m(x), m(y)))));
  const topGeo = new THREE.ExtrudeGeometry(shape, { depth: m(V.topT - 2 * ez), bevelEnabled: true, bevelThickness: m(ez), bevelSize: m(ez), bevelOffset: -m(ez), bevelSegments: 2, curveSegments: 8 });
  topGeo.rotateX(Math.PI / 2).translate(0, m(top - ez), 0);
  g.add(lit(new THREE.Mesh(topGeo, quartz), 'vanity:top'),
    rbox(xw, ya + c, top, V.splashT, V.w - 2 * c, V.backsplash, 0.06, quartz, 'vanity:backsplash'),
    rbox(xw + V.splashT, ya + c, top, V.d - V.splashT, V.splashT, V.backsplash, 0.06, quartz, 'vanity:sideSplash-bath'),
    rbox(xw + V.splashT, yb - c - V.splashT, top, V.d - V.splashT, V.splashT, V.backsplash, 0.06, quartz, 'vanity:sideSplash-linen'));
  // bowl: near-vertical walls coved into a floor ~2in smaller than the rim, falling to the drain (lofted downward -> inward-facing normals)
  const bowlRing = (inset, r, e) => ring(scx, cyv, s.d / 2 + 0.12 - inset, s.w / 2 + 0.12 - inset, r, e);
  const floorE = V.h - s.depth, fi = s.floorInset, dx = scx + s.drainOffset, dr = s.drainDia / 2;
  g.add(loft([bowlRing(0, s.r, V.h + 0.02), bowlRing(0.05, s.r, V.h - 0.4), bowlRing(0.3, s.r, floorE + 1.5), bowlRing(0.55, s.r + 0.3, floorE + 0.7), bowlRing(fi, s.r + 0.5, floorE + 0.3),
    bowlRing(fi + 1, s.r + 0.5, floorE + 0.15), ring(dx, cyv, 0, 0, 0, floorE)], MAT.porcelain, 'vanity:sink'));
  const disc = (r, at, n) => { const d = new THREE.CircleGeometry(m(r), 24); d.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...n))); return d.translate(...P(...at).toArray()); };
  g.add(merged('vanity:sink:holes', MAT.blackPlastic, disc(dr * 0.55, [dx, cyv, floorE + 0.13], [0, 1, 0]), // slot round the stopper + overflow hole (faucet-side wall, the one seen from the hall)
    disc(s.overflowDia / 2, [scx - s.d / 2 + 0.06, cyv, V.h - s.overflowDrop], [1, 0, 0])));

  const F = V.faucet, fx = xw + F.fromBack, fr2 = F.dia / 2, spoutE = top + F.h * 0.55, lv = F.lever;
  const paddle = new RoundedBoxGeometry(m(lv.l), m(lv.t), m(lv.w), 2, m(lv.t * 0.45)).translate(m(lv.l / 2 - 0.3), 0, 0).rotateZ(lv.tilt * Math.PI / 180).translate(...P(fx, cyv, top + F.h + 0.35).toArray());
  g.add(merged('vanity:faucet', CHROME,
    latheGeo([[fr2 + 0.25, 0], [fr2 + 0.25, 0.12], [fr2, 0.25], [fr2, F.h - 0.15], [fr2 - 0.15, F.h], [0.45, F.h + 0.05], [0.45, F.h + 0.4], [0, F.h + 0.4]], [fx, cyv, top]),
    latheGeo([[F.spoutDia / 2 + 0.05, 0], [F.spoutDia / 2, F.reach - 0.1], [F.spoutDia / 2 - 0.1, F.reach], [0, F.reach]], [fx, cyv, spoutE], [1, 0, -0.18], 20), // short stout spout, angled down
    paddle, // flat paddle lever on top
    latheGeo([[dr, 0], [dr, 0.07], [dr - 0.35, 0.11], [dr * 0.55, 0.04], [0, 0.04]], [dx, cyv, floorE + 0.08]), latheGeo([[dr * 0.42, 0], [dr * 0.42, 0.12], [0, 0.16]], [dx, cyv, floorE + 0.13]))); // drain flange + stopper

  // frameless mirror: planar reflection at reduced resolution, skipped for the AO/normal pre-passes
  const M = V.mirror, my = cyv - M.w / 2;
  g.add(boxAt(xw + 0.02, my, M.bottom, M.t, M.w, M.h, MAT.mirrorEdge, 'vanity:mirror'));
  const refl = new Reflector(new THREE.PlaneGeometry(m(M.w - 0.1), m(M.h - 0.1)), { textureWidth: 1024, textureHeight: 1232, clipBias: 0.002, multisample: 4, color: 0xb9bcba });
  refl.name = 'vanity:mirror:reflection';
  refl.rotation.y = Math.PI / 2;
  refl.position.copy(P(xw + 0.02 + M.t + 0.01, cyv, M.bottom + M.h / 2));
  const render = refl.onBeforeRender;
  refl.onBeforeRender = (r, sc, cam, ...rest) => { if (!sc.overrideMaterial) render.call(refl, r, sc, cam, ...rest); };
  const C = M.clip, clip = (y, e) => rboxGeo(xw + 0.02, y - C.w / 2, e, M.t + 0.12, C.w, C.h, 0.05);
  g.add(refl, merged('vanity:mirrorClips', CHROME, clip(my + C.inset, M.bottom - 0.2), clip(my + M.w - C.inset, M.bottom - 0.2), clip(my + C.inset, M.bottom + M.h - 0.3), clip(my + M.w - C.inset, M.bottom + M.h - 0.3)));

  const tr = V.towelRing, ty = yb - tr.ringOut, ringGeo = new THREE.TorusGeometry(m(tr.dia / 2), m(0.17), 10, 40);
  ringGeo.translate(m(xw + tr.fromBack), m(tr.elev - tr.dia / 2 + 0.45), m(ty));
  g.add(merged('vanity:towelRing', SATIN, post([xw + tr.fromBack, yb, tr.elev], [0, -1, 0], tr.standoff), ringGeo));
  return g;
}

export function build() {
  return group('bathroom', tubShower(), toilet(), accessories(), vanity());
}
