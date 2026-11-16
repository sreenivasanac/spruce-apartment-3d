// Contract: build() returns a THREE.Group named 'wardrobe', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.wardrobe.pos/rot and makes it draggable.
// Reference: spruce_apt_photos/antbox1.jpg, antbox2.jpg — ANTBOX folding-cube wardrobe, 3 columns x 3 tiers,
// warm-white moulded PP, near-opaque smoked-brown door panels, champagne frame handles on the left edge, doors hinged on their right edge,
// open hanging bay in the top tier, overhanging lid board.
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

/** Tiny tiling canvas texture (procedural only). */
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d', { willReadFrequently: true }), size);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(...repeat); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  return tx;
}
/** Woven-cloth albedo (light, so the per-instance colour tints it); `print` adds small dark florals/dots. */
function fabricTex(seed, print) {
  const r = rng(seed);
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#e9e9e9'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) { ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.07})`; ctx.fillRect(i, 0, 1, s); ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; ctx.fillRect(0, i, s, 1); }
    if (print) for (let i = 0; i < 46; i++) {
      const x = r() * s, y = r() * s, rad = 2 + r() * 4;
      ctx.fillStyle = ['#7a1420', '#1d2a55', '#16161a', '#a8323c'][(r() * 4) | 0];
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.26) * rad, y + Math.sin(k * 1.26) * rad, rad * 0.62, 0, 7); ctx.fill(); }
    }
  }, print ? [3, 5] : [4, 8]);
}

/** Unit hanging garment seen edge-on from the wardrobe front: x = thickness (+-0.5), y = 0 (neck) .. -1 (hem), z = shoulder width (+-0.5).
 *  A closed rippled loop swept down the body: narrow neck, sloped shoulders, slight waist, flared hem, drape folds that deepen toward the hem. */
function garmentGeometry(ny = 12, n = 20) {
  const pos = [], uv = [], idx = [];
  const lerp = THREE.MathUtils.lerp, ss = THREE.MathUtils.smoothstep;
  for (let j = 0; j <= ny; j++) {
    const v = j / ny;
    const halfW = v < 0.13 ? lerp(0.07, 0.46, v / 0.13) : lerp(lerp(0.46, 0.41, ss(v, 0.13, 0.45)), 0.5, ss(v, 0.45, 1));
    const halfT = lerp(0.16, 0.5, ss(v, 0, 0.8));
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, fold = 1 + 0.32 * ss(v, 0.1, 0.7) * Math.sin(5 * a + v * 5);
      pos.push(halfT * Math.sin(a) * fold, -v * (1 + (j === ny ? 0.035 * Math.sin(4 * a) : 0)), halfW * Math.cos(a));
      uv.push(i / n, v);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < n; i++) { const p = j * (n + 1) + i, q = p + n + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function build() {
  const W = FURNITURE.wardrobe, H = W.handle;
  const cw = W.w / W.cols, t = W.wallT;
  const bodyD = W.d - W.doorT - H.proj, zBack = -W.d / 2, zFront = zBack + bodyD; // body front = door back
  const tiers = []; // bottom -> top: {y0, h}; the top tier gives its last lidT to the overhanging lid board
  [...W.tiers].reverse().reduce((y, h) => (tiers.push({ y0: y, h }), y + h), 0);
  const topTier = tiers.length - 1;
  tiers[topTier].h -= W.lidT;

  // warm ivory moulded PP (antbox1.jpg) — satin with a whisper of sheen so it doesn't go blue-grey under the sky light
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f1e4, roughness: 0.45, sheen: 0.25, sheenRoughness: 0.6, sheenColor: 0xfff4e0, name: 'antbox-white-pp' });
  // smoked-brown acrylic: nearly opaque (the lit white interior is HDR-bright, so anything under ~0.95 reads as a pale film),
  // weak reflections so it stays brown at oblique angles
  const smoked = new THREE.MeshStandardMaterial({ color: 0x2e1a0e, roughness: 0.25, envMapIntensity: 0.08, transparent: true, opacity: 0.955, depthWrite: false, name: 'antbox-smoked-panel' });
  const gold = MAT.brass.clone(); Object.assign(gold, { metalness: 0.5, roughness: 0.4, name: 'antbox-champagne-gold' }); gold.color.set(0xd9ad8e);
  const shelfMat = MAT.whitePlastic.clone(); Object.assign(shelfMat, { roughness: 0.6, name: 'antbox-shelf-beige' }); shelfMat.color.set(0xd9c6a4);

  // ---- carcass: every closed cell is its own moulded cube (walls double up between cells like the real thing); the top tier is
  // one open hanging bay with slim posts at the column lines (antbox2.jpg). All merged into one mesh.
  const parts = [];
  const bx = (w, h, d, x, y, z, r = 0) => {
    const g = (r ? new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(r)) : new THREE.BoxGeometry(m(w), m(h), m(d))).toNonIndexed();
    parts.push(g.translate(m(x), m(y), m(z)));
  };
  const ribs = (span, c0, make) => { // evenly spaced ribs across `span` starting at c0
    const n = Math.max(1, Math.round(span / W.ribPitch)), p = span / n;
    for (let i = 0; i < n; i++) make(c0 + (i + 0.5) * p);
  };
  /** Vertical rib split at mid-height by the fold seam of the folding panels. axis 'x' = rib is thin in x (side panels), 'z' = thin in z (back). */
  const rib = (axis, x, yc, z, len) => {
    const half = (len - W.seamGap) / 2;
    for (const s of [-1, 1]) axis === 'x' ? bx(W.ribT, half, W.ribW, x, yc + s * (half + W.seamGap) / 2, z) : bx(W.ribW, half, W.ribT, x, yc + s * (half + W.seamGap) / 2, z);
  };
  const zc = zBack + bodyD / 2, skinX = W.w / 2 - W.lidOver; // outer side skins sit lidOver inside the envelope (lid + doors reach it)
  const cell = (xl, xr, y0, h, sideRibs) => {
    bx(xr - xl, t, bodyD, (xl + xr) / 2, y0 + t / 2, zc, 0.08);           // floor
    bx(xr - xl, t, bodyD, (xl + xr) / 2, y0 + h - t / 2, zc, 0.08);       // roof
    bx(t, h - 2 * t, bodyD, xl + t / 2, y0 + h / 2, zc);                  // left wall
    bx(t, h - 2 * t, bodyD, xr - t / 2, y0 + h / 2, zc);                  // right wall
    bx(xr - xl - 2 * t, h - 2 * t, t, (xl + xr) / 2, y0 + h / 2, zBack + t / 2); // back
    ribs(xr - xl - 2 * t - 1, xl + t + 0.5, (x) => rib('z', x, y0 + h / 2, zBack + t + W.ribT / 2, h - 2 * t - 1.5)); // inner back ribs
    if (sideRibs) for (const [xw, s] of [[xl + t, 1], [xr - t, -1]]) // inner side ribs (seen when the doors are open)
      ribs(bodyD - t - 2, zBack + t + 1, (z) => rib('x', xw + s * W.ribT / 2, y0 + h / 2, z, h - 2 * t - 1.5));
  };
  const sidePlanes = [], clips = []; // [x, y] of the connector clips on the front posts
  tiers.forEach(({ y0, h }, ti) => {
    if (ti === topTier) {
      cell(-skinX, skinX, y0, h, true);
      for (let c = 1; c < W.cols; c++) { // slim front + rear posts at the column lines instead of partitions
        const x = -W.w / 2 + c * cw, zf = zFront - 0.15 - W.postW / 2;
        bx(W.postW, h - 2 * t, W.postW, x, y0 + h / 2, zBack + t + W.postW / 2, 0.1);
        bx(W.postW, h - 2 * t, W.postW, x, y0 + h / 2, zf, 0.1);
        for (const y of [y0 + t + 1.1, y0 + h - t - 1.1]) { bx(W.postW + 0.5, 1.5, 0.12, x, y, zf + W.postW / 2 + 0.06, 0.05); clips.push([x, y]); }
      }
    } else for (let c = 0; c < W.cols; c++) {
      const x0 = -W.w / 2 + c * cw;
      cell(c === 0 ? -skinX : x0, c === W.cols - 1 ? skinX : x0 + cw, y0, h, false);
    }
    for (const s of [-1, 1]) { // exterior ribbed side panels: raised rim + calm low-relief vertical ribs with the mid-height fold seam
      const x = s * (skinX + W.ribT / 2), rim = 0.9;
      bx(W.ribT, rim, bodyD, x, y0 + rim / 2, zc); bx(W.ribT, rim, bodyD, x, y0 + h - rim / 2, zc);
      for (const z of [zBack + rim / 2, zFront - rim / 2]) bx(W.ribT, h - 2 * rim, rim, x, y0 + h / 2, z);
      // ribs + fold seam are a mip-mapped bump/albedo texture (geometry ribs moire at room distance); u repeats once per rib
      const pw = bodyD - 2 * rim, pg = new THREE.PlaneGeometry(m(pw), m(h - 2 * rim)).rotateY(s * Math.PI / 2).translate(m(s * (skinX + 0.02)), m(y0 + h / 2), m(zc));
      const n = Math.round(pw / W.ribPitch), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
      sidePlanes.push(pg);
    }
  });
  const carcass = mesh(mergeGeometries(parts), white, 'wardrobe:carcass');
  const ribTex = canvasTex(64, (ctx, sz) => { // one rib per tile: soft-shouldered raised stripe, horizontal fold seam at mid-height
    const g = ctx.createLinearGradient(0, 0, sz, 0);
    for (const [o, v] of [[0, 214], [0.18, 214], [0.3, 255], [0.7, 255], [0.82, 214], [1, 214]]) g.addColorStop(o, `rgb(${v},${v},${v})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, sz, sz);
    ctx.fillStyle = 'rgb(196,196,196)'; ctx.fillRect(0, sz / 2 - 1, sz, 2);
  }, [1, 1]);
  const sideMat = white.clone(); Object.assign(sideMat, { map: ribTex, bumpMap: ribTex, bumpScale: 1.2, name: 'antbox-white-ribbed' });
  const sides = mesh(mergeGeometries(sidePlanes), sideMat, 'wardrobe:sidePanels');
  // top lid board: full envelope width (overhangs the side skins by lidOver), reaches over the closed doors
  const lidD = bodyD + W.doorT * 0.6;
  const lid = at(mesh(new RoundedBoxGeometry(m(W.w), m(W.lidT), m(lidD), 2, m(0.1)), white, 'wardrobe:lid'), 0, W.h - W.lidT / 2, zBack + lidD / 2);
  const screws = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.17), m(0.17), m(0.06), 12).rotateX(Math.PI / 2), MAT.chrome, clips.length);
  clips.forEach(([x, y], i) => screws.setMatrixAt(i, new THREE.Matrix4().makeTranslation(m(x), m(y), m(zFront - 0.15 + 0.13))));
  screws.name = 'wardrobe:connectors';

  // ---- doors: pillowed moulded frame (thicker rails than stiles) with a raised bead round the aperture + smoked panel +
  // champagne frame handle on the left edge, in a pivot group on the door's right edge
  const dw = cw - W.doorGap, bev = 0.25;
  const handleShape = roundedRect(H.w, H.h, H.r);
  handleShape.holes.push(roundedRect(H.w - 2 * H.bar, H.h - 2 * H.bar, H.r * 0.35, H.bar, H.bar, THREE.Path));
  const handleGeo = extrude(handleShape, H.proj + 0.05, 0.04, 2); // flat satin band; sunk 0.05 into the frame so it never floats
  const doors = group('wardrobe:doors'), pivots = [];
  tiers.forEach(({ y0, h }, ti) => {
    const dh = h - W.doorGap, aw = dw - 2 * W.stileW, ah = dh - 2 * W.railW, ax = -dw + W.stileW, ay = W.railW;
    const frame = roundedRect(dw, dh, W.doorR, -dw, 0);
    frame.holes.push(roundedRect(aw, ah, W.panelR, ax, ay, THREE.Path));
    const bead = roundedRect(aw + 2 * W.beadW, ah + 2 * W.beadW, W.panelR + W.beadW, ax - W.beadW, ay - W.beadW);
    bead.holes.push(roundedRect(aw, ah, W.panelR, ax, ay, THREE.Path));
    const frameGeo = mergeGeometries([ // pivot = front-right edge, so an open door never cuts into the carcass
      extrude(frame, W.doorT, bev, 4).translate(0, 0, -m(W.doorT)),
      extrude(bead, 0.3 + W.beadH, 0.07, 2).translate(0, 0, -m(0.3)),
    ]);
    const lip = 0.25; // panel tucks this far under the frame
    const panelGeo = extrude(roundedRect(aw + 2 * lip, ah + 2 * lip, W.panelR + lip, ax - lip, ay - lip), 0.1, 0.02, 1);
    for (let c = 0; c < W.cols; c++) {
      const id = `t${tiers.length - ti}c${c + 1}`; // t1 = top tier, c1 = left column (as seen from the front)
      const panel = mesh(panelGeo, smoked, `wardrobe:panel-${id}`); // casts shadow: smoked acrylic keeps the interior dim
      panel.position.z = m(-W.doorT * 0.6);
      const handle = mesh(handleGeo, gold, `wardrobe:handle-${id}`);
      handle.position.set(m(-dw - H.over), m(dh / 2 - H.h / 2), m(-0.05));
      const pivot = group(`wardrobe:door-${id}`, mesh(frameGeo, white, `wardrobe:doorFrame-${id}`), panel, handle);
      at(pivot, -W.w / 2 + (c + 1) * cw - W.doorGap / 2, y0 + W.doorGap / 2, zFront + W.doorT);
      if (ti === topTier) pivots.push(pivot);
      doors.add(pivot);
    }
  });

  // ---- contents (dim silhouettes through the smoked panels, clear when the top doors open)
  const r = rng(67), inside = group('wardrobe:contents');
  const top = tiers[topTier], mid = tiers[topTier - 1], zRod = zBack + bodyD * 0.5;
  const hookGeo = new THREE.BoxGeometry(0.14, W.hangerDrop, 0.14).translate(0, W.hangerDrop / 2, 0); // inches
  const slope = Math.atan2(0.13, 0.39), barL = Math.hypot(0.13, 0.39) * 1.04; // garment-unit space: shoulders drop 0.13 over 0.39 of the width
  const hangerGeo = mergeGeometries([-1, 1].map((s) => new THREE.BoxGeometry(0.3, 0.014, barL).translate(0, 0, s * barL / 2).rotateX(s * slope).translate(0, 0.012, 0)));
  const darks = [0x1b1b1f, 0xb3202a, 0x2a2f45, 0x6a2a3a, 0x23463f, 0x111114, 0x4a5f86, 0x7d6a58, 0x15151a];
  const lights = [0xf1ebe0, 0xe8c9c4, 0xcfdcec, 0xf4f0ea]; // printed garments: light ground, dark florals from the texture
  const fabric = (tex, name) => new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.4, roughness: 0.92, side: THREE.DoubleSide, name });
  const gGeo = garmentGeometry(), nTop = 8, nMid = 5, nAll = nTop * W.cols + nMid;
  const plain = new THREE.InstancedMesh(gGeo, fabric(fabricTex(5, false), 'wardrobe-fabric'), nAll);
  const printed = new THREE.InstancedMesh(gGeo, fabric(fabricTex(9, true), 'wardrobe-fabric-print'), nAll);
  const hangers = new THREE.InstancedMesh(hangerGeo, MAT.blackPlastic, nAll), hooks = new THREE.InstancedMesh(hookGeo, MAT.blackPlastic, nAll);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color(), V = (x, y, z) => new THREE.Vector3(m(x), m(y), m(z));
  let nPlain = 0, nPrint = 0, nHang = 0;
  /** n garments on a rod at height rodY between x0..x1, none longer than maxLen. */
  const hang = (x0, x1, rodY, n, maxLen) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5 + (r() - 0.5) * 0.6) / n) * (x1 - x0), len = maxLen * (0.72 + r() * 0.28), wid = 13 + r() * 2.5, thick = 0.6 + r() * 0.9;
      Q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.28, (r() - 0.5) * 0.04)); // +-8 deg about the rod normal
      M.compose(V(x, rodY - W.hangerDrop, zRod), Q, V(thick, len, wid));
      if (r() < 0.3) { printed.setMatrixAt(nPrint, M); printed.setColorAt(nPrint++, col.setHex(lights[(r() * lights.length) | 0])); }
      else { plain.setMatrixAt(nPlain, M); plain.setColorAt(nPlain++, col.setHex(darks[(r() * darks.length) | 0])); }
      hangers.setMatrixAt(nHang, M.compose(V(x, rodY - W.hangerDrop, zRod), Q, V(1, len, wid)));
      hooks.setMatrixAt(nHang++, M.compose(V(x, rodY - W.hangerDrop, zRod), Q, V(1, 1, 1)));
    }
  };
  // top bay: one continuous rod through the posts, hung from black brackets at the column lines (antbox2.jpg)
  const rodY = top.y0 + top.h - t - W.rodDrop, rodL = 2 * (skinX - t);
  const rod = cyl(W.rodDia / 2, rodL, MAT.chrome, 'wardrobe:rod', 16);
  rod.rotation.z = Math.PI / 2; inside.add(at(rod, 0, rodY, zRod));
  const brackets = [];
  for (let c = 0; c <= W.cols; c++) {
    const x = THREE.MathUtils.clamp(-W.w / 2 + c * cw, -skinX + t + 0.2, skinX - t - 0.2), bh = W.rodDrop + W.rodDia / 2 + 0.15;
    brackets.push(new THREE.BoxGeometry(m(0.35), m(bh), m(1.3)).translate(m(x), m(top.y0 + top.h - t - bh / 2), m(zRod)));
  }
  inside.add(mesh(mergeGeometries(brackets), MAT.blackPlastic, 'wardrobe:rodBrackets'));
  for (let c = 0; c < W.cols; c++) hang(-W.w / 2 + c * cw + t + 1, -W.w / 2 + (c + 1) * cw - t - 1, rodY, nTop, top.h - 2 * t - W.rodDrop - W.hangerDrop - 0.4);
  // centre mid bay: hanging overflow on its own short rod (antbox1.jpg shows shirts hanging there)
  const midRodY = mid.y0 + mid.h - t - W.rodDrop;
  const midRod = cyl(W.rodDia / 2, cw - 2 * t, MAT.chrome, 'wardrobe:rod-mid', 16);
  midRod.rotation.z = Math.PI / 2; inside.add(at(midRod, 0, midRodY, zRod));
  hang(-cw / 2 + t + 1, cw / 2 - t - 1, midRodY, nMid, mid.h - 2 * t - W.rodDrop - W.hangerDrop - 1.5);
  plain.count = nPlain; printed.count = nPrint;
  plain.name = 'wardrobe:clothes'; printed.name = 'wardrobe:clothes-print'; hangers.name = 'wardrobe:hangers'; hooks.name = 'wardrobe:hangerHooks';
  for (const o of [plain, printed]) { o.castShadow = o.receiveShadow = true; }
  inside.add(plain, printed, hangers, hooks);

  // shelves at mid-height of the middle tier's outer cells (antbox1.jpg) + soft folded stacks (darks, denim, light neutrals)
  const foldPalette = [0x1b1b1f, 0x3d5478, 0xe6dfd2, 0x6a2a3a, 0x8a94a3, 0xc9c2b4, 0x2a2f45, 0x5b6f91, 0xb9a48a, 0x23463f];
  const stacks = new THREE.InstancedMesh(new RoundedBoxGeometry(10, 1.3, 12, 3, 0.6).scale(0.1, 1 / 1.3, 1 / 12), new THREE.MeshStandardMaterial({ map: fabricTex(5, false), roughness: 0.95, name: 'wardrobe-folded' }), 60);
  let sk = 0;
  const pile = (xc, y, n, maxH) => {
    const pw = 8 + r() * 2.5, pd = 10 + r() * 3, y1 = y + maxH;
    for (let i = 0; i < n; i++, sk++) {
      const hh = 0.9 + r() * 1.3; if (y + hh > y1) break;
      Q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.14, 0));
      stacks.setMatrixAt(sk, M.compose(V(xc + (r() - 0.5) * 0.9, y + hh / 2, zc + 1 + (r() - 0.5) * 1.2), Q, V(pw * (0.9 + r() * 0.12), hh * 1.08, pd * (0.9 + r() * 0.12))));
      stacks.setColorAt(sk, col.setHex(foldPalette[(r() * foldPalette.length) | 0])); y += hh;
    }
  };
  for (const c of [0, W.cols - 1]) {
    const xc = -W.w / 2 + (c + 0.5) * cw, ys = mid.y0 + mid.h / 2;
    inside.add(at(mesh(new RoundedBoxGeometry(m(cw - 2 * t - W.lidOver), m(t), m(bodyD - t - 0.5), 2, m(0.08)), shelfMat, `wardrobe:shelf-c${c + 1}`), xc - Math.sign(xc) * W.lidOver / 2, ys, zc + t / 2 - 0.25));
    pile(xc, ys + t / 2, 3 + c, mid.h / 2 - t - 1.5); pile(xc, mid.y0 + t, 6 - c, mid.h / 2 - t - 1);
  }
  for (let c = 0; c < W.cols; c++) pile(-W.w / 2 + (c + 0.5) * cw, tiers[0].y0 + t, 2 + ((c * 2) % 3), tiers[0].h - 2 * t - 1.5);
  stacks.count = sk; stacks.name = 'wardrobe:folded'; stacks.castShadow = stacks.receiveShadow = true;
  inside.add(stacks);

  // ---- interaction: click toggles the top-tier doors; eased swing about the right-edge hinge
  const g = group('wardrobe', carcass, sides, lid, screws, inside, doors);
  let open = false;
  const target = THREE.MathUtils.degToRad(W.openDeg);
  g.userData.onClick = () => { open = !open; };
  g.userData.tick = (dt) => pivots.forEach((p, i) => { p.rotation.y = THREE.MathUtils.damp(p.rotation.y, open ? target * (1 - 0.08 * i) : 0, 6, dt); });
  g.userData.setOpen = (v) => { open = v; pivots.forEach((p, i) => { p.rotation.y = v ? target * (1 - 0.08 * i) : 0; }); }; // for shots/tests
  return g;
}
