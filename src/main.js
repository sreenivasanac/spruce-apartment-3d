// Viewer: renderer + post, three view modes, furniture drag, plan dimension overlay, ?shot= poses.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ENV, ROOMS, FURNITURE, m, IN } from './dimensions.js';
import { buildApartment, failed } from './apartment.js';
import { wallColliders, areaReport } from './shell.js';
import { sizeInches, place } from './lib/build.js';
import { SHOTS } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const app = document.getElementById('app');

// ---------------------------------------------------------------- renderer + post
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!shotName });
renderer.setPixelRatio(shotName ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
app.appendChild(labels.domElement);

const scene = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(60, 1, 0.05, 300);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
let camera = persp;

const { root, shell, furniture } = await buildApartment({ scene, renderer });
scene.add(root);
const center = new THREE.Vector3(m(ENV.w / 2), 0, m(ENV.d / 2));

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const gtao = new GTAOPass(scene, camera);
gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1 });
composer.addPass(renderPass); composer.addPass(gtao); composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h); labels.setSize(w, h);
  persp.aspect = w / h; persp.updateProjectionMatrix();
  const span = m(ENV.d + 110) / 2, a = w / h; // plan view fits the unit + deck
  Object.assign(ortho, { left: -span * a, right: span * a, top: span, bottom: -span }); ortho.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- plan overlay (room labels + dimensions + area)
const overlay = new THREE.Group(); overlay.visible = false; scene.add(overlay);
function label(text, x, y) {
  const el = document.createElement('div'); el.className = 'dim'; el.textContent = text;
  const o = new CSS2DObject(el); o.position.set(m(x), m(ENV.ceiling), m(y)); overlay.add(o);
}
const ftin = (inch) => `${Math.floor(inch / 12)}'${Math.round(inch % 12)}"`;
for (const r of Object.values(ROOMS)) {
  if (!r.label) continue;
  const [x0, y0, x1, y1] = r.r;
  label(`${r.label.split(' ')[0]} ${ftin(x1 - x0)} × ${ftin(y1 - y0)}`, (x0 + x1) / 2, (y0 + y1) / 2);
}
const area = areaReport();
label(`Envelope ${ftin(ENV.w)} × ${ftin(ENV.d)} = ${area.grossSqFt} sq ft (listing: 676)`, ENV.w / 2, -10);
function setDims(on) { overlay.visible = on; labels.domElement.style.display = on ? '' : 'none'; document.getElementById('dims').setAttribute('aria-pressed', on); }

// ---------------------------------------------------------------- modes
const orbit = new OrbitControls(persp, renderer.domElement);
orbit.target.copy(center); orbit.maxPolarAngle = Math.PI / 2.05; orbit.enableDamping = true;
const planCtl = new OrbitControls(ortho, renderer.domElement);
planCtl.enableRotate = false; planCtl.target.copy(center); planCtl.screenSpacePanning = true;
const walk = new PointerLockControls(persp, renderer.domElement);
const help = document.getElementById('help');
const HELP = {
  dollhouse: 'Drag to orbit · scroll to zoom · drag furniture to move it · R rotates the selected piece · click the coffee table to lift its top',
  walk: 'Click to look around · WASD / arrows to walk · Esc to release · eye height 5\'7"',
  plan: 'Scroll to zoom · right-drag to pan · drag furniture · toggle Dimensions for the measured overlay',
};
let mode;
function setMode(next) {
  mode = next;
  if (walk.isLocked) walk.unlock();
  const showCeil = next === 'walk';
  shell.userData.ceilings.visible = showCeil;
  scene.traverse((o) => { if (o.userData.hideInDollhouse) o.visible = showCeil; });
  orbit.enabled = next === 'dollhouse'; planCtl.enabled = next === 'plan';
  camera = next === 'plan' ? ortho : persp;
  renderPass.camera = camera; gtao.camera = camera;
  if (next === 'dollhouse') { persp.fov = 50; persp.position.set(center.x + 3, 8.5, center.z + 8); persp.lookAt(center); }
  if (next === 'plan') { ortho.position.set(center.x, 30, center.z); ortho.up.set(0, 0, -1); ortho.lookAt(center); planCtl.update(); }
  if (next === 'walk') { persp.fov = 72; persp.position.set(m(125), m(ENV.eye), m(30)); persp.lookAt(m(200), m(ENV.eye - 6), m(300)); }
  persp.updateProjectionMatrix();
  if (next !== 'plan') setDims(false);
  help.textContent = HELP[next];
  document.querySelectorAll('#ui [data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === next));
}
document.querySelectorAll('#ui [data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.getElementById('dims').addEventListener('click', () => { if (mode !== 'plan') setMode('plan'); setDims(!overlay.visible); });
renderer.domElement.addEventListener('click', () => { if (mode === 'walk' && !walk.isLocked) walk.lock(); });

// ---------------------------------------------------------------- collision (2D, inches)
const walls = wallColliders();
const hits = ([ax0, ay0, ax1, ay1], [bx0, by0, bx1, by1]) => ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
function footprint(obj) { // plan-space AABB of an object, inches
  const b = new THREE.Box3().setFromObject(obj);
  return [b.min.x / IN, b.min.z / IN, b.max.x / IN, b.max.z / IN];
}
const inside = ([x0, y0, x1, y1]) => x0 >= 0 && y0 >= 0 && x1 <= ENV.w && y1 <= ENV.d + 66;
const blocked = (rect, ignore) => !inside(rect) || walls.some((w) => hits(rect, w)) ||
  furniture.children.some((f) => f !== ignore && hits(rect, footprint(f)));

// walk
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR' && selected) rotateSelected(); });
addEventListener('keyup', (e) => keys.delete(e.code));
function stepWalk(dt) {
  if (!walk.isLocked) return;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if (!f && !s) return;
  const dir = new THREE.Vector3(); persp.getWorldDirection(dir); dir.y = 0; dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, persp.up);
  const v = dir.multiplyScalar(f).add(right.multiplyScalar(s)).normalize().multiplyScalar(1.3 * dt); // 1.3 m/s stroll
  const R = 8; // body radius, inches
  for (const axis of ['x', 'z']) { // slide along walls: resolve axes independently
    const p = persp.position.clone(); p[axis] += v[axis];
    const px = p.x / IN, py = p.z / IN;
    if (!blocked([px - R, py - R, px + R, py + R])) persp.position[axis] = p[axis];
  }
  persp.position.y = m(ENV.eye);
}

// furniture drag + click
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let selected = null, dragging = null, grab = new THREE.Vector3(), downAt = null;
const pick = (e) => {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(furniture.children, true)[0];
  let o = hit?.object; while (o && !o.userData.draggable) o = o.parent;
  return o ? { obj: o, hit } : null;
};
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode === 'walk' || e.button !== 0) return;
  const p = pick(e); if (!p) { selected = null; return; }
  selected = dragging = p.obj; downAt = [e.clientX, e.clientY];
  ray.ray.intersectPlane(floorPlane, grab); grab.sub(dragging.position); grab.y = 0;
  orbit.enabled = planCtl.enabled = false;
});
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const at = new THREE.Vector3(); if (!ray.ray.intersectPlane(floorPlane, at)) return;
  const prev = dragging.position.clone();
  dragging.position.set(at.x - grab.x, prev.y, at.z - grab.z); // stays on the floor
  if (blocked(footprint(dragging), dragging)) dragging.position.copy(prev);
});
addEventListener('pointerup', (e) => {
  if (!dragging) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4;
  if (!moved) { let o = pick(e)?.hit.object; while (o && !o.userData.onClick) o = o.parent; o?.userData.onClick(); }
  dragging = null; orbit.enabled = mode === 'dollhouse'; planCtl.enabled = mode === 'plan';
});
function rotateSelected() {
  selected.rotation.y += Math.PI / 2;
  if (blocked(footprint(selected), selected)) selected.rotation.y -= Math.PI / 2;
}
document.getElementById('reset').addEventListener('click', () => furniture.children.forEach((g) => {
  const D = FURNITURE[g.userData.key]; place(g, D.pos[0], D.pos[1], g.position.y / IN, D.rot);
}));

// ---------------------------------------------------------------- shots
function applyShot(name) {
  const s = SHOTS[name]; if (!s) throw new Error(`unknown shot "${name}" — see src/shots.js`);
  document.body.classList.add('shot');
  setMode('walk');
  persp.fov = s.vfov; persp.position.set(m(s.pos[0]), m(s.pos[2]), m(s.pos[1]));
  persp.lookAt(m(s.target[0]), m(s.target[2]), m(s.target[1])); persp.updateProjectionMatrix();
}

// ---------------------------------------------------------------- loop
resize();
const view = params.get('view');
if (shotName) applyShot(shotName); else setMode(['walk', 'plan'].includes(view) ? view : 'dollhouse');
if (params.has('dims')) setDims(true);
if (shotName || view) document.body.classList.toggle('shot', params.has('clean') || !!shotName);

const clock = new THREE.Clock(); let frames = 0;
const tickers = []; scene.traverse((o) => { if (o.userData.tick) tickers.push(o); });
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  stepWalk(dt);
  if (orbit.enabled) orbit.update();
  tickers.forEach((o) => o.userData.tick(dt));
  composer.render();
  if (overlay.visible) labels.render(scene, camera);
  if (++frames === 8) window.__ready = true; // tools/shot.mjs waits for this
});

// Debug/measurement hook for tools/measure.mjs and critics.
window.__apt = {
  THREE, scene, renderer, SHOTS, area, failed,
  find: (name) => scene.getObjectByName(name),
  names: () => { const n = []; scene.traverse((o) => o.name && n.push(o.name)); return n; },
  size: (name) => { const o = scene.getObjectByName(name); return o ? sizeInches(o) : null; },
  bounds: (name) => { // plan-space inches: [x0, y0, x1, y1, elev0, elev1]
    const o = scene.getObjectByName(name); if (!o) return null;
    const b = new THREE.Box3().setFromObject(o), r = (v) => Math.round((v / IN) * 100) / 100;
    return [r(b.min.x), r(b.min.z), r(b.max.x), r(b.max.z), r(b.min.y), r(b.max.y)];
  },
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: null }),
};
