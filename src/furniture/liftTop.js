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

// Walnut laminate print: grain runs along U, plank-like tonal bands, coherent wavy grain lines. Tiles in both axes.
function drawWalnut(ctx, W, H) {
  const r = rng(41);
  ctx.fillStyle = 'rgb(101,62,41)'; ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H;) { // printed "plank" bands
    const bh = H * (0.16 + r() * 0.1);
    ctx.fillStyle = r() < 0.5 ? `rgba(38,18,8,${r() * 0.26})` : `rgba(196,134,92,${r() * 0.15})`;
    ctx.fillRect(0, y, W, bh);
    ctx.fillStyle = 'rgba(30,14,8,0.35)'; ctx.fillRect(0, y, W, 1.5);
    y += bh;
  }
  // shared low-frequency warp so neighbouring grain lines flow together (integer periods => tiles along U)
  const waves = Array.from({ length: 5 }, (_, i) => ({ k: i + 1, a: (H * 0.009 / (i + 1)) * (0.5 + r()), p: r() * TAU, c: (r() - 0.5) * 0.015 }));
  for (let i = 0; i < 1500; i++) {
    const y0 = r() * H;
    ctx.strokeStyle = r() < 0.62 ? `rgba(40,20,12,${0.05 + r() * 0.24})` : `rgba(180,122,86,${0.04 + r() * 0.13})`;
    ctx.lineWidth = 0.6 + r() * r() * 5;
    for (const oy of [-H, 0, H]) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        let y = y0 + oy;
        for (const w of waves) y += w.a * Math.sin((w.k * TAU * x) / W + w.p + y0 * w.c);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(28,13,8,${0.1 + r() * 0.2})`; ctx.fillRect(r() * W, r() * H, 3 + r() * 14, 1); } // pores
}

// White faux marble: soft grey clouding + a few wandering, branching veins with soft halos.
// (No ctx.filter: blur filters blanked the canvas in headless Chrome, so softness is faked with gradients / wide faint strokes.)
function drawMarble(ctx, W, H) {
  const r = rng(77);
  ctx.fillStyle = 'rgb(238,236,232)'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 200, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(128,130,138,${0.05 + r() * 0.13})`); g.addColorStop(1, 'rgba(128,130,138,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  ctx.lineJoin = ctx.lineCap = 'round';
  const vein = (x, y, dir, len, wid, depth) => {
    const home = dir, pts = [[x, y]];
    for (let i = 0; i < len; i++) {
      dir += (r() - 0.5) * 0.5 + (home - dir) * 0.08; // wander, but keep the slab's dominant vein direction
      x += Math.cos(dir) * 14; y += Math.sin(dir) * 14; pts.push([x, y]);
      if (depth < 2 && r() < 0.03) vein(x, y, dir + (r() < 0.5 ? 0.7 : -0.7), len * 0.4, wid * 0.55, depth + 1);
    }
    for (const [scale, alpha] of [[12, 0.03], [7, 0.05], [4, 0.08], [2, 0.14], [1, 0.4]]) { // wide faint passes = halo, last = the vein
      ctx.strokeStyle = `rgba(98,100,110,${alpha})`;
      for (let i = 1; i < pts.length; i++) {
        ctx.lineWidth = wid * scale * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.37 + wid)));
        ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke();
      }
    }
  };
  const flow = 0.6; // dominant vein direction (rad)
  for (let i = 0; i < 4; i++) vein(-40, H * (i / 4 + r() * 0.2) - H * 0.2, flow + (r() - 0.5) * 0.5, 95, 4 + r() * 6, 0); // bold veins crossing the slab
  for (let i = 0; i < 5; i++) vein(r() * W, r() * H, flow + (r() - 0.5) * 1.6, 30 + r() * 30, 1 + r() * 1.5, 2); // hairlines
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
  const walnutTex = tileTex(2048, 1024, 48, 24, drawWalnut);
  // same print, shifted per panel so no two panels show the identical grain
  const walnut = [0, 1, 2, 3, 4].map((i) => {
    const t = i ? walnutTex.clone() : walnutTex;
    t.offset.set(i * 0.37, i * 0.23); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, name: `liftTop-walnut-${i}` });
  });
  const marbleTex = tileTex(1024, 1024, 24, 24, drawMarble);
  marbleTex.offset.set(0.5, 0.5); // slab UVs are centred on 0: keep the (non-tiling) tile seam off the slab
  const marble = new THREE.MeshPhysicalMaterial({ map: marbleTex, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.08, name: 'liftTop-faux-marble' });
  const steel = MAT.blackMetal;

  const bodyTop = D.h - D.topT, bodyH = bodyTop - D.legH, innerH = bodyH - D.panelT, floorY = D.legH + D.panelT;
  const xDiv = -D.w / 2 + D.marbleW; // seam between marble and lift top; divider panel sits just under the marble edge
  const wellX0 = xDiv, wellX1 = D.w / 2 - D.panelT, liftW = D.w / 2 - xDiv - D.topGap;

  // ---- carcass
  const body = group('liftTop:body',
    at(box(D.w - 2 * D.panelT, D.panelT, D.d, walnut[1], 'liftTop:bottom'), 0, D.legH + D.panelT / 2, 0),
    at(box(D.panelT, bodyH, D.d, walnut[2], 'liftTop:sideL'), -D.w / 2 + D.panelT / 2, D.legH + bodyH / 2, 0),
    at(box(D.panelT, bodyH, D.d, walnut[3], 'liftTop:sideR'), D.w / 2 - D.panelT / 2, D.legH + bodyH / 2, 0),
    at(box(D.panelT, innerH, D.d, walnut[4], 'liftTop:divider'), xDiv - D.panelT / 2, floorY + innerH / 2, 0),
    ...[1, -1].map((s) => at(box(wellX1 - wellX0, innerH, D.panelT, walnut[s > 0 ? 3 : 2], s > 0 ? 'liftTop:fasciaFront' : 'liftTop:fasciaBack'),
      (wellX0 + wellX1) / 2, floorY + innerH / 2, s * (D.d / 2 - D.fasciaInset - D.panelT / 2))),
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
    body.add(at(box(M.plateT, M.plateH, M.armGap + 2.5 * M.armW, steel, 'liftTop:wallPlate'), wallX, pivotY, (pivotZ[0] + pivotZ[1]) / 2));
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
    const rod = lying(S.rodR, rodLen, 'z', MAT.chrome, 'liftTop:springRod');
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
  console.assert(Math.abs(armL * (Math.sin(phi1) - Math.sin(phi0)) - D.liftRise) < 1e-6 && Math.abs(armL * (Math.cos(phi1) - Math.cos(phi0)) - D.liftFwd) < 1e-6, 'liftTop linkage');
  return g;
}
