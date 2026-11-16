// Procedural woodgrain canvas: straight-ish grain along V (vertical), periodic in both axes, deterministic.
// Used by the living-room desk (light oak) and the cabinet options. Returns a CanvasTexture with repeat 1 —
// AR Quick Look mis-applies texture repeat, so callers bake scale into geometry UVs instead.
import * as THREE from 'three';
import { rng } from '../materials.js';

const cache = new Map();

/** @param {{seed:number, dark:number[], mid:number[], hi:number[], lines?:number, size?:number, contrast?:number, wobble?:number}} o — wobble = grain waviness */
export function woodCanvas(o) {
  const key = JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const s = o.size ?? 512, r = rng(o.seed), TAU = Math.PI * 2, lines = o.lines ?? 22, contrast = o.contrast ?? 1, wobble = o.wobble ?? 1.3;
  const waves = Array.from({ length: 6 }, () => [1 + (r() * 3 | 0), (r() * 3 | 0) - 1, r() * TAU, 0.4 + r() * 0.6]);
  const warp = (u, v) => waves.reduce((a, [fu, fv, ph, amp]) => a + amp * Math.sin(TAU * (fu * v + fv * u) + ph), 0) / waves.length;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d', { willReadFrequently: true }), img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s, v = y / s, f = lines * u + wobble * warp(u, v), t = f - Math.floor(f);
    let k = t < 0.12 ? t / 0.12 : 1 - 0.7 * ((t - 0.12) / 0.88) ** 0.8; // sharp late-wood line, slow early-wood fade
    k = 1 - contrast * (1 - k);
    const a = k < 0.5 ? o.dark : o.mid, b = k < 0.5 ? o.mid : o.hi, w = k < 0.5 ? k * 2 : (k - 0.5) * 2, i = 4 * (y * s + x);
    for (let ch = 0; ch < 3; ch++) img.data[i + ch] = a[ch] + (b[ch] - a[ch]) * Math.max(0, Math.min(1, w));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < s * 6; i++) { // pores / ticks along the grain
    ctx.fillStyle = `rgba(${o.dark.join(',')},${0.08 + r() * 0.18})`;
    ctx.fillRect(r() * s, r() * s, 1, 2 + r() * 9);
  }
  cache.set(key, c);
  return c;
}

export function canvasTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tangent-space normal map from a grayscale height canvas (Sobel), strength in "pixels of slope". */
export function normalFromHeight(src, strength = 2) {
  const s = src.width, h = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, s, s).data;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d', { willReadFrequently: true }), out = ctx.createImageData(s, s);
  const H = (x, y) => h[4 * (((y + s) % s) * s + ((x + s) % s))] / 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = 4 * (y * s + x);
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}
