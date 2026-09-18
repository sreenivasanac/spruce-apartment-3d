// Contract: build() returns a THREE.Group named 'chair', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.chair.pos/rot and makes it draggable.
import { FURNITURE } from '../dimensions.js';
import { MAT } from '../materials.js';
import { box, group } from '../lib/build.js';

export function build() {
  const D = FURNITURE.chair;
  const h = D.h ?? D.headH;
  const w = D.w ?? D.frameW, d = D.d ?? D.frameL;
  const b = box(w, h, d, MAT.fabricGray, 'chair:placeholder');
  b.position.y = (h * 0.0254) / 2;
  return group('chair', b);
}
