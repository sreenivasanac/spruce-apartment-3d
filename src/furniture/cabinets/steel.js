// Cabinet option D — steel office storage cabinet (user photo): charcoal powder-coated carcass that frames two tall cream
// doors over two short ones, white bar handles at the meeting stiles, a key lock under each right handle, adjustable shelves
// (2 above, 1 below the fixed mid shelf). 31.5 x 15.7 x 70.9 (assumed, "similar to option A").
// Animation: right doors stop at 92° (the slider wall is 2" away), left at 110°. The upper pair swings first, the lower pair follows ~0.2 s later, each door easing out (soft-close feel).
import * as THREE from 'three';
import { CABINETS } from '../../dimensions.js';
import { panel, std, barPull, hingedDoor, animateOpen } from './parts.js';

const C = CABINETS.steel;
const ease = (t) => 1 - (1 - t) ** 3; // fast start, gentle stop

export function build() {
  const g = new THREE.Group(); g.name = 'cabinet:steel';
  const frame = std({ color: 0x6f7378, metalness: 0.25, roughness: 0.5, name: 'steel-charcoal' });
  const cream = std({ color: 0xf3eedf, metalness: 0.1, roughness: 0.4, name: 'steel-cream' });
  const inside = std({ color: 0x4a4d52, metalness: 0.4, roughness: 0.5, name: 'steel-interior' });
  const white = std({ color: 0xf3f2ee, roughness: 0.3, name: 'steel-handle' });
  const chrome = std({ color: 0xdedede, metalness: 1, roughness: 0.15, name: 'steel-lock' });
  const zF = C.d / 2, t = C.sheetT, innerW = C.w - 2 * C.frame;

  // carcass: sides, top, back, plinth, mid rail — the gray reveals around the doors are the carcass edges (photo)
  for (const s of [-1, 1]) g.add(panel(C.frame, C.h, C.d, frame, 'steel:side', s * (C.w - C.frame) / 2, C.h / 2, 0, 0.12));
  g.add(panel(innerW, C.top, C.d, frame, 'steel:top', 0, C.h - C.top / 2, 0, 0.1));
  g.add(panel(innerW, C.plinth, C.d, frame, 'steel:plinth', 0, C.plinth / 2, 0, 0.1));
  g.add(panel(innerW, C.h - C.top - C.plinth, 0.3, inside, 'steel:back', 0, (C.h - C.top + C.plinth) / 2, -zF + 0.4));
  const lowerTop = C.h - C.top - C.upperDoorH - C.midRail;
  g.add(panel(innerW, C.midRail, C.d - 0.2, frame, 'steel:mid-rail', 0, lowerTop + C.midRail / 2, 0.1, 0.08));

  // shelves: folded-edge steel pans, evenly spaced in each compartment
  const shelf = (y) => {
    g.add(panel(innerW - 0.1, 0.12, C.d - C.doorT - 1.4, inside, 'steel:shelf', 0, y, -C.doorT / 2 - 0.3, 0.03));
    g.add(panel(innerW - 0.1, 1.0, t * 4, inside, 'steel:shelf-lip', 0, y - 0.45, zF - C.doorT - 1.0, 0.03));
  };
  const upperBot = lowerTop + C.midRail, upperTop = C.h - C.top;
  for (let i = 1; i <= C.shelves.upper; i++) shelf(upperBot + (i * (upperTop - upperBot)) / (C.shelves.upper + 1));
  for (let i = 1; i <= C.shelves.lower; i++) shelf(C.plinth + (i * (lowerTop - C.plinth)) / (C.shelves.lower + 1));

  // doors: inset in the frame, pan-formed (thin face + returned edges), handle near the meeting stile, lock under the right handle
  const leaf = (lockRight) => (w, h, hinge) => {
    const L = new THREE.Group(); L.name = 'steel:leaf';
    L.add(panel(w, h, C.doorT, cream, 'steel:door', w / 2, h / 2, -C.doorT / 2, 0.15));
    L.add(panel(w - 1.6, h - 1.6, 0.4, inside, 'steel:door-back-pan', w / 2, h / 2, -C.doorT - 0.2, 0.1));
    const hx = hinge === 'L' ? w - 2 : 2, hy = h * 0.5 + (h > 30 ? 1 : 2);
    L.add(barPull(C.handle.L, C.handle.proj, C.handle.dia, white, 'steel:handle', hx, hy, 0));
    if (lockRight && hinge === 'R') {
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(C.lockDia * 0.0127, C.lockDia * 0.0127, 0.006, 20), chrome);
      lock.rotation.x = Math.PI / 2; lock.position.set(hx * 0.0254, (hy - C.handle.L / 2 - 1.6) * 0.0254, 0.003); lock.name = 'steel:lock';
      L.add(lock);
    }
    return L;
  };
  const parts = [], G = C.gap, dw = innerW / 2 - 1.5 * G;
  const tiers = [['upper', upperBot + G, C.upperDoorH - 2 * G, 0], ['lower', C.plinth + G, lowerTop - C.plinth - 2 * G, 0.22]];
  for (const [tier, y0, h, delay] of tiers) for (const hinge of ['L', 'R']) {
    const x = hinge === 'L' ? -innerW / 2 + G : G / 2;
    const d = hingedDoor({ x, y0, w: dw, h, zFront: zF, hinge, maxDeg: hinge === 'R' ? 92 : 110, name: `steel:door-${tier}-${hinge}`, build: leaf(true) });
    const swing = d.userData.setOpen; // stagger + ease: k runs 0..1 over the whole animation
    d.userData.setOpen = (k) => swing(ease(Math.min(1, Math.max(0, (k - delay) / (1 - delay)))));
    g.add(d); parts.push(d);
  }
  animateOpen(g, parts);
  g.userData.info = C;
  return g;
}
