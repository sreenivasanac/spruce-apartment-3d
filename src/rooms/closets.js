// coat closet, linen closet, bedroom closet interiors, stacked W/D
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Name every significant mesh/group (obj.name) so tools/measure.mjs can find it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { m, ENV, ROOMS, LAUNDRY as L, CLOSET as C, SHOE_CLOSET } from '../dimensions.js';
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
  draw(c.getContext('2d', { willReadFrequently: true }), c.width, c.height);
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
const CLOSET_DEFAULT = C;
/** Shelf + rod run of length `len`; `C` (closet sizes) can be overridden per closet. */
function shelfRod(name, x, y, rotDeg, len, C = CLOSET_DEFAULT) {
  const g = group(name);
  const under = C.shelfTop - C.shelfT, cl = C.cleat, rodY = under - C.rod.centreBelowShelf;
  g.add(at(rbox(len - 0.1, C.shelfT, C.shelfD, C.noseR, MAT.closetShelf, `${name}:shelf`), len / 2, under + C.shelfT / 2, C.shelfD / 2));
  g.add(at(box(len - 0.1, cl.h, cl.t, MAT.trim, `${name}:cleat-back`), len / 2, under - cl.h / 2, cl.t / 2));
  for (const s of [0, 1]) { // side cleats + rod sockets
    const xs = s ? len - cl.t / 2 - 0.05 : cl.t / 2 + 0.05, inner = s ? len - cl.t - 0.05 : cl.t + 0.05;
    g.add(at(box(cl.t, cl.h, C.shelfD - cl.t, MAT.trim, `${name}:cleat-side${s}`), xs, under - cl.h / 2, cl.t + (C.shelfD - cl.t) / 2));
    g.add(at(cylAlong('x', C.socket.dia / 2, C.socket.t, MAT.whitePlastic, `${name}:socket${s}`), inner + (s ? -1 : 1) * C.socket.t / 2, rodY, C.rod.out));
  }
  g.add(at(cylAlong('x', C.rod.dia / 2, len - 2 * cl.t - 0.2, MAT.pine, `${name}:rod`, 20), len / 2, rodY, C.rod.out));

  if (len >= C.bracket.minSpan) { // IMG_3938: white enamelled-steel bracket on a small painted pad; diagonal strut ends in an open-top U saddle the rod rests in
    const b = C.bracket, br = group(`${name}:bracket`), padBot = under - cl.h - b.plateH, E = MAT.whiteEnamel;
    br.add(at(box(b.padW, b.plateH, cl.t, MAT.trim), 0, padBot + b.plateH / 2, cl.t / 2));
    br.add(at(box(b.plateW, b.plateH + cl.h, b.plateT, E), 0, padBot + (b.plateH + cl.h) / 2, cl.t + b.plateT / 2));
    br.add(at(box(b.plateW, b.plateT, b.arm, E), 0, under - b.plateT / 2, cl.t + b.arm / 2));
    const hookR = C.rod.dia / 2 + b.strutDia / 2, p0 = new THREE.Vector3(0, padBot + b.strutFoot, cl.t + b.plateT), p1 = new THREE.Vector3(0, rodY - hookR, C.rod.out);
    const strut = cyl(b.strutDia / 2, p0.distanceTo(p1), E, '', 10);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    br.add(at(strut, 0, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(m(hookR), m(b.strutDia / 2), 8, 24, Math.PI), E);
    hook.rotation.set(0, Math.PI / 2, 0); hook.rotateZ(Math.PI); // lower half only: open-top saddle under the rod
    hook.castShadow = true; hook.name = `${name}:bracket-hook`;
    br.add(at(hook, 0, rodY, C.rod.out));
    br.add(at(cyl(b.strutDia / 2, C.rod.centreBelowShelf, E, '', 10), 0, rodY + C.rod.centreBelowShelf / 2, C.rod.out - hookR)); // back leg of the saddle returns up to the arm under the shelf
    br.position.x = m(len / 2);
    g.add(br);
  }
  return place(g, x, y, 0, rotDeg);
}

/** Flush load-centre cover on the bedroom-closet back wall (IMG_3938): hinges left, two black latches right, maker label. */
function electricalPanel() {
  const p = C.panel, g = group('closets:bedroom:panel'), dw = p.w - 2 * p.doorInset, dh = p.h - 2 * p.doorInset;
  g.add(at(rbox(p.w, p.h, p.proud, p.cornerR, MAT.panelGray), 0, 0, p.proud / 2));
  g.add(at(rbox(dw, dh, p.door.t, p.door.r, MAT.panelGray, 'closets:bedroom:panel-door'), 0, 0, p.proud + p.door.t / 2));
  const face = p.proud + p.door.t;
  for (const f of p.latch.at) g.add(at(box(p.latch.w, p.latch.h, p.latch.t, MAT.blackPlastic), dw / 2 - p.latch.inset, f * dh, face + p.latch.t / 2));
  for (const f of p.hinge.at) g.add(at(cyl(p.hinge.r, p.hinge.l, MAT.panelGray, '', 8), -dw / 2, f * dh, face - p.hinge.r));
  g.add(at(box(p.label.w, p.label.h, p.label.t, MAT.blackPlastic), dw / 2 - p.label.insetX, -dh / 2 + p.label.insetY, face + p.label.t / 2));
  return place(g, p.x0 + p.w / 2, ROOMS.bedCloset.r[1], p.top - p.h / 2);
}

// ---------------------------------------------------------------- laundry
/** Short cycle-name dashes fanned around the knob on one side (side -1 = left, +1 = right). Canvas is square-pixelled: ppi = px per inch. */
function cycleLabels(ctx, kx, h, ppi, side) {
  ctx.fillStyle = '#777'; ctx.font = `${h * 0.06}px sans-serif`; ctx.textAlign = side < 0 ? 'right' : 'left';
  for (let i = 0; i < 7; i++) { const a = (-0.42 + i * 0.14) * Math.PI; ctx.fillText('— —', kx + side * Math.cos(a) * 1.7 * ppi, h * 0.53 + Math.sin(a) * 1.7 * ppi); }
}
const fasciaX = (fromLeft, w) => ((fromLeft - L.panelInset) / (L.unit.w - 2 * L.panelInset)) * w;
function fasciaDryer(ctx, w, h) { // IMG_3945: GE roundel far left, knob at mid-width, black display hard against the knob's right, 3 white buttons under it, Power/Start far right
  const ppi = w / (L.unit.w - 2 * L.panelInset);
  ctx.fillStyle = '#efefec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5d6b7c'; ctx.beginPath(); ctx.arc(w * 0.07, h * 0.42, h * 0.13, 0, 7); ctx.fill(); // GE roundel
  ctx.fillStyle = '#efefec'; ctx.font = `italic bold ${h * 0.13}px serif`; ctx.textAlign = 'center'; ctx.fillText('GE', w * 0.07, h * 0.47);
  cycleLabels(ctx, fasciaX(L.knob.dryerFromLeft, w), h, ppi, -1);
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(w * 0.576, h * 0.26, w * 0.28, h * 0.27); // display
  ctx.fillStyle = '#9fd4ff'; ctx.font = `${h * 0.12}px monospace`; ctx.textAlign = 'center'; ctx.fillText('0:45', w * 0.79, h * 0.46);
  ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fbfbfa'; ctx.beginPath(); ctx.roundRect(w * (0.7 + i * 0.054), h * 0.62, w * 0.04, h * 0.2, 6); ctx.fill(); ctx.stroke(); }
  for (const [y, t] of [[0.26, 'Power'], [0.64, 'Start']]) { ctx.fillStyle = '#fbfbfa'; ctx.beginPath(); ctx.roundRect(w * 0.925, h * y, w * 0.045, h * 0.2, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#666'; ctx.font = `${h * 0.06}px sans-serif`; ctx.fillText(t, w * 0.947, h * (y - 0.04)); }
}
function fasciaWasher(ctx, w, h) { // drawer (mesh) far left, wide black display block directly against it, knob right of the display with the cycle names to its right
  const ppi = w / (L.unit.w - 2 * L.panelInset), x0 = fasciaX(L.drawer.fromLeft + L.drawer.w, w) + w * 0.01, x1 = w * 0.67;
  ctx.fillStyle = '#efefec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(x0, h * 0.18, x1 - x0, h * 0.62); // display block
  ctx.fillStyle = '#9fd4ff'; ctx.font = `${h * 0.13}px monospace`; ctx.textAlign = 'center'; ctx.fillText('0:52', (x0 + x1) / 2, h * 0.4);
  ctx.fillStyle = '#d8d8d8'; for (let i = 0; i < 6; i++) ctx.fillRect(x0 + (x1 - x0) * (0.06 + i * 0.155), h * 0.62, (x1 - x0) * 0.1, h * 0.07);
  cycleLabels(ctx, fasciaX(L.knob.washerFromLeft, w), h, ppi, 1);
}
function stickerDryer(ctx, w, h) { // two stacked stickers: grey 'So Fresh And So Clean Clean' over the red-headed DRYER INSTRUCTIONS
  const split = h * 0.5, gap = h * 0.012;
  ctx.fillStyle = '#efefec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#dcdddc'; ctx.fillRect(0, 0, w, split - gap);
  ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.font = `bold ${w * 0.085}px serif`; ctx.fillText('So Fresh And', w / 2, h * 0.055); ctx.fillText('So Clean Clean', w / 2, h * 0.115);
  ctx.fillStyle = '#777'; for (let c = 0; c < 2; c++) for (let r = 0; r < 4; r++) { const x = w * (0.05 + c * 0.48), y = h * (0.16 + r * 0.08); ctx.fillRect(x, y, w * 0.09, h * 0.05); ctx.fillRect(x + w * 0.12, y + h * 0.005, w * 0.3, h * 0.012); ctx.fillRect(x + w * 0.12, y + h * 0.028, w * 0.24, h * 0.012); }
  ctx.fillStyle = '#f7f7f4'; ctx.fillRect(0, split, w, h - split);
  ctx.fillStyle = '#b3261e'; ctx.fillRect(0, split, w, h * 0.06);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${w * 0.075}px sans-serif`; ctx.textAlign = 'left'; ctx.fillText('DRYER INSTRUCTIONS', w * 0.04, split + h * 0.045);
  ctx.fillStyle = '#999'; for (let r = 0; r < 13; r++) ctx.fillRect(w * 0.05, split + h * (0.085 + r * 0.03), w * ((r > 7 ? 0.55 : 0.88) - (r % 3) * 0.08), h * 0.011);
  ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 7; ctx.strokeRect(w * 0.68, split + h * 0.33, w * 0.26, h * 0.14);
}

/** Appliance cabinet: bevelled box with a round port through the front, so the drum is genuinely recessed (the port edge hides behind the door bezel; the bevel shrinks the port by e, so pass the drum radius + 2e). Centred on the origin. */
function cabinet(w, h, d, e, portY, portR, name) {
  const x = m(w / 2 - e), y = m(h / 2 - e), c = m(0.02), s = new THREE.Shape(); // the bevel grows the outline back out by e; tiny corner arcs so it rounds the long edges too
  s.absarc(x - c, y - c, c, 0, Math.PI / 2); s.absarc(-x + c, y - c, c, Math.PI / 2, Math.PI); s.absarc(-x + c, -y + c, c, Math.PI, 1.5 * Math.PI); s.absarc(x - c, -y + c, c, 1.5 * Math.PI, 2 * Math.PI);
  const port = new THREE.Path(); port.absarc(0, m(portY), m(portR), 0, Math.PI * 2, true); s.holes.push(port);
  const geo = new THREE.ExtrudeGeometry(s, { depth: m(d - 2 * e), bevelEnabled: true, bevelThickness: m(e), bevelSize: m(e), bevelSegments: 3, curveSegments: 40 });
  geo.translate(0, 0, -m(d / 2 - e));
  const o = new THREE.Mesh(geo, MAT.applianceWhite); o.castShadow = o.receiveShadow = true; o.name = name;
  return o;
}
/** Perforated drum back (dryer) — dot grid at the real pitch, darker toward the rim; also used as emissive map because the cavity is fully shadowed. */
function drumBackMat(dia) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d', { willReadFrequently: true }), s = 512, step = (L.drum.perfPitch / dia) * s;
  const gr = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2); gr.addColorStop(0, '#8e9194'); gr.addColorStop(0.75, '#707376'); gr.addColorStop(1, '#2c2e30');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#101112'; for (let j = 0, y = step / 2; y < s; y += step * 0.866, j++) for (let x = (j % 2) * step / 2; x < s; x += step) { ctx.beginPath(); ctx.arc(x, y, step * 0.24, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#3c3e41'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.09, 0, 7); ctx.fill(); // hub
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, metalness: 0.3, roughness: 0.45, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, name: 'drum-back-perforated' });
}
/** Drum behind the door glass, local frame of unit(): open cylinder + back disc; dryer gets the lint-filter housing, washer 3 paddles. */
function drum(kind, cz, r, front) {
  const D = L.drum, R = r + D.clear, g = group(`closets:${kind}:drum`), dryer = kind === 'dryer';
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(m(R), m(R), m(D.depth), 48, 1, true), MAT.drumSteel); wall.rotation.x = Math.PI / 2;
  const back = new THREE.Mesh(new THREE.CircleGeometry(m(R), 48), dryer ? drumBackMat(2 * R) : MAT.drumSteel);
  wall.receiveShadow = back.receiveShadow = true; // the cabinet shades the cavity; without this the sun lights it through the body
  g.add(at(wall, 0, 0, -D.depth / 2), at(back, 0, 0, -D.depth));
  if (dryer) g.add(at(box(D.lintW, D.lintH, D.lintD, MAT.rubberHose, 'closets:dryer:lint-filter'), 0, -Math.sqrt(R * R - (D.lintW / 2) ** 2) + D.lintH / 2, -D.lintD / 2));
  else for (let i = 0; i < 3; i++) { // one paddle at the bottom, where the camera looks down onto it
    const p = box(D.paddleW, D.paddleH, D.depth * 0.8, MAT.drumSteel), a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; p.rotation.z = a + Math.PI / 2; g.add(at(p, Math.cos(a) * (R - D.paddleH / 2), Math.sin(a) * (R - D.paddleH / 2), -D.depth / 2)); }
  return at(g, 0, cz, front);
}

/** One 24" front-loader, furniture-style local frame (front = +Z, width along X, bottom at y=0). */
function unit(kind) {
  const U = L.unit, dryer = kind === 'dryer', g = group(`closets:${kind}`);
  const bodyD = U.d - L.door.proud, front = U.d / 2 - L.door.proud, bodyZ = front - bodyD / 2, feet = dryer ? 0 : L.feetH;
  const d = L.door, cz = d.cz[kind], R = d.outerDia / 2, r = d.glassDia[kind] / 2, P = d.proud, bodyCy = feet + (U.h - feet) / 2;
  g.add(at(cabinet(U.w, U.h - feet, bodyD, L.edgeR, cz - bodyCy, r + L.drum.clear + 2 * L.edgeR, `closets:${kind}:body`), 0, bodyCy, bodyZ));
  g.add(drum(kind, cz, r, front));
  if (!dryer) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.8, feet, MAT.blackPlastic, '', 12), sx * (U.w / 2 - 2), feet / 2, bodyZ + sz * (bodyD / 2 - 2)));

  const fw = U.w - 2 * L.panelInset, fy = U.h - L.panelInset - L.panelH / 2;
  g.add(at(decal(fw, L.panelH, dryer ? fasciaDryer : fasciaWasher, `closets:${kind}:fascia`), 0, fy, front + 0.03));
  const k = L.knob, kx = -U.w / 2 + (dryer ? k.dryerFromLeft : k.washerFromLeft);
  const kc = L.knobCap, knob = new THREE.Mesh(new THREE.CylinderGeometry(m((k.dia / 2) * kc.taper), m(k.dia / 2), m(k.proud), 32), MAT.knobChrome); // same bright chrome knob + dark cap on both units
  knob.rotation.x = Math.PI / 2; knob.castShadow = true; knob.name = `closets:${kind}:knob`;
  g.add(at(knob, kx, fy, front + k.proud / 2));
  g.add(at(cylAlong('z', kc.dia / 2, kc.ringT, MAT.blackPlastic, '', 24), kx, fy, front + k.proud));
  g.add(at(cylAlong('z', k.dia / 2 + kc.ringW, kc.ringT, MAT.whitePlastic, '', 32), kx, fy, front + kc.ringT / 2));

  // door: lathe-turned bezel (chrome on the dryer, gloss black on the washer) around smoky (dryer) / dark (washer) see-through glass
  const prof = [[R, 0], [R, P * 0.45], [R - 0.25, P * 0.8], [R - 0.9, P], [r + 1.2, P * 0.95], [r + 0.3, P * 0.6], [r, P * 0.35]].map(([a, b]) => new THREE.Vector2(m(a), m(b)));
  const bezel = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), dryer ? MAT.chrome : MAT.blackGlass);
  bezel.rotation.x = Math.PI / 2; bezel.castShadow = true; bezel.name = `closets:${kind}:door`;
  g.add(at(bezel, 0, cz, front));
  const SR = r * d.glassDomeR, cap = Math.asin(1 / d.glassDomeR); // shallow convex dark-glass dome, apex stays inside the bezel
  const glass = new THREE.Mesh(new THREE.SphereGeometry(m(SR), 48, 8, 0, Math.PI * 2, 0, cap), dryer ? MAT.dryerGlass : MAT.washerGlass);
  glass.rotation.x = Math.PI / 2; glass.name = `closets:${kind}:glass`;
  g.add(at(glass, 0, cz, front + P * 0.35 - SR * Math.cos(cap)));
  g.add(at(rbox(1, 4.5, 0.5, 0.2, dryer ? MAT.chrome : MAT.blackPlastic, `closets:${kind}:door-grip`), dryer ? -(R - 0.9) : R - 0.9, cz, front + P * 0.8)); // pull on the latch side

  if (dryer) {
    const s = L.label;
    g.add(at(decal(s.w, s.h, stickerDryer, 'closets:dryer:label'), -U.w / 2 + s.fromLeft + s.w / 2, s.elev + s.h / 2, front + 0.03));
  } else {
    const dr = L.drawer, f = L.filterCover;
    const dx = -U.w / 2 + dr.fromLeft + dr.w / 2;
    g.add(at(rbox(dr.w, dr.h, 0.3, 0.12, MAT.applianceWhite, 'closets:washer:drawer'), dx, fy, front + 0.15));
    g.add(at(rbox(dr.w * 0.45, 0.7, 0.1, 0.04, MAT.panelGray), dx, fy - dr.h * 0.2, front + 0.32));
    g.add(at(cylAlong('z', f.dia / 2, f.recess / 2, MAT.hvacShadow, '', 40), U.w / 2 - f.fromRight, f.elev, front + f.recess / 4)); // thin shadow groove around the cover
    g.add(at(cylAlong('z', f.dia / 2 - f.grooveW, f.recess, MAT.applianceWhite, 'closets:washer:filter-cover', 40), U.w / 2 - f.fromRight, f.elev, front + f.recess / 2));
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
  g.add(place(cyl(D.collarDia / 2, D.collarH, MAT.whitePlastic, 'closets:duct-collar', 32), D.topX, gy, ENV.ceiling - D.collarH / 2)); // white ceiling collar; duct stops short of the ceiling plane

  // dryer receptacle on the side wall, cord looped over a hook near the header then down the gap and behind the units (IMG_3945)
  const R = L.receptacle, wy = side - 0.8; // cord stands off the wall so the spline never dips into it
  g.add(boxAt(R.x, side - R.d, R.elev, R.w, R.d, R.h, MAT.panelGray, 'closets:dryer-receptacle'));
  const Pg = R.plug;
  g.add(boxAt(R.x + Pg.inset, side - R.d - Pg.d, R.elev + Pg.up, Pg.w, Pg.d, Pg.h, MAT.blackPlastic, 'closets:dryer-plug'));
  g.add(tube([[R.x + R.w / 2, side - R.d - Pg.d / 2, R.elev + Pg.up + Pg.h], [R.x + 3, wy - 1, R.elev + 12], [L.frontX - 3, wy, L.cordHookElev - 4], [L.frontX - 2, wy, L.cordHookElev], [L.frontX - 1, wy, L.cordHookElev - 4],
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
  const S = SHOE_CLOSET, shelfTop = S.rodElev + S.shelfAboveRod + C.shelfT; // shoe closet: rod + shelf heights from the user's tape measure
  const coat = shelfRod('closets:coat', c[0], c[3], 90, c[3] - c[1], { ...C, shelfTop, rod: { ...C.rod, centreBelowShelf: shelfTop - C.shelfT - S.rodElev, out: S.rodOut } });
  return group('closets', bed, electricalPanel(), linen, coat, laundry());
}
