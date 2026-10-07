// Shared building blocks for the three storage-cabinet options. Inches in, metres out; every mesh is a plain Mesh with a
// MeshStandardMaterial and repeat-1 textures so the same models export cleanly to USDZ for AR Quick Look (tools/export-ar.mjs).
// Convention (as all furniture): origin = bottom centre, front = +Z, width along X.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { m } from '../../dimensions.js';

export const EDGE = 0.06; // eased edge radius on panels, inches

/** Rounded panel (w×h×d inches) centred at (x, y, z) inches. */
export function panel(w, h, d, mat, name, x = 0, y = 0, z = 0, r = EDGE) {
  const g = new RoundedBoxGeometry(m(w), m(h), m(d), 1, m(Math.min(r, w / 2.1, h / 2.1, d / 2.1))); // 1 segment = small chamfer: invisible at furniture scale, keeps the USDZ files small
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(m(x), m(y), m(z));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export const std = (o) => new THREE.MeshStandardMaterial(o);

/** Round knob (dia inches) projecting +Z from (x, y, z). */
export function knob(dia, proj, mat, name, x, y, z) {
  const g = new THREE.Group(); g.name = name;
  const prof = [[0, 0], [dia * 0.22, 0], [dia * 0.2, proj * 0.45], [dia * 0.5, proj * 0.78], [dia * 0.46, proj], [0, proj]];
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y2]) => new THREE.Vector2(m(r), m(y2))), 28), mat);
  lathe.rotation.x = Math.PI / 2; lathe.castShadow = true;
  g.add(lathe); g.position.set(m(x), m(y), m(z));
  return g;
}

/** Bar pull: two posts + bar, length L along `axis` ('x' | 'y'), standing proud `proj` in +Z. */
export function barPull(L, proj, dia, mat, name, x, y, z, axis = 'y') {
  const g = new THREE.Group(); g.name = name;
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(m(dia / 2), m(L), 4, 12), mat);
  bar.position.z = m(proj); bar.castShadow = true;
  if (axis === 'x') bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(dia * 0.4), m(dia * 0.5), m(proj), 10), mat);
    post.rotation.x = Math.PI / 2; post.position.z = m(proj / 2);
    post.position[axis] = m(s * (L / 2 - dia * 0.2));
    g.add(post);
  }
  g.position.set(m(x), m(y), m(z));
  return g;
}

/** Half-cup (bin) pull, width w, centred at (x, y, z). */
export function cupPull(w, mat, name, x, y, z) {
  const geo = new THREE.SphereGeometry(m(w / 2), 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); // lower hemisphere shell
  geo.scale(1, 0.55, 0.5);
  const cup = new THREE.Mesh(geo, mat); cup.name = name;
  mat.side = THREE.DoubleSide;
  cup.position.set(m(x), m(y + w * 0.12), m(z + 0.05)); cup.castShadow = true;
  return cup;
}

/**
 * Hinged door. Returns a pivot Group located on the hinge edge (front face plane); `build(L)` must return the leaf built
 * spanning x 0..w; it is shifted so the hinge edge sits on the pivot for either hinge side.
 * pivot.userData.setOpen(t01) swings it (0 shut .. 1 open at maxDeg).
 */
export function hingedDoor({ x, y0, w, h, zFront, hinge, maxDeg = 100, name, build }) {
  const pivot = new THREE.Group(); pivot.name = name;
  const leaf = build(w, h, hinge); // leaf spans x 0..w, y 0..h, z -t..0; builder puts the knob on the side away from the hinge
  if (hinge === 'R') leaf.position.x = -m(w); // no mirroring: negative scale breaks face culling in AR Quick Look
  pivot.add(leaf);
  pivot.position.set(m(hinge === 'L' ? x : x + w), m(y0), m(zFront));
  const sign = hinge === 'L' ? -1 : 1;
  pivot.userData.setOpen = (t) => { pivot.rotation.y = sign * THREE.MathUtils.degToRad(maxDeg) * t; };
  return pivot;
}

/** Drawer front + box that slides out along +Z; userData.setOpen(t01). */
export function drawer({ x, y0, w, h, zFront, depth, front, boxMat, travel, name }) {
  const g = new THREE.Group(); g.name = name;
  g.add(front(w, h));
  const t = 0.5, bh = h * 0.7;
  const bx = new THREE.Group();
  for (const [bw, bd, px, pz] of [[t, depth, t / 2 + 0.6, -depth / 2], [t, depth, w - t / 2 - 0.6, -depth / 2], [w - 1.2, t, w / 2, -depth + t / 2]])
    bx.add(panel(bw, bh, bd, boxMat, `${name}:box`, px, bh / 2 + 0.6, pz - 0.75));
  bx.add(panel(w - 1.2, 0.3, depth, boxMat, `${name}:bottom`, w / 2, 0.75, -depth / 2 - 0.75));
  g.add(bx);
  g.position.set(m(x), m(y0), m(zFront));
  const z0 = g.position.z;
  g.userData.setOpen = (k) => { g.position.z = z0 + m(travel) * k; };
  return g;
}

/** Shaker leaf: frame (stile/rail) + recessed centre panel, as one group spanning x 0..w, y 0..h, z -t..0. */
export function shakerLeaf(w, h, { t = 0.75, stile = 2.2, recess = 0.22, mat, panelMat = mat, name }) {
  const g = new THREE.Group(); g.name = name;
  g.add(panel(stile, h, t, mat, `${name}:stile`, stile / 2, h / 2, -t / 2));
  g.add(panel(stile, h, t, mat, `${name}:stile`, w - stile / 2, h / 2, -t / 2));
  g.add(panel(w - 2 * stile, stile, t, mat, `${name}:rail`, w / 2, stile / 2, -t / 2));
  g.add(panel(w - 2 * stile, stile, t, mat, `${name}:rail`, w / 2, h - stile / 2, -t / 2));
  g.add(panel(w - 2 * stile + 0.1, h - 2 * stile + 0.1, t - recess, panelMat, `${name}:panel`, w / 2, h / 2, -t / 2 - recess / 2));
  return g;
}

/** Gives a cabinet root group setOpen(bool) with an eased animation over all door/drawer parts (userData.setOpen(t)). */
export function animateOpen(root, parts) {
  let k = 0, target = 0;
  const apply = () => parts.forEach((p) => p.userData.setOpen(k));
  root.userData.setOpen = (open) => { target = open ? 1 : 0; };
  root.userData.isOpen = () => target === 1;
  root.userData.snap = (open) => { target = k = open ? 1 : 0; apply(); };
  root.userData.animate = (dt) => { // driven by the cabinet.js wrapper (only the visible option animates)
    if (k === target) return;
    k = target > k ? Math.min(target, k + dt * 1.6) : Math.max(target, k - dt * 1.6);
    apply();
  };
}
