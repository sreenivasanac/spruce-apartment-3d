// Contract: build() returns a THREE.Group named 'wardrobe', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.wardrobe.pos/rot and makes it draggable.
// Reference: spruce_apt_photos/antbox1.jpg, antbox2.jpg — ANTBOX folding-cube wardrobe, 3 columns x 3 tiers,
// white moulded plastic, smoked-brown translucent door panels, champagne D handles, doors hinged on their right edge.
// Overall bounding box (doors closed, handles included) is exactly w x d x h. Click toggles the top-tier doors.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { cyl, group } from '../lib/build.js';

const at = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);

function roundedRect(w, h, r, x0 = 0, y0 = 0, Path = THREE.Shape) {
  const s = new Path();
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0);
  s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2);
  s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI);
  return s;
}

/** Extrude an inch-space shape to `depth` inches with a soft moulded bevel that stays inside the outline; returns metres. */
function extrude(shape, depth, bev, seg = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: seg, curveSegments: 10 });
  g.translate(0, 0, bev);
  return g.scale(m(1), m(1), m(1));
}

const mesh = (g, mat, name, shadow = true) => {
  const o = new THREE.Mesh(g, mat);
  o.castShadow = o.receiveShadow = shadow;
  o.name = name;
  return o;
};

export function build() {
  const W = FURNITURE.wardrobe, H = W.handle;
  const cw = W.w / W.cols, t = W.wallT;
  const bodyD = W.d - W.doorT - H.proj, zBack = -W.d / 2, zFront = zBack + bodyD; // body front = door back
  const tiers = []; // bottom -> top: {y0, h}
  [...W.tiers].reverse().reduce((y, h) => (tiers.push({ y0: y, h }), y + h), 0);
  const topTier = tiers.length - 1;

  const white = MAT.whitePlastic.clone(); Object.assign(white, { roughness: 0.38, name: 'antbox-white-pp' }); white.color.set(0xf3f1ec);
  const smoked = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.05, envMapIntensity: 0.3, transparent: true, opacity: 0.9, depthWrite: false, name: 'antbox-smoked-panel' });
  const gold = MAT.brass.clone(); Object.assign(gold, { metalness: 0.55, roughness: 0.34, name: 'antbox-champagne-gold' }); gold.color.set(0xdcb592);
  const shelfMat = MAT.whitePlastic.clone(); Object.assign(shelfMat, { roughness: 0.6, name: 'antbox-shelf-beige' }); shelfMat.color.set(0xd9c6a4);

  // ---- carcass: every cell is its own moulded cube (so walls double up between cells like the real thing); one merged mesh
  const parts = [];
  const bx = (w, h, d, x, y, z, r = 0) => {
    const g = (r ? new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(r)) : new THREE.BoxGeometry(m(w), m(h), m(d))).toNonIndexed();
    parts.push(g.translate(m(x), m(y), m(z)));
  };
  const ribs = (span, c0, make) => { // evenly spaced ribs across `span` starting at c0
    const n = Math.max(1, Math.round(span / W.ribPitch)), p = span / n;
    for (let i = 0; i < n; i++) make(c0 + (i + 0.5) * p);
  };
  const zc = zBack + bodyD / 2, skinX = W.w / 2 - W.ribT; // outer side skins sit ribT inside the envelope; rims + ribs reach it
  tiers.forEach(({ y0, h }, ti) => {
    for (let c = 0; c < W.cols; c++) {
      const x0 = -W.w / 2 + c * cw, xc = x0 + cw / 2;
      const xl = c === 0 ? -skinX : x0, xr = c === W.cols - 1 ? skinX : x0 + cw;
      bx(xr - xl, t, bodyD, (xl + xr) / 2, y0 + t / 2, zc, 0.08);           // floor
      bx(xr - xl, t, bodyD, (xl + xr) / 2, y0 + h - t / 2, zc, 0.08);       // roof
      bx(t, h - 2 * t, bodyD, xl + t / 2, y0 + h / 2, zc);                  // left wall
      bx(t, h - 2 * t, bodyD, xr - t / 2, y0 + h / 2, zc);                  // right wall
      bx(xr - xl - 2 * t, h - 2 * t, t, (xl + xr) / 2, y0 + h / 2, zBack + t / 2); // back
      ribs(cw - 2 * t - 1, xc - (cw - 2 * t - 1) / 2, (x) => bx(W.ribW, h - 2 * t - 1.5, W.ribT, x, y0 + h / 2, zBack + t + W.ribT / 2)); // inner back ribs
      if (ti === topTier) for (const [xw, s] of [[xl + t, 1], [xr - t, -1]]) // inner side ribs (seen when the doors are open)
        ribs(bodyD - t - 2, zBack + t + 1, (z) => bx(W.ribT, h - 2 * t - 1.5, W.ribW, xw + s * W.ribT / 2, y0 + h / 2, z));
    }
    for (const s of [-1, 1]) { // exterior ribbed side panels: raised rim + vertical ribs, flush with the w envelope
      const x = s * (W.w / 2 - W.ribT / 2), rim = 0.9;
      bx(W.ribT, rim, bodyD, x, y0 + rim / 2, zc); bx(W.ribT, rim, bodyD, x, y0 + h - rim / 2, zc);
      for (const z of [zBack + rim / 2, zFront - rim / 2]) bx(W.ribT, h - 2 * rim, rim, x, y0 + h / 2, z);
      ribs(bodyD - 2 * rim - 0.6, zBack + rim + 0.3, (z) => bx(W.ribT, h - 2 * rim - 1.2, W.ribW, x, y0 + h / 2, z));
    }
  });
  const carcass = mesh(mergeGeometries(parts), white, 'wardrobe:carcass');

  // ---- doors: moulded rounded frame + smoked panel + champagne handle, in a pivot group on the door's right edge
  const dw = cw - W.doorGap, bev = 0.16;
  const handleShape = roundedRect(H.w, H.h, H.w * 0.3);
  handleShape.holes.push(roundedRect(H.w - 2 * H.bar, H.h - 2 * H.bar, H.w * 0.18, H.bar, H.bar, THREE.Path));
  const handleGeo = extrude(handleShape, H.proj + 0.05, 0.06, 2); // sunk 0.05 into the frame so it never floats
  const doors = group('wardrobe:doors'), pivots = [];
  tiers.forEach(({ y0, h }, ti) => {
    const dh = h - W.doorGap;
    const frame = roundedRect(dw, dh, W.doorR, -dw, 0);
    frame.holes.push(roundedRect(dw - 2 * W.frameW, dh - 2 * W.frameW, W.panelR, -dw + W.frameW, W.frameW, THREE.Path));
    const frameGeo = extrude(frame, W.doorT, bev).translate(0, 0, -m(W.doorT)); // pivot = front-right edge, so an open door never cuts into the carcass
    const lip = 0.25; // panel tucks this far under the frame
    const panelGeo = extrude(roundedRect(dw - 2 * W.frameW + 2 * lip, dh - 2 * W.frameW + 2 * lip, W.panelR + lip, -dw + W.frameW - lip, W.frameW - lip), 0.1, 0.02, 1);
    for (let c = 0; c < W.cols; c++) {
      const id = `t${tiers.length - ti}c${c + 1}`; // t1 = top tier, c1 = left column (as seen from the front)
      const panel = mesh(panelGeo, smoked, `wardrobe:panel-${id}`); // casts shadow: smoked acrylic keeps the interior dim
      panel.position.z = m(-W.doorT * 0.6);
      const handle = mesh(handleGeo, gold, `wardrobe:handle-${id}`);
      handle.position.set(m(-dw + 0.06), m(dh / 2 - H.h / 2), m(-0.05));
      const pivot = group(`wardrobe:door-${id}`, mesh(frameGeo, white, `wardrobe:doorFrame-${id}`), panel, handle);
      at(pivot, -W.w / 2 + (c + 1) * cw - W.doorGap / 2, y0 + W.doorGap / 2, zFront + W.doorT);
      if (ti === topTier) pivots.push(pivot);
      doors.add(pivot);
    }
  });

  // ---- contents (dim through the smoked panels, clear when the top doors open): rods + hanging clothes, shelves + folded stacks
  const r = rng(67), inside = group('wardrobe:contents');
  const top = tiers[topTier], rodY = top.y0 + top.h - t - W.rodDrop, zRod = zBack + bodyD * 0.5;
  const garmentShape = new THREE.Shape(); // unit silhouette in (z, y): hanger-width shoulders flaring to the hem, y from -1 (hem) to 0 (shoulder)
  garmentShape.moveTo(-0.08, 0); garmentShape.lineTo(0.08, 0); garmentShape.lineTo(0.4, -0.1); garmentShape.lineTo(0.5, -1); garmentShape.lineTo(-0.5, -1); garmentShape.lineTo(-0.4, -0.1); garmentShape.closePath();
  const garmentGeo = new THREE.ExtrudeGeometry(garmentShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.03, bevelSegments: 2 }).translate(0, 0, -0.3).rotateY(-Math.PI / 2); // thickness now along x, centred
  const hangerGeo = mergeGeometries([new THREE.BoxGeometry(0.25, 0.3, 0.84).translate(0, 0.1, 0), new THREE.BoxGeometry(0.14, 2.9, 0.012).translate(0, 1.6, 0)]); // inches in x/y, unit width in z
  const palette = [0x1b1b1f, 0xb3202a, 0xe9e4da, 0x2a2f45, 0x6a2a3a, 0xd9a7a0, 0x23463f, 0x111114, 0xc9c2b4];
  const nPer = 5, garments = new THREE.InstancedMesh(garmentGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, name: 'wardrobe-fabric' }), nPer * W.cols);
  const hangers = new THREE.InstancedMesh(hangerGeo, MAT.blackPlastic, nPer * W.cols);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color();
  for (let c = 0, k = 0; c < W.cols; c++) {
    const x0 = -W.w / 2 + c * cw + t + 1.2, span = cw - 2 * t - 2.4;
    const rod = cyl(W.rodDia / 2, cw - 2 * t, MAT.chrome, `wardrobe:rod-c${c + 1}`, 16);
    rod.rotation.z = Math.PI / 2; inside.add(at(rod, -W.w / 2 + (c + 0.5) * cw, rodY, zRod));
    for (let i = 0; i < nPer; i++, k++) {
      const x = x0 + ((i + 0.5 + (r() - 0.5) * 0.5) / nPer) * span, len = 15 + r() * 8, wid = 12.5 + r() * 2.5, thick = 0.9 + r() * 0.7;
      const hangW = 3.2; // hanger hook + neck height below the rod centre
      Q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.25, 0));
      garments.setMatrixAt(k, M.compose(new THREE.Vector3(m(x), m(rodY - hangW), m(zRod)), Q, new THREE.Vector3(m(thick), m(len), m(wid))));
      garments.setColorAt(k, col.setHex(palette[(r() * palette.length) | 0]));
      hangers.setMatrixAt(k, M.compose(new THREE.Vector3(m(x), m(rodY - hangW), m(zRod)), Q, new THREE.Vector3(m(1), m(1), m(wid))));
    }
  }
  garments.name = 'wardrobe:clothes'; hangers.name = 'wardrobe:hangers';
  garments.castShadow = true; garments.receiveShadow = true;
  inside.add(garments, hangers);

  // shelves at mid-height of the middle tier's outer cells (antbox1.jpg) + folded stacks in middle and bottom tiers
  const stackGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
  const stacks = new THREE.InstancedMesh(stackGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, name: 'wardrobe-folded' }), 40);
  let sk = 0;
  const pile = (xc, y, n) => { for (let i = 0; i < n; i++, sk++) { const hh = 1 + r() * 0.5; stacks.setMatrixAt(sk, M.compose(new THREE.Vector3(m(xc + (r() - 0.5) * 0.6), m(y + hh / 2), m(zc + (r() - 0.5) * 0.8)), Q.identity(), new THREE.Vector3(m(9.5 + r()), m(hh), m(11.5 + r() * 1.5)))); stacks.setColorAt(sk, col.setHex(palette[(r() * palette.length) | 0])); y += hh; } };
  const mid = tiers[topTier - 1];
  for (const c of [0, W.cols - 1]) {
    const xc = -W.w / 2 + (c + 0.5) * cw, ys = mid.y0 + mid.h / 2;
    inside.add(at(mesh(new RoundedBoxGeometry(m(cw - 2 * t), m(t), m(bodyD - t - 0.5), 2, m(0.08)), shelfMat, `wardrobe:shelf-c${c + 1}`), xc, ys, zc + t / 2 - 0.25));
    pile(xc, ys + t / 2, 4); pile(xc, mid.y0 + t, 5);
  }
  pile(0, mid.y0 + t, 3);
  for (let c = 0; c < W.cols; c++) pile(-W.w / 2 + (c + 0.5) * cw, tiers[0].y0 + t, 3 + c);
  stacks.count = sk; stacks.name = 'wardrobe:folded'; stacks.castShadow = stacks.receiveShadow = true;
  inside.add(stacks);

  // ---- interaction: click toggles the top-tier doors; eased swing about the right-edge hinge
  const g = group('wardrobe', carcass, inside, doors);
  let open = false;
  const target = THREE.MathUtils.degToRad(W.openDeg);
  g.userData.onClick = () => { open = !open; };
  g.userData.tick = (dt) => pivots.forEach((p, i) => { p.rotation.y = THREE.MathUtils.damp(p.rotation.y, open ? target * (1 - 0.08 * i) : 0, 6, dt); });
  g.userData.setOpen = (v) => { open = v; pivots.forEach((p, i) => { p.rotation.y = v ? target * (1 - 0.08 * i) : 0; }); }; // for shots/tests
  return g;
}
