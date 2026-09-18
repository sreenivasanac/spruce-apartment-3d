// cabinets, counters, appliances, sink, peninsula
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Every cabinet/appliance is modelled in a LOCAL frame (width along X centred, back at z=0, front = +Z, bottom y=0)
// and dropped on its wall with place(): rot 0 = E wall (faces +y), -90 = S wall (faces -x), 180 = peninsula (faces -y).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KITCHEN as K, X, Y, WALLS, m } from '../dimensions.js';
import { MAT } from '../materials.js';
import { box, boxAt, cyl, place, group } from '../lib/build.js';

const PONY = WALLS.find((w) => w.id === 'pony');
const carcassH = K.baseH - K.toeKick;

/** Local-frame box: cx = centre along width, y0 = bottom, z0 = back face (inches). */
function lb(w, h, d, mat, name, cx = 0, y0 = 0, z0 = 0) {
  const b = box(w, h, d, mat, name);
  b.position.set(m(cx), m(y0 + h / 2), m(z0 + d / 2));
  return b;
}
/** Rounded box (appliance bodies), same local-frame convention. */
function rb(w, h, d, r, mat, name, cx = 0, y0 = 0, z0 = 0) {
  const b = new THREE.Mesh(new RoundedBoxGeometry(m(w), m(h), m(d), 3, m(r)), mat);
  b.position.set(m(cx), m(y0 + h / 2), m(z0 + d / 2));
  b.castShadow = b.receiveShadow = true;
  if (name) b.name = name;
  return b;
}
/** Bar along an axis ('x'|'y'|'z'), centred at (cx, cy, cz) local inches. */
function bar(r, len, axis, mat, cx, cy, cz, name) {
  const c = cyl(r, len, mat, name, 16);
  if (axis === 'x') c.rotation.z = Math.PI / 2;
  if (axis === 'z') c.rotation.x = Math.PI / 2;
  c.position.set(m(cx), m(cy), m(cz));
  return c;
}
function roundRect(path, x, y, w, h, r) {
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}
function canvasMap(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Brushed bar pull on two posts. Flagged for merging into one mesh (see mergeFlagged). */
function pull(vertical, cx, cy, zFace) {
  const P = K.pull, r = P.dia / 2, z = zFace + P.standoff - r;
  const parts = [bar(r, K.pullL, vertical ? 'y' : 'x', MAT.nickel, cx, cy, z)];
  for (const s of [-1, 1]) {
    const o = s * (K.pullL / 2 - P.postInset);
    parts.push(bar(r * 0.8, P.standoff - r, 'z', MAT.nickel, cx + (vertical ? 0 : o), cy + (vertical ? o : 0), zFace + (P.standoff - r) / 2));
  }
  parts.forEach((p) => { p.userData.merge = 'kitchen:pulls'; });
  return parts;
}

/**
 * Frameless slab cabinet. rows (top -> bottom): { h, n = doors across, kind: 'drawer'|'door'|'panel', sides: ['r','l'], pullAt: 'top'|'bottom' }.
 * Fronts are separate slabs with K.reveal gaps over a dark liner so the reveals read as shadow lines.
 */
function cabinet(name, w, h, d, rows, openTop = false) {
  const g = group(name);
  const cd = d - K.doorT, pt = K.doorT;
  if (openTop) { // sink base: panels only, so the bowl can hang inside and be seen through the counter cut-out
    g.add(group(`${name}:carcass`, [-1, 1].map((s) => lb(pt, h, cd - 0.05, MAT.cabinet, null, s * (w - pt) / 2, 0, 0)),
      lb(w - 2 * pt, pt, cd - 0.05, MAT.cabinet, null, 0, 0, 0), lb(w - 2 * pt, h - pt, pt, MAT.cabinet, null, 0, pt, 0)));
  } else g.add(lb(w, h, cd - 0.05, MAT.cabinet, `${name}:carcass`, 0, 0, 0));
  const liner = lb(w - 0.1, h - 0.1, 0.05, MAT.cabinetGap, null, 0, 0.05, cd - 0.05); // reveal shadow liner
  liner.userData.merge = 'kitchen:reveal-liners'; g.add(liner);
  let top = h, i = 0;
  for (const row of rows) {
    const n = row.n ?? 1, dw = w / n, y0 = top - row.h;
    for (let k = 0; k < n; k++) {
      const cx = -w / 2 + dw * (k + 0.5);
      g.add(lb(dw - K.reveal, row.h - K.reveal, K.doorT, MAT.cabinetDoor, `${name}:front${i++}`, cx, y0 + K.reveal / 2, cd));
      if (row.kind === 'drawer') g.add(...pull(false, cx, y0 + row.h / 2, d));
      if (row.kind === 'door') {
        const side = (row.sides ?? (n === 2 ? ['r', 'l'] : ['r']))[k];
        const px = cx + (side === 'r' ? 1 : -1) * (dw / 2 - K.pull.edge);
        const py = row.pullAt === 'bottom' ? y0 + K.pull.end + K.pullL / 2 : y0 + row.h - K.pull.end - K.pullL / 2;
        g.add(...pull(true, px, py, d));
      }
    }
    top = y0;
  }
  return g;
}
const baseCab = (name, w, rows) => cabinet(name, w, carcassH, K.baseD, rows);
const doorBase = (name, w, topKind) => cabinet(name, w, carcassH, K.baseD, [{ h: K.drawerH, kind: topKind }, { h: carcassH - K.drawerH, n: 2, kind: 'door', pullAt: 'top' }], topKind === 'panel');
const upperCab = (name, w, h, d, n, sides) => cabinet(name, w, h, d, [{ h, n, kind: 'door', pullAt: 'bottom', sides }]);

/** Collapse all meshes flagged userData.merge=<name> into one mesh per name (pulls = 70+ draw calls otherwise). */
function mergeFlagged(root) {
  root.updateMatrixWorld(true);
  const sets = {};
  root.traverse((o) => { if (o.isMesh && o.userData.merge) (sets[o.userData.merge] ??= []).push(o); });
  for (const [name, list] of Object.entries(sets)) {
    const merged = new THREE.Mesh(mergeGeometries(list.map((o) => o.geometry.clone().applyMatrix4(o.matrixWorld))), list[0].material);
    merged.name = name; merged.castShadow = merged.receiveShadow = true;
    list.forEach((o) => o.parent.remove(o));
    root.add(merged);
  }
}

// ------------------------------------------------------------------ counters
/** Quartz top from a plan polygon (inches) with eased (bevelled) edges; optional rounded sink cut-out. */
function counter(name, pts, hole) {
  const e = K.edgeR, s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(m(x), m(y))));
  if (hole) s.holes.push(roundRect(new THREE.Path(), m(hole.cx - hole.w / 2), m(hole.cy - hole.d / 2), m(hole.w), m(hole.d), m(hole.r)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: m(K.counterT - 2 * e), bevelEnabled: true, bevelThickness: m(e), bevelSize: m(e), bevelOffset: -m(e), bevelSegments: 3, curveSegments: 10 });
  const mesh = new THREE.Mesh(geo, MAT.quartz);
  mesh.rotation.x = Math.PI / 2; // shape y -> world z (plan y), extrusion -> down
  mesh.position.y = m(K.counterH - e);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

function sink() {
  const S = K.sink, g = group('kitchen:sink'), lip = 0.25, wall = 0.08, top = K.counterH - K.counterT;
  const outer = roundRect(new THREE.Shape(), m(-S.w / 2 - lip), m(-S.d / 2 - lip), m(S.w + 2 * lip), m(S.d + 2 * lip), m(S.r));
  // bowl floor: baked contact-shadow gradient toward the walls + faint drain-ward streaks (IMG_3948)
  const floorMat = MAT.sinkSteel.clone(); floorMat.name = 'sink-floor'; floorMat.color.set(0xffffff);
  floorMat.map = canvasMap(256, 192, (c, W, H) => {
    c.fillStyle = '#5f6268'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(0,0,0,${0.035 * (1 - i / 26)})`; c.lineWidth = 2 * (26 - i); c.strokeRect(0, 0, W, H); }
    for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '40,40,40'},0.022)`; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo((i * 97) % W, i % 2 ? 0 : H); c.stroke(); }
  });
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(outer, 10), floorMat);
  { const uv = floor.geometry.attributes.uv, fw = m(S.w + 2 * lip), fd = m(S.d + 2 * lip); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / fw + 0.5, uv.getY(i) / fd + 0.5); }
  outer.holes.push(roundRect(new THREE.Path(), m(-S.w / 2 - lip + wall), m(-S.d / 2 - lip + wall), m(S.w + 2 * (lip - wall)), m(S.d + 2 * (lip - wall)), m(S.r)));
  const walls = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: m(S.depth), bevelEnabled: false, curveSegments: 10 }), MAT.sinkSteel.clone());
  walls.material.color.multiplyScalar(0.92); // fake occlusion on the bowl walls
  walls.rotation.x = Math.PI / 2; walls.name = 'kitchen:sink:bowl';
  floor.rotation.x = -Math.PI / 2; floor.position.y = -m(S.depth - 0.05);
  const drain = cyl(1.75, 0.12, MAT.chrome, 'kitchen:sink:drain'); drain.position.y = -m(S.depth - 0.1);
  const hole = cyl(1.1, 0.14, MAT.blackPlastic); hole.position.y = -m(S.depth - 0.1);
  g.add(walls, floor, drain, hole);
  return place(g, S.cx, S.cy, top);
}

function faucet() {
  const F = K.faucet, g = group('kitchen:faucet');
  const col = cyl(F.colR, F.colH, MAT.chrome, 'kitchen:faucet:column', 32); col.position.y = m(F.colH / 2);
  const flange = cyl(F.colR + 0.3, 0.3, MAT.chrome); flange.position.y = m(0.15);
  const head = cyl(F.colR + 0.08, F.headH, MAT.chrome, null, 32); head.position.y = m(F.colH - F.headH / 2 + 0.01); // slightly fatter cartridge head
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(m(F.colR + 0.08), 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.chrome); capTop.scale.y = 0.2; capTop.position.y = m(F.colH);
  // spout: short stub with a flat aerator end, swivelled toward the bowl (local -Z = plan -y) and a little to +x (IMG_3949)
  const a = THREE.MathUtils.degToRad(F.spoutDropDeg), sp = cyl(F.spoutR, F.spoutL, MAT.chrome, 'kitchen:faucet:spout', 20);
  sp.rotation.x = -(Math.PI / 2 - a); sp.position.set(0, -m(Math.sin(a) * F.spoutL / 2), -m(Math.cos(a) * F.spoutL / 2));
  const swivel = group('', sp); swivel.rotation.y = -THREE.MathUtils.degToRad(F.swivelDeg); swivel.position.y = m(F.colH - F.headH - 1.2);
  // lever: thin rod out of the head, sideways and slightly up
  const lever = bar(0.17, F.leverL, 'x', MAT.chrome, F.colR + F.leverL / 2 - 0.1, F.colH - 0.9, 0); lever.rotation.z += 0.2;
  g.add(col, flange, head, capTop, swivel, lever);
  place(g, K.sink.cx, F.y, K.counterH);

  const ag = group('kitchen:airgap');
  const body = cyl(F.airGapR, F.airGapH, MAT.chrome, null, 24); body.position.y = m(F.airGapH / 2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(m(F.airGapR), 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.chrome); dome.scale.y = 0.5; dome.position.y = m(F.airGapH);
  const slot = lb(0.9, 0.5, 0.1, MAT.blackPlastic, null, 0, 0.5, -F.airGapR - 0.02);
  ag.add(body, dome, slot);
  place(ag, K.sink.cx + F.airGapDx, F.y, K.counterH);
  return [g, ag];
}

// ------------------------------------------------------------------ appliances
/** Vertical slab with a bowed (curved) front: GE fridge doors. Local frame, back of slab at z0. */
function bowed(w, h, t, bulge, mat, name, y0, z0) {
  const s = new THREE.Shape();
  s.moveTo(-m(w / 2), 0); s.lineTo(m(w / 2), 0); s.lineTo(m(w / 2), -m(t));
  s.quadraticCurveTo(0, -m(t + 2 * bulge), -m(w / 2), -m(t)); s.closePath();
  const b = 0.2, geo = new THREE.ExtrudeGeometry(s, { depth: m(h - 2 * b), bevelEnabled: true, bevelThickness: m(b), bevelSize: m(b), bevelOffset: -m(b), bevelSegments: 3, curveSegments: 24 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // shape -y -> +z (front), extrusion -> up
  mesh.position.set(0, m(y0 + b), m(z0));
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = name;
  return mesh;
}
function tubeHandle(pts, r, name) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(m(p[0]), m(p[1]), m(p[2]))), false, 'catmullrom', 0.15);
  const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, m(r), 12), MAT.applianceSteel);
  t.castShadow = true; t.name = name;
  return t;
}

function fridge() {
  const F = K.fridge, D = K.fridgeD, g = group('kitchen:fridge'), w = F.w;
  const caseH = F.h - D.hingeH, z1 = D.caseD + D.gap;
  const front = (x) => z1 + D.doorT + D.bulge * (1 - (2 * x / w) ** 2); // door face z at local x
  g.add(lb(w, caseH - 0.5, D.caseD, MAT.applianceCase, 'kitchen:fridge:case', 0, 0.5, 0));
  g.add(lb(w - 1, D.grille, 1, MAT.blackPlastic, 'kitchen:fridge:grille', 0, 0.5, D.caseD - 0.5));
  g.add(bowed(w, D.split - D.grille - 0.25, D.doorT, D.bulge, MAT.applianceSteel, 'kitchen:fridge:freezer', D.grille + 0.25, z1));
  g.add(bowed(w, caseH - D.split - 0.25, D.doorT, D.bulge, MAT.applianceSteel, 'kitchen:fridge:door', D.split + 0.25, z1));
  g.add(lb(5, D.hingeH, 3, MAT.applianceCase, 'kitchen:fridge:hinge', -w / 2 + 3, caseH, D.caseD - 1));
  // handles: bowed bars whose ends dive into the door (GE style). Door is hinged left, handle on the right.
  const hx = w / 2 - 3.2, hy1 = caseH - 6, hy0 = hy1 - D.handleL, zf = front(hx), o = D.handleOff;
  g.add(tubeHandle([[hx, hy0, zf - 0.3], [hx, hy0 + 1.2, zf + o * 0.8], [hx, hy0 + 3, zf + o], [hx, hy1 - 3, zf + o], [hx, hy1 - 1.2, zf + o * 0.8], [hx, hy1, zf - 0.3]], D.handleR, 'kitchen:fridge:handle-door'));
  const fy = D.split - 3.2, fw = D.freezerHandleW / 2, fz = (x) => front(x);
  g.add(tubeHandle([[-fw, fy, fz(fw) - 0.3], [-fw + 1.2, fy, fz(fw) + o * 0.8], [-fw + 3.5, fy, fz(fw - 3.5) + o], [0, fy, fz(0) + o], [fw - 3.5, fy, fz(fw - 3.5) + o], [fw - 1.2, fy, fz(fw) + o * 0.8], [fw, fy, fz(fw) - 0.3]], D.handleR, 'kitchen:fridge:handle-freezer'));
  const bx = -w / 2 + 4.5, badge = bar(D.badge / 2, 0.12, 'z', MAT.chrome, bx, caseH - 6.5, front(bx) - 0.02, 'kitchen:fridge:badge');
  g.add(badge);
  return place(g, F.x0 + w / 2, F.y0, 0, 0);
}

function range() {
  const R = K.range, D = K.rangeD, g = group('kitchen:range'), w = R.w, zf = D.bodyD;
  const topY = R.h - D.glassT;
  g.add(lb(w, topY - 1, D.bodyD, MAT.applianceCase, 'kitchen:range:body', 0, 1, 0));
  g.add(rb(w, D.glassT, K.counterD + 0.4, 0.15, MAT.blackGlass, 'kitchen:range:cooktop', 0, topY, 0));
  const rings = D.burners.map(([x, z, r]) => { const ring = new THREE.Mesh(new THREE.RingGeometry(m(r - 0.12), m(r), 48), MAT.burner); ring.rotation.x = -Math.PI / 2; ring.position.set(m(x), m(R.h + 0.02), m(z)); return ring; });
  g.add(group('kitchen:range:burners', rings));
  // front: storage drawer, oven door w/ window + bar handle, plain manifold strip under the cooktop lip
  g.add(rb(w, D.drawerTop - 1.5, D.doorT, 0.25, MAT.applianceSteel, 'kitchen:range:drawer', 0, 1.5, zf));
  g.add(rb(w, D.doorTop - D.drawerTop - 0.25, D.doorT, 0.25, MAT.applianceSteel, 'kitchen:range:door', 0, D.drawerTop + 0.25, zf));
  g.add(lb(w, topY - D.doorTop - 0.25, D.doorT - 0.6, MAT.applianceSteel, 'kitchen:range:manifold', 0, D.doorTop + 0.25, zf));
  const wy = (D.drawerTop + D.doorTop) / 2 - 1.5;
  g.add(rb(D.window[0], D.window[1], 0.1, 0.04, MAT.blackGlass, 'kitchen:range:window', 0, wy - D.window[1] / 2, zf + D.doorT - 0.04));
  const hy = D.doorTop - 2.2, hz = zf + D.doorT + D.handleOff - D.handleDia / 2;
  g.add(bar(D.handleDia / 2, w - 3, 'x', MAT.applianceSteel, 0, hy, hz, 'kitchen:range:handle'));
  for (const s of [-1, 1]) g.add(bar(D.handleDia / 2 * 0.9, D.handleOff, 'z', MAT.applianceSteel, s * (w / 2 - 3), hy, zf + D.doorT + D.handleOff / 2 - 0.2));
  g.add(bar(0.5, 0.1, 'z', MAT.chrome, 0, (1.5 + D.drawerTop) / 2, zf + D.doorT, 'kitchen:range:badge'));
  // backguard with clock panel + 4 knobs (knobs live on the backguard on this GE model — IMG_3946)
  g.add(rb(w, R.backguardH, D.backguardD, 0.3, MAT.applianceSteel, 'kitchen:range:backguard', 0, R.h, 0));
  g.add(lb(D.display[0], D.display[1], 0.1, MAT.blackGlass, 'kitchen:range:display', 0, R.h + (R.backguardH - D.display[1]) / 2, D.backguardD - 0.04));
  const knobs = [-12.2, -8.6, 8.6, 12.2].map((x) => bar(D.knobDia / 2, D.knobL, 'z', MAT.blackPlastic, x, R.h + R.backguardH / 2, D.backguardD + D.knobL / 2));
  g.add(group('kitchen:range:knobs', knobs));
  const [a, b] = K.southRun.range;
  return place(g, X.southInt, (a + b) / 2, 0, -90);
}

function microwave() {
  const M = K.microwave, D = K.mwD, g = group('kitchen:microwave'), w = M.w, zf = M.d - 0.6;
  g.add(lb(w, M.h, zf, MAT.applianceCase, 'kitchen:microwave:body', 0, 0, 0));
  g.add(lb(w, D.ventH, 0.5, MAT.blackPlastic, 'kitchen:microwave:vent', 0, M.h - D.ventH, zf));
  const doorH = M.h - D.ventH - 0.15, dcx = -w / 2 + D.doorW / 2;
  g.add(rb(D.doorW, doorH, 0.6, 0.2, MAT.applianceSteel, 'kitchen:microwave:door', dcx, 0, zf));
  g.add(lb(D.window[0], D.window[1], 0.08, MAT.blackGlass, 'kitchen:microwave:window', dcx - 1, (doorH - D.window[1]) / 2, M.d - 0.04));
  const pw = w - D.doorW - 0.15, keypad = new THREE.MeshStandardMaterial({ roughness: 0.35, name: 'microwave-keypad', map: canvasMap(128, 320, (c, W, H) => {
    c.fillStyle = '#0c0c0d'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0f2a18'; c.fillRect(14, 16, W - 28, 40); c.fillStyle = '#6dffa0'; c.font = 'bold 26px monospace'; c.fillText('6:18', 28, 46);
    c.fillStyle = '#3a3a3e'; for (let r = 0; r < 8; r++) for (let k = 0; k < 3; k++) c.fillRect(14 + k * 35, 74 + r * 29, 29, 21);
    c.fillStyle = '#9a9aa0'; c.font = '9px sans-serif'; for (let r = 0; r < 8; r++) for (let k = 0; k < 3; k++) c.fillText(r > 2 && r < 6 ? String((r - 3) * 3 + k + 1) : '—', 25 + k * 35, 88 + r * 29);
  }) });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(m(pw), m(doorH)), keypad); pad.position.set(m(w / 2 - pw / 2), m(doorH / 2), m(M.d + 0.005)); pad.name = 'kitchen:microwave:controls';
  g.add(lb(pw, doorH, 0.6, MAT.blackPlastic, null, w / 2 - pw / 2, 0, zf), pad);
  const hx = -w / 2 + D.doorW - 1.2, hz = M.d + D.handleOff - D.handleDia / 2;
  g.add(bar(D.handleDia / 2, D.handleL, 'y', MAT.applianceSteel, hx, doorH / 2, hz, 'kitchen:microwave:handle'));
  for (const s of [-1, 1]) g.add(bar(D.handleDia / 2 * 0.9, D.handleOff, 'z', MAT.applianceSteel, hx, doorH / 2 + s * (D.handleL / 2 - 0.8), M.d + D.handleOff / 2 - 0.2));
  const [a, b] = K.southRun.range;
  return place(g, X.southInt, (a + b) / 2, M.bottom, -90);
}

function dishwasher() {
  const D = K.dwD, g = group('kitchen:dishwasher'), [a, b] = K.peninsula.dw, top = K.baseH - 0.25;
  g.add(lb(D.w, top - 0.5, K.baseD - 1.5, MAT.applianceCase, 'kitchen:dishwasher:body', 0, 0.5, 0));
  g.add(lb(D.w, D.doorBottom - 0.5, 0.5, MAT.blackPlastic, 'kitchen:dishwasher:kick', 0, 0.5, K.baseD - K.kickRecess - 0.5));
  g.add(rb(D.w, top - D.controlH - D.doorBottom, 1.5, 0.2, MAT.applianceSteel, 'kitchen:dishwasher:door', 0, D.doorBottom, K.baseD - 1.5));
  g.add(rb(D.w, D.controlH - 0.1, 1.5, 0.2, MAT.blackPlastic, 'kitchen:dishwasher:controls', 0, top - D.controlH + 0.1, K.baseD - 1.5));
  g.add(lb(7, 1.1, 0.1, MAT.cabinetGap, 'kitchen:dishwasher:pocket-handle', 0, top - D.controlH / 2 - 0.9, K.baseD - 0.04));
  return place(g, (a + b) / 2, PONY.c, 0, 180);
}

function outlets() {
  const O = K.outlets, [pw, ph, pt] = O.plate;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, name: 'outlet-duplex', map: canvasMap(110, 180, (c, W, H) => {
    c.fillStyle = '#ecebe4'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#b9b7ad'; c.lineWidth = 2; roundRect(c, 30, 22, 50, 136, 18); c.stroke();
    c.fillStyle = '#3b3a36';
    for (const y of [48, 112]) { c.fillRect(42, y, 5, 16); c.fillRect(63, y, 5, 13); c.beginPath(); c.arc(55, y + 27, 4.5, 0, 7); c.fill(); }
    c.beginPath(); c.arc(55, 90, 3, 0, 7); c.fill();
  }) });
  return O.southY.map((y, i) => {
    const b = box(pt, ph, pw, [MAT.whitePlastic, mat, MAT.whitePlastic, MAT.whitePlastic, MAT.whitePlastic, MAT.whitePlastic], `kitchen:outlet-${i}`);
    b.geometry.attributes.uv.array.set([0, 1, 1, 1, 0, 0, 1, 0], 8); // -x face (toward the room): full 0..1 UVs for the plate art
    b.position.set(m(X.southInt - pt / 2), m(O.elev), m(y));
    b.castShadow = false;
    return b;
  });
}

// ------------------------------------------------------------------ assembly
export function build() {
  const root = group('kitchen');
  const xS = X.southInt, yE = Y.eastInt, P = K.peninsula, SR = K.southRun, [dbA, dbB] = K.eastRun.drawerBase;
  const faceS = xS - K.baseD, faceE = yE + K.baseD, faceP = PONY.c - K.baseD; // door-face planes of the three runs
  const mid = ([a, b]) => (a + b) / 2, len = ([a, b]) => b - a;

  // --- base cabinets
  const dh = (carcassH - K.drawerH) / 3;
  root.add(place(baseCab('kitchen:base-drawers', dbB - dbA, [{ h: K.drawerH, kind: 'drawer' }, { h: dh, kind: 'drawer' }, { h: dh, kind: 'drawer' }, { h: dh, kind: 'drawer' }]), (dbA + dbB) / 2, yE, K.toeKick, 0));
  root.add(place(doorBase('kitchen:base-s1', len(SR.base1), 'drawer'), xS, mid(SR.base1), K.toeKick, -90));
  root.add(place(doorBase('kitchen:base-s2', len(SR.base2), 'drawer'), xS, mid(SR.base2), K.toeKick, -90));
  root.add(place(doorBase('kitchen:base-sink', len(P.sinkBase), 'panel'), mid(P.sinkBase), PONY.c, K.toeKick, 180));
  // corner fillers: continue each door plane into the inside corners (blind corners behind)
  const t = K.doorT, fill = (x0, y0, w, d, n) => boxAt(x0, y0, K.toeKick, w, d, carcassH, MAT.cabinetDoor, `kitchen:filler-${n}`);
  root.add(group('kitchen:fillers',
    fill(dbB, faceE - t, faceS + t - dbB, t, 'e'), fill(faceS, faceE, t, SR.base1[0] - faceE, 'se'),
    fill(faceS, SR.base2[1], t, faceP - SR.base2[1], 'sp'), fill(P.sinkBase[1], faceP, faceS + t - P.sinkBase[1], t, 'p'),
    fill(X.stubB, faceP, P.dw[0] - X.stubB, t, 'dw')));
  // toe kicks (recessed), split around the range; the dishwasher brings its own
  const kd = K.baseD - K.kickRecess, kick = (x0, y0, w, d, n) => boxAt(x0, y0, 0, w, d, K.toeKick, MAT.toeKick, `kitchen:toekick-${n}`);
  root.add(group('kitchen:toekicks', kick(dbA, yE, xS - dbA, kd, 'e'), kick(xS - kd, yE + kd, kd, SR.range[0] - yE - kd, 's1'),
    kick(xS - kd, SR.range[1], kd, PONY.c - kd - SR.range[1], 's2'), kick(P.dw[1], PONY.c - kd, xS - P.dw[1], kd, 'p')));

  // --- counters (two L pieces either side of the range), splashes, pony-wall shim under the overhang
  const cf = xS - K.counterD, ce = yE + K.counterD, cp = PONY.c + PONY.t + P.overhang;
  root.add(counter('kitchen:counter-a', [[dbA, yE], [xS, yE], [xS, SR.range[0]], [cf, SR.range[0]], [cf, ce], [dbA, ce]]));
  root.add(counter('kitchen:counter-b', [[cf, SR.range[1]], [xS, SR.range[1]], [xS, cp], [X.stubB, cp], [X.stubB, Y.penA], [cf, Y.penA]], K.sink));
  const st = K.splashT, sh = K.backsplashH;
  root.add(boxAt(dbA, yE, K.counterH, xS - dbA - st, st, sh, MAT.quartz, 'kitchen:backsplash-e'));
  root.add(boxAt(xS - st, yE, K.counterH, st, SR.range[0] - yE, sh, MAT.quartz, 'kitchen:backsplash-s1'));
  root.add(boxAt(xS - st, SR.range[1], K.counterH, st, cp - SR.range[1], sh, MAT.quartz, 'kitchen:backsplash-s2'));
  root.add(boxAt(X.stubB, PONY.c, PONY.h, xS - X.stubB, PONY.t, K.counterH - K.counterT - PONY.h, MAT.wall, 'kitchen:pony-shim'));
  root.add(sink(), ...faucet());

  // --- uppers. Corner: E run stops at the S-run door plane, 1.5" fillers both ways.
  const uh = K.upperTop - K.upperBottom, ux = K.upperCornerX, uf = xS - ux, OF = K.overFridgeCab, fx0 = K.fridge.x0;
  const ug = 0.2, upper = (name, w, n, sides, x, y, rot, h = uh - ug, elev = K.upperBottom + ug, d = K.upperD) => place(upperCab(name, w, h, d, n, sides), x, y, elev, rot);
  root.add(upper('kitchen:upper-fridge', OF.w, 2, null, fx0 + OF.w / 2, yE, 0, OF.h, K.upperTop - OF.h, OF.d));
  const eA = fx0 + OF.w, eB = ux - K.upperFiller;
  root.add(upper('kitchen:upper-e', eB - eA, 2, null, (eA + eB) / 2, yE, 0));
  K.southUppers.forEach(([a, b, n, side], i) => root.add(upper(`kitchen:upper-s${i}`, b - a, n, side && [side], xS, (a + b) / 2, -90)));
  const mwTop = K.microwave.bottom + K.microwave.h;
  root.add(upper('kitchen:upper-micro', len(SR.range), 2, null, xS, mid(SR.range), -90, K.upperTop - mwTop, mwTop));
  const sA = K.southUppers[0][0], ufill = (x0, y0, w, d, n) => boxAt(x0, y0, K.upperBottom, w, d, uh, MAT.cabinetDoor, `kitchen:upper-filler-${n}`);
  root.add(ufill(eB, yE + K.upperD - t, ux + t - eB, t, 'e'), ufill(ux, yE + K.upperD, t, sA - yE - K.upperD, 's'));
  // undersides (the lighting item hangs its LED strips from these)
  const under = (x0, y0, w, d, n) => boxAt(x0, y0, K.upperBottom, w, d, ug, MAT.cabinet, `kitchen:undercab-${n}`);
  root.add(under(eA, yE, xS - eA, K.upperD - t, 'e'), under(ux + t, yE + K.upperD - t, uf - t, SR.range[0] - yE - K.upperD + t, 's1'),
    under(ux + t, SR.range[1], uf - t, K.southUppers.at(-1)[1] - SR.range[1], 's2'));

  // --- appliances + outlets
  root.add(fridge(), range(), microwave(), dishwasher(), ...outlets());
  mergeFlagged(root);
  return root;
}
