// Swami shelf (home mandir): the cherry bookcase from spruce_apt_photos/bookcase.jpg dressed like home_mandir_earlier.jpeg.
// Contract: build() returns a THREE.Group named 'mandir', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.mandir.pos/rot and makes it draggable.
// All sizes come from FURNITURE.mandir (inches). Lathe profiles below are unit SHAPES ([radius, height] as a
// fraction of the article's height) and are scaled by the dimension from dimensions.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { group } from '../lib/build.js';

const D = FURNITURE.mandir, DR = D.door, DC = D.decor;
const rand = rng(108);

// ---------- helpers (inches in, metres out) ----------
const put = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);
const shadow = (o) => ((o.castShadow = o.receiveShadow = true), o);

/** Rounded-edge board. UVs are re-projected in metres with U along `grain` ('x'|'y'|'z') so MAT.cherryGrain runs lengthwise. */
function wood(w, h, d, grain, name, radius = D.edge, mat = MAT.cherryGrain) {
  const g = new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(Math.min(radius, w / 2, h / 2, d / 2)));
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const gi = 'xyz'.indexOf(grain), off = rand(); // random V offset so no two boards show the same figure
  for (let i = 0; i < p.count; i++) {
    const P = [p.getX(i), p.getY(i), p.getZ(i)], N = [n.getX(i), n.getY(i), n.getZ(i)].map(Math.abs);
    const ni = N.indexOf(Math.max(...N));
    const vi = [0, 1, 2].find((a) => a !== gi && a !== ni) ?? (gi + 1) % 3;
    uv.setXY(i, P[ni === gi ? (gi + 2) % 3 : gi] + off, P[vi] + off);
  }
  const mesh = shadow(new THREE.Mesh(g, mat));
  mesh.name = name;
  return mesh;
}

/** Turned brass article: pts = [[r, y] …] as fractions of `height` (inches). */
function lathe(pts, height, mat, name, seg = 32) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(m(r * height), m(y * height))), seg);
  const mesh = shadow(new THREE.Mesh(g, mat));
  mesh.name = name;
  return mesh;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- carcass ----------
function carcass() {
  const bw = D.w - 2 * D.corniceOver, bd = D.d - D.corniceOver; // body (cornice overhangs front + sides, back is flush to the wall)
  const zBack = -D.d / 2, zFront = zBack + bd, bodyH = D.h - D.corniceH, innerW = bw - 2 * D.sideT;
  const zMid = (zBack + zFront) / 2, zIn = zBack + D.backT; // zIn = inside face of the back panel
  const g = group('mandir:carcass');

  for (const s of [-1, 1]) g.add(put(wood(D.sideT, bodyH, bd, 'y', `mandir:side${s < 0 ? 'L' : 'R'}`), s * (bw - D.sideT) / 2, bodyH / 2, zMid));
  g.add(put(wood(innerW, bodyH, D.backT, 'y', 'mandir:back', 0.02), 0, bodyH / 2, zBack + D.backT / 2));
  g.add(put(wood(innerW, D.topT, bd - D.backT, 'x', 'mandir:cabinetFloor'), 0, D.plinthH + D.topT / 2, (zIn + zFront) / 2));
  g.add(put(wood(innerW, D.topT, bd - D.backT, 'x', 'mandir:top'), 0, bodyH - D.topT / 2, (zIn + zFront) / 2));
  // plinth + deck rail stand proud of the body, flush with the overlay doors
  const proudD = 2 * DR.t, zProud = zFront + DR.t - proudD / 2;
  g.add(put(wood(bw + 2 * D.plinthProud, D.plinthH, proudD, 'x', 'mandir:plinth'), 0, D.plinthH / 2, zProud));
  g.add(put(wood(innerW, D.deckT, bd - D.backT - DR.t, 'x', 'mandir:deck'), 0, D.baseH - D.deckT / 2, (zIn + zFront - DR.t) / 2));
  g.add(put(wood(bw, D.deckT, proudD, 'x', 'mandir:deckRail', 0.12), 0, D.baseH - D.deckT / 2, zProud));

  // two adjustable shelves -> three equal open bays
  const bayH = (bodyH - D.topT - D.baseH - 2 * D.shelfT) / 3, shelfD = bd - D.backT - D.shelfInset;
  const shelfTops = [1, 2].map((i) => D.baseH + i * (bayH + D.shelfT));
  shelfTops.forEach((top, i) => {
    g.add(put(wood(innerW - 0.04, D.shelfT, shelfD - D.nosingD, 'x', `mandir:shelf${i + 1}`), 0, top - D.shelfT / 2, zIn + (shelfD - D.nosingD) / 2));
    g.add(put(wood(innerW - 0.04, D.nosingH, D.nosingD, 'x', `mandir:shelf${i + 1}Nosing`, 0.1), 0, top - D.nosingH / 2, zIn + shelfD - D.nosingD / 2));
  });

  // crown cornice: stepped layers, each overhanging more than the one below
  let y = bodyH;
  D.corniceSteps.forEach(([h, o], i) => {
    g.add(put(wood(bw + 2 * o, h, bd + o, 'x', `mandir:cornice${i}`, i === D.corniceSteps.length - 1 ? 0.15 : 0.2), 0, y + h / 2, zBack + (bd + o) / 2));
    y += h;
  });

  // raised-panel overlay doors
  const dh = D.baseH - D.deckT - D.plinthH - 2 * DR.gap, dw = (bw - 3 * DR.gap) / 2, fw = DR.frameW;
  const dy = D.plinthH + DR.gap + dh / 2;
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const door = group(`mandir:door${side}`);
    for (const k of [-1, 1]) {
      door.add(put(wood(fw, dh, DR.t, 'y', `mandir:door${side}:stile`), k * (dw - fw) / 2, 0, DR.t / 2));
      door.add(put(wood(dw - 2 * fw, fw, DR.t, 'x', `mandir:door${side}:rail`), 0, k * (dh - fw) / 2, DR.t / 2));
    }
    const fieldT = DR.t - DR.panelRaise;
    door.add(put(wood(dw - 2 * fw + 0.1, dh - 2 * fw + 0.1, fieldT, 'y', `mandir:door${side}:field`, 0.02), 0, 0, fieldT / 2));
    door.add(put(wood(dw - 2 * fw - 1.5, dh - 2 * fw - 1.5, DR.panelRaise * 2, 'y', `mandir:door${side}:panel`, DR.panelRaise * 0.9), 0, 0, fieldT));
    door.add(put(pull(`mandir:pull${side}`), -s * (dw / 2 - DR.pullOff), (DR.pullElevFrac - 0.5) * dh, DR.t));
    for (const k of [-1, 1]) { // hinge barrels on the outer edge
      const hinge = shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(0.13), m(0.13), m(1.6), 10), MAT.blackMetal));
      door.add(put(hinge, s * (dw / 2 + 0.02), k * dh * 0.36, DR.t * 0.4));
    }
    g.add(put(door, s * (dw + DR.gap) / 2, dy, zFront));
  }
  return { g, shelfTops, bayH, innerW, zIn, zFront, shelfFront: zIn + shelfD };
}

/** Antique-brass drop pull: oval backplate, two rosettes and a bail. Origin on the door face, +Z out. */
function pull(name) {
  const H = DR.pullH, g = group(name);
  const plate = shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(0.45), m(0.45), m(0.08), 24), MAT.antiqueBrass));
  plate.rotation.x = Math.PI / 2; plate.scale.z = H / 0.9; // cylinder axis -> Z, then stretch along door-vertical (its local z)
  g.add(put(plate, 0, 0, 0.04));
  for (const k of [-1, 1]) {
    const ros = shadow(new THREE.Mesh(new THREE.SphereGeometry(m(0.3), 16, 10), MAT.antiqueBrass));
    ros.scale.z = 0.6;
    g.add(put(ros, 0, k * H * 0.36, 0.1));
  }
  const P = (y, z) => new THREE.Vector3(0, m(y * H), m(z * DR.pullProj));
  const bail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P(0.36, 0.2), P(0.33, 0.9), P(0.15, 1), P(-0.15, 1), P(-0.33, 0.9), P(-0.36, 0.2)]), 24, m(0.1), 8);
  g.add(shadow(new THREE.Mesh(bail, MAT.antiqueBrass)));
  return g;
}

// ---------- puja articles ----------
const clothMat = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.8, side: THREE.DoubleSide, name: 'mandir-silk-runner' });

/** Saffron silk runner with zari (gold) borders; lies on the shelf and drapes over its front edge. */
function runner(w, depth, name) {
  const zari = (c, x, y, bw, bh, horiz) => { // gold band with maroon pin-lines and diamonds
    c.fillStyle = '#c9971f'; c.fillRect(x, y, bw, bh);
    c.fillStyle = '#6e1408';
    const t = horiz ? bh : bw, n = Math.round((horiz ? bw : bh) / t);
    if (horiz) { c.fillRect(x, y + t * 0.1, bw, t * 0.06); c.fillRect(x, y + t * 0.84, bw, t * 0.06); } else { c.fillRect(x + t * 0.1, y, t * 0.06, bh); c.fillRect(x + t * 0.84, y, t * 0.06, bh); }
    for (let i = 0; i < n; i++) {
      const cx = horiz ? x + (i + 0.5) * (bw / n) : x + t / 2, cy = horiz ? y + t / 2 : y + (i + 0.5) * (bh / n), r = t * 0.22;
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.fill();
    }
  };
  const weave = (c, W, H) => { // fine silk weave so the cloth is not a flat colour
    const r = rng(9);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,190,90' : '120,30,0'},${0.04 + r() * 0.05})`; c.fillRect(r() * W, r() * H, 8 + r() * 30, 1); }
  };
  const ppi = 40, band = 1.1 * ppi;
  const top = canvasTex(Math.round(w * ppi), Math.round(depth * ppi), (c, W, H) => {
    c.fillStyle = '#d9611a'; c.fillRect(0, 0, W, H); weave(c, W, H);
    zari(c, 0, 0, band, H, false); zari(c, W - band, 0, band, H, false);
  });
  const drop = canvasTex(Math.round(w * ppi), Math.round(DC.runnerDrop * ppi), (c, W, H) => {
    c.fillStyle = '#d9611a'; c.fillRect(0, 0, W, H); weave(c, W, H);
    zari(c, 0, 0, band, H, false); zari(c, W - band, 0, band, H, false); zari(c, 0, H - band, W, band, true);
  });
  const g = group(name);
  const a = new THREE.Mesh(new THREE.PlaneGeometry(m(w), m(depth)), clothMat(top));
  a.rotation.x = -Math.PI / 2; a.receiveShadow = true; a.name = `${name}:top`;
  g.add(put(a, 0, 0, -depth / 2));
  const dg = new THREE.PlaneGeometry(m(w), m(DC.runnerDrop), 48, 4), p = dg.attributes.position;
  for (let i = 0; i < p.count; i++) { // soft folds growing toward the free hem
    const t = 0.5 - p.getY(i) / m(DC.runnerDrop);
    p.setZ(i, m(0.05 + t * 0.14 * (1 + Math.sin(p.getX(i) / m(w) * 38))));
  }
  dg.computeVertexNormals();
  const b = shadow(new THREE.Mesh(dg, clothMat(drop)));
  b.name = `${name}:drop`;
  g.add(put(b, 0, -DC.runnerDrop / 2, 0));
  return g; // origin: top of the shelf's front edge, centred
}

/** Dignified devotional art: aureole + soft painted silhouette (no faces) or a gold Om. */
function picture(kind, W, H) {
  const ppi = 72;
  return canvasTex(W * ppi, H * ppi, (c, w, h) => {
    const cx = w / 2, cy = h * (kind === 'om' ? 0.5 : 0.36);
    const bg = c.createRadialGradient(cx, cy, 0, cx, cy, h * 0.75);
    const [c0, c1, c2] = kind === 'standing' ? ['#f7c860', '#c8580f', '#4a0d06'] : kind === 'om' ? ['#e89a24', '#a8300c', '#3c0a06'] : ['#f9d272', '#d2701a', '#5a1208'];
    bg.addColorStop(0, c0); bg.addColorStop(0.45, c1); bg.addColorStop(1, c2);
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    // fine rays + halo rings
    c.save(); c.translate(cx, cy); c.strokeStyle = 'rgba(255,225,140,0.22)'; c.lineWidth = 2;
    for (let i = 0; i < 72; i++) { c.rotate(Math.PI / 36); c.beginPath(); c.moveTo(0, h * 0.13); c.lineTo(0, h * (i % 2 ? 0.30 : 0.36)); c.stroke(); }
    c.restore();
    for (const [r, a] of [[0.125, 0.9], [0.14, 0.45]]) { c.strokeStyle = `rgba(255,214,110,${a})`; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, h * r, 0, 7); c.stroke(); }
    if (kind === 'om') {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${h * 0.4}px "Devanagari Sangam MN","Kohinoor Devanagari","Noto Sans Devanagari",serif`;
      c.shadowColor = 'rgba(60,10,0,0.7)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
      const gold = c.createLinearGradient(0, h * 0.3, 0, h * 0.7); gold.addColorStop(0, '#fff1b0'); gold.addColorStop(0.5, '#e9b53a'); gold.addColorStop(1, '#a8701a');
      c.fillStyle = gold; c.fillText('ॐ', cx, cy + h * 0.02);
      c.shadowColor = 'transparent';
    } else {
      c.filter = 'blur(2.5px)';
      const fig = c.createLinearGradient(0, cy - h * 0.12, 0, h * 0.9); fig.addColorStop(0, '#7a1d0c'); fig.addColorStop(1, '#3a0a05');
      c.fillStyle = fig;
      const u = h * 0.01; // silhouette unit
      c.beginPath(); c.moveTo(cx, cy - 13 * u); c.lineTo(cx + 4 * u, cy - 6 * u); c.lineTo(cx - 4 * u, cy - 6 * u); c.fill(); // crown
      c.beginPath(); c.arc(cx, cy, 6.5 * u, 0, 7); c.fill(); // head (featureless)
      c.beginPath();
      if (kind === 'standing') { // robed standing figure
        c.moveTo(cx - 5 * u, cy + 6 * u); c.bezierCurveTo(cx - 17 * u, cy + 12 * u, cx - 13 * u, cy + 36 * u, cx - 15 * u, cy + 52 * u);
        c.lineTo(cx + 15 * u, cy + 52 * u); c.bezierCurveTo(cx + 13 * u, cy + 36 * u, cx + 17 * u, cy + 12 * u, cx + 5 * u, cy + 6 * u);
      } else { // seated in padmasana
        c.moveTo(cx - 5 * u, cy + 6 * u); c.bezierCurveTo(cx - 19 * u, cy + 10 * u, cx - 15 * u, cy + 30 * u, cx - 27 * u, cy + 40 * u);
        c.bezierCurveTo(cx - 30 * u, cy + 48 * u, cx + 30 * u, cy + 48 * u, cx + 27 * u, cy + 40 * u);
        c.bezierCurveTo(cx + 15 * u, cy + 30 * u, cx + 19 * u, cy + 10 * u, cx + 5 * u, cy + 6 * u);
      }
      c.fill();
      // lotus seat
      const ly = cy + (kind === 'standing' ? 53 : 47) * u;
      for (let i = -3; i <= 3; i++) { c.fillStyle = i % 2 ? '#e58a9c' : '#f4b6bf'; c.beginPath(); c.ellipse(cx + i * 7.5 * u, ly - Math.abs(i) * 0.4 * u, 5.5 * u, 3.4 * u, i * 0.22, 0, 7); c.fill(); }
      c.filter = 'none';
    }
    // inner gold keyline
    c.strokeStyle = 'rgba(240,200,95,0.9)'; c.lineWidth = 4; c.strokeRect(w * 0.05, w * 0.05, w * 0.9, h - w * 0.1);
  });
}

/** Gold-framed picture. Origin = bottom-centre of the frame's BACK face, leaning back by frameLean about that edge. */
function framed(kind, [pw, ph], name) {
  const b = DC.frameBar, t = DC.frameT, g = group(name), inner = group(`${name}:lean`);
  const bar = (w, h, x, y, n) => inner.add(put(wood(w, h, t, 'x', `${name}:${n}`, 0.18, MAT.brass), x, y, t / 2));
  bar(pw + 2 * b, b, 0, b / 2, 'bottom'); bar(pw + 2 * b, b, 0, ph + 1.5 * b, 'top');
  bar(b, ph, -(pw + b) / 2, b + ph / 2, 'left'); bar(b, ph, (pw + b) / 2, b + ph / 2, 'right');
  const art = new THREE.Mesh(new THREE.PlaneGeometry(m(pw), m(ph)), new THREE.MeshStandardMaterial({ map: picture(kind, pw, ph), roughness: 0.6, envMapIntensity: 0.35, name: `mandir-art-${kind}` }));
  art.name = `${name}:art`; art.receiveShadow = true;
  inner.add(put(art, 0, b + ph / 2, t * 0.5));
  const backing = shadow(new THREE.Mesh(new THREE.BoxGeometry(m(pw + b), m(ph + b), m(0.1)), MAT.blackPlastic));
  inner.add(put(backing, 0, b + ph / 2, 0.06));
  inner.rotation.x = -THREE.MathUtils.degToRad(DC.frameLean);
  g.add(inner);
  g.userData.lean = (ph + 2 * b) * Math.sin(THREE.MathUtils.degToRad(DC.frameLean)); // how far the foot stands off the back panel
  return g;
}

const PEDESTAL = [[0, 0], [0.3, 0], [0.3, 0.04], [0.25, 0.065], [0.33, 0.1], [0.27, 0.14], [0, 0.14]];
/** Small brass murti kept abstract and faceless: seated figure (merged ellipsoids) on a lotus pedestal, prabhavali arch behind. */
function murti(H, name) {
  const part = (geo, sx, sy, sz, x, y, z) => geo.scale(m(H * sx), m(H * sy), m(H * sz)).translate(m(H * x), m(H * y), m(H * z));
  const sph = () => new THREE.SphereGeometry(1, 20, 14);
  const parts = [
    new THREE.LatheGeometry(PEDESTAL.map(([r, y]) => new THREE.Vector2(m(r * H), m(y * H))), 32),
    part(sph(), 0.27, 0.085, 0.17, 0, 0.2, 0.02), // crossed legs
    part(sph(), 0.13, 0.2, 0.1, 0, 0.4, 0), // torso
    part(sph(), 0.19, 0.06, 0.09, 0, 0.53, 0), // shoulders
    part(sph(), 0.05, 0.14, 0.05, -0.17, 0.4, 0.03), part(sph(), 0.05, 0.14, 0.05, 0.17, 0.4, 0.03), // arms resting on the knees
    part(sph(), 0.1, 0.105, 0.1, 0, 0.68, 0), // head (featureless)
    part(new THREE.ConeGeometry(1, 1, 16), 0.075, 0.24, 0.075, 0, 0.86, 0), // mukut (crown)
    part(new THREE.TorusGeometry(1, 0.07, 8, 32, Math.PI), 0.36, 0.36, 0.36, 0, 0.5, -0.12), // prabhavali
    ...[-1, 1].map((s) => part(new THREE.CylinderGeometry(1, 1, 1, 8), 0.025, 0.38, 0.025, s * 0.36, 0.31, -0.12)),
  ];
  const mesh = shadow(new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), MAT.brass));
  mesh.name = name;
  return mesh;
}

const FLAME = [[0, 0], [0.13, 0.1], [0.2, 0.28], [0.15, 0.55], [0.055, 0.82], [0, 1]];
let glowTex;
/** Lamp flame: unlit teardrop + soft additive halo. Flickers via userData.tick. */
function flame(name) {
  glowTex ??= canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,190,90,1)'); g.addColorStop(0.35, 'rgba(255,140,40,0.4)'); g.addColorStop(1, 'rgba(255,120,20,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  const core = lathe(FLAME, DC.flameH, MAT.flame, `${name}:core`, 12);
  core.castShadow = core.receiveShadow = false;
  // halo is a 1-vertex Points (not a Sprite): GTAOPass skips Points in its normal/depth pre-pass, a Sprite would render as a black quad
  const halo = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
    new THREE.PointsMaterial({ map: glowTex, size: m(DC.flameH * 4), sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.03), m(0.2), 6), MAT.blackPlastic);
  const g = group(name, core, put(halo, 0, DC.flameH * 0.45, 0), put(wick, 0, 0, 0));
  const phase = rand() * 10; let t = 0;
  g.userData.tick = (dt) => { t += dt; const f = 1 + 0.08 * Math.sin(t * 11 + phase) + 0.05 * Math.sin(t * 23.7 + phase); core.scale.set(1, f, 1); g.userData.light && (g.userData.light.intensity = g.userData.lightBase * f); };
  return g;
}

const DIYA = [[0, 0], [0.55, 0], [0.62, 0.1], [1, 0.5], [0.93, 0.52], [0.6, 0.22], [0, 0.18]]; // fractions of the bowl RADIUS
function diya(name) {
  const R = DC.diyaR, g = group(name, lathe(DIYA, R, MAT.brass, `${name}:bowl`));
  const fl = put(flame(`${name}:flame`), 0, R * 0.5, R * 0.8);
  // very weak warm glow, no shadow (candle-scale against the scene's sun = 5)
  const light = new THREE.PointLight(0xffa24a, 0.05, m(40), 2);
  light.name = `${name}:light`; light.castShadow = false;
  fl.userData.light = light; fl.userData.lightBase = light.intensity;
  g.add(fl, put(light, 0, R * 0.5 + DC.flameH, R * 0.8));
  return g;
}

const VILAKKU = [[0, 0], [0.19, 0], [0.19, 0.028], [0.13, 0.05], [0.06, 0.1], [0.04, 0.155], [0.067, 0.2], [0.04, 0.245], [0.033, 0.38], [0.069, 0.42], [0.033, 0.465], [0.033, 0.58], [0.055, 0.61], [0.165, 0.655], [0.172, 0.7], [0.16, 0.7], [0.055, 0.665], [0.033, 0.67], [0.033, 0.755], [0.055, 0.79], [0.028, 0.835], [0.044, 0.89], [0.017, 0.955], [0, 1]];
/** Kuthu vilakku: South-Indian standing brass oil lamp with one lit wick at the front of the bowl. */
function vilakku(name) {
  const H = DC.vilakkuH;
  return group(name, lathe(VILAKKU, H, MAT.brass, `${name}:body`), put(flame(`${name}:flame`), 0, H * 0.7, H * 0.155));
}

const LOTUS_STEM = [[0, 0], [0.25, 0], [0.25, 0.035], [0.085, 0.1], [0.055, 0.42], [0.12, 0.5], [0, 0.52]];
/** Lotus tealight holder: brass foot, two rings of satin petals (one InstancedMesh), white tealight in the cup. */
function lotus(color, name) {
  const H = DC.lotusH, g = group(name, lathe(LOTUS_STEM, H, MAT.brass, `${name}:stem`));
  const pl = H * 0.27; // petal half-length
  const pg = new THREE.SphereGeometry(1, 10, 8).scale(m(pl * 0.5), m(pl), m(pl * 0.13)).translate(0, m(pl), 0);
  const rings = [[8, 42, 0.28], [6, 20, 0.2]]; // [count, tilt deg from vertical, start radius / H·… in inches below]
  const petals = shadow(new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color, roughness: 0.55, name: 'lotus-petal' }), rings.reduce((a, r) => a + r[0], 0)));
  const o = new THREE.Object3D(); let k = 0;
  rings.forEach(([n, tilt, r0], ri) => {
    for (let i = 0; i < n; i++) {
      const a = ((i + ri * 0.5) / n) * Math.PI * 2;
      o.position.set(Math.sin(a) * m(H * r0 * 0.4), m(H * 0.5), Math.cos(a) * m(H * r0 * 0.4));
      o.rotation.set(THREE.MathUtils.degToRad(tilt), a, 0, 'YXZ');
      o.updateMatrix(); petals.setMatrixAt(k++, o.matrix);
    }
  });
  petals.name = `${name}:petals`;
  const candle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(H * 0.2), m(H * 0.2), m(H * 0.16), 20), MAT.whitePlastic));
  g.add(petals, put(candle, 0, H * 0.58, 0));
  return g;
}

const PLATE = [[0, 0], [0.75, 0], [1, 0.12], [0.98, 0.14], [0.75, 0.03], [0, 0.03]]; // fractions of plate RADIUS
function plate(name) {
  const R = DC.plateR, g = group(name, lathe(PLATE, R, MAT.brass, `${name}:dish`, 48));
  const mari = new THREE.MeshStandardMaterial({ color: 0xe8861a, roughness: 1, flatShading: true, name: 'marigold' });
  [[-0.3, 0.15, 0], [0.32, -0.1, 0.6], [0.02, -0.42, 1.3]].forEach(([x, z, r], i) => {
    const f = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(m(R * 0.19), 2), mari));
    f.scale.y = 0.65; f.rotation.y = r; f.name = `${name}:marigold${i}`;
    g.add(put(f, x * R, R * 0.03 + R * 0.19 * 0.62, z * R));
  });
  return g;
}

const BELL = [[0.31, 0], [0.32, 0.03], [0.26, 0.14], [0.2, 0.32], [0.15, 0.44], [0.055, 0.49], [0.04, 0.8], [0.1, 0.86], [0.08, 0.94], [0, 1]];
const INCENSE_DISH = [[0, 0], [0.09, 0], [0.13, 0.03], [0.12, 0.035], [0.08, 0.012], [0.02, 0.012], [0.02, 0.04], [0, 0.04]]; // fractions of stick length
function incense(name) {
  const L = DC.incenseL, g = group(name, lathe(INCENSE_DISH, L, MAT.brass, `${name}:dish`));
  const stick = shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(0.045), m(0.03), m(L), 6), new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 1, name: 'agarbatti' })));
  const tilt = THREE.MathUtils.degToRad(24);
  stick.rotation.z = -tilt;
  g.add(put(stick, Math.sin(tilt) * L / 2, Math.cos(tilt) * L / 2 + L * 0.02, 0));
  return g;
}

export function build() {
  const { g: body, shelfTops, innerW, zIn, zFront, shelfFront } = carcass();
  const [main, upper] = shelfTops, deck = D.baseH, half = innerW / 2;
  const decor = group('mandir:decor');

  // MAIN shelf: runner, two framed pictures, murtis, lit diya
  const rw = innerW - 2 * DC.runnerMargin;
  decor.add(put(runner(rw, shelfFront - zIn - 0.3, 'mandir:runner'), 0, main + 0.06, shelfFront + 0.02));
  [['seated', -1], ['standing', 1]].forEach(([kind, s]) => {
    const f = framed(kind, DC.pic, `mandir:picture${s < 0 ? 'L' : 'R'}`);
    decor.add(put(f, s * half * 0.6, main + 0.07, zIn + f.userData.lean + 0.05));
  });
  decor.add(put(murti(DC.murtiH, 'mandir:murti'), 0, main + 0.07, zIn + 3.2));
  for (const s of [-1, 1]) decor.add(put(murti(DC.smallMurtiH, `mandir:murtiSmall${s < 0 ? 'L' : 'R'}`), s * half * 0.3, main + 0.07, zIn + 5.6));
  decor.add(put(diya('mandir:diya'), 0, main + 0.07, shelfFront - 1.7));

  // UPPER shelf: Om picture flanked by lotus tealight holders
  const om = framed('om', DC.omPic, 'mandir:pictureOm');
  decor.add(put(om, 0, upper, zIn + om.userData.lean + 0.05));
  decor.add(put(lotus(0xd977a0, 'mandir:lotusL'), -half * 0.68, upper, zIn + 5), put(lotus(0xf3ece2, 'mandir:lotusR'), half * 0.68, upper, zIn + 5));

  // DECK: pair of kuthu vilakku, puja plate with marigolds, bell, incense
  for (const s of [-1, 1]) decor.add(put(vilakku(`mandir:vilakku${s < 0 ? 'L' : 'R'}`), s * half * 0.66, deck, zIn + 4.2));
  decor.add(put(plate('mandir:plate'), 0, deck, zIn + 5.2));
  decor.add(put(lathe(BELL, DC.bellH, MAT.brass, 'mandir:bell'), half * 0.36, deck, zFront - 2.6));
  decor.add(put(incense('mandir:incense'), -half * 0.4, deck, zFront - 2.4));

  return group('mandir', body, decor);
}
