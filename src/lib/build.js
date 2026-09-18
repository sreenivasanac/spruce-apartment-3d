// Geometry helpers. Everything takes INCHES in plan space and converts with m() exactly once.
import * as THREE from 'three';
import { m } from '../dimensions.js';

/** Box whose UVs are in metres (so textures with repeat = tiles/metre tile physically). Size in inches. */
export function box(w, h, d, mat, name) {
  const g = new THREE.BoxGeometry(m(w), m(h), m(d));
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // face order: +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * m(dims[f][0]), uv.getY(k) * m(dims[f][1]));
  }
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

/** Box given by plan-space min corner + size: x0,y0 plan inches, elev = bottom elevation, w along x, d along y, h up. */
export function boxAt(x0, y0, elev, w, d, h, mat, name) {
  const b = box(w, h, d, mat, name);
  b.position.set(m(x0 + w / 2), m(elev + h / 2), m(y0 + d / 2));
  return b;
}

export function cyl(r, h, mat, name, seg = 24) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(m(r), m(r), m(h), seg), mat);
  c.castShadow = c.receiveShadow = true;
  if (name) c.name = name;
  return c;
}

/** Position an object: plan x,y (inches), elevation (inches), rotation about up in degrees. */
export function place(obj, x, y, elev = 0, rotDeg = 0) {
  obj.position.set(m(x), m(elev), m(y));
  obj.rotation.y = THREE.MathUtils.degToRad(rotDeg);
  return obj;
}

/** Horizontal rectangle (floor/ceiling) from plan rect [x0,y0,x1,y1] at elevation; UVs in metres. faceUp=false for ceilings. */
export function slab([x0, y0, x1, y1], elev, mat, faceUp = true, name) {
  const w = m(x1 - x0), d = m(y1 - y0);
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + m(x0), uv.getY(i) * d + m(y0));
  const mesh = new THREE.Mesh(g, mat);
  mesh.rotation.x = faceUp ? -Math.PI / 2 : Math.PI / 2;
  mesh.position.set(m((x0 + x1) / 2), m(elev), m((y0 + y1) / 2));
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

export function group(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  children.flat().filter(Boolean).forEach((c) => g.add(c));
  return g;
}

/** World-space bounding-box size of an object, in inches {w (x), h (up), d (y)} — used by tools/measure.mjs. */
export function sizeInches(obj) {
  const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const r = (v) => Math.round((v / 0.0254) * 100) / 100;
  return { w: r(s.x), h: r(s.y), d: r(s.z) };
}
