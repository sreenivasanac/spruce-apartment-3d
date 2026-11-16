// deck: floor, railing, soffit, privacy partition, sconce, condenser + exterior backdrop (lawn, pool, redwoods, pool house, sky)
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Everything the sun can shadow onto the unit (own deck) is individual named meshes; the rest of the building and the
// scenery is merged per material / instanced and never casts shadows, so the whole exterior costs ~60 draw calls.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ENV, WALLS, Y, DECK, SCENERY as S, SUN, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { boxAt, cyl, place, group } from '../lib/build.js';
import { wallPieces } from '../shell.js';

const D = DECK;
const FLOOR = -D.floorDrop; //                       deck walking surface
const GRADE = FLOOR - D.heightAboveGrade; //         lawn elevation
const Y_WALL = ENV.d + D.skinT; //                   outer face of the stucco skin
const Y_OUT = Y.deckOuter, Y_SLAT = Y_OUT - D.slatT, Y_APRON = Y_SLAT - D.fasciaT;
const F2F = D.bldg.floorToFloor;
const UP_SLAB_T = F2F - D.floorDrop - D.soffitElev; // balcony slab of the unit above = our soffit

// ---------------------------------------------------------------- helpers
function canvasTex(size, draw, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d', { willReadFrequently: true }), size);
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(ctx, s, base, amp, seed, blotches = 0, blotchRGB = '0,0,0') {
  const r = rng(seed), img = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) { const n = (r() - 0.5) * amp; for (let k = 0; k < 3; k++) img.data[i * 4 + k] = base[k] + n; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < blotches; i++) { // soft large-scale variation, wrapped so the tile stays seamless
    const x = r() * s, y = r() * s, rad = s * (0.05 + r() * 0.12), a = 0.05 + r() * 0.1, rgb = r() < 0.5 ? blotchRGB : '255,255,200';
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
}

/** Collects static meshes and merges them per material (one draw call each). */
function batcher() {
  const by = new Map();
  return {
    add(...meshes) { for (const o of meshes) { o.updateMatrix(); const g = o.geometry.applyMatrix4(o.matrix); if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g); } },
    build(name, hide = false) {
      const g = group(name);
      for (const [mat, geos] of by) { const mesh = new THREE.Mesh(mergeGeometries(geos), mat); mesh.name = `${name}:${mat.name}`; mesh.receiveShadow = true; g.add(mesh); }
      g.userData.hideInDollhouse = hide;
      return g;
    },
  };
}

/** One InstancedMesh of unit boxes from [x0,y0,elev,w,d,h] plan-inch records. */
function instancedBoxes(list, mat, name, shadow) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
  const M = new THREE.Matrix4();
  list.forEach(([x0, y0, e, w, d, h], i) => im.setMatrixAt(i, M.makeScale(m(w), m(h), m(d)).setPosition(m(x0 + w / 2), m(e + h / 2), m(y0 + d / 2))));
  im.name = name; im.castShadow = shadow; im.receiveShadow = true;
  im.computeBoundingBox(); im.computeBoundingSphere();
  return im;
}

/** Box with eased edges (lumber, sheet metal). Plan-space min corner + size, like boxAt. */
function softBoxAt(x0, y0, elev, w, d, h, r, mat, name) {
  const b = new THREE.Mesh(new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(r)), mat);
  b.position.set(m(x0 + w / 2), m(elev + h / 2), m(y0 + d / 2));
  b.castShadow = b.receiveShadow = true; b.name = name;
  return b;
}

const P = (x, y) => new THREE.Vector2(m(x), -m(y)); // plan inches -> shape space (shape is rotated flat afterwards)
/** Flat slab from a Shape given in plan space; `t` inches thick with its top at `top` (so holes get walls). */
function flat(shape, top, t, mat, name) {
  const geo = t ? new THREE.ExtrudeGeometry(shape, { depth: m(t), bevelEnabled: false, curveSegments: 40 }) : new THREE.ShapeGeometry(shape, 40);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = m(top - t); mesh.name = name;
  return mesh;
}

// ---------------------------------------------------------------- local (textured) materials
const std = (o) => new THREE.MeshStandardMaterial(o);
function makeMats() {
  const grass = canvasTex(512, (c, s) => {
    speckle(c, s, [104, 142, 52], 60, 41, 40, '40,70,10');
    const r = rng(42); for (let i = 0; i < 5000; i++) { c.strokeStyle = `rgba(${r() < 0.5 ? '60,100,30' : '170,190,80'},0.35)`; const x = r() * s, y = r() * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); c.stroke(); }
  });
  const mulch = canvasTex(256, (c, s) => {
    speckle(c, s, [80, 62, 50], 40, 43);
    const r = rng(44); for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '50,30,22' : '150,100,70'},0.5)`; c.save(); c.translate(r() * s, r() * s); c.rotate(r() * 3); c.fillRect(0, 0, 3 + r() * 7, 1 + r() * 2); c.restore(); }
  });
  const mulchRing = canvasTex(512, (c, s) => { // needle litter fading raggedly into the lawn
    const r = rng(53);
    for (let i = 0; i < 30000; i++) { const a = r() * 7, d = Math.pow(r(), 0.7) * s * 0.5; c.fillStyle = `rgba(${r() < 0.5 ? '70,50,40' : '112,82,62'},${0.85 * (1 - d / (s * 0.5))})`; c.fillRect(s / 2 + Math.cos(a) * d - 2, s / 2 + Math.sin(a) * d - 2, 4, 4); }
  }, { wrap: false });
  const concrete = canvasTex(512, (c, s) => { // tile = one joint bay
    speckle(c, s, [172, 170, 164], 22, 45, 14, '90,90,90');
    c.fillStyle = 'rgba(70,70,68,0.8)'; c.fillRect(0, 0, s, 3); c.fillRect(0, 0, 3, s);
  });
  const bark = (srgb) => canvasTex(512, (c, s) => {
    const r = rng(46);
    c.fillStyle = srgb ? '#5e3e30' : '#808080'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { // long fibrous ridges and furrows, vertical
      const x = r() * s, w = 1.5 + r() * 5, dark = r() < 0.55;
      c.strokeStyle = srgb ? `rgba(${dark ? '34,20,15' : '122,84,62'},${0.2 + r() * 0.3})` : `rgba(${dark ? '0,0,0' : '255,255,255'},${0.3 + r() * 0.4})`;
      c.lineWidth = w; const y0 = r() * s, len = s * (0.3 + r() * 0.7);
      const b1 = (r() - 0.5) * 14, b2 = (r() - 0.5) * 14, b3 = (r() - 0.5) * 10;
      for (const o of [0, -s]) { c.beginPath(); c.moveTo(x, y0 + o); c.bezierCurveTo(x + b1, y0 + o + len / 3, x + b2, y0 + o + (2 * len) / 3, x + b3, y0 + o + len); c.stroke(); } // drawn twice: seamless in V
    }
  }, { srgb });
  // drooping redwood spray: a bough across the top with hanging branchlets of short needles. Transparent background.
  const spray = canvasTex(1024, (c, s) => {
    const r = rng(47);
    const frond = (x, y, ang, len, depth) => { // stem + fine twigs, recursing into side branchlets
      c.strokeStyle = 'rgb(58,42,30)'; c.lineWidth = depth ? 1.5 : 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
      for (let k = len * 0.15; k < len; k += 5) {
        const px = x + Math.cos(ang) * k, py = y + Math.sin(ang) * k, t = r(), tl = (8 + r() * 10) * (1 - (k / len) * 0.5);
        c.strokeStyle = t < 0.4 ? 'rgb(38,64,36)' : t < 0.8 ? 'rgb(70,104,50)' : 'rgb(140,142,66)'; c.lineWidth = 1.6;
        for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang + sd * 0.7) * tl, py + Math.sin(ang + sd * 0.7) * tl); c.stroke(); }
        if (!depth && r() < 0.09) frond(px, py, ang + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.4), len * (0.25 + r() * 0.2), 1);
      }
    };
    c.strokeStyle = 'rgb(60,40,30)'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, s * 0.1); c.quadraticCurveTo(s / 2, s * 0.02, s, s * 0.16); c.stroke();
    for (let i = 0; i < 34; i++) frond(s * (0.03 + r() * 0.94), s * (0.05 + 0.08 * r()), Math.PI / 2 + (r() - 0.5) * 0.8, s * (0.3 + r() * 0.55), 0);
  }, { wrap: false });
  // strappy lily-like clump growing up from the bottom edge (shrub bed in front of the rail, IMG_3926)
  const blades = canvasTex(256, (c, s) => {
    const r = rng(48);
    for (let i = 0; i < 60; i++) {
      const x0 = s * (0.3 + r() * 0.4), lean = (r() - 0.5) * s * 0.9, h = s * (0.5 + r() * 0.48), t = r();
      c.strokeStyle = t < 0.4 ? 'rgb(52,84,36)' : t < 0.8 ? 'rgb(96,132,54)' : 'rgb(150,172,84)'; c.lineWidth = 3 + r() * 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, s); c.quadraticCurveTo(x0 + lean * 0.3, s - h * 0.8, x0 + lean, s - h + Math.abs(lean) * 0.35); c.stroke();
    }
  }, { wrap: false });
  // far tree silhouette: trunk + clumped crown
  const tree = canvasTex(256, (c, s) => {
    const r = rng(49);
    c.fillStyle = 'rgb(58,40,30)'; c.fillRect(s * 0.47, s * 0.55, s * 0.06, s * 0.45);
    for (let i = 0; i < 420; i++) {
      const y = s * (0.03 + r() * 0.8), half = s * 0.46 * Math.sin(Math.min(1, (y / s) * 1.5 + 0.12) * Math.PI * 0.62), x = s / 2 + (r() * 2 - 1) * half, t = r();
      c.fillStyle = t < 0.5 ? 'rgb(36,62,34)' : t < 0.85 ? 'rgb(64,98,46)' : 'rgb(120,134,60)';
      c.beginPath(); c.ellipse(x, y, 5 + r() * 12, 4 + r() * 8, r() * 3, 0, 7); c.fill();
    }
  }, { wrap: false });
  const slate = canvasTex(256, (c, s) => {
    const r = rng(50), rows = 8, cols = 8;
    for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) { const v = 0.88 + r() * 0.24; c.fillStyle = `rgb(${92 * v | 0},${108 * v | 0},${134 * v | 0})`; c.fillRect((i + (j % 2) / 2) * (s / cols), j * (s / rows), s / cols - 1, s / rows - 2); }
  }, { repeat: [10, 5] });
  const leaf = canvasTex(256, (c, s) => {
    speckle(c, s, [62, 92, 44], 40, 51);
    const r = rng(52); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${r() < 0.55 ? '28,50,26' : '132,160,76'},0.7)`; c.beginPath(); c.ellipse(r() * s, r() * s, 2 + r() * 5, 1 + r() * 2, r() * 3, 0, 7); c.fill(); }
  }, { repeat: [8, 4] });
  const sky = canvasTex(1024, (c, s) => { // equirect: v=0 top. Pale zenith, hazy bright horizon, warm low sun glow in the west.
    const g = c.createLinearGradient(0, 0, 0, s);
    [[0, '#86b4e2'], [0.3, '#b4d2ee'], [0.46, '#f1efe2'], [0.5, '#fbf3df'], [0.505, '#5d7044'], [1, '#3c4a30']].forEach(([t, col]) => g.addColorStop(t, col));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    const az = THREE.MathUtils.degToRad(SUN.azimuthFromWestDeg), u = Math.atan2(Math.cos(az), -Math.sin(az)) / (2 * Math.PI); // SphereGeometry: x=-cos(2πu), z=sin(2πu)
    const sx = u * s, sy = s * (0.5 - SUN.elevationDeg / 180);
    c.save(); c.beginPath(); c.rect(0, 0, s, s * 0.503); c.clip(); c.translate(sx, sy); c.scale(1, 0.5);
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.3);
    glow.addColorStop(0, 'rgba(255,250,230,1)'); glow.addColorStop(0.12, 'rgba(255,232,180,0.9)'); glow.addColorStop(0.5, 'rgba(255,214,150,0.3)'); glow.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = glow; c.fillRect(-s, -s, 2 * s, 2 * s); c.restore();
  }, { wrap: false });
  const grille = canvasTex(512, (c, s) => { // opaque (mip-mapped, so no moire): dark fan cavity with hub + blades seen through the ivory wire guard
    c.fillStyle = '#17181a'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#2b2d30'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s / 2, s / 2); c.arc(s / 2, s / 2, s * 0.44, i * 2.094, i * 2.094 + 1.2); c.closePath(); c.fill(); }
    c.fillStyle = '#3a3c40'; c.beginPath(); c.arc(s / 2, s / 2, s * 0.12, 0, 7); c.fill();
    c.strokeStyle = 'rgb(222,219,208)'; c.lineWidth = 3.4;
    for (let i = 0; i <= 44; i++) { const p = (i / 44) * s; c.beginPath(); c.moveTo(0, p); c.lineTo(s, p); c.stroke(); }
    c.lineWidth = 7; for (let i = 0; i <= 6; i++) { const p = (i / 6) * s; c.beginPath(); c.moveTo(p, 0); c.lineTo(p, s); c.stroke(); }
  }, { wrap: false });
  const fins = canvasTex(64, (c, s) => { for (let x = 0; x < s; x++) { c.fillStyle = x % 4 < 2 ? '#2a2c2e' : '#6d7073'; c.fillRect(x, 0, 1, s); } }, { repeat: [24, 1] });
  const logo = canvasTex(256, (c, s) => {
    c.fillStyle = '#e4e1d6'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#1d9ad6'; c.beginPath(); c.moveTo(s * 0.06, s * 0.62); c.lineTo(s * 0.3, s * 0.62); c.lineTo(s * 0.3, s * 0.4); c.closePath(); c.fill();
    c.fillStyle = '#0b3a7a'; c.beginPath(); c.moveTo(s * 0.06, s * 0.62); c.lineTo(s * 0.3, s * 0.4); c.lineTo(s * 0.06, s * 0.4); c.closePath(); c.fill();
    c.fillStyle = '#1a1a1a'; c.font = `bold ${s * 0.17}px Arial, sans-serif`; c.textBaseline = 'middle'; c.fillText('DAIKIN', s * 0.33, s * 0.52);
  }, { wrap: false });

  const alpha = (map) => new THREE.MeshBasicMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide }); // unlit: backlit foliage is shaded per instance instead
  return {
    grass: std({ map: grass, roughness: 1, name: 'lawn' }),
    mulch: std({ map: mulch, roughness: 1, name: 'mulch' }),
    mulchRing: std({ map: mulchRing, roughness: 1, transparent: true, depthWrite: false, name: 'mulch-ring' }),
    concrete: std({ map: concrete, roughness: 0.95, name: 'pool-deck-concrete' }),
    coping: std({ color: 0x9c4a36, roughness: 0.85, name: 'pool-coping-brick' }),
    water: new THREE.MeshLambertMaterial({ color: 0x2aa2da, emissive: 0x1a8fd0, emissiveIntensity: 0.5, name: 'pool-water' }), // Lambert: no low-sun glare sheet
    bark: std({ map: bark(true), bumpMap: bark(false), bumpScale: 3, roughness: 1, name: 'redwood-bark' }),
    spray: Object.assign(alpha(spray), { name: 'redwood-spray' }),
    blades: Object.assign(alpha(blades), { name: 'strappy-leaves' }),
    tree: Object.assign(alpha(tree), { name: 'far-tree' }),
    slate: std({ map: slate, roughness: 0.8, name: 'pool-house-roof-blue-gray', flatShading: true }),
    leaf: std({ map: leaf, roughness: 0.95, name: 'shrub-leaf' }),
    sky: new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false, name: 'sky' }),
    grille: std({ map: grille, roughness: 0.5, name: 'condenser-grille' }),
    fins: std({ map: fins, roughness: 0.6, metalness: 0.4, name: 'condenser-coil' }),
    logo: std({ map: logo, roughness: 0.45, name: 'daikin-logo' }),
    storefront: std({ color: 0x53606b, roughness: 0.25, name: 'storefront-glass' }),
    lounger: std({ color: 0xffffff, roughness: 0.9, name: 'lounger-sling' }),
    umbrella: std({ color: 0xc23a2c, roughness: 0.9, side: THREE.DoubleSide, name: 'umbrella-red' }),
    bronze: std({ color: 0x2c2a27, roughness: 0.6, metalness: 0.4, name: 'lamp-post-bronze' }),
  };
}

// ---------------------------------------------------------------- own deck
function railing() {
  const g = group('deck:railing');
  const slats = [], x0 = D.x0, x1 = D.x1, top = D.railH - D.capT, slatBot = FLOOR - D.slatBelowFloor;
  const gapF = (x1 - x0 - D.slatsFront * D.slatW) / (D.slatsFront - 1);
  for (let i = 0; i < D.slatsFront; i++) slats.push([x0 + i * (D.slatW + gapF), Y_SLAT, slatBot, D.slatW, D.slatT, top - slatBot]);
  const runN = Y_SLAT - Y_WALL, gapN = (runN - D.slatsReturn * D.slatW) / D.slatsReturn; // return starts with a gap at the wall
  for (let i = 0; i < D.slatsReturn; i++) slats.push([x0, Y_WALL + gapN + i * (D.slatW + gapN), slatBot, D.slatT, D.slatW, top - slatBot]);
  g.add(instancedBoxes(slats, MAT.deckRail, 'deck:slats', true));

  const xi = x0 + D.slatT, R = MAT.deckRail, e = 0.2; // e = eased lumber edge
  const railBot = FLOOR + D.bottomRailGap;
  g.add(
    softBoxAt(xi, Y_APRON, top - D.apronH, x1 - xi, D.fasciaT, D.apronH, e, R, 'deck:apron-front'),
    softBoxAt(xi, Y_WALL, top - D.apronH, D.fasciaT, Y_APRON - Y_WALL, D.apronH, e, R, 'deck:apron-north'),
    softBoxAt(xi, Y_APRON, railBot, x1 - xi, D.fasciaT, D.bottomRailH, e, R, 'deck:bottom-rail-front'),
    softBoxAt(xi, Y_WALL, railBot, D.fasciaT, Y_APRON - Y_WALL, D.bottomRailH, e, R, 'deck:bottom-rail-north'),
    softBoxAt(x0, Y_OUT - D.capW, top, x1 - x0, D.capW, D.capT, 0.3, R, 'deck:cap-front'),
    softBoxAt(x0, Y_WALL, top, D.capW, Y_OUT - D.capW - Y_WALL, D.capT, 0.3, R, 'deck:cap-north'),
  );
  const xp = xi + D.fasciaT, postH = top - FLOOR, pw = D.post.w, pd = D.post.d;
  const posts = [[xp, Y_APRON - pw, pw, pw]]; // NW corner 4x4
  for (const f of D.postsAt) posts.push([x0 + f * (x1 - x0) - pw / 2, Y_APRON - pd, pw, pd]);
  posts.push([xp, (Y_WALL + Y_APRON) / 2 - pw / 2, pd, pw], [xp, Y_WALL, pd, pw]); // mid + wall end of the north return
  posts.forEach(([x, y, w, d], i) => g.add(softBoxAt(x, y, FLOOR, w, d, postH, e, R, `deck:post-${i}`)));
  return g;
}

function partition() {
  const p = D.partition, g = group('deck:partition'), W = MAT.partitionWhite;
  const xN = D.x1 - p.t, bot = FLOOR + p.gapBelow, h = D.partitionH - bot, yEnd = Y_APRON - p.post;
  g.add(boxAt(xN + p.battenT, Y_WALL, bot, p.t - 2 * p.battenT, yEnd - Y_WALL, h, W, 'deck:partition-panel'));
  const bars = [];
  for (const x of [xN, D.x1 - p.battenT]) { // framed board-and-batten on both faces
    bars.push([x, Y_WALL, bot, p.battenT, yEnd - Y_WALL, p.frameW], [x, Y_WALL, bot + h - p.frameW, p.battenT, yEnd - Y_WALL, p.frameW]);
    bars.push([x, Y_WALL, bot + p.frameW, p.battenT, p.frameW, h - 2 * p.frameW], [x, yEnd - p.frameW, bot + p.frameW, p.battenT, p.frameW, h - 2 * p.frameW]);
    const run = yEnd - Y_WALL - 2 * p.frameW, n = Math.round(run / p.pitch) - 1, pitch = run / (n + 1);
    for (let i = 1; i <= n; i++) bars.push([x, Y_WALL + p.frameW + i * pitch - p.battenW / 2, bot + p.frameW, p.battenT, p.battenW, h - 2 * p.frameW]);
  }
  g.add(instancedBoxes(bars, W, 'deck:partition-battens', true));
  g.add(softBoxAt(D.x1 - p.post, yEnd, FLOOR, p.post, p.post, D.soffitElev - FLOOR, 0.2, W, 'deck:partition-post'));
  return g;
}

function sconce() {
  const s = D.sconce, g = group('deck:sconce');
  g.add(softBoxAt(s.x - s.plateW / 2, Y_WALL, s.elev - s.plateH / 2, s.plateW, 0.75, s.plateH, 0.3, MAT.partitionWhite, 'deck:sconce-plate'));
  const cy = Y_WALL + 0.75 + 0.6 + s.dia / 2;
  g.add(place(cyl(s.dia / 2 - 0.15, s.h, MAT.lensLit ?? MAT.frosted, 'deck:sconce-lens', 32), s.x, cy, s.elev));
  for (const k of [-1, 1]) g.add(place(cyl(s.dia / 2, s.bandH * 1.4, MAT.whitePlastic, `deck:sconce-band${k}`, 32), s.x, cy, s.elev + k * (s.h / 2 - s.bandH * 0.8)));
  g.add(boxAt(s.x - 0.75, Y_WALL + 0.75, s.elev - 0.75, 1.5, 0.7, 1.5, MAT.whitePlastic, 'deck:sconce-arm'));
  const glow = new THREE.PointLight(0xffc88a, 1.2, m(140), 2); // warm patch on the soffit/partition (IMG_3930); no shadows
  glow.name = 'deck:sconce-light'; place(glow, s.x, cy + 4, s.elev);
  g.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

function condenser(L) {
  const c = D.condenser, g = group('deck:condenser'), I = MAT.hvacIvory, inch = (v) => m(v);
  const mesh = (geo, mat, x, y, z, name) => { const o = new THREE.Mesh(geo, mat); o.position.set(inch(x), inch(y), inch(z)); o.castShadow = o.receiveShadow = true; o.name = name; g.add(o); return o; };
  const cyBody = c.feetH + c.h / 2, zF = c.d / 2;
  mesh(new RoundedBoxGeometry(inch(c.w), inch(c.h), inch(c.d), 3, inch(c.edgeR)), I, 0, cyBody, 0, 'deck:condenser-body');
  // fan side: dark cavity, hub + blades, wire guard, raised surround
  const gr = c.grille, gx = -c.w / 2 + gr.inset + gr.w / 2, gy = c.feetH + c.h / 2 - 0.25;
  mesh(new THREE.PlaneGeometry(inch(gr.w), inch(gr.h)), L.grille, gx, gy, zF + 0.05, 'deck:condenser-grille').castShadow = false;
  const fr = 0.7; // surround bars
  for (const [dx, dy, w, h] of [[0, gr.h / 2, gr.w + fr * 2, fr], [0, -gr.h / 2, gr.w + fr * 2, fr], [-gr.w / 2, 0, fr, gr.h], [gr.w / 2, 0, fr, gr.h]])
    mesh(new RoundedBoxGeometry(inch(w), inch(h), inch(1), 2, inch(0.25)), I, gx + dx, gy + dy, zF + 0.1, 'deck:condenser-surround');
  const lw = c.w - gr.w - gr.inset * 2 - 2; // logo on the solid service panel
  mesh(new THREE.PlaneGeometry(inch(lw), inch(lw)), L.logo, c.w / 2 - lw / 2 - 1, c.feetH + c.h - lw / 2 - 1.2, zF + 0.02, 'deck:condenser-logo').castShadow = false;
  // coil on the back + left end
  mesh(new THREE.PlaneGeometry(inch(c.w - 3), inch(c.h - 3)), L.fins, 0, cyBody, -zF - 0.02, 'deck:condenser-coil-back').rotation.y = Math.PI;
  mesh(new THREE.PlaneGeometry(inch(c.d - 3), inch(c.h - 3)), L.fins, -c.w / 2 - 0.02, cyBody, 0, 'deck:condenser-coil-end').rotation.y = -Math.PI / 2;
  const v = c.valveCover; // service-valve cover on the wall-side end
  mesh(new RoundedBoxGeometry(inch(v.w), inch(v.h), inch(v.d), 3, inch(1.2)), I, c.w / 2 + v.w / 2 - 0.6, c.feetH + v.h / 2 + 2, -c.d / 2 + v.d / 2 + 1, 'deck:condenser-valve-cover');
  for (const sx of [-1, 1]) { // mounting feet on rubber pads
    mesh(new THREE.BoxGeometry(inch(2), inch(c.feetH - 1), inch(c.d + 3)), I, sx * (c.w / 2 - 5), 1 + (c.feetH - 1) / 2, 0, 'deck:condenser-foot');
    mesh(new THREE.BoxGeometry(inch(3.5), inch(1), inch(c.d + 4)), MAT.rubberHose ?? MAT.blackPlastic, sx * (c.w / 2 - 5), 0.5, 0, 'deck:condenser-pad');
  }
  return place(g, c.x, c.y, FLOOR, 90); // fan face toward plan-right (IMG_3927)
}

function services() { // disconnect, whip, lineset + line-hide on the building wall next to the condenser
  const c = D.condenser, dc = D.disconnect, lh = D.lineHide, g = group('deck:services'), W = MAT.lineset;
  g.add(softBoxAt(dc.x - dc.w / 2, Y_WALL, dc.elev, dc.w, dc.d, dc.h, 0.4, MAT.whitePlastic, 'deck:disconnect'));
  g.add(softBoxAt(lh.x - lh.w / 2, Y_WALL, FLOOR, lh.w, lh.d, 16, 0.4, W, 'deck:line-hide'));
  const v = (x, y, e) => new THREE.Vector3(m(x), m(e), m(y));
  const valveX = c.x - c.d / 2 + c.valveCover.d / 2 + 1, valveY = c.y - c.w / 2 - c.valveCover.w + 1.2; // plan position of the valve cover's wall-side face
  const tube = (pts, r, name) => { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, m(r), 8), W); t.name = name; t.castShadow = t.receiveShadow = true; g.add(t); };
  const r = D.linesetDia / 2, ve = FLOOR + c.feetH + 5;
  for (const k of [0, 1]) tube([v(valveX + k * 1.6, valveY + 0.5, ve + k * 2.5), v(valveX + 2 + k, valveY - 1.5, ve - 3 + k * 2), v(lh.x - 4, Y_WALL + 3 + k, FLOOR + 3 + k * 2.5), v(lh.x - 0.5 + k, Y_WALL + lh.d / 2, FLOOR + 10 + k * 3)], r, `deck:lineset-${k}`);
  tube([v(dc.x, Y_WALL + dc.d / 2, dc.elev + 0.3), v(dc.x + 0.5, Y_WALL + 3.5, dc.elev - 9), v(dc.x + 2, Y_WALL + 4.5, ve + 6), v(valveX - 1, valveY + 0.6, ve + 4)], r * 0.75, 'deck:whip');
  return g;
}

// ---------------------------------------------------------------- building beyond the unit
/** Unit bays along the facade: [x origin, mirrored]. Bay 0 is this apartment; neighbours alternate mirrored (shared decks). */
function bays() {
  const out = [];
  for (let k = -D.bldg.unitsN; k <= D.bldg.unitsS; k++) out.push({ k, x: k * ENV.w, mirror: ((k % 2) + 2) % 2 === 1 });
  return out;
}
const bayX = (bay, a, b) => (bay.mirror ? [bay.x + ENV.w - b, bay.x + ENV.w - a] : [bay.x + a, bay.x + b]);

function building(own, ctx, slatsCtx, slatsTan) {
  const west = WALLS.find((w) => w.id === 'ext-west'), B = bays();
  const xMin = B[0].x, xMax = B[B.length - 1].x + ENV.w, top = F2F * D.bldg.storeys;
  const skin = (a, b, lo, hi, into) => into.add(boxAt(a, ENV.d, lo, b - a, D.skinT, hi - lo, MAT.stuccoExt));
  // our storey: split around the real openings; neighbours + upper storeys: solid skin with dummy glazing
  for (const p of wallPieces({ ...west, a: 0, b: ENV.w, h: F2F })) skin(p.a, p.b, p.lo, p.hi, own);
  skin(0, ENV.w, GRADE, 0, own);
  own.add(boxAt(0, 0, GRADE, ENV.w, ENV.d, -GRADE - 0.5, MAT.stuccoExt)); // plinth so the unit doesn't float in dollhouse view
  skin(xMin, 0, GRADE, top, ctx); skin(ENV.w, xMax, GRADE, top, ctx); skin(0, ENV.w, F2F, top, ctx);
  ctx.add(boxAt(xMin - D.bldg.eave.over, ENV.d - 40, top, xMax - xMin + 2 * D.bldg.eave.over, Y_OUT - ENV.d + 40 + D.bldg.eave.over, D.bldg.eave.t, MAT.roofEave));
  for (let f = 0; f < D.bldg.storeys; f++) for (const bay of B) {
    const e = f * F2F;
    if (!(f === 0 && bay.k === 0)) for (const o of west.openings) { // dummy window/slider: white frame + dark glass, proud of the skin
      const [a, b] = bayX(bay, o.a, o.b);
      ctx.add(boxAt(a, Y_WALL, e + o.sill, b - a, 0.5, o.head - o.sill, MAT.vinylFrame), boxAt(a + 2, Y_WALL + 0.5, e + o.sill + 2, b - a - 4, 0.3, o.head - o.sill - 4, MAT.blackGlass));
    }
    // balcony (ours at f=0,k=0 is built in detail elsewhere; the slab above it is the named soffit)
    const [a, b] = bayX(bay, D.x0, D.x1), outerIsA = !bay.mirror, ours = bay.k === 0;
    if (ours && f === 0) continue;
    const fl = e + FLOOR, railMat = f === 0 && bay.k < 0 ? MAT.railTan : MAT.deckRail, list = railMat === MAT.railTan ? slatsTan : slatsCtx;
    if (!(ours && f === 1)) ctx.add(boxAt(a, ENV.d, fl - UP_SLAB_T, b - a, Y_APRON - ENV.d, UP_SLAB_T, f ? MAT.stuccoSoffit : MAT.deckFloor));
    ctx.add(boxAt(a, Y_APRON, fl - UP_SLAB_T, b - a, D.fasciaT, UP_SLAB_T, railMat), boxAt(a, Y_OUT - D.capW, e + D.railH - D.capT, b - a, D.capW, D.capT, railMat));
    const n = D.slatsFront, gap = (b - a - n * D.slatW) / (n - 1), h = D.railH - D.capT + D.slatBelowFloor;
    for (let i = 0; i < n; i++) list.push([a + i * (D.slatW + gap), Y_SLAT, fl - D.slatBelowFloor, D.slatW, D.slatT, h]);
    const xr = outerIsA ? a : b - D.slatT, gN = (Y_SLAT - Y_WALL - D.slatsReturn * D.slatW) / D.slatsReturn; // outer-end return
    for (let i = 0; i < D.slatsReturn; i++) list.push([xr, Y_WALL + gN + i * (D.slatW + gN), fl - D.slatBelowFloor, D.slatT, D.slatW, h]);
    ctx.add(boxAt(outerIsA ? a : b - D.capW, Y_WALL, e + D.railH - D.capT, D.capW, Y_OUT - D.capW - Y_WALL, D.capT, railMat));
  }
}

// ---------------------------------------------------------------- scenery
function kidney(grow = 0) { // bean outline; concave side faces the building (IMG_3929)
  const p = S.pool, pts = [];
  for (let i = 0; i < 64; i++) { const t = (i / 64) * Math.PI * 2, c = Math.cos(t); pts.push(P(p.cx + (p.a + grow) * c, p.cy + (p.b + grow) * Math.sin(t) - p.bend * (c * c - 0.5))); }
  return pts;
}

function lounger() { // local: head end toward -Z, feet +Z; returns [frameGeo, slingGeo]
  const l = S.lounger, bx = (w, h, d, x, y, z, rx = 0) => { const g = new THREE.BoxGeometry(m(w), m(h), m(d)); if (rx) g.rotateX(rx); g.translate(m(x), m(y), m(z)); return g; };
  const seatL = l.l - l.backL, a = THREE.MathUtils.degToRad(l.backDeg), zH = -l.l / 2 + l.backL; // hinge
  const frame = [], by = Math.sin(a) * l.backL / 2, bz = Math.cos(a) * l.backL / 2;
  for (const sx of [-1, 1]) {
    frame.push(bx(1.2, 1.2, seatL, sx * l.w / 2, l.seatH, zH + seatL / 2), bx(1.2, 1.2, l.backL, sx * l.w / 2, l.seatH + by, zH - bz, a));
    for (const z of [zH + 4, l.l / 2 - 5]) frame.push(bx(1.2, l.seatH, 1.2, sx * l.w / 2, l.seatH / 2, z));
  }
  const sling = [bx(l.w - 1.5, 0.5, seatL, 0, l.seatH, zH + seatL / 2), bx(l.w - 1.5, 0.5, l.backL, 0, l.seatH + by, zH - bz, a)];
  return [mergeGeometries(frame), mergeGeometries(sling)];
}

function scenery(L) {
  const g = group('deck:scenery'), far = batcher(), r = rng(77), G = GRADE, M4 = new THREE.Matrix4(), col = new THREE.Color();
  const cx = (D.x0 + D.x1) / 2;
  const noShadow = (o) => { o.castShadow = false; o.receiveShadow = false; return o; };

  const sky = new THREE.Mesh(new THREE.SphereGeometry(m(S.skyR), 48, 24), L.sky);
  sky.name = 'scenery:sky'; sky.renderOrder = -10; place(sky, cx, ENV.d, 0); g.add(sky);

  const quadsFlat = (mat, recs, elev) => { // soft-edged ground decals, instanced: [x, y, size]
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, recs.length);
    recs.forEach(([x, y, sz], i) => im.setMatrixAt(i, M4.makeRotationY(i * 2.1).scale(new THREE.Vector3(m(sz), 1, m(sz))).setPosition(m(x), m(elev + i * 0.04), m(y))));
    im.name = 'scenery:mulch-rings'; im.renderOrder = 1; g.add(im);
  };
  // ground: lawn, mulch bed along the building + rings under the redwoods
  const circle = (x, y, rad) => new THREE.Shape().absarc(m(x), -m(y), m(rad), 0, Math.PI * 2);
  L.grass.map.repeat.set(1 / 2.5, 1 / 2.5); L.mulch.map.repeat.set(1 / 1.2, 1 / 1.2); L.concrete.map.repeat.set(1 / m(S.poolDeck.joint), 1 / m(S.poolDeck.joint));
  g.add(noShadow(flat(circle(cx, S.centreY, S.lawnR), G, 0, L.grass, 'scenery:lawn')));
  const B = bays(), bed = new THREE.Shape([P(B[0].x - 40, S.shrubBed.y0 - 8), P(B[B.length - 1].x + ENV.w + 40, S.shrubBed.y0 - 8), P(B[B.length - 1].x + ENV.w + 40, S.shrubBed.y1), P(B[0].x - 40, S.shrubBed.y1)]);
  const mulch = [flat(bed, G + 0.5, 0, L.mulch)];
  quadsFlat(L.mulchRing, S.redwoods.slice(0, 6).map(([x, y, d]) => [x, y, S.mulchR * (d / 40) * 2]), G + 0.3);
  far.add(...mulch);

  // pool deck (round slab with the kidney cut out), apron to the pool house, walk to the north, coping + water
  const pd = S.poolDeck, deckShape = circle(pd.cx, pd.cy, pd.r); deckShape.holes.push(new THREE.Path(kidney(S.pool.coping)));
  g.add(noShadow(flat(deckShape, G + pd.lift, pd.lift, L.concrete, 'scenery:pool-deck')));
  const [ax0, ay0, ax1, ay1] = pd.apronTo;
  far.add(flat(new THREE.Shape([P(ax0, ay0), P(ax1, ay0), P(ax1, ay1), P(ax0, ay1)]), G + pd.lift - 0.4, 0, L.concrete));
  const walk = new THREE.CatmullRomCurve3([[pd.cx - pd.r * 0.8, pd.cy - pd.r * 0.55], [-330, 900], [-480, 700], [-900, 620]].map(([x, y]) => new THREE.Vector3(x, y, 0))).getPoints(24);
  const side = (s) => walk.map((p, i) => { const q = walk[Math.min(i + 1, walk.length - 1)], o = walk[Math.max(i - 1, 0)], t = new THREE.Vector2(q.x - o.x, q.y - o.y).normalize(); return P(p.x - t.y * s * S.path.w / 2, p.y + t.x * s * S.path.w / 2); });
  far.add(flat(new THREE.Shape([...side(1), ...side(-1).reverse()]), G + pd.lift - 0.6, 0, L.concrete));
  const coping = new THREE.Shape(kidney(S.pool.coping)); coping.holes.push(new THREE.Path(kidney(0)));
  g.add(noShadow(flat(coping, G + pd.lift + 0.4, 0, L.coping, 'scenery:pool-coping')));
  g.add(noShadow(flat(new THREE.Shape(kidney(1)), G + pd.lift - S.pool.waterDrop, 0, L.water, 'scenery:pool-water')));

  // pool house: white block walls, deep flat eave, blue-gray pyramid roof
  const h = S.poolHouse, ph = group('scenery:pool-house'), phb = batcher();
  phb.add(boxAt(-h.w / 2, -h.d / 2, 0, h.w, h.d, h.wallH, MAT.partitionWhite), boxAt(-h.w / 2 - h.eaveOver, -h.d / 2 - h.eaveOver, h.wallH, h.w + 2 * h.eaveOver, h.d + 2 * h.eaveOver, h.fasciaH, MAT.roofEave));
  const gw = h.w * 0.55, gd = h.d * 0.35; // storefront toward the pool: gray-blue glass + white mullions
  phb.add(boxAt(-h.w / 2 + 20, -h.d / 2 - 0.6, 8, gw, 0.6, h.wallH - 16, L.storefront), boxAt(-h.w / 2 - 0.6, -h.d / 2 + 20, 8, 0.6, gd, h.wallH - 16, L.storefront));
  for (let i = 0; i <= 5; i++) phb.add(boxAt(-h.w / 2 + 20 + (i / 5) * gw - 1.5, -h.d / 2 - 1.4, 8, 3, 0.8, h.wallH - 16, MAT.partitionWhite));
  for (let i = 0; i <= 3; i++) phb.add(boxAt(-h.w / 2 - 1.4, -h.d / 2 + 20 + (i / 3) * gd - 1.5, 8, 0.8, 3, h.wallH - 16, MAT.partitionWhite));
  phb.add(boxAt(-h.w / 2 - 0.8, h.d / 2 - 110, 50, 0.8, 44, 30, MAT.blackPlastic)); // rules sign
  phb.add(place(cyl(11, 32, MAT.stuccoExt, '', 16), -h.w / 2 - 50, -h.d / 2 + 60, 16)); // trash can
  ph.add(phb.build('scenery:pool-house-body'));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(m(h.roofBase / Math.SQRT2), m(h.roofH), 4, 1, true), L.slate);
  roof.rotation.y = Math.PI / 4; roof.position.y = m(h.wallH + h.fasciaH + h.roofH / 2); roof.name = 'scenery:pool-house-roof'; ph.add(roof);
  place(ph, h.x0 + h.w / 2, h.y0 + h.d / 2, G, h.rotDeg); g.add(ph);

  // loungers: navy row on the near side (backs to the building), blue row beyond the pool — both face the water
  const [frameGeo, slingGeo] = lounger(), nL = S.loungersNear + S.loungersFar, p = S.pool;
  const frames = new THREE.InstancedMesh(frameGeo, MAT.whitePlastic, nL), slings = new THREE.InstancedMesh(slingGeo, L.lounger, nL);
  for (let i = 0; i < nL; i++) {
    const near = i < S.loungersNear, k = near ? i : i - S.loungersNear, n = near ? S.loungersNear : S.loungersFar, t = (k + 0.5) / n - 0.5;
    const x = p.cx + t * (near ? 2 * p.a + 40 : 1.3 * p.a) + (near ? 0 : -120), y = p.cy + (near ? -(p.b + 95 - Math.abs(t) * 40) : p.b + 120);
    M4.makeRotationY((near ? 0 : Math.PI) + t * (near ? -0.5 : 0.3)).setPosition(m(x), m(G + pd.lift), m(y));
    frames.setMatrixAt(i, M4); slings.setMatrixAt(i, M4); slings.setColorAt(i, col.set(near ? 0x1b2740 : 0x2a58b0));
  }
  frames.name = 'scenery:lounger-frames'; slings.name = 'scenery:loungers'; g.add(frames, slings);

  const u = S.umbrella, canopy = new THREE.ConeGeometry(m(u.r), m(u.canopyH), 8, 1, true).translate(0, m(u.h - u.canopyH / 2), 0);
  const umb = new THREE.InstancedMesh(canopy, L.umbrella, S.umbrellas.length), poles = [];
  S.umbrellas.forEach(([x, y], i) => { umb.setMatrixAt(i, M4.makeTranslation(m(x), m(G + pd.lift), m(y))); poles.push(place(cyl(0.9, u.h, MAT.whitePlastic, '', 8), x, y, G + u.h / 2), place(cyl(15, 1.2, MAT.whitePlastic, '', 16), x + 40, y - 10, G + 28), place(cyl(1, 28, MAT.whitePlastic, '', 8), x + 40, y - 10, G + 14)); });
  umb.name = 'scenery:umbrellas'; g.add(umb); far.add(...poles);
  for (const [x, y] of S.lampPosts) far.add(place(cyl(1.75, S.lampH - 14, L.bronze, '', 10), x, y, G + (S.lampH - 14) / 2), place(cyl(6, 3, L.bronze, '', 12), x, y, G + 1.5),
    boxAt(x - 3.5, y - 3.5, G + S.lampH - 14, 7, 7, 11, MAT.partitionWhite), boxAt(x - 4.5, y - 4.5, G + S.lampH - 3, 9, 9, 3, L.bronze));

  // redwoods: flared, tapering lathe trunks (instanced). The two by the deck hide in dollhouse view — the orbit camera starts between them.
  const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14, hh = t * t * S.redwoodH; prof.push(new THREE.Vector2(m(20 * (0.3 + 0.7 * (1 - t)) * (1 + 0.6 * Math.exp(-hh / 30))), m(hh))); }
  const trunkGeo = new THREE.LatheGeometry(prof, 18); L.bark.map.repeat.set(5, 9); L.bark.bumpMap.repeat.set(5, 9);
  const trunks = (list, name, hide) => { const im = new THREE.InstancedMesh(trunkGeo, L.bark, list.length); list.forEach(([x, y, d], i) => im.setMatrixAt(i, M4.makeRotationY(i * 1.7).scale(new THREE.Vector3(d / 40, 1, d / 40)).setPosition(m(x), m(G), m(y)))); im.name = name; im.userData.hideInDollhouse = hide; g.add(im); };
  trunks(S.redwoods.slice(0, 2), 'scenery:redwoods-near', true); trunks(S.redwoods.slice(2), 'scenery:redwoods-far', false);

  /** Alpha-tested quads, one InstancedMesh: recs = [x, y, elevCentre, w, h, yaw, tilt, shade]. */
  const quads = (mat, recs, name, hide) => {
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, recs.length), q = new THREE.Quaternion(), e = new THREE.Euler();
    recs.forEach(([x, y, el, w, hh, yaw, tilt, shade], i) => { im.setMatrixAt(i, M4.compose(new THREE.Vector3(m(x), m(el), m(y)), q.setFromEuler(e.set(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(m(w), m(hh), 1))); im.setColorAt(i, col.setScalar(shade)); });
    im.name = name; im.userData.hideInDollhouse = hide; im.frustumCulled = false;
    im.isLine2 = true; // GTAOPass skips isLine2 objects in its normal/depth pre-pass, which ignores alphaTest and would draw AO halos around whole quads
    g.add(im);
  };
  const sprays = [];
  S.redwoods.forEach(([x, y], i) => { for (let k = 0, n = i < 2 ? 70 : 30; k < n; k++) {
    const t = r(), hh = S.canopyFrom + t * (S.redwoodH - S.canopyFrom - 60), reach = (50 + 280 * (1 - t * 0.7)) * Math.sqrt(r()), ang = r() * Math.PI * 2, size = 150 + r() * 130;
    const px = x + Math.cos(ang) * reach, py = y + Math.sin(ang) * reach;
    if (py < Y_OUT + 30 && px > -60 && px < ENV.w + 60) continue; // keep boughs out of the balconies
    sprays.push([px, py, G + hh - reach * 0.18, size, size * 0.85, r() * Math.PI, (r() - 0.5) * 0.5, 0.3 + r() * r() * 1.0]);
  } });
  quads(L.spray, sprays, 'scenery:canopy', true);

  const ring = [];
  for (let i = 0; i < S.farTreeCount; i++) { const a = (i / S.farTreeCount) * Math.PI * 2 + r() * 0.06, rad = S.farTreeRing[0] + r() * (S.farTreeRing[1] - S.farTreeRing[0]), hh = S.farTreeH[0] + r() * (S.farTreeH[1] - S.farTreeH[0]), w = hh * (0.55 + r() * 0.3), yaw = r() * Math.PI, sh = 0.4 + r() * 0.45;
    for (const dy of [0, Math.PI / 2]) ring.push([cx + Math.cos(a) * rad, S.centreY + Math.sin(a) * rad, G + hh / 2, w, hh, yaw + dy, 0, sh]); }
  quads(L.tree, ring, 'scenery:far-trees', false);

  // shrub bed along the building: lumpy evergreen mounds + strappy clumps in front of the rail (IMG_3926, IMG_3936)
  let blob = new THREE.IcosahedronGeometry(1, 3); blob.deleteAttribute('normal'); blob.deleteAttribute('uv');
  blob = mergeVertices(blob); // shared vertices -> smooth normals (icosahedra are built flat-shaded)
  const bp = blob.attributes.position, buv = new Float32Array(bp.count * 2);
  for (let i = 0; i < bp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(bp, i), n = 1 + 0.14 * Math.sin(v.x * 7 + v.y * 5) * Math.cos(v.z * 6 + v.y * 3) + 0.06 * Math.sin(v.x * 17 - v.z * 13);
    buv[i * 2] = Math.atan2(v.z, v.x) / Math.PI; buv[i * 2 + 1] = v.y * 0.5; // cylindrical wrap for the leaf speckle
    bp.setXYZ(i, v.x * n, v.y * n, v.z * n);
  }
  blob.setAttribute('uv', new THREE.BufferAttribute(buv, 2)); blob.computeVertexNormals();
  const nShrub = 60, shrubs = new THREE.InstancedMesh(blob, L.leaf, nShrub), clumps = [];
  for (let i = 0; i < nShrub; i++) {
    const x = -260 + (i / nShrub) * 900 + (r() - 0.5) * 16, underDeck = x > D.x0 - 20, y = (underDeck ? Y_OUT + 22 : S.shrubBed.y0 + 26) + r() * 26;
    const hh = underDeck ? 30 + r() * 16 : 74 + r() * 22, w = underDeck ? 22 + r() * 12 : 30 + r() * 14; // stay below the deck floor / reach the window sill (IMG_3936)
    shrubs.setMatrixAt(i, M4.makeRotationY(r() * 6).scale(new THREE.Vector3(m(w), m(hh / 2), m(w))).setPosition(m(x), m(G + hh * 0.42), m(y)));
    shrubs.setColorAt(i, col.setScalar(0.7 + r() * 0.5));
    if (i % 2 === 0 || !underDeck) { const ch = underDeck ? 50 + r() * 22 : 84 + r() * 22, yaw = r() * Math.PI; for (const dy of [0, Math.PI / 2]) clumps.push([x + 9, y + 14 + r() * 10, G + ch / 2, ch * 0.9, ch, yaw + dy, 0, 0.55 + r() * 0.45]); }
  }
  shrubs.name = 'scenery:shrubs'; g.add(shrubs);
  quads(L.blades, clumps, 'scenery:strappy-clumps', false);

  g.add(far.build('scenery:static'));
  g.traverse((o) => { if (o.isMesh) noShadow(o); });
  return g;
}

// ---------------------------------------------------------------- assemble
export function build() {
  const L = makeMats(), own = batcher(), ctx = batcher(), slatsCtx = [], slatsTan = [];
  const xi = D.x0 + D.slatT, xs = xi + D.fasciaT;
  const floor = boxAt(xs, Y_WALL, FLOOR - D.slabT, D.x1 - xs, Y_APRON - Y_WALL, D.slabT, MAT.deckFloor, 'deck:floor');
  const soffit = boxAt(D.x0, ENV.d, D.soffitElev, D.x1 - D.x0, Y_OUT - ENV.d, UP_SLAB_T, MAT.stuccoSoffit, 'deck:soffit');
  const drip = softBoxAt(D.x0, Y_OUT - D.dripEdge.t, D.soffitElev - D.dripEdge.h, D.x1 - D.x0, D.dripEdge.t, D.dripEdge.h + 1, 0.2, MAT.partitionWhite, 'deck:drip-edge');
  soffit.userData.hideInDollhouse = drip.userData.hideInDollhouse = true;
  const fascia = group('deck:fascia',
    boxAt(xi, Y_APRON, FLOOR - D.slabT, D.x1 - xi, D.fasciaT, D.slabT, MAT.deckRail, 'deck:fascia-front'),
    boxAt(xi, Y_WALL, FLOOR - D.slabT, D.fasciaT, Y_APRON - Y_WALL, D.slabT, MAT.deckRail, 'deck:fascia-north'));
  building(own, ctx, slatsCtx, slatsTan);
  const face = own.build('deck:building-face');
  const neighbours = ctx.build('deck:neighbours', true);
  neighbours.add(instancedBoxes(slatsCtx, MAT.deckRail, 'deck:neighbour-slats', false), instancedBoxes(slatsTan, MAT.railTan, 'deck:neighbour-slats-tan', false));
  return group('deck', floor, fascia, railing(), soffit, drip, partition(), sconce(), condenser(L), services(), face, neighbours, scenery(L));
}
