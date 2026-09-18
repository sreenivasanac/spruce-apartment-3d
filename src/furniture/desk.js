// Contract: build() returns a THREE.Group named 'desk', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT (sitter's side) facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.desk.pos/rot and makes it draggable.
// Reference: spruce_apt_photos/table.jpg, table2.jpg — 63x24x29 splice-board desk, black 1x1.5 steel tube frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { cyl, group } from '../lib/build.js';

/** Rustic-brown laminate woodgrain, grain along U. Tileable; one tile = D.woodTile inches square. */
function woodTexture() {
  const s = 1024, c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d'), r = rng(63);
  ctx.fillStyle = '#7b4626'; ctx.fillRect(0, 0, s, s);
  // broad tonal bands, then fine grain lines; every stroke uses whole sine periods and is drawn 3x so the tile wraps
  const streak = (y, amp, periods, phase, width, style) => {
    ctx.strokeStyle = style; ctx.lineWidth = width;
    for (const oy of [-s, 0, s]) {
      ctx.beginPath();
      for (let x = 0; x <= s; x += 8) {
        const yy = y + oy + amp * Math.sin((x / s) * periods * 2 * Math.PI + phase) + amp * 0.4 * Math.sin((x / s) * (periods + 2) * 2 * Math.PI + phase * 2);
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  };
  for (let i = 0; i < 26; i++) streak(r() * s, 10 + r() * 30, 1 + (r() * 2 | 0), r() * 6.3, 14 + r() * 50, `rgba(${r() < 0.6 ? '46,23,11' : '172,106,58'},${0.14 + r() * 0.2})`);
  for (let i = 0; i < 420; i++) streak(r() * s, 4 + r() * 22, 1 + (r() * 3 | 0), r() * 6.3, 0.6 + r() * 2.2, `rgba(${r() < 0.7 ? '38,19,9' : '190,128,78'},${0.10 + r() * 0.30})`);
  for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(30,15,8,${0.05 + r() * 0.12})`; ctx.fillRect(r() * s, r() * s, 3 + r() * 14, 1); } // pores
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Box with eased edges (inches). uvOffset != null => planar UVs in inches on XZ (u along the width = grain direction). */
function rbox(w, h, d, r, mat, name, uvOffset = null) {
  const g = new RoundedBoxGeometry(m(w), m(h), m(d), 3, m(r));
  if (uvOffset) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / m(1) + uvOffset[0]), (p.getZ(i) + p.getY(i)) / m(1) + uvOffset[1]);
  }
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function build() {
  const D = FURNITURE.desk;
  const at = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);
  const underTop = D.h - D.topT;

  // ---- three-panel top: wood | matte black | wood
  const wood = MAT.rusticWood.clone();
  wood.color.set(0xffffff); wood.map = woodTexture(); wood.map.repeat.setScalar(1 / D.woodTile); wood.roughness = 0.42; wood.name = 'desk-rustic-laminate';
  const midW = D.w - 2 * D.endPanelW, topY = underTop + D.topT / 2, endX = (D.w - D.endPanelW) / 2;
  const top = group('desk:top',
    at(rbox(D.endPanelW, D.topT, D.d, D.edgeR, wood, 'desk:top-left', [0, 0]), -endX, topY, 0),
    at(rbox(midW, D.topT, D.d, D.edgeR, MAT.blackLaminate, 'desk:top-centre'), 0, topY, 0),
    at(rbox(D.endPanelW, D.topT, D.d, D.edgeR, wood, 'desk:top-right', [9.3, 13.7]), endX, topY, 0), // offset so the two ends don't mirror
  );

  // ---- frame: 1 x 1.5 black steel tube. Each side = closed rectangle (2 legs + top rail + floor stretcher); front + rear long rails under the top
  const legX = D.w / 2 - D.frameInset - D.tubeT / 2, legZ = D.d / 2 - D.railInset - D.leg / 2;
  const legH = underTop - D.footH, between = 2 * legZ - D.leg, span = 2 * legX - D.tubeT;
  const tube = (w, h, d, name) => rbox(w, h, d, D.tubeR, MAT.blackMetal, name);
  const frame = group('desk:frame');
  for (const sx of [-1, 1]) {
    const side = sx < 0 ? 'L' : 'R';
    for (const sz of [-1, 1]) {
      frame.add(at(tube(D.tubeT, legH, D.leg, `desk:leg-${side}${sz < 0 ? 'rear' : 'front'}`), sx * legX, D.footH + legH / 2, sz * legZ));
      const foot = at(cyl(D.footDia / 2, D.footH, MAT.blackPlastic, 'desk:foot'), sx * legX, D.footH / 2, sz * legZ);
      frame.add(foot);
    }
    frame.add(at(tube(D.tubeT, D.railH, between, `desk:side-rail-${side}`), sx * legX, underTop - D.railH / 2, 0));
    frame.add(at(tube(D.tubeT, D.railH, between, `desk:stretcher-${side}`), sx * legX, D.footH + D.railH / 2, 0));
  }
  frame.add(at(tube(span, D.railH, D.tubeT, 'desk:front-rail'), 0, underTop - D.railH / 2, legZ));
  frame.add(at(tube(span, D.railH, D.tubeT, 'desk:rear-bar'), 0, underTop - D.railH / 2, -legZ));

  return group('desk', top, frame);
}
