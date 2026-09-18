// Contract: build() returns a THREE.Group named 'wifeDesk', modelled around the ORIGIN:
// footprint centred on (0,0), bottom on the floor (y=0), FRONT (sitter's side) facing +Z, width along X.
// apartment.js positions/rotates it from FURNITURE.wifeDesk.pos/rot and makes it draggable.
// Reference: refs/IMG_3955.jpg, IMG_3956.jpg — white IKEA top on an ALEX 5-drawer unit (sitter's left) + 2 ADILS legs (right).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FURNITURE, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { cyl, group } from '../lib/build.js';

const at = (o, x, y, z) => (o.position.set(m(x), m(y), m(z)), o);

/** Box with slightly eased edges (inches) — foil-wrapped particleboard is never knife-sharp. */
function rbox(w, h, d, r, mat, name) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(m(w), m(h), m(d), 2, m(r)), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

/** ALEX drawer front: rectangle with a shallow scooped finger-pull cut out of the top edge, extruded to frontT. */
function drawerFront(w, h, A, mat, name) {
  const s = new THREE.Shape(), sw = A.scoopW / 2, sh = A.scoopH;
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h);
  s.lineTo(sw, h);
  s.bezierCurveTo(sw * 0.72, h, sw * 0.62, h - sh, sw * 0.3, h - sh); // eased S-curve into the flat-bottomed scoop
  s.lineTo(-sw * 0.3, h - sh);
  s.bezierCurveTo(-sw * 0.62, h - sh, -sw * 0.72, h, -sw, h);
  s.lineTo(-w / 2, h); s.closePath();
  const bev = A.ease; // 1/16in eased foil edge
  const g = new THREE.ExtrudeGeometry(s, { depth: A.frontT - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, bev);
  g.scale(m(1), m(1), m(1));
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function build() {
  const D = FURNITURE.wifeDesk, A = D.alex;
  const underTop = D.h - D.topT;
  // paper-foil micro texture: faint roughness mottling so the big white planes don't read as a flat CG slab
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d'), img = ctx.createImageData(256, 256), r = rng(47);
  for (let i = 0; i < img.data.length; i += 4) { const v = 150 + r() * 70; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const foil = new THREE.CanvasTexture(c); foil.wrapS = foil.wrapT = THREE.RepeatWrapping; foil.repeat.set(3, 3);
  const white = MAT.cabinet.clone(); Object.assign(white, { roughness: 0.5, roughnessMap: foil, bumpMap: foil, bumpScale: 0.06, name: 'ikea-white-foil' }); white.color.set(0xf4f3f0);
  const band = white.clone(); Object.assign(band, { roughness: 0.3, roughnessMap: null, bumpMap: null, name: 'ikea-white-edgeband' }); band.color.set(0xecebe6); // ABS edge band: glossier, a hair darker -> visible seam
  const legWhite = MAT.whitePlastic.clone(); Object.assign(legWhite, { roughness: 0.35, name: 'adils-white-powdercoat' });
  const shadow = MAT.blackPlastic.clone(); Object.assign(shadow, { roughness: 1, name: 'alex-drawer-void' }); shadow.color.set(0x2a2a2c);

  // top = foil-faced core + edge band all round; the band stops bandT short of the faces so the seam line shows
  const top = at(group('wifeDesk:top',
    rbox(D.w - 2 * D.bandT, D.topT, D.d - 2 * D.bandT, D.edgeR, white, 'wifeDesk:top:core'),
    rbox(D.w, D.topT - 2 * D.bandT, D.d, D.bandT, band, 'wifeDesk:top:edgeband')), 0, underTop + D.topT / 2, 0);
  // dressing from IMG_3955: navy laptop sleeve with a zip line, lying slightly askew on the ALEX end
  const S = D.sleeve, navy = MAT.fabricGray.clone(); Object.assign(navy, { roughness: 0.95, name: 'sleeve-navy' }); navy.color.set(0x1c2a4a);
  const sleeve = group('wifeDesk:sleeve', rbox(S.w, S.h, S.d, S.h * 0.45, navy, 'wifeDesk:sleeve:body'), rbox(S.w + 0.04, 0.12, S.d + 0.04, 0.05, MAT.blackPlastic, 'wifeDesk:sleeve:zip'));
  at(sleeve, S.x, D.h + S.h / 2, S.z).rotation.y = THREE.MathUtils.degToRad(S.yawDeg);

  // ---- ALEX: carcass of 5 panels, drawer fronts inset between the sides; stands on thin felt pads that make up 27.5 -> underTop
  const padH = underTop - A.h;
  const ax = -D.w / 2 + A.inset + A.w / 2, az = D.d / 2 - A.frontSetback - A.d / 2;
  const alex = group('wifeDesk:alex');
  const innerW = A.w - 2 * A.panelT;
  for (const sx of [-1, 1]) alex.add(at(rbox(A.panelT, A.h, A.d, D.edgeR, white, `wifeDesk:alex:side${sx < 0 ? 'L' : 'R'}`), sx * (A.w - A.panelT) / 2, A.h / 2, 0));
  alex.add(at(rbox(innerW, A.panelT, A.d, D.edgeR, white, 'wifeDesk:alex:topPanel'), 0, A.h - A.panelT / 2, 0));
  alex.add(at(rbox(innerW, A.plinthH, A.d, D.edgeR, white, 'wifeDesk:alex:bottom'), 0, A.plinthH / 2, 0));
  alex.add(at(rbox(innerW, A.h - A.plinthH - A.panelT, A.panelT / 2, D.edgeR, white, 'wifeDesk:alex:back'), 0, (A.h + A.plinthH - A.panelT) / 2, -A.d / 2 + A.panelT / 2));
  // dark void right behind the fronts so the shadow gaps + scoops read as openings into the drawer boxes
  const voidH = A.h - A.plinthH - A.panelT;
  alex.add(at(rbox(innerW, voidH, A.panelT / 4, 0.01, shadow, 'wifeDesk:alex:void'), 0, A.plinthH + voidH / 2, A.d / 2 - A.frontT - A.gap - A.panelT / 8));
  const fh = (voidH - (A.drawers + 1) * A.gap) / A.drawers, fw = innerW - 2 * A.gap;
  for (let i = 0; i < A.drawers; i++) {
    alex.add(at(drawerFront(fw, fh, { ...A, ease: D.drawerEase }, white, `wifeDesk:alex:drawer${i + 1}`), 0, A.plinthH + A.gap + i * (fh + A.gap), A.d / 2 - A.frontT));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // felt pads
    const p = at(cyl(0.5, padH, MAT.fabricGray, 'wifeDesk:alex:pad', 12), sx * (A.w / 2 - 1.2), -padH / 2, sz * (A.d / 2 - 1.5));
    p.castShadow = false; alex.add(p);
  }
  at(alex, ax, padH, az);

  // ---- ADILS legs: white tube, mounting plate under the top, dark adjustable foot
  const legs = group('wifeDesk:legs');
  const lx = D.w / 2 - D.legInset;
  [-1, 1].forEach((sz, i) => {
    const z = sz * (D.d / 2 - D.legInset);
    const tubeH = underTop - D.footH - D.plateT;
    legs.add(at(cyl(D.legDia / 2, tubeH, legWhite, `wifeDesk:leg${i + 1}`, 32), lx, D.footH + tubeH / 2, z));
    legs.add(at(cyl(D.legDia / 2 * 0.86, D.footH, MAT.blackPlastic, `wifeDesk:foot${i + 1}`, 24), lx, D.footH / 2, z));
    legs.add(at(cyl(D.plateDia / 2, D.plateT, legWhite, `wifeDesk:plate${i + 1}`, 32), lx, underTop - D.plateT / 2, z));
  });

  return group('wifeDesk', top, sleeve, alex, legs);
}
