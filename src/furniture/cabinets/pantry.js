// Cabinet option B — FULTRU 6-door pantry (spruce_apt_photos/cabinet-2): white shaker doors, crown cap, arched plinth.
// Upper module: 2 doors (left section) + 1 door; lower module: drawer over 2 doors (left) + 1 tall door (right). 40.9 x 15.7 x 68.1.
import * as THREE from 'three';
import { CABINETS, m } from '../../dimensions.js';
import { panel, std, knob, hingedDoor, drawer, shakerLeaf, animateOpen } from './parts.js';

const C = CABINETS.pantry;

/** Front apron with the arched cut-out between two short feet (cabinet-2 photos), extruded `t` deep, spanning x -w/2..w/2. */
function apron(w, h, t, mat) {
  const s = new THREE.Shape(), foot = 2.6, rise = 1.1, ease = 1.4, X = (v) => m(v), Y = (v) => m(v);
  s.moveTo(X(-w / 2), 0); s.lineTo(X(-w / 2 + foot), 0);
  s.quadraticCurveTo(X(-w / 2 + foot + 0.2), Y(rise), X(-w / 2 + foot + ease), Y(rise));
  s.lineTo(X(w / 2 - foot - ease), Y(rise));
  s.quadraticCurveTo(X(w / 2 - foot - 0.2), Y(rise), X(w / 2 - foot), 0);
  s.lineTo(X(w / 2), 0); s.lineTo(X(w / 2), Y(h)); s.lineTo(X(-w / 2), Y(h)); s.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: m(t), bevelEnabled: false }), mat);
  mesh.name = 'pantry:apron'; mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function build() {
  const g = new THREE.Group(); g.name = 'cabinet:pantry';
  const white = std({ color: 0xf1f0eb, roughness: 0.48, name: 'pantry-white' });
  const inside = std({ color: 0xe8e6df, roughness: 0.7, name: 'pantry-interior' });
  const black = std({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.35, name: 'pantry-knob' });
  const cw = C.w - 2 * C.cap.over, zF = C.d / 2 - C.doorT - 0.15, cd = zF + C.d / 2; // carcass under the cap; door faces stop 0.15" behind the cap edge so the overall depth stays 15.7
  const top = C.h - C.cap.t, lowerTop = C.plinth + (top - C.plinth - C.upperH);
  const xL = -cw / 2, xMid = xL + C.leftW, zc = (zF - C.d / 2) / 2;

  // carcass
  for (const s of [-1, 1]) g.add(panel(C.side, top, cd, white, 'pantry:side', s * (cw - C.side) / 2, top / 2, zc));
  g.add(panel(C.w, C.cap.t, C.d, white, 'pantry:cap', 0, top + C.cap.t / 2, 0, 0.2));
  g.add(panel(cw - 2 * C.side, top, 0.25, inside, 'pantry:back', 0, top / 2, zc - cd / 2 + 0.3));
  g.add(panel(0.7, top - C.plinth, cd - 0.8, inside, 'pantry:divider', xMid, (top + C.plinth) / 2, zc - 0.4));
  const ap = apron(cw - 2 * C.side, C.plinth, 0.7, white); ap.position.z = m(zF - 0.7); g.add(ap);
  for (const y of [C.plinth + 0.35, lowerTop, lowerTop + C.upperH / 2, (C.plinth + lowerTop) / 2 - 2])
    g.add(panel(cw - 2 * C.side - 0.1, 0.7, cd - 1.2, inside, 'pantry:shelf', 0, y, zc - 0.3));
  g.add(panel(cw + 0.1, 0.35, cd + 0.05, white, 'pantry:module-seam', 0, lowerTop + 0.05, zc)); // the two boxes stack with a visible joint

  // doors (full overlay, 0.12" reveals) — knob on the edge away from the hinge, at about mid-height
  const parts = [], G = C.gap;
  const leaf = (w, h, hinge) => {
    const L = shakerLeaf(w, h, { t: C.doorT, stile: C.stile, mat: white, name: 'pantry:leaf' });
    L.add(knob(C.knob.dia, C.knob.proj, black, 'pantry:knob', hinge === 'L' ? w - 1.5 : 1.5, h * 0.5, 0));
    return L;
  };
  const door = (x, y0, w, h, hinge, name) => { const d = hingedDoor({ x, y0, w, h, zFront: zF + C.doorT, hinge, name, build: leaf }); g.add(d); parts.push(d); };
  const lw = (C.leftW - G) / 2, rw = cw - C.leftW - G;
  const uy = lowerTop + G, uh = top - lowerTop - 2 * G;
  door(xL + G / 2, uy, lw - G / 2, uh, 'L', 'pantry:door-upper-1');
  door(xL + lw + G, uy, lw - G / 2, uh, 'R', 'pantry:door-upper-2');
  door(xMid + G / 2, uy, rw, uh, 'R', 'pantry:door-upper-3');
  const dh = C.drawer.h, ly = C.plinth + G, lh = lowerTop - C.plinth - dh - 3 * G;
  door(xL + G / 2, ly, lw - G / 2, lh, 'L', 'pantry:door-lower-1');
  door(xL + lw + G, ly, lw - G / 2, lh, 'R', 'pantry:door-lower-2');
  door(xMid + G / 2, ly, rw, lowerTop - C.plinth - 2 * G, 'R', 'pantry:door-lower-3');
  const dr = drawer({ x: xL + G / 2, y0: lowerTop - G - dh, w: C.leftW - G, h: dh, zFront: zF + C.doorT, depth: C.drawer.depth, travel: C.drawer.travel, boxMat: inside, name: 'pantry:drawer',
    front: (w, h) => {
      const F = shakerLeaf(w, h, { t: C.doorT, stile: 1.4, mat: white, name: 'pantry:drawer-front' });
      F.add(knob(C.knob.dia, C.knob.proj, black, 'pantry:drawer-knob', w / 2, h / 2, 0));
      return F;
    } });
  g.add(dr); parts.push(dr);
  animateOpen(g, parts);
  g.userData.info = C;
  return g;
}
