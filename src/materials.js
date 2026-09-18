// Shared PBR materials. All textures are procedural (canvas) — no external assets.
// Colors sampled from the reference photos (see docs/spec.md "Material schedule").
import * as THREE from 'three';

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

// Dark espresso LVP planks, ~6" x 48". Texture tile = 48" x 48" (8 plank rows, staggered).
function lvpMap(kind) {
  return canvasTex(1024, (ctx, s) => {
    const r = rng(7);
    const rows = 8, ph = s / rows;
    for (let i = 0; i < rows; i++) {
      const off = r() * s;
      for (let k = -1; k < 2; k++) {
        const x0 = off + k * s;
        const v = 0.93 + r() * 0.14;
        if (kind === 'color') {
          ctx.fillStyle = `rgb(${52 * v | 0},${38 * v | 0},${32 * v | 0})`;
          ctx.fillRect(x0, i * ph, s, ph);
          for (let g = 0; g < 60; g++) { // grain streaks
            ctx.strokeStyle = `rgba(${r() < 0.5 ? '20,12,10' : '95,72,60'},${0.08 + r() * 0.12})`;
            ctx.lineWidth = 0.5 + r() * 1.5;
            const gy = i * ph + r() * ph; const gx = x0 + r() * s;
            ctx.beginPath(); ctx.moveTo(gx, gy); ctx.bezierCurveTo(gx + 60, gy + (r() - 0.5) * 6, gx + 120, gy + (r() - 0.5) * 6, gx + 160 + r() * 200, gy + (r() - 0.5) * 4); ctx.stroke();
          }
          ctx.fillStyle = 'rgba(8,5,4,0.9)'; ctx.fillRect(x0, i * ph, 2, ph); // butt joint
        } else {
          ctx.fillStyle = `rgb(${120 + r() * 50 | 0},0,0)`; ctx.fillRect(x0, i * ph, s, ph);
        }
      }
      ctx.fillStyle = kind === 'color' ? 'rgba(8,5,4,0.9)' : 'rgb(230,0,0)';
      ctx.fillRect(0, i * ph, s, 2); // long joint
    }
  }, { srgb: kind === 'color' });
}

const tex = {
  lvp: lvpMap('color'), lvpRough: lvpMap('rough'),
  carpet: canvasTex(512, (c, s) => noise(c, s, [150, 136, 122], 70, 3)),
  carpetBump: canvasTex(512, (c, s) => noise(c, s, [128, 128, 128], 200, 4), { srgb: false }),
  orangePeel: canvasTex(512, (c, s) => noise(c, s, [128, 128, 128], 90, 5, 4), { srgb: false }),
  stucco: canvasTex(512, (c, s) => noise(c, s, [128, 128, 128], 230, 6, 8), { srgb: false }),
  quartz: canvasTex(512, (ctx, s) => {
    noise(ctx, s, [128, 126, 122], 14, 8);
    const r = rng(9);
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(${r() < 0.7 ? '190,188,182' : '90,88,86'},${0.35 + r() * 0.4})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 1 + r() * 3.5, 1 + r() * 2.5, r() * 3, 0, 7); ctx.fill(); }
  }),
  brushed: canvasTex(256, (ctx, s) => { const r = rng(11); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.06)`; ctx.fillRect(r() * s, 0, 1, s); } }, { srgb: false }),
};
// Texture world sizes: set repeat per metre so UV-scaled geometry (see lib/build.js uvBox) tiles physically.
tex.lvp.repeat.set(1 / 1.2192, 1 / 1.2192); tex.lvpRough.repeat.copy(tex.lvp.repeat); // 48" tile
tex.carpet.repeat.set(2.5, 2.5); tex.carpetBump.repeat.set(2.5, 2.5);
tex.orangePeel.repeat.set(1.6, 1.6); tex.stucco.repeat.set(2, 2); tex.quartz.repeat.set(1.2, 1.2);

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

export const MAT = {
  // architecture
  wall: std({ color: 0xb8b1a3, roughness: 0.92, bumpMap: tex.orangePeel, bumpScale: 0.6, name: 'wall-greige' }),
  wallAccent: std({ color: 0x8d8c88, roughness: 0.92, bumpMap: tex.orangePeel, bumpScale: 0.6, name: 'wall-accent-gray' }),
  ceiling: std({ color: 0xd9d5cb, roughness: 0.97, bumpMap: tex.stucco, bumpScale: 0.8, name: 'ceiling' }),
  trim: std({ color: 0xeeece6, roughness: 0.45, name: 'trim-white-semigloss' }),
  door: std({ color: 0xefede8, roughness: 0.4, name: 'door-white' }),
  entryDoor: std({ color: 0x8b877f, roughness: 0.5, name: 'entry-door-gray' }),
  lvp: std({ map: tex.lvp, roughnessMap: tex.lvpRough, roughness: 0.62, metalness: 0, name: 'lvp-espresso' }),
  carpet: std({ map: tex.carpet, bumpMap: tex.carpetBump, bumpScale: 1.2, roughness: 1, name: 'carpet-greige' }),
  deckFloor: std({ color: 0x6f7377, roughness: 0.7, name: 'deck-gray-paint' }),
  deckRail: std({ color: 0x3a3d3e, roughness: 0.75, name: 'deck-rail-charcoal' }),
  stuccoExt: std({ color: 0xcfc9b8, roughness: 1, bumpMap: tex.stucco, bumpScale: 2.5, name: 'stucco-exterior' }),
  // kitchen / bath
  cabinet: std({ color: 0xf1f0ec, roughness: 0.55, name: 'cabinet-white-thermofoil' }),
  toeKick: std({ color: 0xd8d6d0, roughness: 0.7, name: 'toe-kick' }),
  quartz: std({ map: tex.quartz, roughness: 0.28, name: 'quartz-gray' }),
  stainless: std({ color: 0xb9bcbf, metalness: 1, roughness: 0.32, roughnessMap: tex.brushed, name: 'stainless-brushed' }),
  nickel: std({ color: 0xc4c2bd, metalness: 1, roughness: 0.38, name: 'brushed-nickel' }),
  chrome: std({ color: 0xffffff, metalness: 1, roughness: 0.06, name: 'chrome' }),
  blackGlass: phys({ color: 0x0a0a0c, roughness: 0.08, metalness: 0, clearcoat: 1, name: 'black-glass' }),
  blackPlastic: std({ color: 0x151515, roughness: 0.55, name: 'black-plastic' }),
  whitePlastic: std({ color: 0xf2f1ee, roughness: 0.5, name: 'white-plastic' }),
  porcelain: phys({ color: 0xf6f5f1, roughness: 0.12, clearcoat: 0.6, name: 'porcelain' }),
  fiberglass: phys({ color: 0xf4f3ee, roughness: 0.22, clearcoat: 0.4, name: 'tub-fiberglass' }),
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
};
export const TEX = tex;
