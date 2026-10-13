// all doors (entry, interior slab, louver, bypass closet) + casings, slider, bedroom window, blinds
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
//
// Every opening is built in a LOCAL FRAME (see frame()): +X runs along the wall from the opening's 'a' edge,
// +Z is the wall normal (plan +y for 'x' walls, plan -x for 'y' walls), origin on the wall centre-plane at the floor.
// Inside a frame, boxAt(x, z, elev, w, d, h) therefore reads "along, across, up". A side is a sign of local Z.
// Static detail (casings, jambs, hardware) is merged to one mesh per material to stay inside the draw-call budget;
// the parts critics measure (slabs, panels, frames, glass, valances, blinds) keep their own names.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENV, WALLS, ROOMS, DOORS, DOOR_HW as HW, SLIDER, BED_WINDOW, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { box, boxAt, cyl, group } from '../lib/build.js';

const EASE = 0.08; // eased arris on painted flat stock / vinyl extrusions, inches

// ---------------------------------------------------------------- helpers
function find(id) {
  for (const wall of WALLS) { const o = wall.openings.find((q) => q.id === id); if (o) return { wall, o }; }
  throw new Error(`openings: no wall opening "${id}"`);
}

function frame(wall, a, name) {
  const g = new THREE.Group(); g.name = name;
  const c = wall.c + wall.t / 2;
  if (wall.axis === 'x') g.position.set(m(a), 0, m(c));
  else { g.position.set(m(c), 0, m(a)); g.rotation.y = -Math.PI / 2; }
  return g;
}

/** Local-Z sign of the side of `wall` on which room `key` lies. */
function roomSide(wall, key) {
  const [x0, y0, x1, y1] = ROOMS[key].r, mid = wall.c + wall.t / 2;
  return wall.axis === 'x' ? Math.sign((y0 + y1) / 2 - mid) : -Math.sign((x0 + x1) / 2 - mid);
}

/** Rounded-edge box by local min corner (same argument order as boxAt, plus radius). */
function rboxAt(x0, z0, elev, w, d, h, mat, name, r = EASE) {
  const rr = Math.min(r, w / 2.01, d / 2.01, h / 2.01);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(rr)), mat);
  mesh.position.set(m(x0 + w / 2), m(elev + h / 2), m(z0 + d / 2));
  mesh.castShadow = mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

/** Four-sided rectangular frame (sash, screen, vinyl frame, mirror frame). Members: l/r stiles, t/b rails, inches. */
function rectFrame(x0, x1, e0, e1, z0, z1, { l, r, t, b }, mat) {
  const d = z1 - z0;
  return [
    rboxAt(x0, z0, e0, l, d, e1 - e0, mat), rboxAt(x1 - r, z0, e0, r, d, e1 - e0, mat),
    rboxAt(x0 + l, z0, e1 - t, x1 - x0 - l - r, d, t, mat), b ? rboxAt(x0 + l, z0, e0, x1 - x0 - l - r, d, b, mat) : null,
  ];
}

/** Collapse parts into one mesh per material. Parts lose their identity; the result is a named group. */
function merged(name, ...parts) {
  const holder = new THREE.Group();
  parts.flat(Infinity).filter(Boolean).forEach((p) => holder.add(p));
  holder.updateMatrixWorld(true);
  const by = new Map();
  holder.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  const out = group(name);
  for (const [mat, gs] of by) {
    const mesh = new THREE.Mesh(mergeGeometries(gs), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `${name}:${mat.name}`;
    out.add(mesh);
  }
  return out;
}

function pane(x0, x1, e0, e1, z, name) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(m(x1 - x0), m(e1 - e0)), MAT.glassPane);
  p.position.set(m((x0 + x1) / 2), m((e0 + e1) / 2), m(z));
  p.name = name; p.renderOrder = 2; // glass never casts a shadow: the sun must come through
  return p;
}
function screenMesh(x0, x1, e0, e1, z, name) {
  const p = pane(x0, x1, e0, e1, z, name); p.material = MAT.insectScreen; p.renderOrder = 1; return p;
}

// ---------------------------------------------------------------- casings + jambs
/** How much of the casing width fits beside `edge` before a perpendicular wall gets in the way (plan geometry). */
function casingRoom(wall, edge, dir, f, cw, ct) {
  const planSign = wall.axis === 'x' ? f : -f;
  const face = planSign > 0 ? wall.c + wall.t : wall.c;
  const band = [Math.min(face, face + planSign * ct), Math.max(face, face + planSign * ct)];
  let room = cw;
  for (const o of WALLS) {
    if (o === wall || (o.h ?? ENV.ceiling) < ENV.door.h) continue;
    const thick = [o.c, o.c + o.t], run = [o.a, o.b];
    const [along, across] = o.axis === wall.axis ? [run, thick] : [thick, run];
    if (across[0] >= band[1] - 0.01 || across[1] <= band[0] + 0.01) continue;
    const gap = dir > 0 ? along[0] - edge : edge - along[1];
    if (gap > -0.01) room = Math.min(room, gap);
  }
  return Math.max(0, room);
}

/** Flat casing (two legs + head) on face f of an opening, clipped where a side wall crowds it. */
function casing(wall, o, f, { cw = ENV.door.casing, ct = ENV.door.casingT, mat = MAT.trim } = {}) {
  const W = o.b - o.a, z0 = f > 0 ? wall.t / 2 : -wall.t / 2 - ct;
  const ra = casingRoom(wall, o.a, -1, f, cw, ct), rb = casingRoom(wall, o.b, 1, f, cw, ct), min = 0.4, tuck = 0.02;
  const la = ra > min ? ra - tuck : 0, lb = rb > min ? rb - tuck : 0;
  return [
    la && rboxAt(-la, z0, o.sill, la, ct, o.head - o.sill, mat),
    lb && rboxAt(W, z0, o.sill, lb, ct, o.head - o.sill, mat),
    rboxAt(-la, z0, o.head, W + la + lb, ct, cw, mat),
  ];
}

/** Thin lining over the cut wall faces of an opening between local z0..z1 (jambs + head). */
function jambSkin(W, e0, head, z0, z1, mat = MAT.trim, T = HW.jambT) {
  const d = z1 - z0;
  return [boxAt(0, z0, e0, T, d, head - e0, mat), boxAt(W - T, z0, e0, T, d, head - e0, mat), boxAt(T, z0, head - T, W - 2 * T, d, T, mat)];
}

// ---------------------------------------------------------------- hardware
function zCyl(r, h, mat, x, elev, z) { const c = cyl(r, h, mat); c.rotation.x = Math.PI / 2; c.position.set(m(x), m(elev), m(z)); return c; }

/** Lever on one door face: rose, neck, lever blade pointing `toward` (±1 along local X). n = face normal sign. */
function leverSet(x, elev, zFace, n, toward) {
  const L = HW.lever;
  return [
    zCyl(L.roseR, L.roseT, MAT.nickel, x, elev, zFace + (n * L.roseT) / 2),
    zCyl(L.neckR, L.proj, MAT.nickel, x, elev, zFace + (n * L.proj) / 2),
    rboxAt(toward > 0 ? x - L.h / 2 : x + L.h / 2 - L.len, zFace + n * (L.proj - L.t / 2) - L.t / 2, elev - L.h / 2, L.len, L.t, L.h, MAT.nickel, null, 0.22),
  ];
}

// ---------------------------------------------------------------- hinged doors
const CASED = { entry: 'in', bathDoor: 'both', bedDoor: 'both', wdDoor: 'swing', linenDoor: 'swing' };

function hingedDoor(id) {
  const D = DOORS[id], { wall, o } = find(id), W = o.b - o.a, t = wall.t, H = o.head;
  const s = roomSide(wall, D.swingInto), dir = D.hinge === 'a' ? 1 : -1;
  const entry = D.type === 'slab-entry', louver = D.type === 'louver';
  const T = entry ? HW.entry.slabT : ENV.door.slabT, jT = HW.jambT, gap = HW.gap, pin = HW.pinOut;
  const g = frame(wall, o.a, `door:${id}`);

  // fixed trim
  const stopZ = s > 0 ? t / 2 - T - 0.05 - HW.stop.w : -t / 2 + T + 0.05;
  const trim = [casing(wall, o, s), CASED[id] === 'both' && casing(wall, o, -s)];
  if (entry) {
    const E = HW.entry, split = t / 2 - T - HW.stop.w; // corridor-painted reveal up to the stop, white inside
    trim.push(jambSkin(W, 0, H, -t / 2 - 0.01, split, MAT.corridorTrim), jambSkin(W, 0, H, split, t / 2 + 0.01));
    trim.push(casing(wall, o, -s, { cw: E.corridorCasing.w, ct: E.corridorCasing.t, mat: MAT.corridorTrim }));
    trim.push(boxAt(jT, -t / 2 - E.threshold.out, 0, W - 2 * jT, t - T + E.threshold.out + 0.4, E.threshold.h, MAT.nickel));
    trim.push(entrySidePanel(W, t));
  } else trim.push(jambSkin(W, 0, H, -t / 2 - 0.01, t / 2 + 0.01));
  trim.push(jambSkin(W, 0, H, stopZ, stopZ + HW.stop.w, MAT.trim, HW.stop.t)); // door stop bead
  g.add(merged(`door:${id}:trim`, trim));

  // leaf, pivoting on the hinge pin (pin stands `pin` proud of the wall face so an open leaf clears the casing)
  const leaf = group(`door:${id}:leaf`);
  leaf.position.set(m(dir > 0 ? jT : W - jT), 0, m(s * (t / 2 + pin)));
  leaf.rotation.y = THREE.MathUtils.degToRad(-s * dir * D.openDeg);
  const L = W - 2 * jT - 2 * gap, xa = dir > 0 ? gap : -gap - L, za = s > 0 ? -pin - T : pin;
  const e0 = entry ? HW.entry.undercut : HW.undercut, e1 = H - jT - gap;
  if (louver) leaf.add(...louverLeaf(id, xa, L, za, T, e0, e1));
  else if (entry) { // corridor face + edges taupe-gray (IMG_3952), room face white (A6). Box face order: +x -x +y -y +z -z
    const G = MAT.entryDoor, slab = boxAt(xa, za, e0, L, T, e1 - e0, [G, G, G, G, s > 0 ? MAT.door : G, s > 0 ? G : MAT.door], `door:${id}:slab`);
    leaf.add(slab);
  } else leaf.add(rboxAt(xa, za, e0, L, T, e1 - e0, MAT.door, `door:${id}:slab`));

  const lx = dir * (gap + L - HW.lever.backset), lev = louver ? HW.louver.leverElev : HW.lever.elev;
  const zOut = -s * pin, zIn = -s * (pin + T);
  const hw = [leverSet(lx, lev, zOut, s, -dir), leverSet(lx, lev, zIn, -s, -dir)];
  for (const e of HW.hinge.elevs) { const k = cyl(HW.hinge.r, HW.hinge.h, MAT.nickel); k.position.set(0, m(e + HW.hinge.h / 2), 0); hw.push(k); }
  if (entry) hw.push(entryHardware(lx, zOut, zIn, s, xa + L / 2));
  leaf.add(merged(`door:${id}:hardware`, hw));
  g.add(leaf);
  if (D.toggle) swingToggle(g, leaf, THREE.MathUtils.degToRad(-s * dir * D.openDeg), D.toggle);
  return g;
}

/** Clickable door (dollhouse/plan click, or the walk-mode action key): swings the leaf between shut and its open angle. */
function swingToggle(g, leaf, openRad, what) {
  let target = null; // null = leave the leaf where the module / a ?shot= pose put it
  const isOpen = () => Math.abs(target ?? leaf.rotation.y) > 0.01;
  const label = () => { g.userData.actionLabel = `${isOpen() ? 'Close' : 'Open'} the ${what}`; };
  g.userData.onClick = () => { target = isOpen() ? 0 : openRad; label(); };
  leaf.userData.tick = (dt) => {
    if (target === null) return;
    const d = target - leaf.rotation.y;
    if (Math.abs(d) > 1e-4) leaf.rotation.y += Math.sign(d) * Math.min(Math.abs(d), dt * 2.4); // ~0.7 s for a full swing
  };
  label();
}

/** Full-louver leaf (IMG_3945): stiles + three rails, two panels of fixed slats as one InstancedMesh. */
function louverLeaf(id, xa, L, za, T, e0, e1) {
  const V = HW.louver, [mr0, mr1] = V.midRail, inner = L - 2 * V.stile;
  const railAt = (lo, hi) => rboxAt(xa + V.stile, za, lo, inner, T, hi - lo, MAT.door);
  const body = merged(`door:${id}:slab`, rboxAt(xa, za, e0, V.stile, T, e1 - e0, MAT.door), rboxAt(xa + L - V.stile, za, e0, V.stile, T, e1 - e0, MAT.door),
    railAt(e0, e0 + V.botRail), railAt(mr0, mr1), railAt(e1 - V.topRail, e1));
  const rows = [];
  for (const [lo, hi] of [[e0 + V.botRail, mr0], [mr1, e1 - V.topRail]]) for (let e = lo + V.pitch / 2; e < hi; e += V.pitch) rows.push(e);
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(m(inner + 0.3), m(V.slatT), m(V.slatW)), MAT.door, rows.length);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(V.tiltDeg)), one = new THREE.Vector3(1, 1, 1);
  rows.forEach((e, i) => slats.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(m(xa + L / 2), m(e), m(za + T / 2)), q, one)));
  slats.name = `door:${id}:louvers`; slats.castShadow = slats.receiveShadow = true;
  return [body, slats];
}

/** Smart deadbolt (corridor keypad escutcheon + interior thumb-turn), knocker with viewer. Leaf-local coords. */
function entryHardware(lx, zOut, zIn, s, xMid) {
  const E = HW.entry, B = E.deadbolt, K = E.knocker, out = [];
  // corridor side (= zIn face, normal -s)
  const zc = (d) => zIn - s * d; // d inches proud of the corridor face
  out.push(rboxAt(lx - B.w / 2, Math.min(zc(0), zc(B.t)), E.deadboltElev - B.h / 2, B.w, B.t, B.h, MAT.nickel, null, 0.45));
  out.push(zCyl(B.w * 0.36, 0.12, MAT.blackGlass, lx, E.deadboltElev + B.h / 2 - B.w / 2, zc(B.t + 0.04)));
  out.push(rboxAt(xMid - K.w / 2, Math.min(zc(0), zc(0.3)), E.knockerElev - K.h / 2, K.w, 0.3, K.h, MAT.nickel, null, 0.12));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(m(K.w * 0.42), m(0.13), 8, 20, Math.PI), MAT.nickel);
  ring.rotation.z = Math.PI; ring.position.set(m(xMid), m(E.knockerElev + K.h * 0.1), m(zc(0.55))); out.push(ring);
  out.push(zCyl(0.3, 0.2, MAT.blackGlass, xMid, E.knockerElev + K.h * 0.3, zc(0.36)));
  // room side: thumb-turn housing + door viewer
  const zr = (d) => zOut + s * d;
  out.push(rboxAt(lx - B.w / 2, Math.min(zr(0), zr(1.2)), E.deadboltElev - B.h / 2, B.w, 1.2, B.h, MAT.nickel, null, 0.4));
  out.push(rboxAt(lx - 0.3, Math.min(zr(1.2), zr(1.9)), E.deadboltElev - 1.1, 0.6, 0.7, 1.6, MAT.nickel, null, 0.2));
  out.push(zCyl(0.45, 0.3, MAT.nickel, xMid, E.knockerElev + K.h * 0.3, zr(0.15)));
  return out;
}

/** Corridor-side panelled sidelight filler with the unit plaque (IMG_3952), beside the latch jamb. Frame-local coords. */
function entrySidePanel(W, t) {
  const P = HW.entry.sidePanel, C = HW.entry.corridorCasing, x0 = W + C.w, z1 = -t / 2, raise = 0.4;
  const parts = [boxAt(x0, z1 - C.t + raise, 0, P.w, C.t - raise, P.h, MAT.corridorTrim)];
  parts.push(rectFrame(x0, x0 + P.w, 0, P.h, z1 - C.t, z1 - C.t + raise, { l: P.stile, r: P.stile, t: P.stile, b: P.stile }, MAT.corridorTrim));
  parts.push(rboxAt(x0 + P.stile, z1 - C.t, P.midRail, P.w - 2 * P.stile, raise, P.stile, MAT.corridorTrim));
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#0c0c0d'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f2f2f0'; ctx.font = '600 34px Helvetica, Arial, sans-serif'; ctx.fillText('113', 12, 42); // A9: plaque reads 113
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map, roughness: 0.35, name: 'unit-plaque' });
  const plaque = boxAt(x0 + (P.w - P.plaque) / 2, z1 - C.t + raise - 0.3, P.plaqueElev, P.plaque, 0.3, P.plaque, MAT.blackPlastic);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(m(P.plaque), m(P.plaque)), face);
  label.rotation.y = Math.PI; label.position.copy(plaque.position); label.position.z -= m(0.16);
  return [parts, plaque, label];
}

// ---------------------------------------------------------------- bypass closet doors
function bypassDoors(id, roomKey, mirror) {
  const { wall, o } = find(id), W = o.b - o.a, t = wall.t, H = o.head, f = roomSide(wall, roomKey);
  const B = HW.bypass, M = B.mirror, jT = HW.jambT, floor = ROOMS[roomKey].floor === 'carpet' ? B.carpetT : 0;
  const pT = mirror ? M.panelT : B.panelT, pw = (W - 2 * jT + (mirror ? M.overlap : B.overlap)) / 2;
  const g = frame(wall, o.a, `door:${id}`);
  const trackD = mirror ? M.trackD : B.trackD, trackTop = H - jT, e0 = floor + (mirror ? M.botTrackH + 0.1 : HW.undercut), e1 = trackTop - B.trackH - 0.05;
  const trim = [casing(wall, o, f), jambSkin(W, 0, H, -t / 2 - 0.01, t / 2 + 0.01),
    rboxAt(jT, -trackD / 2, trackTop - B.trackH, W - 2 * jT, trackD, B.trackH, MAT.trim)];
  if (mirror) trim.push(boxAt(jT, -trackD / 2, floor, W - 2 * jT, trackD, M.botTrackH, MAT.trim));
  const zFront = f > 0 ? B.trackGap : -B.trackGap - pT, zRear = f > 0 ? -B.trackGap - pT : B.trackGap; // room-side / closet-side track

  if (!mirror) { // two white slabs on a double top track, flush cup pulls at the outer edges; slide to open one half (DOORS[id].open)
    const cupZ = (z) => z + (f > 0 ? pT : 0) + f * 0.03;
    const slab = (x0, z0, name) => group(name, rboxAt(x0, z0, e0, pw, pT, e1 - e0, MAT.door, `${name}:slab`), zCyl(B.pullR, 0.12, MAT.nickel, x0 + (x0 < W / 2 ? B.pullInset : pw - B.pullInset), B.pullElev, cupZ(z0)));
    const front = slab(jT, zFront, `door:${id}:panelFront`), rear = slab(W - jT - pw, zRear, `door:${id}:panelRear`);
    g.add(front, rear);
    // 'a'/'b' = which end of the opening stands open. Seen from the room side the 'b' end is on the viewer's left when f < 0.
    const side = (v) => (v === 'closed' ? 'closed' : (v === 'left') === (f < 0) ? 'b' : 'a');
    const shift = W - 2 * jT - pw, X = { closed: [0, 0], a: [shift, 0], b: [0, -shift] }; // [front, rear] offsets
    const order = ['left', 'right', 'closed'], label = { left: 'left half open', right: 'right half open', closed: 'closed' };
    let state = DOORS[id].open ?? 'closed', target = X[side(state)];
    const apply = () => { front.position.x = m(target[0]); rear.position.x = m(target[1]); };
    apply();
    g.userData.setBypass = (v) => { state = v; target = X[side(v)]; apply(); g.userData.actionLabel = actionText(); }; // instant (shots)
    const actionText = () => `Slide the ${DOORS[id].toggle ?? 'closet doors'} (now ${label[state]})`;
    if (DOORS[id].toggle) {
      g.userData.onClick = () => { state = order[(order.indexOf(state) + 1) % order.length]; target = X[side(state)]; g.userData.actionLabel = actionText(); };
      front.userData.tick = (dt) => { // ease both panels toward their target along the track
        for (const [p, t] of [[front, target[0]], [rear, target[1]]]) { const d = m(t) - p.position.x; p.position.x += Math.sign(d) * Math.min(Math.abs(d), dt * 0.9); }
      };
      g.userData.actionLabel = actionText();
    }
  } else { // IMG_3937: both mirror panels parked at the 'b' (living-wall) end, the 'a' half of the closet standing open
    const panel = (x0, z0, name, reflect) => {
      const back = pT - 0.25, zb = f > 0 ? z0 : z0 + 0.25, p = group(name);
      p.add(merged(`${name}:frame`, boxAt(x0, zb, e0, pw, back, e1 - e0, MAT.door),
        rectFrame(x0, x0 + pw, e0, e1, z0, z0 + pT, { l: M.stile, r: M.stile, t: M.stile, b: M.stile }, MAT.trim)));
      const mw = pw - 2 * M.stile, mh = e1 - e0 - 2 * M.stile, geo = new THREE.PlaneGeometry(m(mw), m(mh));
      let glass;
      if (reflect) {
        glass = new Reflector(geo, { textureWidth: 768, textureHeight: 1536, color: 0xb6bcb9, clipBias: 0.003, multisample: 4 });
        const render = glass.onBeforeRender; // skip the AO pass's override render: one extra scene draw per frame, not two
        glass.onBeforeRender = function (r, sc, cam) { if (!sc.overrideMaterial) render.call(this, r, sc, cam); };
      } else glass = new THREE.Mesh(geo, MAT.mirror);
      if (f < 0) glass.rotation.y = Math.PI;
      glass.position.set(m(x0 + pw / 2), m((e0 + e1) / 2), m(f > 0 ? zb + back + 0.02 : zb - 0.02));
      glass.name = `${name}:mirror`;
      p.add(glass);
      return p;
    };
    g.add(panel(W - jT - pw, zFront, `door:${id}:panelFront`, true), panel(W - jT - pw - M.peek, zRear, `door:${id}:panelRear`, false));
  }
  g.add(merged(`door:${id}:trim`, trim));
  return g;
}

// ---------------------------------------------------------------- sliding glass door
function slider() {
  const { wall, o } = find('slider'), S = SLIDER, W = o.b - o.a, t = wall.t, H = o.head, fw = S.frame, sa = S.sash;
  const inside = roomSide(wall, 'living'), g = frame(wall, o.a, 'slider');
  if (inside !== -1) throw new Error('openings: slider expects the living room on local -Z');
  const zf0 = t / 2 - S.frameD + 0.5, zf1 = t / 2 + 0.5; // vinyl frame sits to the exterior, nail-fin proud of the stucco
  g.add(merged('slider:frame', rectFrame(0, W, 0, H, zf0, zf1, { l: fw, r: fw, t: fw, b: 0 }, MAT.vinylFrame),
    boxAt(fw, zf0, 0, W - 2 * fw, S.frameD, S.sillH, MAT.vinylFrame), // sill track
    boxAt(fw, zf0 + 1.55, S.sillH, W - 2 * fw, 0.25, 0.5, MAT.vinylFrame))); // track rib between the panels
  g.add(merged('slider:casing', casing(wall, o, inside), jambSkin(W, 0, H, -t / 2 - 0.01, zf0)));

  // two sashes: fixed on the outer track at the 'b' (S) end, operable on the inner track at the 'a' end (IMG_3925)
  const pw = (W - 2 * fw + sa.overlap) / 2, e0 = S.sillH, e1 = H - fw, members = { l: sa.stile, r: sa.stile, t: sa.top, b: sa.bottom };
  const sash = (name, x0, z0) => {
    const p = group(name, merged(`${name}:sash`, rectFrame(x0, x0 + pw, e0, e1, z0, z0 + sa.t, members, MAT.vinylFrame)));
    p.add(pane(x0 + sa.stile, x0 + pw - sa.stile, e0 + sa.bottom, e1 - sa.top, z0 + sa.t / 2, `${name}:glass`));
    return p;
  };
  const zInner = zf0 + 0.1, zOuter = zInner + sa.t + 0.3;
  const operable = sash('slider:panelOperable', fw, zInner), P = S.pull, px = fw + pw - sa.stile / 2;
  operable.add(merged('slider:pull', rboxAt(px - P.w / 2, zInner - 0.3, P.elev, P.w, 0.3, P.h, MAT.vinylFrame, null, 0.12),
    rboxAt(px - 0.35, zInner - P.proj, P.elev + 1.2, 0.7, 0.5, P.h - 2.4, MAT.vinylFrame, null, 0.2),
    rboxAt(px - 0.35, zInner - P.proj, P.elev + 1.2, 0.7, P.proj - 0.2, 0.7, MAT.vinylFrame, null, 0.2),
    rboxAt(px - 0.35, zInner - P.proj, P.elev + P.h - 1.9, 0.7, P.proj - 0.2, 0.7, MAT.vinylFrame, null, 0.2)));
  g.add(operable, sash('slider:panelFixed', W - fw - pw, zOuter));

  // insect screen on the outermost track over the operable half
  const sc = S.screen, zs = zf1 - sc.t - 0.1, scr = group('slider:screen',
    merged('slider:screen:frame', rectFrame(fw, fw + pw, e0, e1, zs, zs + sc.t, { l: sc.frame, r: sc.frame, t: sc.frame, b: sc.frame }, MAT.vinylFrame)),
    screenMesh(fw + sc.frame, fw + pw - sc.frame, e0 + sc.frame, e1 - sc.frame, zs + sc.t / 2, 'slider:screen:mesh'));
  g.add(scr);

  // cornice valance (returns to the wall, stepped crown) + vertical blinds stacked open at the 'a' end
  const V = S.valance, vx0 = V.x0 - o.a, vx1 = V.x1 - o.a, zw = -t / 2, bt = V.boardT, vw = vx1 - vx0;
  const step = (proj, h) => { // one tier of the built-up crown: front strip + two mitred-looking end returns
    const top = V.elev + V.h;
    return [rboxAt(vx0 - proj, zw - V.d - proj, top - h, vw + 2 * proj, proj + 0.1, h, MAT.trim),
      rboxAt(vx0 - proj, zw - V.d, top - h, proj + 0.1, V.d, h, MAT.trim), rboxAt(vx1 - 0.1, zw - V.d, top - h, proj + 0.1, V.d, h, MAT.trim)];
  };
  g.add(merged('slider:valance', rboxAt(vx0, zw - V.d, V.elev, vw, bt, V.h, MAT.trim), rboxAt(vx0, zw - V.d, V.elev, bt, V.d, V.h, MAT.trim),
    rboxAt(vx1 - bt, zw - V.d, V.elev, bt, V.d, V.h, MAT.trim), boxAt(vx0, zw - V.d, V.elev + V.h - bt, vw, V.d, bt, MAT.trim),
    step(0.45, 1.9), step(0.95, 0.9)));
  const zv = zw - (V.d + bt) / 2 - 0.1, [bs0, bs1] = S.blindsStack, n = S.vanes, r = rng(41);
  const rail = boxAt(vx0 + bt + 0.5, zv - 0.6, S.vaneTop, vw - 2 * bt - 1, 1.2, 1.3, MAT.whitePlastic, 'slider:blinds:headrail');
  // Gathered vanes read as an accordion of overlapping PVC edges: one pleated extrusion (sawtooth front + back in plan)
  // instead of 34 paper-thin boxes, which only produced shadow-map / AO speckle at room distance.
  const vaneH = S.vaneTop - S.vaneBottom, pitch = (bs1 - bs0) / n, x0 = bs0 - o.a, zF = zv - S.vaneW / 2, zB = zv + S.vaneW / 2, tooth = S.vanePleat;
  const pts = [];
  for (let i = 0; i < n; i++) { const j = (r() - 0.5) * 0.12; pts.push([x0 + i * pitch, zF + tooth + j], [x0 + (i + 0.85) * pitch, zF + j]); }
  for (let i = n - 1; i >= 0; i--) pts.push([x0 + (i + 0.85) * pitch, zB - tooth], [x0 + i * pitch, zB]);
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(m(x), -m(z)))); // shape y = -local z (see rotateX below)
  const vanes = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: m(vaneH), bevelEnabled: false }).rotateX(-Math.PI / 2), MAT.blinds);
  vanes.position.y = m(S.vaneBottom);
  vanes.name = 'slider:blinds:vanes'; vanes.castShadow = vanes.receiveShadow = true;
  g.add(group('slider:blinds', rail, vanes));
  return g;
}

// ---------------------------------------------------------------- bedroom window (XO vinyl slider, drywall returns, raised blind)
function bedWindow() {
  const { wall, o } = find('bedWindow'), B = BED_WINDOW, W = o.b - o.a, t = wall.t, fw = B.frame, g = frame(wall, o.a, 'bedWindow');
  const zf0 = t / 2 - B.frameD + 0.25, zf1 = t / 2 + 0.25, e0 = o.sill, e1 = o.head, mid = W / 2, ml = B.mullion;
  g.add(merged('bedWindow:frame', rectFrame(0, W, e0, e1, zf0, zf1, { l: fw, r: fw, t: fw, b: fw }, MAT.vinylFrame),
    rboxAt(mid - ml / 2, zf0 + B.sashT + 0.3, e0 + fw, ml, B.frameD - B.sashT - 0.5, e1 - e0 - 2 * fw, MAT.vinylFrame))); // fixed meeting stile
  // O: fixed lite at the 'a' (N) half glazed straight into the frame; X: operable sash on the inner track at the 'b' half (IMG_3936)
  g.add(pane(fw, mid - ml / 2, e0 + fw, e1 - fw, zf1 - 0.9, 'bedWindow:glassFixed'));
  const sx0 = mid - ml / 2, sx1 = W - fw, zs = zf0 + 0.15, sw = B.sash;
  const sash = group('bedWindow:sash', merged('bedWindow:sash:frame', rectFrame(sx0, sx1, e0 + fw, e1 - fw, zs, zs + B.sashT, { l: sw, r: sw, t: sw, b: sw }, MAT.vinylFrame),
    rboxAt(sx0 + 0.2, zs - 0.35, (e0 + e1) / 2 - 1.2, sw - 0.4, 0.35, 2.4, MAT.vinylFrame, null, 0.12)), // cam latch
  pane(sx0 + sw, sx1 - sw, e0 + fw + sw, e1 - fw - sw, zs + B.sashT / 2, 'bedWindow:glassSash'));
  g.add(sash, screenMesh(mid, W - fw, e0 + fw, e1 - fw, zf1 - 0.2, 'bedWindow:screen'));
  // painted sill board over the bottom drywall return (returns themselves are the shell's cut wall faces)
  g.add(rboxAt(0.02, -t / 2 - 0.03, e0, W - 0.04, zf0 + t / 2 + 0.03, 0.3, MAT.trim, 'bedWindow:sill', 0.12));

  // faux-wood blind, fully raised: outside-mount valance with returns, head rail, slat stack, bottom rail, pull cords
  const V = { ...B.blindValance, w: W + 2 * B.blindValance.overhang, elev: e1 - B.blindValance.drop }, L = B.blind, bx0 = (W - V.w) / 2, zw = -t / 2, slatLen = V.w - 1.5, stackTop = V.elev + 1;
  const blind = group('bedWindow:blind', merged('bedWindow:blind:valance', rboxAt(bx0, zw - V.d, V.elev, V.w, 0.45, V.h, MAT.blinds, null, 0.2),
    rboxAt(bx0, zw - V.d, V.elev, 0.45, V.d, V.h, MAT.blinds), rboxAt(bx0 + V.w - 0.45, zw - V.d, V.elev, 0.45, V.d, V.h, MAT.blinds),
    boxAt(bx0 + 0.6, zw - V.d + 0.5, stackTop, V.w - 1.2, V.d - 0.6, V.h - 1.2, MAT.whitePlastic)));
  const slats = new THREE.InstancedMesh(new RoundedBoxGeometry(m(slatLen), m(L.slatPitch * 0.8), m(L.slatW), 1, m(0.04)), MAT.blinds, L.slats);
  const mtx = new THREE.Matrix4(), r = rng(43), zc = zw - V.d / 2 - 0.1;
  for (let i = 0; i < L.slats; i++) slats.setMatrixAt(i, mtx.makeTranslation(m(W / 2 + (r() - 0.5) * 0.15), m(stackTop - (i + 0.5) * L.slatPitch), m(zc + (r() - 0.5) * 0.1)));
  slats.name = 'bedWindow:blind:slats'; slats.castShadow = slats.receiveShadow = true;
  const railTop = stackTop - L.slats * L.slatPitch;
  blind.add(slats, rboxAt((W - slatLen) / 2, zc - L.slatW / 2, railTop - L.railH, slatLen, L.slatW, L.railH, MAT.blinds, 'bedWindow:blind:bottomRail', 0.15));
  const cords = [];
  for (const dx of [0, 0.7]) { // lift cords + tassels at the 'b' end (left in IMG_3936)
    const cx = W / 2 + slatLen / 2 - 3 - dx, drop = L.cordDrop + dx * 4, c = cyl(0.04, drop, MAT.blinds, null, 6);
    c.position.set(m(cx), m(V.elev - drop / 2), m(zc - L.slatW / 2 - 0.15));
    const tassel = cyl(0.22, 1.1, MAT.blinds, null, 10); tassel.position.set(m(cx), m(V.elev - drop - 0.5), m(zc - L.slatW / 2 - 0.15));
    cords.push(c, tassel);
  }
  blind.add(merged('bedWindow:blind:cords', cords));
  g.add(blind);
  return g;
}

// ---------------------------------------------------------------- assembly
export function build() {
  const g = group('openings');
  for (const [id, D] of Object.entries(DOORS)) {
    if (D.type === 'bypass-slab') g.add(bypassDoors(id, 'dining', false));
    else if (D.type === 'bypass-mirror') g.add(bypassDoors(id, 'bedroom', true));
    else g.add(hingedDoor(id));
  }
  g.add(slider(), bedWindow());
  g.traverse((o) => { if (o.material === MAT.glassPane || o.material === MAT.insectScreen) o.castShadow = o.receiveShadow = false; });
  return g;
}
