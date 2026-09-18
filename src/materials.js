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
          { const q = 120 + r() * 50 | 0; ctx.fillStyle = `rgb(${q},${q},${q})`; ctx.fillRect(x0, i * ph, s, ph); } // grey: three.js reads roughness from G
        }
      }
      ctx.fillStyle = kind === 'color' ? 'rgba(8,5,4,0.9)' : 'rgb(230,230,230)';
      ctx.fillRect(0, i * ph, s, 2); // long joint
    }
  }, { srgb: kind === 'color' });
}

// Cherry-finish laminate/veneer: warm red-brown with fine darker grain streaks running along U. Tile = 1 m x 0.25 m.
function cherryMap() {
  const t = canvasTex(1024, (ctx, s) => {
    const r = rng(23);
    ctx.fillStyle = '#47201a'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { // broad tonal bands
      ctx.fillStyle = `rgba(${r() < 0.5 ? '30,10,6' : '100,50,32'},${0.04 + r() * 0.06})`;
      ctx.fillRect(0, r() * s, s, 8 + r() * 60);
    }
    for (let i = 0; i < 700; i++) { // fine grain, wraps in U
      ctx.strokeStyle = `rgba(${r() < 0.65 ? '24,8,4' : '120,64,42'},${0.05 + r() * 0.12})`;
      ctx.lineWidth = 0.5 + r() * 1.3;
      const y = r() * s, a = (r() - 0.5) * 10;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(s / 3, y + a, (2 * s) / 3, y - a, s, y); ctx.stroke();
    }
  });
  t.repeat.set(1, 4);
  return t;
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
    for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(${r() < 0.7 ? '176,174,168' : '96,94,92'},${0.18 + r() * 0.3})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 0.8 + r() * 2.6, 0.8 + r() * 1.8, r() * 3, 0, 7); ctx.fill(); } // kitchen item: finer, lower-contrast speckle per IMG_3949
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
  ceiling: std({ color: 0xd9d5cb, roughness: 0.97, bumpMap: tex.stucco, bumpScale: 0.22, name: 'ceiling' }), // fine spray texture; photos read almost smooth
  trim: std({ color: 0xeeece6, roughness: 0.45, name: 'trim-white-semigloss' }),
  door: std({ color: 0xefede8, roughness: 0.4, name: 'door-white' }),
  entryDoor: std({ color: 0x8b877f, roughness: 0.5, name: 'entry-door-gray' }),
  lvp: std({ map: tex.lvp, roughnessMap: tex.lvpRough, roughness: 0.62, metalness: 0, name: 'lvp-espresso' }),
  carpet: std({ map: tex.carpet, bumpMap: tex.carpetBump, bumpScale: 1.2, roughness: 1, name: 'carpet-greige' }),
  deckFloor: std({ color: 0x6f7377, roughness: 0.7, name: 'deck-gray-paint' }),
  deckRail: std({ color: 0x4b4e50, roughness: 0.75, name: 'deck-rail-charcoal' }),
  stuccoExt: std({ color: 0xcfc9b8, roughness: 1, bumpMap: tex.stucco, bumpScale: 1.1, name: 'stucco-exterior' }),
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
  // kitchen item
  cabinetDoor: std({ color: 0xf1f0ec, roughness: 0.5, bumpMap: canvasTex(256, (ctx, s) => { const r = rng(21); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.10)`; ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 40 + r() * 120); } }, { repeat: [6, 3], srgb: false }), bumpScale: 0.25, name: 'cabinet-door-linear-thermofoil' }),
  cabinetGap: std({ color: 0x2a2927, roughness: 1, name: 'cabinet-reveal-shadow' }),
  applianceCase: std({ color: 0x2b2c2e, roughness: 0.6, metalness: 0.3, name: 'appliance-case-charcoal' }),
  burner: std({ color: 0x34343a, roughness: 0.3, name: 'cooktop-burner-print' }),
  applianceSteel: std({ color: 0xd2d4d6, metalness: 0.8, roughness: 0.34, roughnessMap: tex.brushed, envMapIntensity: 3, name: 'appliance-stainless' }), // IBL is dim (0.35) so boost reflections to read as bright steel
  sinkSteel: std({ color: 0x8e9194, metalness: 0.3, roughness: 0.5, envMapIntensity: 0.6, name: 'sink-stainless-satin' }), // mostly diffuse: the bowl sits right under the ceiling fixture and blows out as a mirror
  // mandir: cherry with grain along U (mandir.js maps U along each board's length), darkened antique brass, silk runner base
  cherryGrain: std({ map: cherryMap(), roughness: 0.42, name: 'cherry-grain' }),
  antiqueBrass: std({ color: 0x8f6d34, metalness: 1, roughness: 0.42, name: 'antique-brass' }),
  // closets / laundry: natural pine rod (grain along U, tile 0.5 m), appliance enamel, flex foil duct (4 ribs per tile along U; closets.js sets repeat so a tile = 3\"), rubber hose
  pine: std({ map: canvasTex(512, (ctx, s) => { const r = rng(31); ctx.fillStyle = '#d2a476'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 260; i++) { ctx.strokeStyle = `rgba(${r() < 0.7 ? '150,96,52' : '235,200,160'},${0.1 + r() * 0.25})`; ctx.lineWidth = 0.6 + r() * 2.2; const y = r() * s, a = (r() - 0.5) * 24; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(s / 3, y + a, (2 * s) / 3, y - a, s, y); ctx.stroke(); } }, { repeat: [2, 1] }), roughness: 0.6, name: 'pine-natural' }),
  applianceWhite: phys({ color: 0xf3f3f1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, name: 'appliance-white-enamel' }),
  foilDuct: std({ color: 0xc9cbce, metalness: 1, roughness: 0.34, bumpMap: canvasTex(64, (ctx, s) => { for (let x = 0; x < s; x++) { const v = 128 + 120 * Math.sin((x / s) * Math.PI * 2 * 4); ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; ctx.fillRect(x, 0, 1, s); } }, { srgb: false }), bumpScale: 3, name: 'flex-foil-duct' }),
  rubberHose: std({ color: 0x2a2b2d, roughness: 0.7, name: 'rubber-hose' }),
  panelGray: std({ color: 0xe4e3de, roughness: 0.5, metalness: 0.1, name: 'load-centre-painted-steel' }),
  // lighting: opal/frosted diffuser of a switched-on LED fixture (no transmission -> no extra render pass); lighting.js clones it per brightness
  lensLit: std({ color: 0xfff6e6, roughness: 0.55, emissive: 0xffdcae, emissiveIntensity: 2.2, name: 'fixture-lens-lit' }),
  // deck item (textured scenery materials — grass, bark, foliage, sky — are built in rooms/deck.js next to their painters)
  stuccoSoffit: std({ color: 0xc4bdaa, roughness: 1, bumpMap: tex.stucco, bumpScale: 5, name: 'stucco-soffit-heavy' }),
  partitionWhite: std({ color: 0xe6e4dc, roughness: 0.6, name: 'partition-white-paint' }),
  hvacIvory: std({ color: 0xe4e1d6, roughness: 0.45, metalness: 0.1, name: 'daikin-ivory' }),
  hvacDark: std({ color: 0x1c1d1f, roughness: 0.7, name: 'condenser-cavity' }),
  lineset: std({ color: 0xdedcd4, roughness: 0.6, name: 'lineset-white-vinyl' }),
  railTan: std({ color: 0xa89a82, roughness: 0.8, name: 'neighbour-rail-tan' }),
  roofEave: std({ color: 0x8c8980, roughness: 0.9, name: 'roof-eave' }),
  // openings item: cheap window glass (no transmission pass; never casts shadows), insect screen, corridor-side door paint
  glassPane: phys({ color: 0xdfe8e6, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.06, depthWrite: false, envMapIntensity: 1.5, specularIntensity: 1, side: THREE.DoubleSide, name: 'window-glass' }),
  insectScreen: std({ color: 0x3a3c3e, roughness: 1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, name: 'insect-screen' }),
  corridorTrim: std({ color: 0x8f8a80, roughness: 0.5, name: 'corridor-door-frame-taupe' }),
  mirrorEdge: std({ color: 0x9fb0a8, roughness: 0.15, metalness: 0.3, name: 'mirror-glass-edge' }), // bathroom: polished edge of the frameless mirror
};
export const TEX = tex;
