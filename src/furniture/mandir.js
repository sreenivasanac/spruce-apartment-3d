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
function wood(w, h, d, grain, name, radius = D.edge, mat = MAT.cherryGrain, uv0) { // uv0 = [x, y, z, offset] (inches): board centre inside a larger one-piece part -> continuous figure
  const g = new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(Math.min(radius, w / 2, h / 2, d / 2)));
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const gi = 'xyz'.indexOf(grain), off = uv0 ? uv0[3] : rand(); // random V offset so no two boards show the same figure
  for (let i = 0; i < p.count; i++) {
    const P = [p.getX(i), p.getY(i), p.getZ(i)].map((v, a) => v + (uv0 ? m(uv0[a]) : 0)), N = [n.getX(i), n.getY(i), n.getZ(i)].map(Math.abs);
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
  // plain dark mullion right behind the door gap so nothing textured shows through the 1/8" slot
  g.add(put(wood(DR.mullionW, dh, D.backT, 'y', 'mandir:mullion', 0.02, MAT.cherry), 0, dy, zFront - D.backT / 2));
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const door = group(`mandir:door${side}`), off = rand();
    // thermofoil door = one routed piece: every part shares one vertical-grain UV frame, joints are only fine eased grooves
    const part = (w, h, t, x, y, z, n, r) => door.add(put(wood(w, h, t, 'y', `mandir:door${side}:${n}`, r, MAT.cherryGrain, [x, y, 0, off]), x, y, z));
    for (const k of [-1, 1]) {
      part(fw, dh, DR.t, k * (dw - fw) / 2, 0, DR.t / 2, 'stile');
      part(dw - 2 * fw, fw, DR.t, 0, k * (dh - fw) / 2, DR.t / 2, 'rail');
    }
    const fieldT = DR.t - DR.panelRaise;
    part(dw - 2 * fw + 0.1, dh - 2 * fw + 0.1, fieldT, 0, 0, fieldT / 2, 'field', 0.02);
    part(dw - 2 * fw - 1.5, dh - 2 * fw - 1.5, DR.panelRaise * 2, 0, 0, fieldT, 'panel', DR.panelRaise * 0.9);
    door.add(put(pull(`mandir:pull${side}`), -s * (dw / 2 - DR.pullOff), (DR.pullElevFrac - 0.5) * dh, DR.t));
    for (const k of [-1, 1]) { // dark wrap hinges on the outer edge: knuckle + leaf wrapping the door edge
      const hy = k * dh * (0.5 - DR.hingeFrac), r = DR.hingeDia / 2;
      const knuckle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(r), m(r), m(DR.hingeL), 12), MAT.blackMetal));
      knuckle.name = `mandir:door${side}:hinge${k < 0 ? 'Lo' : 'Hi'}`;
      const leaf = shadow(new THREE.Mesh(new THREE.BoxGeometry(m(0.05), m(DR.hingeL), m(0.8)), MAT.blackMetal)); // leaf screwed to the carcass side
      door.add(put(knuckle, s * (dw / 2 + DR.gap + r * 0.2), hy, DR.t * 0.45), put(leaf, s * (dw / 2 + DR.gap + 0.025), hy, -0.4));
    }
    g.add(put(door, s * (dw + DR.gap) / 2, dy, zFront));
  }
  return { g, shelfTops, bayH, innerW, zIn, zFront, shelfFront: zIn + shelfD };
}

/** Antique-brass drop pull: waisted, pointed-end pierced backplate (extruded Shape), post + hanging teardrop bail. Origin on the door face, +Z out. */
function pull(name) {
  const H = DR.pullH, W = DR.pullW / 2, g = group(name), N = 40;
  const hw = (t) => W * (0.42 + 0.58 * Math.abs(Math.sin(Math.PI * t)) ** 0.8) * Math.min(1, (1 - Math.abs(t)) * 6); // two lobes, waist, pointed ends
  const pts = [];
  for (let i = 0; i <= N; i++) { const t = -1 + (2 * i) / N; pts.push(new THREE.Vector2(m(hw(t)), m(t * H / 2))); }
  for (let i = N - 1; i > 0; i--) { const t = -1 + (2 * i) / N; pts.push(new THREE.Vector2(-m(hw(t)), m(t * H / 2))); }
  const shape = new THREE.Shape(pts);
  for (const k of [-1, 1]) { const hole = new THREE.Path(); hole.absarc(0, m(k * H * 0.38), m(0.07), 0, Math.PI * 2, true); shape.holes.push(hole); } // piercings
  const plate = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: m(0.04), bevelEnabled: true, bevelSize: m(0.03), bevelThickness: m(0.03), bevelSegments: 2, curveSegments: 10 }), MAT.antiqueBrass));
  g.add(put(plate, 0, 0, 0.03));
  const postY = H * 0.25, R = H * 0.13; // post in the upper lobe, bail hangs from it and rests on a stud in the lower lobe
  const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(0.1), m(0.16), m(DR.pullProj), 12), MAT.antiqueBrass));
  post.rotation.x = Math.PI / 2;
  const knob = shadow(new THREE.Mesh(new THREE.SphereGeometry(m(0.19), 14, 10), MAT.antiqueBrass));
  const stud = shadow(new THREE.Mesh(new THREE.SphereGeometry(m(0.16), 12, 8), MAT.antiqueBrass));
  const bail = shadow(new THREE.Mesh(new THREE.TorusGeometry(m(R), m(0.075), 8, 28).scale(1, 1.9, 1), MAT.antiqueBrass));
  bail.rotation.x = THREE.MathUtils.degToRad(7); // hangs a touch proud at the bottom where it rests on the stud
  g.add(put(post, 0, postY, DR.pullProj / 2), put(knob, 0, postY, DR.pullProj), put(stud, 0, -H * 0.25, 0.12), put(bail, 0, postY - R * 1.9 + 0.08, DR.pullProj * 0.62));
  return g;
}

// ---------- puja articles ----------
let weaveTex;
/** Saffron silk runner with zari (gold) borders: ONE thin sheet swept over the shelf — flat on top, rounded fold over the
 *  nosing, lying against the nosing face, then hanging free with a slight inward curl and a wavy hem.
 *  Origin: top of the shelf's front edge (nosing face), centred. `nosing` = height of the face it lies against. */
function runner(w, depth, nosing, name) {
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
  const R = DC.runnerFoldR, arc = (Math.PI / 2) * R, flat = depth - R, L = flat + arc + DC.runnerDrop - R; // developed length back -> hem
  const ppi = 40, band = 1.1 * ppi;
  const map = canvasTex(Math.round(w * ppi), Math.round(L * ppi), (c, W, H) => { // canvas top = back of shelf, bottom = hem
    c.fillStyle = '#cf5a17'; c.fillRect(0, 0, W, H);
    const r = rng(9); // slubby silk threads so the cloth is not a flat colour
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,180,80' : '110,28,0'},${0.04 + r() * 0.07})`; c.fillRect(r() * W, r() * H, 8 + r() * 40, 1); }
    zari(c, 0, 0, band, H, false); zari(c, W - band, 0, band, H, false); zari(c, 0, H - band, W, band, true);
  });
  weaveTex ??= (() => { // fine plain-weave bump, 1 tile = 8 threads
    const t = canvasTex(32, 32, (c) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#a0a0a0' : '#606060'; c.fillRect(x * 4, y * 4, 4, 4); } });
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const bump = weaveTex.clone(); bump.repeat.set(w * 6, L * 6); bump.needsUpdate = true; // ~48 threads per inch
  const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.62, sheen: 1, sheenRoughness: 0.35, sheenColor: 0xffb24d, side: THREE.DoubleSide, name: 'mandir-silk-runner' });

  const nu = 64, nv = 40, geo = new THREE.PlaneGeometry(1, 1, nu, nv), pos = geo.attributes.position, uv = geo.attributes.uv;
  const lift = 0.03; // sheet rides just above the wood (thin cloth, no slab thickness)
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), sLen = (1 - uv.getY(i)) * L, x = (u - 0.5) * w; // sLen = distance from the back edge along the cloth
    let y, z;
    if (sLen <= flat) { y = lift; z = -depth + sLen; } // on the shelf
    else if (sLen <= flat + arc) { const a = (sLen - flat) / R; y = lift - R + R * Math.cos(a); z = -R + (R + lift) * Math.sin(a); } // quarter-round fold
    else {
      const dn = sLen - flat - arc, free = Math.max(0, R + dn - nosing) / Math.max(0.01, DC.runnerDrop - nosing); // 0 on the nosing face -> 1 at the hem
      y = -R - dn;
      z = lift + free * free * (-DC.runnerCurl + 0.16 * (1 + Math.sin(u * 31 + 0.7) * 0.7 + Math.sin(u * 13) * 0.3)); // inward curl + soft flutes growing to the hem
      y += free * 0.06 * Math.sin(u * 17 + 1); // hem not ruler-straight
    }
    pos.setXYZ(i, m(x), m(y), m(z));
  }
  geo.computeVertexNormals();
  const mesh = shadow(new THREE.Mesh(geo, mat));
  mesh.name = `${name}:cloth`;
  return group(name, mesh);
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

/** Gold-framed picture under glass. Origin = bottom-centre of the frame's BACK face, leaning back by frameLean about that edge
 *  (it rests against the back panel, so no easel). Frame = one extruded moulding ring with a bevelled profile (flush corners). */
function framed(kind, [pw, ph], name) {
  const b = DC.frameBar, t = DC.frameT, bev = 0.14, g = group(name), inner = group(`${name}:lean`);
  const ow = pw + 2 * b, oh = ph + 2 * b;
  const rect = (C, w, h, cw) => { C.moveTo(-m(w) / 2, -m(h) / 2); const P = [[1, -1], [1, 1], [-1, 1]]; (cw ? P.reverse() : P).forEach(([x, y]) => C.lineTo(x * m(w) / 2, y * m(h) / 2)); C.closePath(); return C; };
  const ring = rect(new THREE.Shape(), ow - 2 * bev, oh - 2 * bev, false);
  ring.holes.push(rect(new THREE.Path(), pw + 2 * bev - 0.1, ph + 2 * bev - 0.1, true));
  const frame = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: m(t - 2 * bev), bevelEnabled: true, bevelSize: m(bev), bevelThickness: m(bev), bevelSegments: 3 }), MAT.brass)); // clean gilt moulding (patina map is for UV-mapped lathed brass)
  frame.name = `${name}:frame`;
  inner.add(put(frame, 0, oh / 2, bev));
  // lit print (no emissive), toned down so it never outshines its surroundings in shade
  const art = new THREE.Mesh(new THREE.PlaneGeometry(m(pw), m(ph)), new THREE.MeshStandardMaterial({ map: picture(kind, pw, ph), color: 0xd2cbc4, roughness: 0.75, envMapIntensity: 0.3, name: `mandir-art-${kind}` }));
  art.name = `${name}:art`; art.receiveShadow = true;
  inner.add(put(art, 0, oh / 2, t * 0.45));
  frameGlass ??= Object.assign(MAT.glassPane.clone(), { envMapIntensity: 0.5, opacity: 0.04, side: THREE.FrontSide, name: 'mandir-frame-glass' }); // window glass is tuned for a bright exterior; a frame in shade must not veil the print
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(m(pw), m(ph)), frameGlass);
  glass.name = `${name}:glass`;
  inner.add(put(glass, 0, oh / 2, t * 0.6));
  const backing = shadow(new THREE.Mesh(new THREE.BoxGeometry(m(ow - 0.3), m(oh - 0.3), m(0.1)), MAT.blackPlastic));
  inner.add(put(backing, 0, oh / 2, 0.06));
  inner.rotation.x = -THREE.MathUtils.degToRad(DC.frameLean);
  g.add(inner);
  g.userData.lean = oh * Math.sin(THREE.MathUtils.degToRad(DC.frameLean)); // how far the foot stands off the back panel
  return g;
}

const PEDESTAL = [[0, 0], [0.3, 0], [0.3, 0.04], [0.25, 0.065], [0.33, 0.1], [0.27, 0.14], [0, 0.14]];
// seated-figure silhouette above the pedestal (spline control points): folded knees, waist, shoulders, neck, head, tapering mukut
const FIGURE = [[0.26, 0.14], [0.295, 0.19], [0.26, 0.25], [0.14, 0.31], [0.115, 0.38], [0.175, 0.46], [0.2, 0.51], [0.16, 0.56], [0.055, 0.595], [0.07, 0.63], [0.1, 0.68], [0.085, 0.74], [0.055, 0.775], [0.075, 0.805], [0.045, 0.87], [0.02, 0.94], [0, 1]];
/** Small brass murti kept abstract and faceless: ONE continuous lathe silhouette (slightly flattened front-to-back) on a lotus
 *  pedestal, with a prabhavali arch behind. */
function murti(H, name) {
  const v = (pts) => pts.map(([r, y]) => new THREE.Vector2(m(r * H), m(y * H)));
  const parts = [
    new THREE.LatheGeometry(v(PEDESTAL), 32),
    new THREE.LatheGeometry(new THREE.SplineCurve(v(FIGURE)).getPoints(64), 32).scale(1, 1, 0.72),
    new THREE.TorusGeometry(m(H * 0.36), m(H * 0.025), 8, 32, Math.PI).translate(0, m(H * 0.5), m(-H * 0.14)), // prabhavali
    ...[-1, 1].map((s) => new THREE.CylinderGeometry(m(H * 0.025), m(H * 0.025), m(H * 0.38), 8).translate(m(s * H * 0.36), m(H * 0.31), m(-H * 0.14))),
  ];
  const mesh = shadow(new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), MAT.brassPatina));
  mesh.name = name;
  return mesh;
}

const FLAME = [[0, 0], [0.13, 0.1], [0.2, 0.28], [0.15, 0.55], [0.055, 0.82], [0, 1]];
let glowTex, flameGeo, flameMat, frameGlass;
/** Lamp flame: additive teardrop with a baked gradient (orange root, white-yellow core, orange tip) + soft additive halo.
 *  Every flame shares the same geometry/materials so they all look identical. Flickers via userData.tick. */
function flame(name) {
  glowTex ??= canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); [[0, 0.8], [0.12, 0.45], [0.3, 0.18], [0.55, 0.06], [0.8, 0.015], [1, 0]].forEach(([s, a]) => g.addColorStop(s, `rgba(255,${Math.round(170 - s * 70)},${Math.round(70 - s * 50)},${a})`)); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  if (!flameGeo) {
    flameGeo = new THREE.LatheGeometry(new THREE.SplineCurve(FLAME.map(([r, y]) => new THREE.Vector2(m(r * DC.flameH), m(y * DC.flameH)))).getPoints(24), 16);
    const p = flameGeo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const stops = [[0, 0xff5a0a], [0.3, 0xfff0b8], [0.55, 0xffd060], [1, 0xff6a10]];
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / m(DC.flameH), k = Math.max(1, stops.findIndex(([s]) => s >= t));
      c.setHex(stops[k - 1][1]).lerp(new THREE.Color(stops[k][1]), (t - stops[k - 1][0]) / (stops[k][0] - stops[k - 1][0]));
      col.set([c.r, c.g, c.b], i * 3);
    }
    flameGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, name: 'mandir-flame' });
  }
  const core = new THREE.Mesh(flameGeo, flameMat); core.name = `${name}:core`;
  // halo is a 1-vertex Points (not a Sprite): GTAOPass skips Points in its normal/depth pre-pass, a Sprite would render as a black quad.
  // Point size is not fov-corrected by three, so it is oversized to read ~3" wide at the ~40° shot fovs.
  const halo = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
    new THREE.PointsMaterial({ map: glowTex, size: m(DC.flameH * 9), sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  halo.name = `${name}:halo`;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.03), m(0.2), 6), MAT.blackPlastic);
  const g = group(name, core, put(halo, 0, DC.flameH * 0.45, 0), put(wick, 0, 0, 0));
  const phase = rand() * 10; let t = 0;
  g.userData.tick = (dt) => { t += dt; const f = 1 + 0.08 * Math.sin(t * 11 + phase) + 0.05 * Math.sin(t * 23.7 + phase); core.scale.set(1, f, 1); g.userData.light && (g.userData.light.intensity = g.userData.lightBase * f); };
  return g;
}

const DIYA = [[0, 0], [0.55, 0], [0.62, 0.1], [1, 0.5], [0.93, 0.52], [0.6, 0.22], [0, 0.18]]; // fractions of the bowl RADIUS
function diya(name) {
  const R = DC.diyaR, g = group(name, lathe(DIYA, R, MAT.brassPatina, `${name}:bowl`));
  const fl = put(flame(`${name}:flame`), 0, R * 0.5, R * 0.8);
  // weak warm pool on the cloth and murtis, no shadow (candle-scale against the scene's sun = 5)
  const light = new THREE.PointLight(0xffa24a, 0.1, m(DC.flameLightIn), 2);
  light.name = `${name}:light`; light.castShadow = false;
  fl.userData.light = light; fl.userData.lightBase = light.intensity;
  g.add(fl, put(light, 0, R * 0.5 + DC.flameH, R * 0.8));
  return g;
}

const VILAKKU = [[0, 0], [0.19, 0], [0.19, 0.028], [0.13, 0.05], [0.06, 0.1], [0.04, 0.155], [0.067, 0.2], [0.04, 0.245], [0.033, 0.38], [0.069, 0.42], [0.033, 0.465], [0.033, 0.58], [0.055, 0.61], [0.165, 0.655], [0.172, 0.7], [0.16, 0.7], [0.055, 0.665], [0.033, 0.67], [0.033, 0.755], [0.055, 0.79], [0.028, 0.835], [0.044, 0.89], [0.017, 0.955], [0, 1]];
/** Kuthu vilakku: South-Indian standing brass oil lamp with one lit wick at the front of the bowl. */
function vilakku(name) {
  const H = DC.vilakkuH;
  return group(name, lathe(VILAKKU, H, MAT.brassPatina, `${name}:body`), put(flame(`${name}:flame`), 0, H * 0.7, H * 0.155));
}

const LOTUS_STEM = [[0, 0], [0.25, 0], [0.25, 0.035], [0.085, 0.1], [0.055, 0.42], [0.12, 0.5], [0, 0.52]];
/** Lotus tealight holder: brass foot, two rings of satin petals (one InstancedMesh), white tealight in the cup. */
function lotus(color, name) {
  const H = DC.lotusH, g = group(name, lathe(LOTUS_STEM, H, MAT.brassPatina, `${name}:stem`));
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
let marigoldGeo;
function plate(name) {
  const R = DC.plateR, g = group(name, lathe(PLATE, R, MAT.brassPatina, `${name}:dish`, 48));
  if (!marigoldGeo) { // ruffled pom-pom: radial petal lobes + noise, orange -> yellow petal tips baked as vertex colour
    marigoldGeo = new THREE.IcosahedronGeometry(1, 5);
    const p = marigoldGeo.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const az = Math.atan2(v.z, v.x), el = Math.asin(v.y), ruffle = Math.sin(az * 14 + el * 9) * Math.sin(el * 11 + az * 3);
      const k = 1 + 0.13 * ruffle + 0.05 * Math.sin(az * 37 + el * 29);
      p.setXYZ(i, v.x * k, v.y * k * 0.7, v.z * k);
      c.setHex(0xd2600a).lerp(new THREE.Color(0xf5a81c), THREE.MathUtils.clamp(0.5 + ruffle * 1.6, 0, 1));
      col.set([c.r, c.g, c.b], i * 3);
    }
    marigoldGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    marigoldGeo.computeVertexNormals();
  }
  const mari = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, name: 'marigold' });
  [[-0.3, 0.15, 0], [0.32, -0.1, 0.6], [0.02, -0.42, 1.3]].forEach(([x, z, r], i) => {
    const f = shadow(new THREE.Mesh(marigoldGeo, mari)), fr = R * 0.2;
    f.scale.setScalar(m(fr)); f.rotation.set(0.2 * (i - 1), r, 0.15); f.name = `${name}:marigold${i}`;
    g.add(put(f, x * R, R * 0.03 + fr * 0.62, z * R));
  });
  return g;
}

const BELL = [[0.31, 0], [0.32, 0.03], [0.26, 0.14], [0.2, 0.32], [0.15, 0.44], [0.055, 0.49], [0.04, 0.8], [0.1, 0.86], [0.08, 0.94], [0, 1]];
const INCENSE_DISH = [[0, 0], [0.09, 0], [0.13, 0.03], [0.12, 0.035], [0.08, 0.012], [0.02, 0.012], [0.02, 0.04], [0, 0.04]]; // fractions of stick length
function incense(name) {
  const L = DC.incenseL, g = group(name, lathe(INCENSE_DISH, L, MAT.brassPatina, `${name}:dish`));
  const tilt = THREE.MathUtils.degToRad(24), stick = group(`${name}:stick`), ash = L * 0.09;
  const seg = (r0, r1, len, y, mat) => stick.add(put(shadow(new THREE.Mesh(new THREE.CylinderGeometry(m(r0), m(r1), m(len), 8), mat)), 0, y, 0));
  seg(0.03, 0.025, L * 0.3, L * 0.15, new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 1, name: 'agarbatti-bamboo' })); // bare bamboo core at the foot
  seg(0.05, 0.045, L * 0.7 - ash, L * 0.3 + (L * 0.7 - ash) / 2, new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 1, name: 'agarbatti' }));
  seg(0.04, 0.048, ash, L - ash / 2, new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 1, name: 'agarbatti-ash' })); // grey ash tip
  seg(0.05, 0.05, 0.07, L - ash - 0.03, new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false, name: 'agarbatti-ember' })); // glowing ring under the ash
  stick.rotation.z = -tilt;
  g.add(put(stick, 0, L * 0.02, 0));
  return g;
}

export function build() {
  const { g: body, shelfTops, innerW, zIn, zFront, shelfFront } = carcass();
  const [main, upper] = shelfTops, deck = D.baseH, half = innerW / 2;
  const decor = group('mandir:decor');

  // MAIN shelf: runner, two framed pictures, murtis, lit diya
  const rw = innerW - 2 * DC.runnerMargin;
  decor.add(put(runner(rw, shelfFront - zIn - 0.3, D.nosingH, 'mandir:runner'), 0, main, shelfFront));
  [['seated', -1], ['standing', 1]].forEach(([kind, s]) => {
    const f = framed(kind, DC.pic, `mandir:picture${s < 0 ? 'L' : 'R'}`);
    decor.add(put(f, s * half * 0.6, main + 0.04, zIn + f.userData.lean + 0.05));
  });
  decor.add(put(murti(DC.murtiH, 'mandir:murti'), 0, main + 0.04, zIn + 3.2));
  for (const s of [-1, 1]) decor.add(put(murti(DC.smallMurtiH, `mandir:murtiSmall${s < 0 ? 'L' : 'R'}`), s * half * 0.3, main + 0.04, zIn + 5.6));
  decor.add(put(diya('mandir:diya'), 0, main + 0.04, shelfFront - 1.7));

  // UPPER shelf: Om picture flanked by lotus tealight holders
  const om = framed('om', DC.omPic, 'mandir:pictureOm');
  decor.add(put(om, 0, upper, zIn + om.userData.lean + 0.05));
  decor.add(put(lotus(0xd977a0, 'mandir:lotusL'), -half * 0.68, upper, zIn + 5), put(lotus(0xf3ece2, 'mandir:lotusR'), half * 0.68, upper, zIn + 5));

  // DECK: pair of kuthu vilakku, puja plate with marigolds, bell, incense
  for (const s of [-1, 1]) decor.add(put(vilakku(`mandir:vilakku${s < 0 ? 'L' : 'R'}`), s * half * 0.66, deck, zIn + 4.2));
  decor.add(put(plate('mandir:plate'), 0, deck, zIn + 5.2));
  decor.add(put(lathe(BELL, DC.bellH, MAT.brassPatina, 'mandir:bell'), half * 0.36, deck, zFront - 2.6));
  decor.add(put(incense('mandir:incense'), -half * 0.4, deck, zFront - 2.4));

  return group('mandir', body, decor);
}
