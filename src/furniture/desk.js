// Contract: build() returns a THREE.Group named 'desk', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT (sitter's side) facing +Z, width along X.
// Reference: spruce_apt_photos/long-desk/ — 63 x 24 x 29 desk (user-given), light-oak top on a white square-tube steel
// frame: two closed rectangular side frames (legs + top rail + floor rail) joined by front/back aprons under the top.
// Dressing: a generic 27" monitor centred near the back edge (user: any size is fine).
import * as THREE from 'three';
import { FURNITURE, m } from '../dimensions.js';
import { woodCanvas, canvasTexture } from '../lib/woodgrain.js';
import { panel, std } from './cabinets/parts.js';
import { group } from '../lib/build.js';

export function build() {
  const D = FURNITURE.desk, M = D.monitor;
  const under = D.h - D.topT;

  // light-oak laminate top, grain running along the 63" length (texture rotated so grain follows U)
  const src = woodCanvas({ seed: 63, dark: [168, 128, 86], mid: [208, 172, 128], hi: [226, 198, 158], lines: 34, contrast: 0.45, wobble: 0.35 });
  const rot = document.createElement('canvas'); rot.width = rot.height = src.width;
  const rx = rot.getContext('2d'); rx.translate(src.width, 0); rx.rotate(Math.PI / 2); rx.drawImage(src, 0, 0);
  const oak = std({ map: canvasTexture(rot), roughness: 0.55, name: 'desk-light-oak' });
  const top = panel(D.w, D.topT, D.d, oak, 'desk:top', 0, under + D.topT / 2, 0, D.edgeR);

  // white powder-coated steel frame
  const steel = std({ color: 0xf1f1ee, metalness: 0.2, roughness: 0.45, name: 'desk-white-steel' });
  const t = D.tube, lx = D.w / 2 - D.frameInset - t / 2, lz = D.d / 2 - D.frameInset - t / 2;
  const frame = group('desk:frame');
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) frame.add(panel(t, under - D.footH, t, steel, 'desk:leg', sx * lx, D.footH + (under - D.footH) / 2, sz * lz, 0.1));
    frame.add(panel(t, t, 2 * lz - t, steel, 'desk:side-top-rail', sx * lx, under - t / 2, 0, 0.1));
    frame.add(panel(t, t, 2 * lz + t, steel, 'desk:floor-rail', sx * lx, D.footH + t / 2, 0, 0.1));
  }
  for (const sz of [-1, 1]) frame.add(panel(2 * lx - t, D.apronH, t * 0.8, steel, 'desk:apron', 0, under - D.apronH / 2, sz * lz, 0.08));

  // 27" monitor: thin-bezel panel on a column stand with a flat rectangular base, centred, near the back edge
  const black = std({ color: 0x111214, roughness: 0.5, name: 'monitor-plastic' });
  const glass = std({ color: 0x050607, roughness: 0.08, metalness: 0.2, name: 'monitor-screen' });
  const silver = std({ color: 0x9a9ca0, metalness: 0.8, roughness: 0.35, name: 'monitor-stand' });
  const bz = -D.d / 2 + M.backset, sy = D.h + M.lift;
  const monitor = group('desk:monitor',
    panel(M.baseW, M.baseT, M.baseD, silver, 'desk:monitor-base', 0, D.h + M.baseT / 2, bz, 0.25),
    panel(M.neck, M.lift + M.h * 0.45, M.neck * 0.6, silver, 'desk:monitor-neck', 0, D.h + (M.lift + M.h * 0.45) / 2, bz - M.baseD * 0.3, 0.2),
    panel(M.w, M.h, M.t, black, 'desk:monitor-body', 0, sy + M.h / 2, bz + 0.2, 0.15),
    panel(M.w - 2 * M.bezel, M.h - M.bezel - M.chin, 0.05, glass, 'desk:monitor-screen', 0, sy + M.chin + (M.h - M.bezel - M.chin) / 2, bz + 0.2 + M.t / 2 + 0.01, 0.01),
    panel(M.w * 0.42, M.h * 0.5, 1.0, black, 'desk:monitor-back', 0, sy + M.h * 0.5, bz + 0.2 - M.t / 2 - 0.45, 0.4));
  return group('desk', top, frame, monitor);
}
