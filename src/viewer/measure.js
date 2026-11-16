// Tape measure: click two points on any surface to read the straight-line distance between them.
// In walk mode the point under the crosshair is used. A third click starts a new measurement.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { IN } from '../dimensions.js';
import { ftin, inches } from './format.js';

const COLOR = 0xffb020;

export function createMeasure(V) {
  const btn = document.getElementById('measureBtn');
  // screen-space widths (a 3 px line, 9 px end dots) so the tape reads the same from the dollhouse view and up close
  const line = new Line2(new LineGeometry().setPositions([0, 0, 0, 0, 0, 0]), new LineMaterial({ color: COLOR, linewidth: 3, depthTest: false, transparent: true }));
  line.renderOrder = 11; line.frustumCulled = false; line.visible = false; line.name = 'measure:line';
  const dot = () => { const d = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), new THREE.PointsMaterial({ color: COLOR, size: 9, sizeAttenuation: false, depthTest: false, transparent: true })); d.renderOrder = 12; d.frustumCulled = false; d.visible = false; return d; };
  const dots = [dot(), dot()];
  V.scene.add(line, ...dots);
  const el = document.createElement('div'); el.className = 'dim tape';
  const tag = new CSS2DObject(el); tag.visible = false; V.labelScene.add(tag);

  let active = false, pts = []; // 0, 1 or 2 fixed points
  function draw(a, b) {
    line.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]); line.visible = true;
    dots[0].position.copy(a); dots[0].visible = true; dots[1].position.copy(b); dots[1].visible = true;
    const d = a.distanceTo(b) / IN, rise = Math.abs(a.y - b.y) / IN, run = Math.hypot(a.x - b.x, a.z - b.z) / IN;
    el.textContent = `${ftin(d)} · ${inches(d)}${rise > 1 && run > 1 ? `  (across ${inches(run)}, up ${inches(rise)})` : ''}`;
    tag.position.lerpVectors(a, b, 0.5); tag.visible = true;
    V.invalidate();
  }
  function clear() { pts = []; line.visible = tag.visible = false; dots.forEach((d) => { d.visible = false; }); V.invalidate(); }
  function setActive(on) {
    active = on; clear();
    btn.setAttribute('aria-pressed', on); document.body.classList.toggle('measuring', on);
    V.say(on ? 'Tape measure: click the first point' : '');
  }
  btn.addEventListener('click', () => setActive(!active));

  return {
    get active() { return active; },
    setActive,
    /** A click landed on world point p (or null when it hit nothing). */
    click(p) {
      if (!p) return;
      if (pts.length === 2) clear();
      pts.push(p.clone());
      if (pts.length === 1) { dots[0].position.copy(p); dots[0].visible = true; V.say('Click the second point'); V.invalidate(); } else { draw(pts[0], pts[1]); V.say(`Distance ${el.textContent}`); }
    },
    /** Live preview from the first point to the pointer. */
    hover(p) { if (pts.length === 1 && p) draw(pts[0], p); },
    get result() { return pts.length === 2 ? pts[0].distanceTo(pts[1]) / IN : null; }, // inches, for tests
  };
}
