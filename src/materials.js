// Shared PBR materials. All textures are procedural (canvas) — no external assets.
// Colors sampled from the reference photos (see docs/spec.md "Material schedule").
import * as THREE from 'three';
import { FINISHES } from './dimensions.js';

function canvasTex(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// deterministic PRNG so renders are reproducible for the critics
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function noise(ctx, s, base, amp, seed, grain = 1) {
  const r = rng(seed);
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const n = (r() - 0.5) * amp;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (grain > 1) { ctx.imageSmoothingEnabled = true; ctx.drawImage(ctx.canvas, 0, 0, s / grain, s / grain, 0, 0, s, s); }
}

// Espresso LVP, 6" x 48" planks (FINISHES.lvp). One tile = 96" x 96": 16 rows x 2 planks with a random stagger per row.
// Planks run along canvas Y = texture V = plan-y (E-W, IMG_3933). Colour / roughness (G channel) / bump are drawn in
// lockstep so joints, embossed grain and scuffs register with each other.
function lvpMaps() {
  const S = 2048, rows = L.tile / L.plankW, ph = S / rows, pl = S * L.plankL / L.tile;
  const mk = (size) => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.translate(size, 0); x.rotate(Math.PI / 2); x.scale(size / S, size / S); return x; };
  const col = mk(2048), rough = mk(1024), bump = mk(1024), all = [col, rough, bump];
  bump.fillStyle = '#808080'; bump.fillRect(0, 0, S, S);
  const plank = (x0, y0, seed) => {
    const r = rng(seed), v = 0.95 + r() * 0.1, warm = r() * 5; // +-5%: floor reads as one dark sheet (IMG_3932)
    for (const c of all) { c.save(); c.beginPath(); c.rect(x0, y0, pl, ph); c.clip(); }
    col.fillStyle = `rgb(${(33 + warm * 0.6) * v | 0},${26 * v | 0},${23 * v | 0})`; col.fillRect(x0, y0, pl, ph);
    const g = 72 + r() * 12 | 0; rough.fillStyle = `rgb(${g},${g},${g})`; rough.fillRect(x0, y0, pl, ph); // satin: roughness ~0.28-0.33 -> tight whitish sun glare, diffuse stays espresso (IMG_3933)
    for (let i = 0; i < 4; i++) { col.fillStyle = `rgba(${r() < 0.5 ? '16,11,9' : '92,78,68'},${0.04 + r() * 0.07})`; col.fillRect(x0, y0 + r() * ph, pl, 6 + r() * 30); } // tonal bands
    for (let i = 0; i < 110; i++) { // grain streaks along the plank, every third one embossed
      const gy = y0 + r() * ph, gx = x0 + r() * pl - 100, len = 120 + r() * 520, a = (r() - 0.5) * 7, dark = r() < 0.55;
      const path = (c) => { c.beginPath(); c.moveTo(gx, gy); c.bezierCurveTo(gx + len / 3, gy + a, gx + 2 * len / 3, gy - a, gx + len, gy + a * 0.3); c.stroke(); };
      col.strokeStyle = `rgba(${dark ? '15,10,8' : '94,80,70'},${0.07 + r() * 0.13})`; col.lineWidth = 0.6 + r() * 2.2; path(col);
      if (i % 3 === 0) { bump.strokeStyle = 'rgba(40,40,40,0.35)'; bump.lineWidth = 1.5; path(bump); rough.strokeStyle = 'rgba(190,190,190,0.25)'; rough.lineWidth = 1.5; path(rough); }
    }
    col.fillStyle = 'rgba(8,5,4,0.3)'; col.fillRect(x0, y0, 1, ph); col.fillRect(x0, y0, pl, 1); // butt + long joint: barely visible in IMG_3932/3933
    rough.fillStyle = 'rgb(150,150,150)'; rough.fillRect(x0, y0, 1, ph); rough.fillRect(x0, y0, pl, 1);
    bump.fillStyle = 'rgba(0,0,0,0.3)'; bump.fillRect(x0, y0, 2, ph); bump.fillRect(x0, y0, pl, 2); // micro-bevel groove
    for (const c of all) c.restore();
  };
  const r = rng(7);
  for (let i = 0; i < rows; i++) {
    const off = (0.15 + r() * 0.7) * pl;
    plank(off, i * ph, 100 + i * 2); // plank A
    plank(off - pl, i * ph, 101 + i * 2); plank(off + pl, i * ph, 101 + i * 2); // plank B wraps around the tile edge
  }
  for (let i = 0; i < 700; i++) { // fine traffic scuffs: only visible in the glare (IMG_3933)
    const x = r() * S, y = r() * S, a = r() * Math.PI, len = 30 + r() * 220;
    rough.strokeStyle = `rgba(${r() < 0.7 ? '235,235,235' : '70,70,70'},${0.12 + r() * 0.25})`; rough.lineWidth = 0.8 + r();
    rough.beginPath(); rough.moveTo(x, y); rough.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); rough.stroke();
  }
  return all.map((c, i) => {
    const t = new THREE.CanvasTexture(c.canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
    if (i === 0) t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.setScalar(1 / (L.tile * 0.0254)); // UVs are in metres
    return t;
  });
}

/** Draw fn(x, y) at every wrapped copy so blobs crossing the canvas edge tile seamlessly. */
function wrapped(s, x, y, rad, fn) {
  for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) if (x + dx > -rad && x + dx < s + rad && y + dy > -rad && y + dy < s + rad) fn(x + dx, y + dy);
}
const blob = (ctx, x, y, rad, rgb, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); };

// Light orange-peel drywall texture (height map): overlapping soft splatter blobs ~0.3"-0.9" across (visible at room distance in the IMG_3935 sun patch).
function orangePeelMap() {
  return canvasTex(1024, (ctx, s) => {
    const r = rng(5), px = s / FINISHES.wallTextureTile; // px per inch
    ctx.fillStyle = '#707070'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) { const rad = (0.15 + r() * 0.3) * px, a = 0.25 + r() * 0.45; wrapped(s, r() * s, r() * s, rad, (x, y) => blob(ctx, x, y, rad, '255,255,255', a)); }
  }, { srgb: false });
}

// Knock-down drywall texture (height map): flattened splatter islands ~1/4"-3/4" across with flat tops (IMG_3945/3940/3946).
function knockdownMap() {
  return canvasTex(1024, (ctx, s) => {
    const r = rng(15), px = s / FINISHES.wallTextureTile;
    ctx.fillStyle = '#585858'; ctx.fillRect(0, 0, s, s);
    ctx.filter = 'blur(2px)'; ctx.fillStyle = '#9c9c9c';
    for (let i = 0; i < 1500; i++) { // each island = 3 overlapping lobes -> irregular outline
      const cx = r() * s, cy = r() * s, R = (0.12 + r() * 0.26) * px;
      for (let k = 0; k < 3; k++) { const ox = (r() - 0.5) * R * 1.4, oy = (r() - 0.5) * R * 1.4, rx = R * (0.5 + r() * 0.6), ry = R * (0.4 + r() * 0.5), rot = r() * 3;
        wrapped(s, cx + ox, cy + oy, R * 2, (x, y) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); ctx.fill(); }); }
    }
    ctx.filter = 'none';
  }, { srgb: false });
}

// Greige cut-pile carpet: per-fibre noise + soft light/dark mottling from foot traffic and vacuuming (IMG_3935).
function carpetMaps() {
  const mottled = (base, amp, seed, n, alpha, tuft) => (ctx, s) => {
    noise(ctx, s, base, amp, seed);
    const r = rng(seed + 1);
    for (let i = 0; i < 6000; i++) { const rad = 5 + r() * 7, lite = r() < 0.5; wrapped(s, r() * s, r() * s, rad, (x, y) => blob(ctx, x, y, rad, lite ? tuft[0] : tuft[1], 0.16 + r() * 0.3)); } // chunky yarn tufts ~3/8" so the pile still reads from across the room
    if (n) for (let k = 0, bw = s / 3; k < 2; k++) { ctx.fillStyle = `rgba(${k ? '255,245,232' : '0,0,0'},0.08)`; ctx.fillRect(k * bw, 0, bw, s); } // 12" vacuum tracks along plan-y: dark / light nap / untouched base (IMG_3939)
    for (let i = 0; i < n; i++) { const rad = 25 + r() * 110, lite = r() < 0.5, a = alpha * (0.5 + r()); wrapped(s, r() * s, r() * s, rad, (x, y) => blob(ctx, x, y, rad, lite ? '215,200,184' : '70,60,52', a)); }
  };
  return [canvasTex(1024, mottled([104, 92, 82], 60, 3, 220, 0.05, ['196,180,164', '62,52,44'])), canvasTex(1024, mottled([128, 128, 128], 160, 4, 0, 0, ['255,255,255', '0,0,0']), { srgb: false })];
}

// Wall-plate faces at 64 px/in (white thermoplastic). kind: outlet | gfci | rocker | rocker2 | coax. Sizes: FINISHES.plate.
function plateMat(kind) {
  const P = 64, F = FINISHES.plate, wIn = kind === 'rocker2' ? F.w2 : F.w, W = Math.round(wIn * P), H = Math.round(F.h * P);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), cy = H / 2, I = (v) => v * P;
  const rr = (cx, y0, w, h, rad) => { x.beginPath(); x.roundRect(cx - I(w) / 2, y0 - I(h) / 2, I(w), I(h), I(rad)); };
  const dot = (cx, y0, rad, fill) => { x.beginPath(); x.arc(cx, y0, I(rad), 0, 7); x.fillStyle = fill; x.fill(); };
  const screw = (cx, y0) => { dot(cx, y0, 0.095, '#dcdad3'); x.strokeStyle = '#8f8d86'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, y0, I(0.095), 0, 7); x.stroke(); x.beginPath(); x.moveTo(cx - I(0.07), y0 + 1); x.lineTo(cx + I(0.07), y0 - 1); x.stroke(); };
  const slots = (cx, y0) => { x.fillStyle = '#2f2e2b'; x.fillRect(cx - I(0.29), y0 - I(0.2), I(0.075), I(0.37)); x.fillRect(cx + I(0.215), y0 - I(0.16), I(0.075), I(0.29)); x.beginPath(); x.arc(cx, y0 + I(0.3), I(0.09), Math.PI, 0); x.rect(cx - I(0.09), y0 + I(0.3), I(0.18), I(0.07)); x.fill(); };
  const line = () => { x.strokeStyle = '#aeaca4'; x.lineWidth = 2; x.stroke(); };
  x.fillStyle = '#f1efe9'; x.fillRect(0, 0, W, H);
  const decora = (cx) => { rr(cx, cy, 1.31, 2.63, 0.06); x.fillStyle = '#ebe9e2'; x.fill(); line(); screw(cx, cy - I(1.19)); screw(cx, cy + I(1.19)); };
  if (kind === 'outlet') {
    for (const s of [-1, 1]) { rr(W / 2, cy + s * I(0.77), 1.34, 1.12, 0.45); x.fillStyle = '#e9e7e0'; x.fill(); line(); slots(W / 2, cy + s * I(0.77) - I(0.05)); }
    screw(W / 2, cy);
  } else if (kind === 'gfci') {
    decora(W / 2); slots(W / 2, cy - I(0.85)); slots(W / 2, cy + I(0.8));
    x.fillStyle = '#3a3a3a'; x.fillRect(W / 2 - I(0.2), cy - I(0.27), I(0.4), I(0.2)); x.fillStyle = '#b4392d'; x.fillRect(W / 2 - I(0.2), cy + I(0.02), I(0.4), I(0.2)); dot(W / 2 + I(0.45), cy - I(0.05), 0.04, '#4fae55');
  } else if (kind === 'coax') {
    dot(W / 2, cy, 0.22, '#9d9c98'); dot(W / 2, cy, 0.15, '#c9c8c3'); dot(W / 2, cy, 0.035, '#5b5a57'); screw(W / 2, cy - I(1.64)); screw(W / 2, cy + I(1.64));
  } else {
    for (const cx of kind === 'rocker2' ? [W / 2 - I(0.906), W / 2 + I(0.906)] : [W / 2]) {
      decora(cx); rr(cx, cy, 1.18, 2.5, 0.05);
      const g = x.createLinearGradient(0, cy - I(1.25), 0, cy + I(1.25)); g.addColorStop(0, '#f6f4ee'); g.addColorStop(0.5, '#efede6'); g.addColorStop(0.51, '#e2e0d8'); g.addColorStop(1, '#f0eee8'); x.fillStyle = g; x.fill(); line();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // the plate is an extruded rounded rectangle whose cap UVs are its XY coords in metres, centred -> map them to 0..1
  t.repeat.set(1 / (wIn * 0.0254), 1 / (F.h * 0.0254)); t.offset.set(0.5, 0.5);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.42, name: "plate-" + kind });
}

// Cherry-finish laminate (Sauder "select cherry"): deep low-saturation brown, broad soft cathedral/flame figure + sparse fine
// pores, grain along U. Tile = 1.25 m x 0.4 m. relief=true draws the same figure in greys for the bump/roughness map.
function cherryMap(relief = false) {
  const t = canvasTex(1024, (ctx, s) => {
    const r = rng(23);
    ctx.fillStyle = relief ? '#808080' : '#43201a'; ctx.fillRect(0, 0, s, s);
    const wavy = (y, amp, k, ph) => { ctx.beginPath(); for (let x = 0; x <= s; x += 16) ctx.lineTo(x, y + amp * Math.sin((x / s) * Math.PI * 2 * k + ph)); ctx.stroke(); }; // integer k -> wraps in U
    ctx.filter = 'blur(7px)';
    for (let i = 0; i < 9; i++) { // wide soft figure bands, each drawn 3x so it wraps in V
      const dark = r() < 0.45, y = r() * s, amp = 6 + r() * 16, k = 1 + Math.floor(r() * 2), ph = r() * 7;
      ctx.strokeStyle = relief ? `rgba(${dark ? '60,60,60' : '170,170,170'},0.25)` : `rgba(${dark ? '38,15,9' : '110,55,32'},${0.1 + r() * 0.12})`;
      ctx.lineWidth = 20 + r() * 60;
      for (const o of [-s, 0, s]) wavy(y + o, amp, k, ph);
    }
    ctx.filter = 'none';
    for (let i = 0; i < 250; i++) { // fine pores / growth lines
      const dark = r() < 0.55;
      ctx.strokeStyle = relief ? `rgba(${dark ? '20,20,20' : '200,200,200'},${0.1 + r() * 0.2})` : `rgba(${dark ? '34,12,6' : '110,55,32'},${0.04 + r() * 0.08})`;
      ctx.lineWidth = 0.6 + r() * 1.6;
      wavy(r() * s, 2 + r() * 6, 1 + Math.floor(r() * 2), r() * 7);
    }
  }, { srgb: !relief });
  t.repeat.set(0.8, 2.5);
  return t;
}

const L = FINISHES.lvp;
const tex = {
  orangePeel: orangePeelMap(),
  stucco: canvasTex(512, (c, s) => noise(c, s, [128, 128, 128], 230, 6, 8), { srgb: false }),
  quartz: canvasTex(512, (ctx, s) => {
    noise(ctx, s, [141, 140, 137], 12, 8);
    const r = rng(9);
    for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(${r() < 0.85 ? '196,193,186' : '92,90,87'},${0.2 + r() * 0.35})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 0.8 + r() * 1.6, 0.7 + r() * 1.2, r() * 3, 0, 7); ctx.fill(); } // kitchen item: finer, lower-contrast speckle per IMG_3949
  }),
  brushed: canvasTex(256, (ctx, s) => { const r = rng(11); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.06)`; ctx.fillRect(r() * s, 0, 1, s); } }, { srgb: false }),
};
// Texture world sizes: set repeat per metre so UV-scaled geometry (see lib/build.js uvBox) tiles physically.
[tex.lvp, tex.lvpRough, tex.lvpBump] = lvpMaps();
[tex.carpet, tex.carpetBump] = carpetMaps();
tex.carpet.repeat.setScalar(1 / (FINISHES.carpetTile * 0.0254)); tex.carpetBump.repeat.setScalar(2.5); // bump is shared with upholstery fabrics
tex.knockdown = knockdownMap(); tex.knockdown.repeat.copy(tex.orangePeel.repeat.setScalar(1 / (FINISHES.wallTextureTile * 0.0254))); tex.stucco.repeat.set(2, 2); tex.quartz.repeat.set(1.2, 1.2);

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

export const MAT = {
  // architecture
  wall: std({ color: 0xc2beb4, roughness: 0.9, bumpMap: tex.orangePeel, bumpScale: 1.2, name: 'wall-greige' }), // eggshell greige, IMG_3933/3935
  wallAccent: std({ color: 0x77746d, roughness: 0.9, bumpMap: tex.orangePeel, bumpScale: 1.2, name: 'wall-accent-gray' }),
  ceiling: std({ color: 0xe2ddd0, roughness: 0.97, bumpMap: tex.orangePeel, bumpScale: 0.6, name: 'ceiling' }), // fine spray texture; photos read almost smooth (IMG_3932/3935)
  trim: std({ color: 0xf4f2ec, roughness: 0.45, name: 'trim-white-semigloss' }),
  door: std({ color: 0xefede8, roughness: 0.4, name: 'door-white' }),
  entryDoor: std({ color: 0x8b877f, roughness: 0.5, name: 'entry-door-gray' }),
  lvp: std({ map: tex.lvp, roughnessMap: tex.lvpRough, roughness: 1, bumpMap: tex.lvpBump, bumpScale: 0.15, metalness: 0, envMapIntensity: 0.7, name: 'lvp-espresso' }), // satin: roughness lives in the map (~0.3); sheen comes from the sun specular, not the sky env
  carpet: phys({ map: tex.carpet, bumpMap: tex.carpetBump, bumpScale: 3, roughness: 1, sheen: 0.25, sheenRoughness: 0.85, sheenColor: 0x6e6257, name: 'carpet-greige' }), // sheen = fuzzy cut-pile rim light
  deckFloor: std({ color: 0x6d7379, roughness: 0.5, name: 'deck-gray-paint' }),
  deckRail: std({ color: 0x4d555b, roughness: 0.7, name: 'deck-rail-charcoal' }),
  stuccoExt: std({ color: 0xcfc9b8, roughness: 1, bumpMap: tex.stucco, bumpScale: 1.1, name: 'stucco-exterior' }),
  // kitchen / bath
  cabinet: std({ color: 0xf1f0ec, roughness: 0.55, name: 'cabinet-white-thermofoil' }),
  toeKick: std({ color: 0xd8d6d0, roughness: 0.7, name: 'toe-kick' }),
  quartz: std({ map: tex.quartz, color: 0xe4e4e2, roughness: 0.42, name: 'quartz-gray' }),
  stainless: std({ color: 0xb9bcbf, metalness: 1, roughness: 0.32, roughnessMap: tex.brushed, name: 'stainless-brushed' }),
  nickel: std({ color: 0xc4c2bd, metalness: 1, roughness: 0.38, name: 'brushed-nickel' }),
  chrome: std({ color: 0xffffff, metalness: 1, roughness: 0.06, name: 'chrome' }),
  blackGlass: phys({ color: 0x0a0a0c, roughness: 0.08, metalness: 0, clearcoat: 1, name: 'black-glass' }),
  blackPlastic: std({ color: 0x151515, roughness: 0.55, name: 'black-plastic' }),
  whitePlastic: std({ color: 0xf2f1ee, roughness: 0.5, name: 'white-plastic' }),
  porcelain: phys({ color: 0xfbfaf6, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.6, name: 'porcelain' }),
  fiberglass: phys({ color: 0xfbfaf5, roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 1.6, name: 'tub-fiberglass' }), // warm-white gelcoat
  mirror: std({ color: 0xffffff, metalness: 1, roughness: 0.02, name: 'mirror' }),
  glass: phys({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.01, ior: 1.5, transparent: true, opacity: 0.25, name: 'glass' }),
  vinylFrame: std({ color: 0xf2f1ec, roughness: 0.5, name: 'vinyl-frame-white' }),
  blinds: std({ color: 0xe9e6dd, roughness: 0.8, side: THREE.DoubleSide, name: 'blinds' }),
  frosted: phys({ color: 0xffffff, roughness: 0.6, transmission: 0.5, emissive: 0xfff1d6, emissiveIntensity: 1.2, name: 'fixture-frosted-lit' }),
  // furniture
  walnut: std({ color: 0x5a3a26, roughness: 0.5, name: 'walnut' }),
  rusticWood: std({ color: 0x6b4226, roughness: 0.55, name: 'rustic-brown-wood' }),
  cherry: std({ color: 0x4a1f17, roughness: 0.45, name: 'cherry-bookcase' }),
  blackMetal: std({ color: 0x141414, metalness: 0.6, roughness: 0.5, name: 'black-powdercoat' }),
  blackLaminate: std({ color: 0x1b1b1c, roughness: 0.6, name: 'black-laminate' }),
  fabricCharcoal: std({ color: 0x3b3e44, roughness: 1, bumpMap: tex.carpetBump, bumpScale: 0.3, name: 'futon-charcoal-linen' }),
  fabricGray: std({ color: 0x9a9a98, roughness: 1, name: 'chair-gray-fabric' }),
  meshGray: std({ color: 0x8e8e8c, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide, name: 'chair-mesh' }),
  marble: std({ color: 0xe9e7e3, roughness: 0.15, name: 'faux-marble' }),
  mattress: std({ color: 0xf3f1ea, roughness: 0.95, name: 'mattress-white' }),
  brass: std({ color: 0xc9a24a, metalness: 1, roughness: 0.3, name: 'brass' }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffc46b, name: 'flame' }),
  // kitchen item
  cabinetDoor: std({ color: 0xeff0ef, roughness: 0.5, bumpMap: canvasTex(256, (ctx, s) => { const r = rng(21); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.10)`; ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 40 + r() * 120); } }, { repeat: [6, 3], srgb: false }), bumpScale: 0.4, name: 'cabinet-door-linear-thermofoil' }),
  cabinetGap: std({ color: 0x1c1b1a, roughness: 1, name: 'cabinet-reveal-shadow' }),
  applianceCase: std({ color: 0x2b2c2e, roughness: 0.6, metalness: 0.3, name: 'appliance-case-charcoal' }),
  burner: std({ color: 0x34343a, roughness: 0.3, name: 'cooktop-burner-print' }),
  applianceSteel: std({ color: 0xb6b8ba, metalness: 0.85, roughness: 0.5, roughnessMap: tex.brushed, envMapIntensity: 1.5, name: 'appliance-stainless' }), // IBL is dim (0.35) so boost reflections to read as bright steel
  sinkSteel: std({ color: 0xd4d6d8, metalness: 0.9, roughness: 0.4, roughnessMap: tex.brushed, envMapIntensity: 4, name: 'sink-stainless-brushed' }),
  // mandir: cherry with grain along U (mandir.js maps U along each board's length), darkened antique brass, silk runner base
  cherryGrain: (() => { const relief = cherryMap(true); return std({ map: cherryMap(), roughness: 0.62, roughnessMap: relief, bumpMap: relief, bumpScale: 0.35, envMapIntensity: 0.8, name: 'cherry-grain' }); })(), // roughnessMap G ~0.5 -> effective ~0.55-0.6 with pores rougher
  antiqueBrass: std({ color: 0x77582a, metalness: 1, roughness: 0.52, name: 'antique-brass' }), // mandir.js clones it with a crevice roughness map for the pulls
  // hand-polished puja brass: blotchy roughness + faint tarnish so highlights break up (UVs 0..1 on lathed articles)
  brassPatina: std({ color: 0xc9a24a, metalness: 1, roughness: 1, name: 'brass-patina',
    roughnessMap: canvasTex(256, (ctx, s) => { noise(ctx, s, [70, 70, 70], 50, 41); const r = rng(42); for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '150,150,150' : '40,40,40'},${0.1 + r() * 0.2})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 6 + r() * 40, 4 + r() * 18, r() * 3, 0, 7); ctx.fill(); } }, { repeat: [2, 2], srgb: false }),
    map: canvasTex(256, (ctx, s) => { const r = rng(43); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 50; i++) { ctx.fillStyle = `rgba(${r() < 0.6 ? '150,110,70' : '255,235,190'},${0.08 + r() * 0.16})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 8 + r() * 45, 5 + r() * 20, r() * 3, 0, 7); ctx.fill(); } }, { repeat: [2, 2] }) }),
  // closets / laundry: natural pine rod (grain along U, tile 0.5 m), appliance enamel, flex foil duct (4 ribs per tile along U; closets.js sets repeat so a tile = 3\"), rubber hose
  pine: std({ map: canvasTex(512, (ctx, s) => { // strong cathedral grain + latewood streaks along U, one knot per tile. ponytail: one shared tile (half a rod long) so knots squash on the short rods; per-rod textures if that ever shows
    const r = rng(31); ctx.fillStyle = '#d9ad7c'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) { const late = r() < 0.6; ctx.strokeStyle = `rgba(${late ? '122,72,34' : '240,208,166'},${late ? 0.18 + r() * 0.42 : 0.1 + r() * 0.25})`; ctx.lineWidth = 0.6 + r() * (late ? 3.2 : 2); const y = r() * s, a = (r() - 0.5) * 30; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(s / 3, y + a, (2 * s) / 3, y - a, s, y); ctx.stroke(); }
    for (const [cx, cy] of [[s * 0.3, s * 0.35], [s * 0.75, s * 0.8]]) for (let k = 1; k <= 6; k++) { ctx.strokeStyle = `rgba(112,64,30,${0.5 - k * 0.05})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, k * 34, k * 9, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); } // cathedral arches
    const kx = s * 0.93, ky = s * 0.55; for (let k = 5; k >= 1; k--) { ctx.fillStyle = k === 1 ? '#4a2812' : `rgba(110,60,26,${0.22 + (5 - k) * 0.1})`; ctx.beginPath(); ctx.ellipse(kx, ky, k * 1.8, k * 11, 0, 0, 7); ctx.fill(); }
  }, { repeat: [2, 1] }), roughness: 0.55, name: 'pine-natural' }),
  applianceWhite: phys({ color: 0xf3f3f1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, name: 'appliance-white-enamel' }),
  foilDuct: std({ color: 0xc9cbce, metalness: 1, roughness: 0.34, bumpMap: canvasTex(64, (ctx, s) => { for (let x = 0; x < s; x++) { const v = 128 + 120 * Math.sin((x / s) * Math.PI * 2 * 4); ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; ctx.fillRect(x, 0, 1, s); } }, { srgb: false }), bumpScale: 3, name: 'flex-foil-duct' }),
  rubberHose: std({ color: 0x2a2b2d, roughness: 0.7, name: 'rubber-hose' }),
  panelGray: std({ color: 0xe4e3de, roughness: 0.5, metalness: 0.1, name: 'load-centre-painted-steel' }),
  // lighting: opal/frosted diffuser of a switched-on LED fixture (no transmission -> no extra render pass); lighting.js clones it per brightness
  lensLit: std({ color: 0xfff6e6, roughness: 0.55, emissive: 0xffdcae, emissiveIntensity: 2.2, name: 'fixture-lens-lit' }),
  // deck item (textured scenery materials — grass, bark, foliage, sky — are built in rooms/deck.js next to their painters)
  stuccoSoffit: std({ color: 0xded7c6, roughness: 1, bumpMap: tex.stucco, bumpScale: 4, name: 'stucco-soffit-heavy' }),
  partitionWhite: std({ color: 0xe6e4dc, roughness: 0.6, name: 'partition-white-paint' }),
  hvacIvory: std({ color: 0xe4e1d6, roughness: 0.45, metalness: 0.1, name: 'daikin-ivory' }),
  lineset: std({ color: 0xdedcd4, roughness: 0.6, name: 'lineset-white-vinyl' }),
  railTan: std({ color: 0xa89a82, roughness: 0.8, name: 'neighbour-rail-tan' }),
  roofEave: std({ color: 0x8c8980, roughness: 0.9, name: 'roof-eave' }),
  // openings item: cheap window glass (no transmission pass; never casts shadows), insect screen, corridor-side door paint
  glassPane: phys({ color: 0xdfe8e6, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.06, depthWrite: false, envMapIntensity: 1.5, specularIntensity: 1, side: THREE.DoubleSide, name: 'window-glass' }),
  insectScreen: std({ color: 0x232527, roughness: 1, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, name: 'insect-screen' }),
  corridorTrim: std({ color: 0x8f8a80, roughness: 0.5, name: 'corridor-door-frame-taupe' }),
  mirrorEdge: std({ color: 0x9fb0a8, roughness: 0.15, metalness: 0.3, name: 'mirror-glass-edge' }), // bathroom: polished edge of the frameless mirror
  // finishes: wall plates (face art baked per kind), LVP->carpet reducer, mini-split shadow lines
  plateOutlet: plateMat('outlet'), plateGfci: plateMat('gfci'), plateRocker: plateMat('rocker'), plateRocker2: plateMat('rocker2'), plateCoax: plateMat('coax'),
  transition: std({ color: 0x2a1d18, roughness: 0.5, name: 'transition-vinyl-espresso' }),
  hvacShadow: std({ color: 0x6f6d68, roughness: 0.8, name: 'minisplit-shadow-gap' }),
  // futon: mirror-chrome legs sit in the sofa's shadow with a dim IBL -> boosted reflections + faint baked bright/dark banding so they still read as chrome
  futonChrome: std({ color: 0xe8ecef, metalness: 1, roughness: 0.15, envMapIntensity: 2.2, emissive: 0xffffff, emissiveIntensity: 0.22,
    emissiveMap: canvasTex(128, (ctx, s) => { const g = ctx.createLinearGradient(0, 0, s, 0); [[0, 0.1], [0.12, 0.9], [0.2, 0.15], [0.42, 0.05], [0.55, 0.7], [0.62, 1], [0.7, 0.2], [0.9, 0.02], [1, 0.1]].forEach(([t, v]) => g.addColorStop(t, `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`)); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); }), name: 'futon-chrome' }),
  // closets (fix round 1): opaque enamelled-steel wire bracket, lifted shelf white (closet interiors get almost no bounce light), knob chrome that stays bright
  // in the dim IBL, smoky dryer / dark washer door glass, drum interiors (self-lit a little: the cavity is fully shadowed)
  whiteEnamel: std({ color: 0xf4f3ef, roughness: 0.35, metalness: 0, name: 'white-enamel-steel' }),
  closetShelf: std({ color: 0xeeece6, roughness: 0.45, emissive: 0xeeece6, emissiveIntensity: 0.1, name: 'closet-shelf-white-semigloss' }),
  knobChrome: std({ color: 0xf2f3f4, metalness: 0.75, roughness: 0.22, envMapIntensity: 2.5, name: 'knob-chrome' }),
  dryerGlass: phys({ color: 0x15181b, roughness: 0.08, transparent: true, opacity: 0.5, depthWrite: false, name: 'dryer-door-glass-smoke' }),
  washerGlass: phys({ color: 0x0a0a0c, roughness: 0.08, transparent: true, opacity: 0.8, depthWrite: false, name: 'washer-door-glass-dark' }),
  drumSteel: std({ color: 0x4a4d50, metalness: 0.7, roughness: 0.4, emissive: 0x8a8d90, emissiveIntensity: 0.4, side: THREE.DoubleSide, name: 'drum-stainless' }),
  // kitchen item (fix round 1)
  kitchenPull: std({ color: 0xcfd0d2, metalness: 1, roughness: 0.35, envMapIntensity: 1.5, name: 'kitchen-pull-brushed-nickel' }),
  cooktopGlass: phys({ color: 0x0a0a0a, roughness: 0.06, metalness: 0, clearcoat: 0.3, specularIntensity: 0.4, envMapIntensity: 0.3, name: 'cooktop-black-ceramic' }), // low env: RoomEnvironment's light panels washed the top out gray
  ovenGlass: phys({ color: 0x121314, roughness: 0.1, metalness: 0, clearcoat: 1, envMapIntensity: 0.6, name: 'oven-door-glass' }),
  kitchenChrome: std({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 2.5, name: 'kitchen-faucet-chrome' }), // MAT.chrome reads satin gray under the dim IBL
  cabinetRevealFill: std({ color: 0x7d7b77, roughness: 1, name: 'cabinet-reveal-soft-shadow' }), // mid-gray: a near-black 0.15" line aliases into dashes at room distance (no MSAA behind the composer)
  burnerLine: std({ color: 0x555555, roughness: 0.4, name: 'cooktop-burner-line' }),
  // shell (fix round 1): heavier knock-down texture for hall/bath/kitchen walls + kitchen/hall ceilings, flat poche for cut wall tops in plan/dollhouse
  wallKnockdown: std({ color: 0xc2beb4, roughness: 0.92, bumpMap: tex.knockdown, bumpScale: 0.7, name: 'wall-greige-knockdown' }),
  ceilingKnockdown: std({ color: 0xe2ddd0, roughness: 0.97, bumpMap: tex.knockdown, bumpScale: 0.8, name: 'ceiling-knockdown' }),
  hvacCream: std({ color: 0xddd6c0, roughness: 0.5, name: 'minisplit-cream' }), // finishes: aged ivory Daikin head, IMG_3939
  poche: new THREE.MeshBasicMaterial({ color: 0x2b2b2b, name: 'wall-cut-poche' }),
  // bathroom (fix round 1): the bath is lit by one dim dome, so plain chrome reads black — brighter reflections; satin bar pulls / towel hardware
  bathChrome: std({ color: 0xffffff, metalness: 1, roughness: 0.12, envMapIntensity: 3, name: 'bath-chrome' }),
  bathSatin: std({ color: 0xd8d6d0, metalness: 1, roughness: 0.3, envMapIntensity: 2.2, name: 'bath-satin-nickel' }),
};
export const TEX = tex;
