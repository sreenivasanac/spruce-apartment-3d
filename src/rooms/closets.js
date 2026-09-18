// coat closet, linen closet, bedroom closet interiors, stacked W/D
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Name every significant mesh/group (obj.name) so tools/measure.mjs can find it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { m, ROOMS, LAUNDRY as L, CLOSET as C } from '../dimensions.js';
import { MAT } from '../materials.js';
import { box, boxAt, cyl, group, place } from '../lib/build.js';

// ---- local-frame helpers: parts are positioned in inches inside a group, the group is then place()d in plan space
const at = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);
function rbox(w, h, d, r, mat, name) {
  const o = new THREE.Mesh(new RoundedBoxGeometry(m(w), m(h), m(d), 3, m(r)), mat);
  o.castShadow = o.receiveShadow = true;
  if (name) o.name = name;
  return o;
}
/** Cylinder whose axis is local X (rods) or Z (knobs, discs). */
const cylAlong = (axis, r, len, mat, name, seg) => { const c = cyl(r, len, mat, name, seg); c.rotation[axis === 'x' ? 'z' : 'x'] = Math.PI / 2; return c; };
/** Tube through plan-space points [x, y, elev] (inches). */
function tube(pts, dia, mat, name, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, e]) => new THREE.Vector3(m(x), m(e), m(y))));
  const o = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 12, m(dia / 2), radial), mat);
  o.castShadow = o.receiveShadow = true; o.name = name; o.userData.lengthIn = curve.getLength() / m(1);
  return o;
}
/** Small canvas-textured decal plane (fascias, sticker). draw(ctx, w, h) works in pixels. */
function decal(w, h, draw, name) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round((1024 * h) / w);
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const o = new THREE.Mesh(new THREE.PlaneGeometry(m(w), m(h)), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.35, clearcoat: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  o.receiveShadow = true; o.name = name;
  return o;
}

// ---------------------------------------------------------------- shelf + rod
/**
 * White shelf on 1x4 cleats with a pine rod between sockets on the side cleats; centre shelf-and-rod bracket on long spans.
 * Local frame: X runs along the back wall from 0..len, Z = out from the back wall, Y = elevation.
 * rotDeg 0: back wall faces plan-down (+y), origin = plan-left end. rotDeg 90: back wall faces plan-right (+x), origin = plan-down end.
 */
function shelfRod(name, x, y, rotDeg, len) {
  const g = group(name);
  const under = C.shelfTop - C.shelfT, cl = C.cleat, rodY = under - C.rod.centreBelowShelf;
  g.add(at(rbox(len - 0.1, C.shelfT, C.shelfD, C.noseR, MAT.trim, `${name}:shelf`), len / 2, under + C.shelfT / 2, C.shelfD / 2));
  g.add(at(box(len - 0.1, cl.h, cl.t, MAT.trim, `${name}:cleat-back`), len / 2, under - cl.h / 2, cl.t / 2));
  for (const s of [0, 1]) { // side cleats + rod sockets
    const xs = s ? len - cl.t / 2 - 0.05 : cl.t / 2 + 0.05, inner = s ? len - cl.t - 0.05 : cl.t + 0.05;
    g.add(at(box(cl.t, cl.h, C.shelfD - cl.t, MAT.trim, `${name}:cleat-side${s}`), xs, under - cl.h / 2, cl.t + (C.shelfD - cl.t) / 2));
    g.add(at(cylAlong('x', C.socket.dia / 2, C.socket.t, MAT.whitePlastic, `${name}:socket${s}`), inner + (s ? -1 : 1) * C.socket.t / 2, rodY, C.rod.out));
  }
  g.add(at(cylAlong('x', C.rod.dia / 2, len - 2 * cl.t - 0.2, MAT.pine, `${name}:rod`, 20), len / 2, rodY, C.rod.out));

  if (len >= C.bracket.minSpan) { // IMG_3938: white steel bracket on a painted pad, diagonal strut ending in a hook around the rod
    const b = C.bracket, br = group(`${name}:bracket`), padBot = under - cl.h - b.plateH;
    br.add(at(box(b.padW, b.plateH, cl.t, MAT.trim), 0, padBot + b.plateH / 2, cl.t / 2));
    br.add(at(box(b.plateW, b.plateH + cl.h, b.plateT, MAT.whitePlastic), 0, padBot + (b.plateH + cl.h) / 2, cl.t + b.plateT / 2));
    br.add(at(box(b.plateW, b.plateT, b.arm, MAT.whitePlastic), 0, under - b.plateT / 2, cl.t + b.arm / 2));
    const hookR = C.rod.dia / 2 + b.strutDia / 2, p0 = new THREE.Vector3(0, padBot + 1, cl.t + b.plateT), p1 = new THREE.Vector3(0, rodY - hookR, C.rod.out);
    const strut = cyl(b.strutDia / 2, p0.distanceTo(p1), MAT.whitePlastic, '', 10);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    br.add(at(strut, 0, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(m(hookR), m(b.strutDia / 2), 8, 24, Math.PI * 1.5), MAT.whitePlastic);
    hook.rotation.set(0, Math.PI / 2, 0); hook.rotateZ(Math.PI); // open side up-and-back, cradle under the rod
    br.add(at(hook, 0, rodY, C.rod.out));
    br.position.x = m(len / 2);
    g.add(br);
  }
  return place(g, x, y, 0, rotDeg);
}

/** Flush load-centre cover on the bedroom-closet back wall (IMG_3938): hinges left, two black latches right, maker label. */
function electricalPanel() {
  const p = C.panel, g = group('closets:bedroom:panel'), dw = p.w - 2 * p.doorInset, dh = p.h - 2 * p.doorInset;
  g.add(at(rbox(p.w, p.h, p.proud, 0.15, MAT.panelGray), 0, 0, p.proud / 2));
  g.add(at(rbox(dw, dh, 0.12, 0.05, MAT.panelGray, 'closets:bedroom:panel-door'), 0, 0, p.proud + 0.06));
  for (const f of [0.22, -0.2]) g.add(at(box(p.latch.w, p.latch.h, 0.06, MAT.blackPlastic), dw / 2 - 1.6, f * dh, p.proud + 0.15));
  for (const f of [0.36, 0, -0.36]) g.add(at(cyl(0.12, 1, MAT.panelGray, '', 8), -dw / 2, f * dh, p.proud + 0.1));
  g.add(at(box(1.5, 0.7, 0.04, MAT.blackPlastic), dw / 2 - 1.8, -dh / 2 + 1.6, p.proud + 0.14));
  return place(g, p.x0 + p.w / 2, ROOMS.bedCloset.r[1], p.top - p.h / 2);
}

// ---------------------------------------------------------------- laundry
function fasciaDryer(ctx, w, h) {
  ctx.fillStyle = '#efefec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5d6b7c'; ctx.beginPath(); ctx.arc(w * 0.07, h * 0.42, h * 0.13, 0, 7); ctx.fill(); // GE roundel
  ctx.fillStyle = '#efefec'; ctx.font = `italic bold ${h * 0.13}px serif`; ctx.textAlign = 'center'; ctx.fillText('GE', w * 0.07, h * 0.47);
  const kx = ((L.knob.dryerFromLeft - L.panelInset) / (L.unit.w - 2 * L.panelInset)) * w;
  ctx.fillStyle = '#777'; ctx.font = `${h * 0.055}px sans-serif`;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.fillText('— —', kx + Math.cos(a) * h * 0.52 * 1.6, h * 0.5 + Math.sin(a) * h * 0.36); }
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(w * 0.5, h * 0.3, w * 0.24, h * 0.24); // display
  ctx.fillStyle = '#9fd4ff'; ctx.font = `${h * 0.1}px monospace`; ctx.fillText('0:45', w * 0.69, h * 0.47);
  ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) ctx.strokeRect(w * (0.5 + i * 0.062), h * 0.64, w * 0.045, h * 0.17);
  for (const [y, t] of [[0.3, 'Power'], [0.66, 'Start']]) { ctx.strokeRect(w * 0.9, h * y, w * 0.05, h * 0.2); ctx.fillStyle = '#666'; ctx.font = `${h * 0.06}px sans-serif`; ctx.fillText(t, w * 0.925, h * (y - 0.04)); }
}
function fasciaWasher(ctx, w, h) {
  ctx.fillStyle = '#efefec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(w * 0.4, h * 0.18, w * 0.24, h * 0.62); // display block
  ctx.fillStyle = '#9fd4ff'; ctx.font = `${h * 0.12}px monospace`; ctx.textAlign = 'center'; ctx.fillText('0:52', w * 0.52, h * 0.4);
  ctx.fillStyle = '#d8d8d8'; for (let i = 0; i < 5; i++) ctx.fillRect(w * (0.415 + i * 0.044), h * 0.62, w * 0.028, h * 0.07);
  const kx = ((L.knob.washerFromLeft - L.panelInset) / (L.unit.w - 2 * L.panelInset)) * w;
  ctx.fillStyle = '#777'; ctx.font = `${h * 0.055}px sans-serif`;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.fillText('— —', kx + Math.cos(a) * h * 0.52 * 1.6, h * 0.5 + Math.sin(a) * h * 0.36); }
}
function stickerDryer(ctx, w, h) {
  ctx.fillStyle = '#f7f7f4'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#222'; ctx.font = `bold ${h * 0.085}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('So Fresh And So Clean Clean', w / 2, h * 0.11);
  ctx.fillStyle = '#888'; for (let c = 0; c < 2; c++) for (let r = 0; r < 4; r++) { ctx.fillRect(w * (0.06 + c * 0.47), h * (0.19 + r * 0.1), w * 0.06, h * 0.05); ctx.fillRect(w * (0.14 + c * 0.47), h * (0.2 + r * 0.1), w * 0.3, h * 0.025); }
  ctx.fillStyle = '#b3261e'; ctx.fillRect(0, h * 0.6, w, h * 0.1);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.075}px sans-serif`; ctx.textAlign = 'left'; ctx.fillText('DRYER INSTRUCTIONS', w * 0.04, h * 0.675);
  ctx.fillStyle = '#999'; for (let r = 0; r < 5; r++) ctx.fillRect(w * 0.05, h * (0.75 + r * 0.045), w * (0.6 - (r % 2) * 0.12), h * 0.02);
  ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 6; ctx.strokeRect(w * 0.76, h * 0.74, w * 0.18, h * 0.2);
}

/** One 24" front-loader, furniture-style local frame (front = +Z, width along X, bottom at y=0). */
function unit(kind) {
  const U = L.unit, dryer = kind === 'dryer', g = group(`closets:${kind}`);
  const bodyD = U.d - L.door.proud, front = U.d / 2 - L.door.proud, bodyZ = front - bodyD / 2, feet = dryer ? 0 : L.feetH;
  g.add(at(rbox(U.w, U.h - feet, bodyD, L.edgeR, MAT.applianceWhite, `closets:${kind}:body`), 0, feet + (U.h - feet) / 2, bodyZ));
  if (!dryer) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.8, feet, MAT.blackPlastic, '', 12), sx * (U.w / 2 - 2), feet / 2, bodyZ + sz * (bodyD / 2 - 2)));

  const fw = U.w - 2 * L.panelInset, fy = U.h - L.panelInset - L.panelH / 2;
  g.add(at(decal(fw, L.panelH, dryer ? fasciaDryer : fasciaWasher, `closets:${kind}:fascia`), 0, fy, front + 0.03));
  const k = L.knob, kx = -U.w / 2 + (dryer ? k.dryerFromLeft : k.washerFromLeft);
  g.add(at(cylAlong('z', k.dia / 2, k.proud, MAT.chrome, `closets:${kind}:knob`, 32), kx, fy, front + k.proud / 2));
  g.add(at(cylAlong('z', k.dia / 2 + 0.25, 0.15, MAT.whitePlastic, '', 32), kx, fy, front + 0.075));

  // door: lathe-turned bezel (chrome on the dryer, gloss black on the washer) around dark glass
  const d = L.door, R = d.outerDia / 2, r = d.glassDia / 2, P = d.proud;
  const prof = [[R, 0], [R, P * 0.45], [R - 0.25, P * 0.8], [R - 0.9, P], [r + 1.2, P * 0.95], [r + 0.3, P * 0.6], [r, P * 0.35]].map(([a, b]) => new THREE.Vector2(m(a), m(b)));
  const bezel = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), dryer ? MAT.chrome : MAT.blackGlass);
  bezel.rotation.x = Math.PI / 2; bezel.castShadow = true; bezel.name = `closets:${kind}:door`;
  g.add(at(bezel, 0, d.cz, front));
  const SR = r * d.glassDomeR, cap = Math.asin(1 / d.glassDomeR); // shallow convex dark-glass dome, apex stays inside the bezel
  const glass = new THREE.Mesh(new THREE.SphereGeometry(m(SR), 48, 8, 0, Math.PI * 2, 0, cap), MAT.blackGlass);
  glass.rotation.x = Math.PI / 2; glass.name = `closets:${kind}:glass`;
  g.add(at(glass, 0, d.cz, front + P * 0.35 - SR * Math.cos(cap)));
  g.add(at(rbox(1, 4.5, 0.5, 0.2, dryer ? MAT.chrome : MAT.blackPlastic, `closets:${kind}:door-grip`), dryer ? -(R - 0.9) : R - 0.9, d.cz, front + P * 0.8)); // pull on the latch side

  if (dryer) {
    const s = L.label;
    g.add(at(decal(s.w, s.h, stickerDryer, 'closets:dryer:label'), -U.w / 2 + s.fromLeft + s.w / 2, s.elev + s.h / 2, front + 0.03));
  } else {
    const dr = L.drawer, f = L.filterCover;
    const dx = -U.w / 2 + dr.fromLeft + dr.w / 2;
    g.add(at(rbox(dr.w, dr.h, 0.3, 0.12, MAT.applianceWhite, 'closets:washer:drawer'), dx, fy, front + 0.15));
    g.add(at(rbox(dr.w * 0.45, 0.7, 0.1, 0.04, MAT.panelGray), dx, fy - dr.h * 0.2, front + 0.32));
    g.add(at(cylAlong('z', f.dia / 2, 0.12, MAT.whitePlastic, 'closets:washer:filter-cover', 32), U.w / 2 - f.fromRight, f.elev, front + 0.06));
  }
  return g;
}

function laundry() {
  const U = L.unit, g = group('closets:laundry');
  const [back, wdN, , side] = ROOMS.wd.r; // back-wall face x, plan-up side wall y, plan-down side wall y
  const cx = L.frontX - U.d / 2, y0 = wdN + L.sideGap, cy = y0 + U.w / 2;
  const bodyD = U.d - L.door.proud;
  g.add(place(unit('washer'), cx, cy, 0, 90));
  g.add(place(rbox(bodyD - 2 * L.stackKitInset, L.stackGap, U.w - 2 * L.stackKitInset, 0.1, MAT.whitePlastic, 'closets:stack-kit'), cx - L.door.proud / 2, cy, U.h + L.stackGap / 2));
  g.add(place(unit('dryer'), cx, cy, U.h + L.stackGap, 90));

  // 4" flex foil duct: down the side gap from the ceiling (front) to behind the dryer
  const D = L.duct, gy = (y0 + U.w + side) / 2, dz = D.topElev - D.bottomElev, dx = D.topX - D.bottomX;
  const duct = tube([[D.topX, gy, D.topElev], [D.topX - 0.4, gy + 0.2, D.topElev - dz * 0.2], [D.topX - dx * 0.25, gy - 0.2, D.topElev - dz * 0.42], [D.topX - dx * 0.6, gy + 0.2, D.topElev - dz * 0.68],
    [D.bottomX + 1.5, gy, D.bottomElev + dz * 0.1], [D.bottomX, gy - 0.6, D.bottomElev]], D.dia, MAT.foilDuct, 'closets:duct', 20);
  MAT.foilDuct.bumpMap.repeat.set(duct.userData.lengthIn / 3, 1); // 3" texture tile = 4 ribs
  g.add(duct);

  // dryer receptacle on the side wall, cord looped over a hook near the header then down the gap and behind the units (IMG_3945)
  const R = L.receptacle, wy = side - 0.8; // cord stands off the wall so the spline never dips into it
  g.add(boxAt(R.x, side - R.d, R.elev, R.w, R.d, R.h, MAT.panelGray, 'closets:dryer-receptacle'));
  g.add(boxAt(R.x + 1, side - R.d - 1.2, R.elev + 1, 2.5, 1.2, 2.5, MAT.blackPlastic, 'closets:dryer-plug'));
  g.add(tube([[R.x + 2.2, side - R.d - 0.9, R.elev + 3.5], [R.x + 3, wy - 1, R.elev + 12], [L.frontX - 3, wy, L.cordHookElev - 4], [L.frontX - 2, wy, L.cordHookElev], [L.frontX - 1, wy, L.cordHookElev - 4],
    [L.frontX - 1, wy, L.cordLowElev + 8], [L.frontX - 6, wy, L.cordLowElev], [back + 6, wy, L.cordLowElev], [back + 1.5, wy - 3, L.cordLowElev + 1], [back + 1.5, cy + 4, L.cordLowElev + 3]], L.cordDia, MAT.rubberHose, 'closets:dryer-cord', 8));
  g.add(boxAt(L.frontX - 2.6, side - 0.8, L.cordHookElev - 0.4, 1.2, 0.8, 0.5, MAT.whitePlastic, 'closets:cord-hook'));

  // washer outlet box low on the side wall with hot/cold supply hoses + drain hose to the washer back
  const W = L.washerBox, bx = W.x;
  g.add(boxAt(bx, side - W.d, W.elev, W.w, W.d, W.h, MAT.whitePlastic, 'closets:washer-box'));
  [[1.8, 0xb33a32], [4.2, 0x2f5fa8]].forEach(([o, col], i) => {
    const v = cylAlong('z', 0.55, 1.2, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }), `closets:valve${i}`, 12);
    g.add(place(v, bx + o, side - W.d - 0.6, W.elev + 3));
    g.add(tube([[bx + o, side - W.d - 1.2, W.elev + 3], [bx + o, side - W.d - 2.6, W.elev + 1], [back + 1.4, side - 5, W.elev - 2 + i], [back + 1.4, cy + 3 - i * 2, W.elev + 6]], L.hoseDia, MAT.nickel, `closets:supply-hose${i}`, 8));
  });
  g.add(tube([[bx + 7, side - W.d - 0.2, W.elev + 5.5], [bx + 7, side - 2.2, W.elev + 9], [bx + 4, side - 3.4, W.elev + 3], [back + 1.5, side - 5.2, W.elev - 6], [back + 1.5, cy + 5, W.elev - 9]], L.drainDia, MAT.rubberHose, 'closets:drain-hose', 8));
  return g;
}

export function build() {
  MAT.pine.map.rotation = Math.PI / 2; // grain (canvas U) along the rod's length (cylinder V)
  const b = ROOMS.bedCloset.r, l = ROOMS.linen.r, c = ROOMS.coat.r;
  const bed = shelfRod('closets:bedroom', b[0], b[1], 0, b[2] - b[0]); // along x against the plan-up back wall
  const linen = shelfRod('closets:linen', l[0], l[3], 90, l[3] - l[1]); // along y against the plan-left back wall
  const coat = shelfRod('closets:coat', c[0], c[3], 90, c[3] - c[1]);
  return group('closets', bed, electricalPanel(), linen, coat, laundry());
}
