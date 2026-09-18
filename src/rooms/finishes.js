// baseboards, wall plates (outlets / switches / cable), LVP->carpet reducer, smoke detector, chime, bedroom mini-split head.
// (Wall / floor / ceiling paint + textures are the architecture materials in materials.js, applied by shell.js.)
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
//
// Everything wall-mounted is modelled in WALL-LOCAL space: +X = out of the wall, +Y = up, +Z = along the wall
// (= normal x up), then dropped onto a wall face with onWall(). All sizes come from dimensions.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENV, WALLS, ROOMS, X, Y, KITCHEN, FIXTURES, FINISHES as F, m } from '../dimensions.js';
import { MAT } from '../materials.js';
import { box, group } from '../lib/build.js';

/** Matrix taking wall-local space to the world at plan point (px,py), elevation elev, on a face with plan normal n. */
function wallMatrix(px, py, elev, n) {
  return new THREE.Matrix4().makeRotationY(Math.atan2(-n[1], n[0])).setPosition(m(px), m(elev), m(py));
}
function onWall(obj, px, py, elev, n) {
  obj.applyMatrix4(wallMatrix(px, py, elev, n));
  return obj;
}
/** Extrude a wall-local profile [[out, up], ...] (inches) along the wall for `len` inches (from z=0 to z=len). */
function profileAlong(pts, len) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(m(x), m(y))));
  return new THREE.ExtrudeGeometry(s, { depth: m(len), bevelEnabled: false });
}
/** Rounded rectangle extruded OUT of the wall (wall-local: width along Z, height along Y, back face on the wall). */
function roundedPlate(w, h, t, r, bevel) {
  const s = new THREE.Shape(), x0 = -m(w) / 2, y0 = -m(h) / 2, R = m(r);
  s.moveTo(x0 + R, y0); s.lineTo(-x0 - R, y0); s.quadraticCurveTo(-x0, y0, -x0, y0 + R); s.lineTo(-x0, -y0 - R); s.quadraticCurveTo(-x0, -y0, -x0 - R, -y0);
  s.lineTo(x0 + R, -y0); s.quadraticCurveTo(x0, -y0, x0, -y0 - R); s.lineTo(x0, y0 + R); s.quadraticCurveTo(x0, y0, x0 + R, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: m(t - 2 * bevel), bevelEnabled: true, bevelThickness: m(bevel), bevelSize: m(bevel), bevelOffset: -m(bevel), bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, m(bevel)); // back bevel starts at the wall plane
  return g.rotateY(Math.PI / 2); // extrusion axis +Z -> +X (out of the wall)
}
const lbox = (out, up, along, mat, x, y, z, name) => { const b = box(out, up, along, mat, name); b.position.set(m(x), m(y), m(z)); b.castShadow = false; return b; };

// ---------------------------------------------------------------- baseboards
/** Wall footprints at floor level: each wall minus its door-type openings. doorA/doorB flag ends that are door jambs. */
function floorRects() {
  const out = [];
  for (const w of WALLS) {
    let cur = w.a, prevDoor = false;
    const push = (a, b, doorA, doorB) => { if (b > a) out.push({ w, doorA, doorB, r: w.axis === 'x' ? [a, w.c, b, w.c + w.t] : [w.c, a, w.c + w.t, b] }); };
    for (const o of w.openings.filter((o) => o.sill < ENV.baseboard.h).sort((p, q) => p.a - q.a)) { push(cur, o.a, prevDoor, true); cur = o.b; prevDoor = true; }
    push(cur, w.b, prevDoor, false);
  }
  return out;
}

/** Where a baseboard would be hidden or impossible: casework, tub, vanity (all from dimensions.js). */
function noBaseboardRects() {
  const K = KITCHEN, f = K.fridge;
  return [
    [X.stubB, Y.eastInt, X.southInt, Y.eastInt + K.counterD], // kitchen E run
    [X.stubB, Y.eastInt, f.x0 + f.w, f.y0 + f.d], //             fridge bay
    [X.southInt - K.counterD, Y.eastInt, X.southInt, Y.penB], // kitchen S run
    [X.stubB, Y.penA, X.southInt, Y.penB], //                    peninsula
    [X.northInt, Y.eastInt, X.bathE, Y.tubFront], //             tub alcove
    ROOMS.vanity.r,
  ];
}

/**
 * Baseboards on every exposed wall face. For each face of each floor-level wall footprint, walk along it and keep the
 * stretches whose probe point (just in front of the face) is inside the unit and not inside another wall or casework.
 * Ends at door jambs stop short by the casing width; ends at free outside corners run past by the board thickness.
 */
function baseboards() {
  const { h, t } = ENV.baseboard, B = F.baseboard, rects = floorRects(), solid = [...rects.map((q) => q.r), ...noBaseboardRects()];
  const inside = ([x0, y0, x1, y1], x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  const blocked = (x, y) => x <= 0 || y <= 0 || x >= ENV.w || y >= ENV.d || solid.some((r) => inside(r, x, y));
  const profile = [[0, 0], [t, 0], [t, h - B.chamfer], [t - B.chamfer, h], [0, h]];
  const byWall = new Map();
  for (const { w, r: [x0, y0, x1, y1], doorA, doorB } of rects) {
    // face: n = normal, O = start corner so that the face runs O + a*u with a = n x up = (-ny, nx)
    const faces = [{ n: [0, -1], O: [x0, y0], len: x1 - x0 }, { n: [0, 1], O: [x1, y1], len: x1 - x0 }, { n: [-1, 0], O: [x0, y1], len: y1 - y0 }, { n: [1, 0], O: [x1, y0], len: y1 - y0 }];
    for (const { n, O, len } of faces) {
      const a = [-n[1], n[0]], long = (w.axis === 'x') === (n[0] === 0);
      const startIsA = a[0] + a[1] > 0; // u grows with the plan coordinate -> u=0 is the wall's a-end
      if (!long && (n[0] + n[1] < 0 ? doorA : doorB)) continue; // door jamb face
      const doorAt0 = long && (startIsA ? doorA : doorB), doorAtLen = long && (startIsA ? doorB : doorA);
      const free = (u, off = t / 2) => !blocked(O[0] + a[0] * u + n[0] * off, O[1] + a[1] * u + n[1] * off);
      const N = Math.round(len / B.probe);
      let run = null;
      for (let i = 0; i <= N; i++) {
        const ok = i < N && free((i + 0.5) * B.probe);
        if (ok && run === null) run = i * B.probe;
        if (!ok && run !== null) {
          let u0 = run, u1 = i * B.probe;
          if (u0 === 0) u0 += doorAt0 ? ENV.door.casing : free(-t / 2) ? -t : 0;
          if (i === N) u1 += doorAtLen ? -ENV.door.casing : free(len + t / 2) ? t : 0;
          if (u1 - u0 >= B.minRun) {
            const g = profileAlong(profile, u1 - u0).applyMatrix4(wallMatrix(O[0] + a[0] * u0, O[1] + a[1] * u0, 0, n));
            (byWall.get(w.id) ?? byWall.set(w.id, []).get(w.id)).push(g);
          }
          run = null;
        }
      }
    }
  }
  const g = group('finishes:baseboards');
  for (const [id, geoms] of byWall) {
    const mesh = new THREE.Mesh(mergeGeometries(geoms), MAT.trim);
    mesh.name = `baseboard:${id}`;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

// ---------------------------------------------------------------- wall plates
function plates() {
  const P = F.plate, g = group('finishes:plates');
  const geo = { 1: roundedPlate(P.w, P.h, P.t, P.r, P.bevel), 2: roundedPlate(P.w2, P.h, P.t, P.r, P.bevel) };
  const mats = { outlet: MAT.plateOutlet, gfci: MAT.plateGfci, rocker: MAT.plateRocker, rocker2: MAT.plateRocker2, coax: MAT.plateCoax };
  for (const p of F.plates) {
    const o = group(`plate:${p.id}`);
    const mesh = new THREE.Mesh(geo[p.kind === 'rocker2' ? 2 : 1], mats[p.kind]);
    mesh.receiveShadow = true;
    o.add(mesh);
    if (p.kind === 'coax') { // F-connector barrel
      const c = new THREE.Mesh(new THREE.CylinderGeometry(m(0.19), m(0.19), m(0.4), 12).rotateZ(Math.PI / 2), MAT.nickel);
      c.position.x = m(P.t + 0.2);
      o.add(c);
    }
    g.add(onWall(o, p.p[0], p.p[1], p.elev, p.n));
  }
  return g;
}

// ---------------------------------------------------------------- LVP -> carpet reducer at the bedroom entry
function transition() {
  const T = F.transition, [x0, , x1] = ROOMS.bedEntry.r, w = T.w, h = T.h;
  const s = new THREE.Shape();
  s.moveTo(m(-w / 2), 0); s.quadraticCurveTo(m(-w * 0.15), m(h), m(w * 0.12), m(h)); s.lineTo(m(w / 2), m(h * 0.85)); s.lineTo(m(w / 2), 0);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: m(x1 - x0), bevelEnabled: false, curveSegments: 8 }), MAT.transition);
  mesh.name = 'finishes:transition';
  mesh.receiveShadow = true;
  return onWall(mesh, x1, Y.bedroomN, 0, [0, 1]); // local X = plan +y (hall -> bedroom), runs from x1 back to x0
}

// ---------------------------------------------------------------- ceiling smoke detector
function smokeDetector(d) {
  const R = d.dia / 2, pts = [[0, -d.h], [R * 0.55, -d.h], [R * 0.86, -d.h * 0.82], [R * 0.97, -d.h * 0.5], [R, -d.h * 0.2], [R, 0]];
  const g = group(`finishes:smoke:${d.id}`);
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(m(r), m(y))), 40), MAT.whitePlastic);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(m(R * 0.985), m(R * 0.985), m(0.12), 40, 1, true), MAT.hvacShadow); // sensing-chamber slot
  vent.position.y = m(-d.h * 0.35);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(m(d.button / 2), m(d.button / 2), m(0.1), 20), MAT.trim);
  btn.position.set(m(R * 0.25), m(-d.h - 0.03), 0);
  g.add(body, vent, btn);
  g.position.set(m(d.cx), m(ENV.ceiling), m(d.cy));
  g.userData.hideInDollhouse = true;
  return g;
}

// ---------------------------------------------------------------- door chime / alarm sounder above the bedroom closet (IMG_3937)
function chime() {
  const C = F.chime, g = group('finishes:chime'), front = WALLS.find((w) => w.id === 'bedcloset-front');
  g.add(new THREE.Mesh(roundedPlate(C.w, C.h, C.d, C.r, 0.12), MAT.whitePlastic));
  for (let i = 0; i < C.slots; i++) g.add(lbox(0.04, C.slotH, C.slotW, MAT.hvacShadow, C.d, -C.h * 0.22, (i - (C.slots - 1) / 2) * C.slotPitch));
  g.add(lbox(0.04, 0.12, C.w * 0.45, MAT.hvacShadow, C.d, C.h * 0.27, 0)); // label recess
  return onWall(g, C.cx, front.c + front.t, C.elev, [0, 1]);
}

// ---------------------------------------------------------------- bedroom mini-split head (FIXTURES.miniSplit, IMG_3935 / 3939)
function miniSplit() {
  const S = FIXTURES.miniSplit, D = F.miniSplit, { w, h, d } = S, g = group('miniSplit');
  // side profile: flat back on the wall, flat top, near-vertical front panel, bottom sweeping back to the wall
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(m(d * 0.45), 0); s.quadraticCurveTo(m(d * 0.95), m(h * 0.02), m(d), m(h * 0.38));
  s.lineTo(m(d), m(h * 0.9)); s.quadraticCurveTo(m(d), m(h), m(d * 0.88), m(h)); s.lineTo(0, m(h));
  const e = m(D.endR);
  const geo = new THREE.ExtrudeGeometry(s, { depth: m(w) - 2 * e, bevelEnabled: true, bevelThickness: e, bevelSize: e, bevelOffset: -e, bevelSegments: 4, curveSegments: 16 });
  geo.translate(0, 0, -m(w) / 2 + e);
  const body = new THREE.Mesh(geo, MAT.whitePlastic);
  body.name = 'miniSplit:body'; body.castShadow = body.receiveShadow = true;
  g.add(body);
  g.add(lbox(0.1, D.grooveH, w * 0.94, MAT.hvacShadow, d, h * D.grooveFrac, 0, 'miniSplit:panel-gap')); // front-panel parting line
  g.add(lbox(0.1, D.grooveH, w * D.louverFrac, MAT.blackPlastic, d * 0.965, h * 0.26, 0, 'miniSplit:outlet-slot')); // discharge opening above the flap
  const flap = lbox(D.louverD, D.louverT, w * D.louverFrac, MAT.whitePlastic, d * 0.8375 + 0.1, h * 0.105 - 0.1, 0, 'miniSplit:louver'); // on the bottom sweep (curve midpoint)
  flap.rotation.z = Math.atan2(h * 0.38, d * 0.55);
  g.add(flap);
  g.add(lbox(0.06, D.display.h, D.display.w, MAT.blackPlastic, d, h * 0.47, -w * 0.34, 'miniSplit:display'));
  g.add(lbox(0.05, D.badge.h, D.badge.w, MAT.nickel, d, h * 0.78, w * 0.36, 'miniSplit:badge'));
  const face = X.bedLivA, n = [-1, 0]; // bedroom face of the bed|living wall
  onWall(g, face, S.cy, S.elevTop - h, n);
  // remote-control cradle on the wall below the head
  const R = D.remote, rc = group('miniSplit:remote');
  rc.add(new THREE.Mesh(roundedPlate(R.w, R.h, R.d, 0.3, 0.1), MAT.whitePlastic));
  rc.add(lbox(0.03, R.lcd[1], R.lcd[0], MAT.hvacShadow, R.d, R.h * 0.22, 0));
  return group('finishes:hvac', g, onWall(rc, face, R.cy, R.elev, n));
}

export function build() {
  return group('finishes', baseboards(), plates(), transition(), ...F.smoke.map(smokeDetector), chime(), miniSplit());
}
