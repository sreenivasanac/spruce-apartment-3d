// Freestanding metal shoe rack for the shoe closet (spruce_apt_photos/shoe-rack-1, VACLIFE-style): four black 0.63" steel posts,
// black plastic U-connectors at every tier (the bottom ones double as feet), a front + back rail per tier with a black
// non-woven fabric deck slung between them, U-shaped top handles. 32.2 W x 11.8 D x 68.5 H at 10 tiers, 6.7" apart.
// Dressing: low-poly pairs (sneakers, slip-ons, sandals, slippers; Crocs on the bottom shelf), toes facing the doors.
// Click toggles 9 ⇄ 10 tiers: at 10 tiers the top handles reach 68.5", which runs into the closet rod (68" to its centre,
// ~12" off the back wall) — the clash is flagged with a red marker and in userData.fit.
// Contract: origin bottom centre, front +Z, width along X.
import * as THREE from 'three';
import { FURNITURE, SHOE_CLOSET, CLOSET, m } from '../dimensions.js';
import { std } from './cabinets/parts.js';
import { group } from '../lib/build.js';

const R = FURNITURE.shoeRack;
const black = std({ color: 0x1b1c1e, metalness: 0.5, roughness: 0.45, name: 'rack-steel' });
const plastic = std({ color: 0x141516, roughness: 0.6, name: 'rack-connector' });
const fabric = std({ color: 0x232426, roughness: 0.95, side: THREE.DoubleSide, name: 'rack-fabric' });

const mesh = (geo, mat, name, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(m(x), m(y), m(z)); o.name = name; o.castShadow = o.receiveShadow = true; return o; };
const boxG = (w, h, d) => new THREE.BoxGeometry(m(w), m(h), m(d));
const tube = (len, axis, dia = R.post) => { const g = new THREE.CylinderGeometry(m(dia / 2), m(dia / 2), m(len), 12); if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); return g; };

// ---------------------------------------------------------------- shoes (one shoe, toe toward +Z, sole at y=0; units = inches)
const SHOE_COLORS = [0xf2f2ee, 0x2c3e66, 0xb03a2e, 0x8a8f96, 0xd8c3a5, 0x4f6b4a, 0x1c1c1c, 0xe0e0e0, 0x7a5236, 0x3c78a8, 0xe8a93b, 0xc8c8cc];
function shoe(kind, color, accent) {
  const g = new THREE.Group(), up = std({ color, roughness: 0.7 }), sole = std({ color: accent ?? 0xf1efe9, roughness: 0.8 });
  const L = kind === 'croc' ? 10.6 : kind === 'sandal' ? 10.2 : 10.4, W = kind === 'croc' ? 4.2 : 3.7;
  const footprint = () => { // rounded sole outline, wider at the toe
    const s = new THREE.Shape(), l = L / 2, w = W / 2;
    s.moveTo(0, -l); s.bezierCurveTo(w * 0.95, -l, w * 0.9, -l * 0.3, w, l * 0.25); s.bezierCurveTo(w * 1.05, l * 0.85, w * 0.4, l, 0, l);
    s.bezierCurveTo(-w * 0.4, l, -w * 1.05, l * 0.85, -w, l * 0.25); s.bezierCurveTo(-w * 0.9, -l * 0.3, -w * 0.95, -l, 0, -l);
    return s;
  };
  const extr = (h, mat) => { // outline is in inches: extrude, stand it up (sole at y=0, toe toward +Z), then convert once to metres
    const geo = new THREE.ExtrudeGeometry(footprint(), { depth: h, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1, curveSegments: 8 });
    geo.rotateX(Math.PI / 2); geo.translate(0, h + 0.15, 0); geo.scale(m(1), m(1), m(1)); return mesh(geo, mat, 'shoe'); };
  if (kind === 'sneaker' || kind === 'slipon') {
    g.add(extr(1.0, sole));
    const body = mesh(new THREE.SphereGeometry(m(1), 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), up, 'shoe:upper', 0, 0.9, -0.6);
    body.scale.set(W * 0.48, kind === 'sneaker' ? 3.6 : 2.6, L * 0.47); g.add(body);
    g.add(mesh(new THREE.CylinderGeometry(m(1.2), m(1.3), m(0.3), 14), std({ color: 0x2a2a2a, roughness: 0.9 }), 'shoe:opening', 0, kind === 'sneaker' ? 4.2 : 3.2, -2.4)); // collar opening
    if (kind === 'sneaker') g.add(mesh(boxG(1.3, 0.25, 3.2), sole, 'shoe:laces', 0, 3.55, 1.0).rotateX(-0.35));
  } else if (kind === 'sandal' || kind === 'slipper') {
    g.add(extr(kind === 'slipper' ? 0.9 : 0.7, sole));
    const strap = mesh(new THREE.TorusGeometry(m(W * 0.5), m(kind === 'slipper' ? 0.9 : 0.3), 8, 20, Math.PI), up, 'shoe:strap', 0, 0.8, kind === 'slipper' ? 1.8 : 0.8);
    strap.scale.z = kind === 'slipper' ? 1.6 : 1; strap.rotation.y = Math.PI / 2 * 0; g.add(strap);
    if (kind === 'sandal') g.add(mesh(new THREE.TorusGeometry(m(W * 0.48), m(0.25), 6, 16, Math.PI), up, 'shoe:strap2', 0, 0.8, -1.6));
  } else { // croc: chunky clog with a heel strap
    g.add(extr(1.2, up));
    const body = mesh(new THREE.SphereGeometry(m(1), 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), up, 'shoe:croc-upper', 0, 1.1, 1.0);
    body.scale.set(W * 0.5, 2.8, L * 0.36); g.add(body);
    const holes = std({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.8 });
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.CylinderGeometry(m(0.22), m(0.22), m(0.1), 8), holes, 'shoe:croc-hole', ((i % 3) - 1) * 0.9, 3.6, 1.2 + Math.floor(i / 3) * 1.2));
    g.add(mesh(new THREE.TorusGeometry(m(W * 0.5), m(0.3), 6, 16, Math.PI), up, 'shoe:croc-strap', 0, 2.2, -3.2).rotateX(-0.6));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
function pair(kind, color, accent, name) {
  const p = new THREE.Group(); p.name = name;
  for (const s of [-1, 1]) { const sh = shoe(kind, color, accent); sh.position.x = m(s * 2.2); sh.rotation.y = s * -0.04; p.add(sh); }
  return p;
}
// what goes on each shelf, bottom (index 0) up; Crocs on the bottom shelf as requested
const SHELF_KINDS = [['croc', 'slipon'], ['sneaker', 'sneaker'], ['sneaker', 'slipon'], ['sandal', 'sneaker'], ['sneaker', 'slipper'],
  ['slipon', 'sneaker'], ['sneaker', 'sandal'], ['slipper', 'sneaker'], ['sandal', 'slipon'], ['sneaker']];

// ---------------------------------------------------------------- rack
function buildRack(tiers, rodClash) {
  const g = group(`shoeRack:${tiers}`);
  const w = R.w, d = R.d, P = R.post, xIn = w / 2 - P / 2, zIn = d / 2 - P / 2;
  const topShelf = R.bottom + (tiers - 1) * R.pitch, H = topShelf + (R.h - R.bottom - (R.tiersMax - 1) * R.pitch); // handles keep their height above the top shelf
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(mesh(tube(H - P / 2, 'y'), black, 'shoeRack:post', sx * xIn, (H - P / 2) / 2, sz * zIn));
    g.add(mesh(tube(d - P, 'z'), black, 'shoeRack:handle', sx * xIn, H - P / 2, 0)); // U-shaped top handle
  }
  for (let i = 0; i < tiers; i++) {
    const y = R.bottom + i * R.pitch;
    for (const sx of [-1, 1]) { // U-connector across the depth, sleeves round the posts; bottom row reaches the floor as feet
      g.add(mesh(boxG(P + 0.35, R.connH, d - P), plastic, 'shoeRack:connector', sx * xIn, y - R.connH / 2 + 0.3, 0));
      for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(m(P / 2 + 0.17), m(P / 2 + 0.17), m(R.connH + 0.6), 12), plastic, 'shoeRack:sleeve', sx * xIn, y - R.connH / 2 + 0.1, sz * zIn));
      if (i === 0) g.add(mesh(boxG(P + 0.6, y, d + 0.3), plastic, 'shoeRack:foot', sx * xIn, y / 2, 0));
    }
    for (const sz of [-1, 1]) g.add(mesh(tube(w - 2 * P, 'x', R.rail), black, 'shoeRack:rail', 0, y, sz * (zIn - 0.1)));
    const deck = mesh(boxG(w - 2 * P - 0.2, 0.06, d - P - 0.4), fabric, 'shoeRack:fabric', 0, y - 0.05, 0);
    g.add(deck);
    // shoes: spread the shelf's pairs evenly, sitting on the fabric, toes to the front
    const kinds = SHELF_KINDS[i] ?? [], n = Math.min(kinds.length, R.pairs[i] ?? 0);
    for (let k = 0; k < n; k++) {
      const c = SHOE_COLORS[(i * 3 + k * 5) % SHOE_COLORS.length], kind = kinds[k];
      const pr = pair(kind, kind === 'croc' ? 0x8fd1b0 : c, kind === 'croc' ? 0x8fd1b0 : undefined, `shoeRack:pair-${i + 1}-${k + 1}-${kind}`);
      pr.position.set(m((k - (n - 1) / 2) * (w / Math.max(n, 2.6))), m(y), m(0.3));
      g.add(pr);
    }
  }
  if (rodClash) { // red marker where the top front of the rack meets the rod
    const mk = mesh(boxG(w + 0.4, 1.4, 1.6), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.55, depthTest: false }), 'shoeRack:clash', 0, H - 0.7, zIn);
    mk.castShadow = false; mk.renderOrder = 20; g.add(mk);
  }
  return g;
}

/** Clearance check against the closet rod (all inches, measured from the back wall / floor). Negative = overlap. */
export function rodFit(tiers) {
  const H = R.bottom + (tiers - 1) * R.pitch + (R.h - R.bottom - (R.tiersMax - 1) * R.pitch);
  const rodBottom = SHOE_CLOSET.rodElev - CLOSET.rod.dia / 2, rodBackFace = SHOE_CLOSET.rodOut - CLOSET.rod.dia / 2;
  const rackFront = 0.75 + R.d; // 0.6" baseboard stand-off + 0.15" foot overhang
  const vertical = rodBottom - H, depth = rodBackFace - rackFront;
  return { tiers, height: Math.round(H * 100) / 100, clearanceBelowRod: Math.round(vertical * 100) / 100, rackFrontVsRodBack: Math.round(depth * 100) / 100, fits: vertical >= 0 || depth >= 0 };
}

export function build() {
  const root = group('shoeRack');
  let tiers = Number(new URLSearchParams(location.search).get('rack')) || R.tiers;
  const show = () => {
    root.clear();
    const fit = rodFit(tiers);
    root.add(buildRack(tiers, !fit.fits));
    root.userData.fit = fit;
    root.userData.actionLabel = tiers === R.tiersMax ? `Show 9 tiers (10 hits the rod by ${Math.abs(fit.clearanceBelowRod)}″)` : `Show the full 10 tiers (${R.h}″)`;
  };
  root.userData.onClick = () => { tiers = tiers === R.tiersMax ? R.tiersMax - 1 : R.tiersMax; show(); };
  show();
  return root;
}
