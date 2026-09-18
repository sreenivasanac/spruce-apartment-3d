// Walnut lift-top coffee table (spruce_apt_photos/lift_top1-3.jpg).
// Contract: build() returns a THREE.Group named 'liftTop', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT (sitter side) facing +Z, width along X.
// Seen from the sitter (lift_top2.jpg): fixed faux-marble top over an open cubby on the LEFT (-X),
// walnut lift top over the hidden storage well on the RIGHT (+X).
// Click toggles the top; group.userData.setOpen(bool, instant?) and URL ?lift=open force a state.
import * as THREE from 'three';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { box, cyl, group } from '../lib/build.js';

const TAU = Math.PI * 2;

/** Canvas texture whose tile is tileW x tileH inches (geometry UVs are in metres). */
function tileTex(pxW, pxH, tileW, tileH, draw) {
  const c = document.createElement('canvas');
  c.width = pxW; c.height = pxH;
  draw(c.getContext('2d'), pxW, pxH);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / m(tileW), 1 / m(tileH));
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Smooth value noise on a gx x gy lattice over the unit square, wrapping in both axes (keeps the print tileable). */
function valueNoise(r, gx, gy) {
  const v = Array.from({ length: gx * gy }, () => r() - 0.5), s = (t) => t * t * (3 - 2 * t);
  return (u, w) => {
    const x = u * gx, y = w * gy, x0 = Math.floor(x), y0 = Math.floor(y), fx = s(x - x0), fy = s(y - y0);
    const at = (i, j) => v[(((j % gy) + gy) % gy) * gx + (((i % gx) + gx) % gx)];
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
}

// Walnut laminate print: grain runs along U; PLANKS flat-sawn boards across V (tile height = PLANKS * plankW, so the
// joints land identically on every tile). Each board carries one family of nested cathedral (flame) arches:
// ring phase = RINGS * x/W + hyperbola(dy) -> rounded tips on the board's heart line, arms straightening into
// near-parallel grain toward the edges. An integer ring count per tile + wrapping noise keeps it seamless along U.
const PLANKS = 3, RINGS = 32;
function drawWalnut(ctx, W, H, D) {
  const r = rng(41), img = ctx.createImageData(W, H), px = img.data, ph = H / PLANKS, ppi = ph / D.plankW;
  const light = [112, 78, 57], dark = [60, 39, 28]; // cool mid-brown, soft contrast (lift_top1.jpg)
  const warp = valueNoise(r, 10, 9), fibre = valueNoise(r, 24, 400), blotch = valueNoise(r, 5, 6);
  for (let p = 0; p < PLANKS; p++) {
    const yc = 0.5 + (r() - 0.5) * 0.5, dirn = r() < 0.5 ? -1 : 1, elong = 7 + r() * 5, tipW = 0.5 + r() * 0.5; // heart line (plank fraction), arch direction, arm slope, tip roundness (in)
    const tone = [0.1, -0.12, 0.02][p] + (r() - 0.5) * 0.06, wob = { a: 0.12 + r() * 0.1, p: r() * TAU }, pb = r() * TAU, inPerRing = 48 / RINGS;
    for (let y = Math.round(p * ph); y < Math.round((p + 1) * ph); y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, w = y / H;
        const dy = ((y - p * ph) / ph - yc - wob.a * Math.sin(TAU * u + wob.p)) * D.plankW; // inches off the (wandering) heart line
        const ring = dirn * RINGS * u + (elong * tipW * (Math.hypot(1, dy / tipW) - 1)) / inPerRing + 2.2 * warp(u, w);
        const rr = ring + 0.35 * Math.sin((TAU * ring) / 4 + pb), f = rr - Math.floor(rr); // uneven ring spacing
        const late = f < 0.75 ? f / 0.75 : (1 - f) / 0.25; // slow darkening into the latewood line, quick return
        const band = 0.5 + 0.5 * Math.sin((TAU * ring) / 8 + pb); // a few broad darker bands
        const v = THREE.MathUtils.clamp(0.12 + 0.34 * late * late + 0.3 * band * band * band + tone + 0.5 * fibre(u, w) + 0.35 * blotch(u, w), 0, 1);
        const i = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) px[i + c] = light[c] + (dark[c] - light[c]) * v;
        px[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(40,24,16,${0.05 + r() * 0.1})`; ctx.fillRect(r() * W, r() * H, 4 + r() * 18, 1); } // pores
  ctx.fillStyle = 'rgba(22,12,8,0.85)';
  for (let p = 0; p < PLANKS; p++) ctx.fillRect(0, Math.round(p * ph) - 1, W, Math.max(2, D.seamW * ppi)); // plank joints (min 2 px so they survive mip-mapping)
}

// Calacatta-style faux marble: warm-white base, 3 broad smoky-grey vein bands with feathered edges (many overlapping
// low-alpha gradient blobs along a wandering path), lighter secondary veins, a few hairlines, fine speckle.
// (No ctx.filter: blur filters blanked the canvas in headless Chrome.)
function drawMarble(ctx, W, H) {
  const r = rng(77);
  ctx.fillStyle = 'rgb(241,239,233)'; ctx.fillRect(0, 0, W, H);
  const blob = (x, y, rad, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  };
  for (let i = 0; i < 30; i++) blob(r() * W, r() * H, 80 + r() * 220, '150,150,156', 0.04 + r() * 0.07); // clouding
  /** Wandering path from (x,y) along dir; calls visit(x, y, i) every `step` px. */
  const walk = (x, y, dir, n, step, wander, visit) => {
    const home = dir;
    for (let i = 0; i < n; i++) {
      dir += (r() - 0.5) * wander + (home - dir) * 0.1;
      x += Math.cos(dir) * step; y += Math.sin(dir) * step; visit(x, y, i, dir);
    }
  };
  ctx.lineCap = 'round';
  const hair = (x, y, dir, n, wid, a) => { // thin vein with a faint halo
    let px = x, py = y;
    walk(x, y, dir, n, 12, 0.6, (qx, qy, i) => {
      for (const [s, al] of [[9, a * 0.12], [4, a * 0.25], [1.5, a]]) {
        ctx.strokeStyle = `rgba(120,121,130,${al})`; ctx.lineWidth = wid * s * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.4 + wid)));
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
      }
      px = qx; py = qy;
    });
  };
  const flow = 0.62; // dominant vein direction (rad)
  /** Smoky band: half-width swells and pinches between ~0.4x and ~1.5x wid; spawns narrower branch bands + secondary veins. */
  const band = (x0, y0, dir0, n, wid, depth) => {
    const phase = r() * TAU, side = r() < 0.5 ? -0.55 : 0.55;
    let edge = null;
    walk(x0, y0, dir0, n, 5, 0.45, (x, y, i, dir) => {
      const w = wid * (0.4 + 1.1 * Math.abs(Math.sin(i * 0.025 + phase)) ** 2);
      const e = [x - Math.sin(dir) * w * side, y + Math.cos(dir) * w * side]; // crisper vein line bounding one flank of the band
      if (edge) { ctx.strokeStyle = 'rgba(96,97,106,0.22)'; ctx.lineWidth = 1 + w * 0.06; ctx.beginPath(); ctx.moveTo(...edge); ctx.lineTo(...e); ctx.stroke(); }
      edge = e;
      for (let k = 0; k < 2; k++) { // feathered body: blobs scattered across the band
        const o = (r() - 0.5) * w * 1.6;
        blob(x - Math.sin(dir) * o, y + Math.cos(dir) * o, w * (0.5 + r() * 0.8), '150,150,155', 0.08 + r() * 0.09);
      }
      if (Math.sin(i * 0.06 + phase) > -0.2) blob(x + (r() - 0.5) * w * 0.7, y + (r() - 0.5) * w * 0.7, w * (0.25 + r() * 0.35), '100,101,110', 0.17); // darker smoky core
      if (depth < 1 && r() < 0.007) band(x, y, dir + (r() < 0.5 ? 0.9 : -0.9), n * 0.35, wid * 0.45, depth + 1);
      if (r() < 0.007) hair(x, y, dir + (r() < 0.5 ? 0.8 : -0.8), 20 + r() * 25, 1 + r(), 0.2); // secondary veins branching off
    });
  };
  [0.0, 0.3, 0.62, 0.9].forEach((fy, b) => {
    band(-60, H * fy - 120, flow + (r() - 0.5) * 0.25, 270, b % 2 ? 20 + r() * 8 : 38 + r() * 14, 0);
    if (b % 2) hair(-40, H * (fy + 0.15), flow + (r() - 0.5) * 0.3, 110, 1.2, 0.22);
  });
  for (let i = 0; i < 9000; i++) { ctx.fillStyle = r() < 0.5 ? `rgba(120,120,126,${r() * 0.1})` : `rgba(255,255,255,${r() * 0.25})`; ctx.fillRect(r() * W, r() * H, 1.5, 1.5); } // speckle
}

/** Box with eased (bevelled) edges + slightly rounded plan corners; bottom at y=0, centred in x/z. UVs in metres, U along X. */
function rbox(w, h, d, mat, name, D) {
  const W = m(w), Dp = m(d), C = m(D.cornerR), B = m(D.edgeR), x = -W / 2, y = -Dp / 2, q = Math.PI / 2;
  const s = new THREE.Shape();
  s.moveTo(x + C, y); s.lineTo(x + W - C, y); s.absarc(x + W - C, y + C, C, -q, 0);
  s.lineTo(x + W, y + Dp - C); s.absarc(x + W - C, y + Dp - C, C, 0, q);
  s.lineTo(x + C, y + Dp); s.absarc(x + C, y + Dp - C, C, q, 2 * q);
  s.lineTo(x, y + C); s.absarc(x + C, y + C, C, 2 * q, 3 * q);
  const g = new THREE.ExtrudeGeometry(s, { depth: m(h) - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelOffset: -B, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, B); g.rotateX(-q);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = name;
  return mesh;
}

const at = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);
/** Cylinder lying along X (pins, cross-bar) or Z (gas spring). */
const lying = (r, len, axis, mat, name) => { const c = cyl(r, len, mat, name, 16); axis === 'x' ? c.geometry.rotateZ(Math.PI / 2) : c.geometry.rotateX(Math.PI / 2); return c; };

export function build() {
  const D = FURNITURE.liftTop, L = D.leg, M = D.mech, S = M.spring;
  const walnutTex = tileTex(2048, 1024, 48, PLANKS * D.plankW, (c, W, H) => drawWalnut(c, W, H, D));
  // same print, shifted per panel so no two panels show the identical grain
  const walnut = [0, 1, 2, 3, 4].map((i) => {
    const t = i ? walnutTex.clone() : walnutTex;
    // lift top (i = 0, UVs centred on 0): half-tile V shift puts the joints at +-plankW/2 => 2 joints as in lift_top1/3.jpg
    t.offset.set(i * 0.37, i ? i * 0.23 : 0.5); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, name: `liftTop-walnut-${i}` });
  });
  const marbleTex = tileTex(1024, 1024, 24, 24, drawMarble);
  marbleTex.offset.set(0.5, 0.5); // slab UVs are centred on 0: keep the (non-tiling) tile seam off the slab
  const marble = new THREE.MeshPhysicalMaterial({ map: marbleTex, roughness: 0.08, clearcoat: 0.6, clearcoatRoughness: 0.08, name: 'liftTop-faux-marble' });
  const steel = MAT.blackMetal;

  // Tops overhang the carcass by topOver all round (shadow line under the top); overall bounds stay D.w x D.d.
  const bodyTop = D.h - D.topT, bodyH = bodyTop - D.legH, innerH = bodyH - D.panelT, floorY = D.legH + D.panelT;
  const cw = D.w - 2 * D.topOver, cd = D.d - 2 * D.topOver; // carcass footprint
  const xDiv = -D.w / 2 + D.marbleW; // seam between marble and lift top; divider panel sits just under the marble edge
  const wellX0 = xDiv, wellX1 = cw / 2 - D.panelT, liftW = D.w / 2 - xDiv - D.topGap;

  // ---- carcass
  const body = group('liftTop:body',
    at(box(cw - 2 * D.panelT, D.panelT, cd, walnut[1], 'liftTop:bottom'), 0, D.legH + D.panelT / 2, 0),
    at(box(D.panelT, bodyH, cd, walnut[2], 'liftTop:sideL'), -cw / 2 + D.panelT / 2, D.legH + bodyH / 2, 0),
    at(box(D.panelT, bodyH, cd, walnut[3], 'liftTop:sideR'), cw / 2 - D.panelT / 2, D.legH + bodyH / 2, 0),
    at(box(D.panelT, innerH, cd, walnut[4], 'liftTop:divider'), xDiv - D.panelT / 2, floorY + innerH / 2, 0),
    ...[1, -1].map((s) => at(box(wellX1 - wellX0, innerH, D.fasciaT, walnut[s > 0 ? 3 : 2], s > 0 ? 'liftTop:fasciaFront' : 'liftTop:fasciaBack'),
      (wellX0 + wellX1) / 2, floorY + innerH / 2, s * (cd / 2 - D.fasciaInset - D.fasciaT / 2))),
    at(rbox(D.marbleW, D.topT, D.d, marble, 'liftTop:marble', D), -D.w / 2 + D.marbleW / 2, bodyTop, 0),
  );

  // ---- legs: black tapered round, slightly splayed toward the corners, plus the small centre support (lift_top2.jpg)
  const legs = group('liftTop:legs');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const len = D.legH + D.panelT / 2; // head buried in the bottom panel; trimmed below so the tilted foot just touches the floor
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(L.topR), m(L.botR), m(len), 24), steel);
    leg.geometry.translate(0, -m(len) / 2, 0); // pivot at the top
    leg.castShadow = true; leg.name = 'liftTop:leg';
    at(leg, sx * (D.w / 2 - L.inset), D.legH + D.panelT / 2, sz * (D.d / 2 - L.inset));
    leg.rotation.set(sz * THREE.MathUtils.degToRad(L.splayDeg), 0, -sx * THREE.MathUtils.degToRad(L.splayDeg));
    leg.scale.y = leg.position.y / (leg.position.y - new THREE.Box3().setFromObject(leg).min.y); // splay lowers/raises the foot: land it on y=0
    legs.add(leg);
  }
  legs.add(at(cyl(L.centreR, D.legH, steel, 'liftTop:legCentre', 16), 0, D.legH / 2, 0));

  // ---- lift mechanism: parallelogram 4-bar. Arm angle phi is measured in the Z-Y plane from +Z; closed the arms lie
  // almost flat pointing back (-Z), open they swing up/forward, so the top travels an arc ending at (+liftFwd, +liftRise).
  const chord = Math.hypot(D.liftFwd, D.liftRise);
  const phi0 = Math.PI - THREE.MathUtils.degToRad(M.closedDeg);
  const phiMid = Math.PI - Math.atan2(D.liftFwd, D.liftRise); // arm direction at mid-travel is perpendicular to the chord
  const phi1 = 2 * phiMid - phi0;
  const armL = chord / (2 * Math.sin(phi0 - phiMid));
  const pivotY = bodyTop - M.railH / 2 - armL * Math.sin(phi0);
  const pivotZ = [M.frontPivotZ, M.frontPivotZ - M.armGap]; // base pivots of the front / rear arm pair
  const sides = [[wellX0, 1], [wellX1, -1]].map(([wall, inward]) => ({ inward, armX: wall + inward * (M.plateT + 0.1 + M.armT / 2) }));

  const top = group('liftTop:top', rbox(liftW, D.topT, D.d, walnut[0], 'liftTop:topPanel', D));
  top.children[0].position.set(m(D.w / 2 - liftW / 2), m(bodyTop), 0);
  const armSets = pivotZ.map((z, i) => at(group(i ? 'liftTop:armsRear' : 'liftTop:armsFront'), 0, pivotY, z));
  const springs = [];
  const springBase = [pivotZ[1] - S.baseBack, pivotY - S.baseDrop]; // [z, y] on the wall plate
  const springEnd = (phi) => [pivotZ[1] + S.along * Math.cos(phi), pivotY + S.along * Math.sin(phi)];
  const springLen = (phi) => { const [z, y] = springEnd(phi); return Math.hypot(z - springBase[0], y - springBase[1]); };
  const bodyLen = springLen(phi0) * 0.9, rodLen = springLen(phi1) - bodyLen + 0.3;

  for (const { inward, armX } of sides) {
    const wallX = armX - inward * (0.1 + M.armT / 2 + M.plateT / 2);
    body.add(at(box(M.plateT, M.plateH, M.plateL, steel, 'liftTop:wallPlate'), wallX, pivotY, pivotZ[0] + M.armW - M.plateL / 2)); // long mounting plate running back along the side wall (lift_top3.jpg)
    body.add(at(box(M.plateT, M.plateH, 2, steel, 'liftTop:springBracket'), wallX, springBase[1], springBase[0]));
    armSets.forEach((set) => {
      set.add(at(box(M.armT, M.armW, armL + M.armW, steel, 'liftTop:arm'), armX, 0, armL / 2)); // built along +Z, rotated by -phi about X
      set.add(at(lying(M.pinR, M.armT * 3, 'x', steel, 'liftTop:pin'), armX, 0, 0), at(lying(M.pinR, M.armT * 3, 'x', steel, 'liftTop:pin'), armX, 0, armL));
    });
    // rail under the top that carries the two upper pivots
    const railX = armX + inward * (M.armT / 2 + M.railW / 2 + 0.05), tipZ = (pivotZ[0] + pivotZ[1]) / 2 + armL * Math.cos(phi0);
    top.add(at(box(M.railW, M.railH, M.armGap + 2 * M.armW, steel, 'liftTop:topRail'), railX, bodyTop - M.railH / 2, tipZ));
    // gas spring: body hinged on the wall bracket, rod pinned to the rear arm
    const sp = at(group('liftTop:gasSpring'), armX + inward * (M.armT / 2 + S.bodyR + 0.05), springBase[1], springBase[0]);
    const rod = lying(S.rodR, rodLen, 'z', steel, 'liftTop:springRod'); // all visible hardware is black in lift_top3.jpg
    sp.add(at(lying(S.bodyR, bodyLen, 'z', steel, 'liftTop:springBody'), 0, 0, bodyLen / 2), rod);
    springs.push({ sp, rod });
    body.add(sp);
  }
  const span = Math.abs(sides[1].armX - sides[0].armX);
  armSets[1].add(at(lying(M.barR, span, 'x', steel, 'liftTop:crossBar'), (sides[0].armX + sides[1].armX) / 2, 0, armL * 0.55));

  const g = group('liftTop', body, legs, top, ...armSets);

  // ---- animation
  let t = 0, target = 0;
  const pose = () => {
    const phi = phi0 + (phi1 - phi0) * t * t * (3 - 2 * t); // smoothstep
    armSets.forEach((a) => { a.rotation.x = -phi; });
    top.position.set(0, m(armL * (Math.sin(phi) - Math.sin(phi0))), m(armL * (Math.cos(phi) - Math.cos(phi0))));
    const [z, y] = springEnd(phi), dz = z - springBase[0], dy = y - springBase[1], len = Math.hypot(dz, dy);
    for (const { sp, rod } of springs) { sp.rotation.x = -Math.atan2(dy, dz); rod.position.z = m(len - rodLen / 2); }
    g.updateMatrixWorld(true); // so bounds()/measurements right after setOpen(..., true) see the new pose
  };
  g.userData.setOpen = (open, instant = false) => { target = open ? 1 : 0; if (instant) { t = target; pose(); } };
  g.userData.isOpen = () => target === 1;
  g.userData.onClick = () => g.userData.setOpen(target === 0);
  g.userData.tick = (dt) => {
    if (t === target) return;
    t = THREE.MathUtils.clamp(t + (Math.sign(target - t) * dt) / M.seconds, 0, 1);
    pose();
  };
  pose();
  if (new URLSearchParams(globalThis.location?.search).get('lift') === 'open') g.userData.setOpen(true, true);

  // self-check: the linkage must land exactly on the specified rise/forward travel
  console.assert(pivotY - M.armW / 2 > floorY && springBase[1] - M.plateH / 2 > floorY && M.frontPivotZ + M.armW < cd / 2 - D.fasciaInset - D.fasciaT, 'liftTop mechanism fits the well');
  console.assert(Math.abs(armL * (Math.sin(phi1) - Math.sin(phi0)) - D.liftRise) < 1e-6 && Math.abs(armL * (Math.cos(phi1) - Math.cos(phi0)) - D.liftFwd) < 1e-6, 'liftTop linkage');
  return g;
}
