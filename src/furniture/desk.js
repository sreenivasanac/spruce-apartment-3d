// Contract: build() returns a THREE.Group named 'desk', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT (sitter's side) facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.desk.pos/rot and makes it draggable.
// Reference: spruce_apt_photos/table.jpg, table2.jpg — 63x24x29 splice-board desk, black 1x1.5 steel tube frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, group } from '../lib/build.js';

/**
 * Rustic-brown laminate woodgrain, grain along U. Tileable; one tile = D.woodTile inches square.
 * Grain = iso-lines of ONE smooth periodic scalar field (so lines never cross); Gaussian bumps stretched along U
 * bend the lines into cathedral/flame figures, two tight strong bumps make knots. Returns { map, bump }.
 */
function woodTexture() {
  const s = 1024, r = rng(63), TAU = 2 * Math.PI;
  const waves = (n, fu, fv) => Array.from({ length: n }, () => [1 + (r() * fu | 0), (r() * (2 * fv + 1) | 0) - fv, r() * TAU, 0.5 + r() * 0.5]); // integer freqs => periodic
  const noise = (W, u, v) => W.reduce((a, [fu, fv, ph, amp]) => a + amp * Math.sin(TAU * (fu * u + fv * v) + ph), 0) / W.length;
  const warp = waves(7, 1, 3), tone = waves(5, 1, 3), fine = waves(8, 1, 60), wrap = (d) => d - Math.round(d);
  const bumps = [[0.22, 0.30, 0.30, 0.050, 2.6], [0.70, 0.72, 0.32, 0.045, -2.4], [0.55, 0.12, 0.26, 0.035, 1.8], [0.36, 0.585, 0.045, 0.012, 3], [0.86, 0.43, 0.04, 0.010, 2.5]]; // [u0, v0, sigmaU, sigmaV, rings] — last two are knots
  const dark = [0x5e, 0x2d, 0x10], mid = [0x9c, 0x5b, 0x2a], hi = [0xbd, 0x7f, 0x45];
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };
  const cMap = mk(), cBump = mk(), xMap = cMap.getContext('2d'), xBump = cBump.getContext('2d');
  const iMap = xMap.createImageData(s, s), iBump = xBump.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s, v = y / s;
    let f = 14 * v + 1.6 * noise(warp, u, v), knot = 0;
    bumps.forEach(([u0, v0, su, sv, A], i) => { const g = Math.exp(-((wrap(u - u0) / su) ** 2 + (wrap(v - v0) / sv) ** 2)); f += A * g; if (i > 2) knot = Math.max(knot, g); });
    const t = f - Math.floor(f), t2 = 5 * f - Math.floor(5 * f); // main rings + 5x finer grain, same field
    let k = t < 0.1 ? t / 0.1 : 1 - 0.8 * ((t - 0.1) / 0.9) ** 0.7; // sharp dark line, fast rise, slow fade
    k = k * 0.78 + 0.22 * (t2 < 0.2 ? t2 / 0.2 : 1 - (t2 - 0.2) / 0.8);
    k *= 1 - 0.55 * Math.max(0, noise(tone, u, v) * 2.2); // broad low-frequency dark umber bands
    k *= 1 - 0.5 * Math.max(0, noise(fine, u, f / 14)); // fine streaks along the same field so they follow the figure (f/14 advances exactly 1 per tile => still periodic)
    k = Math.max(0, k * (1 - 0.8 * knot ** 3));
    const a = k < 0.5 ? dark : mid, b = k < 0.5 ? mid : hi, w = k < 0.5 ? k * 2 : (k - 0.5) * 2, o = 4 * (y * s + x);
    for (let c = 0; c < 3; c++) iMap.data[o + c] = a[c] + (b[c] - a[c]) * w;
    iBump.data[o] = iBump.data[o + 1] = iBump.data[o + 2] = 90 + 150 * k; iMap.data[o + 3] = iBump.data[o + 3] = 255;
  }
  xMap.putImageData(iMap, 0, 0); xBump.putImageData(iBump, 0, 0);
  for (let i = 0; i < 6000; i++) { const px = r() * s, py = r() * s, l = 3 + r() * 14, al = 0.06 + r() * 0.14; // pores
    xMap.fillStyle = `rgba(40,18,8,${al})`; xMap.fillRect(px, py, l, 1); xBump.fillStyle = `rgba(0,0,0,${al * 2})`; xBump.fillRect(px, py, l, 1); }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: tex(cMap, true), bump: tex(cBump, false) };
}

/** Box with eased edges (inches). uvOffset != null => UVs in inches, projected per dominant normal so the grain (U) runs along every edge band. */
function rbox(w, h, d, r, mat, name, uvOffset = null) {
  const g = new RoundedBoxGeometry(m(w), m(h), m(d), 3, m(r));
  if (uvOffset) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, i1 = 1 / m(1);
    for (let i = 0; i < p.count; i++) {
      const [x, y, z] = [p.getX(i) * i1, p.getY(i) * i1, p.getZ(i) * i1];
      const [u, v] = Math.abs(n.getX(i)) > 0.7 ? [z, y + 5.3] : Math.abs(n.getZ(i)) > 0.7 ? [x, y + 11.1] : [x, z]; // ends | front/back edge bands (offset so they don't repeat the top) | top
      uv.setXY(i, u + uvOffset[0], v + uvOffset[1]);
    }
  }
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function build() {
  const D = FURNITURE.desk;
  const at = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);
  const underTop = D.h - D.topT;

  // ---- three-panel top: wood | matte black | wood, hairline dark seams between the panels
  const wt = woodTexture(), wood = MAT.rusticWood.clone();
  wood.color.set(0xffffff); wood.map = wt.map; wood.bumpMap = wt.bump; wood.bumpScale = 0.15; wood.roughness = 0.5; wood.name = 'desk-rustic-laminate';
  for (const t of [wt.map, wt.bump]) t.repeat.setScalar(1 / D.woodTile);
  const midW = D.w - 2 * D.endPanelW - 2 * D.seamW, topY = underTop + D.topT / 2, endX = (D.w - D.endPanelW) / 2, seamX = (midW + D.seamW) / 2;
  const seam = (sx) => at(box(D.seamW, D.topT - 2 * D.edgeR, D.d - 2 * D.edgeR, MAT.cabinetGap, 'desk:seam'), sx * seamX, topY, 0);
  const top = group('desk:top',
    at(rbox(D.endPanelW, D.topT, D.d, D.edgeR, wood, 'desk:top-left', [0, 0]), -endX, topY, 0),
    at(rbox(midW, D.topT, D.d, D.edgeR, MAT.blackLaminate, 'desk:top-centre'), 0, topY, 0),
    at(rbox(D.endPanelW, D.topT, D.d, D.edgeR, wood, 'desk:top-right', [9.3, 13.7]), endX, topY, 0), // offset so the two ends don't mirror
    seam(-1), seam(1),
  );

  // ---- frame: 1 x 1.5 black steel tube. Each side = closed rectangle (2 legs + top rail + floor stretcher); front + rear long rails under the top
  const legX = D.w / 2 - D.frameInset - D.tubeT / 2, legZ = D.d / 2 - D.railInset - D.leg / 2;
  const legH = underTop - D.footH, between = 2 * legZ - D.leg, span = 2 * legX - D.tubeT;
  const steel = MAT.blackMetal.clone(); // matte powder-coat: charcoal, soft edge highlights instead of a flat black silhouette
  steel.color.set(0x1b1b1d); Object.assign(steel, { metalness: 0.35, roughness: 0.55, envMapIntensity: 0.8, name: 'desk-powdercoat' });
  const tube = (w, h, d, name) => rbox(w, h, d, D.tubeR, steel, name);
  const frame = group('desk:frame');
  for (const sx of [-1, 1]) {
    const side = sx < 0 ? 'L' : 'R';
    for (const sz of [-1, 1]) {
      frame.add(at(tube(D.tubeT, legH, D.leg, `desk:leg-${side}${sz < 0 ? 'rear' : 'front'}`), sx * legX, D.footH + legH / 2, sz * legZ));
      const foot = at(cyl(D.footDia / 2, D.footH, MAT.blackPlastic, 'desk:foot'), sx * legX, D.footH / 2, sz * legZ);
      frame.add(foot);
    }
    frame.add(at(tube(D.tubeT, D.railH, between, `desk:side-rail-${side}`), sx * legX, underTop - D.railH / 2, 0));
    frame.add(at(tube(D.tubeT, D.railH, between, `desk:stretcher-${side}`), sx * legX, D.footH + D.railH / 2, 0));
  }
  frame.add(at(tube(span, D.railH, D.tubeT, 'desk:front-rail'), 0, underTop - D.railH / 2, legZ));
  frame.add(at(tube(span, D.railH, D.tubeT, 'desk:rear-bar'), 0, underTop - D.railH / 2, -legZ)); // rear cross-bar sits right under the top (table.jpg shows no low bar)
  // connector plate where the two half-frames bolt together (hangs below the front rail at mid-span) + bolt heads at the side-frame top corners
  const [cw, ch, cd] = D.clip;
  frame.add(at(box(cw, ch, cd, steel, 'desk:centre-clip'), 0, underTop - D.railH - ch / 2 + D.clipLap, legZ + D.tubeT / 2));
  const bolts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const dz of [0, D.leg / 2 + D.boltPitch])
    bolts.push(new THREE.CylinderGeometry(m(D.boltDia / 2), m(D.boltDia / 2), m(D.boltT), 12).rotateZ(Math.PI / 2).translate(m(sx * (legX + D.tubeT / 2 + D.boltT / 2)), m(underTop - D.railH / 2), m(sz * (legZ - dz))));
  const boltMesh = new THREE.Mesh(mergeGeometries(bolts), MAT.blackPlastic); boltMesh.name = 'desk:bolts'; frame.add(boltMesh);

  return group('desk', top, frame);
}
