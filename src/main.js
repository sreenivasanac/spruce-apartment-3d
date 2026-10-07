// Viewer: renderer + post, three view modes (dollhouse / walk / plan), furniture drag, plan dimension overlay, ?shot= poses.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ENV, ROOMS, WALLS, DOORS, FURNITURE, m, IN } from './dimensions.js';
import { buildApartment, failed } from './apartment.js';
import { wallColliders, areaReport } from './shell.js';
import { sizeInches, place } from './lib/build.js';
import { SHOTS } from './shots.js';

// ---------------------------------------------------------------- viewer tuning (not real-world sizes)
const VIEW = {
  listingSqFt: 676,
  walkSpeed: 1.3, // m/s, a stroll
  turnSpeed: 1.6, // rad/s for keyboard turning in walk mode
  bodyR: 8, // walker half-width, inches (16" body passes the 26" bath door)
  walkStart: [125, 34], walkLook: [200, 300], walkFov: 72,
  dollFov: 42, dollPos: [300, 590, 530], // plan x, elevation, plan y (inches): from above the deck/SW corner
  planMargin: 44, // inches of paper around envelope + deck in plan view
  nudge: 1, nudgeBig: 6, // keyboard furniture nudge, inches
  highlight: 0xffb020,
};

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const app = document.getElementById('app');
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- renderer + post
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!shotName });
renderer.setPixelRatio(shotName ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', '3D view of the apartment');
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
app.appendChild(labels.domElement);

const scene = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(60, 1, 0.05, 300);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
let camera = persp;

const { root, shell, furniture } = await buildApartment({ scene, renderer });
scene.add(root);
const deckR = ROOMS.deck.r;
const center = new THREE.Vector3(m(ENV.w / 2), 0, m(ENV.d / 2 + 20)); // orbit pivot, nudged toward the deck
const planCenter = new THREE.Vector3(m(ENV.w / 2), 0, m(deckR[3] / 2)); // envelope + deck

// The lighting module owns the look; apply its exposure / IBL strength if it exports them (guarded: it may be mid-edit).
try {
  const { RENDER } = await Object.values(import.meta.glob('./rooms/lighting.js'))[0]();
  if (RENDER?.exposure) renderer.toneMappingExposure = RENDER.exposure;
  if (RENDER?.envIntensity != null) scene.environmentIntensity = RENDER.envIntensity;
} catch { /* already reported by apartment.js */ }

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const gtao = new GTAOPass(scene, camera);
gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1 });
composer.addPass(renderPass); composer.addPass(gtao); composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h); composer.setSize(w, h); labels.setSize(w, h);
  persp.aspect = a; persp.updateProjectionMatrix();
  // plan view fits envelope + deck + margin in both directions
  const span = Math.max(m(deckR[3] + 2 * VIEW.planMargin) / 2, m(ENV.w + 2 * VIEW.planMargin) / 2 / a);
  Object.assign(ortho, { left: -span * a, right: span * a, top: span, bottom: -span }); ortho.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- plan overlay: room labels (CSS2D) + dimension lines with ticks (SVG)
const overlay = new THREE.Group(); overlay.visible = false; scene.add(overlay);
function label(text, x, y, cls = 'dim') {
  const el = document.createElement('div'); el.className = cls; el.textContent = text;
  const o = new CSS2DObject(el); o.position.set(m(x), m(ENV.ceiling), m(y)); overlay.add(o);
}
/** 316.5 -> 26'4½" (nearest half inch, no 12" roll-over). */
function ftin(inch) {
  const h = Math.round(inch * 2) / 2, ft = Math.floor(h / 12), i = h - ft * 12;
  return `${ft}'${Math.floor(i)}${i % 1 ? '½' : ''}"`;
}
const area = areaReport();
const BIG = 25; // sq ft: rooms at least this big get dimension lines, smaller ones get W × D in the label
const dims = []; // { a:[x,y], b:[x,y], off, text } — measured points, perpendicular offset of the dim line (inches)
for (const [key, r] of Object.entries(ROOMS)) {
  if (!r.label) continue;
  const [x0, y0, x1, y1] = r.r, name = r.label.split(' ')[0], big = area.rooms[key] >= BIG;
  label(big ? `${name} · ${Math.round(area.rooms[key])} sq ft` : `${name} ${ftin(x1 - x0)} × ${ftin(y1 - y0)}`, (x0 + x1) / 2, (y0 + y1) / 2);
  if (!big) continue;
  const inset = Math.min(30, (y1 - y0) / 4);
  dims.push({ a: [x0, y1 - inset], b: [x1, y1 - inset], off: 0, text: ftin(x1 - x0) });
  dims.push({ a: [x0 + inset, y0], b: [x0 + inset, y1], off: 0, text: ftin(y1 - y0) });
}
dims.push({ a: [0, 0], b: [ENV.w, 0], off: -16, text: `${ftin(ENV.w)} overall` });
dims.push({ a: [0, 0], b: [0, ENV.d], off: -16, text: `${ftin(ENV.d)} overall` });
for (const o of WALLS.find((w) => w.id === 'ext-west').openings) // slider + bedroom window widths, outside the deck-side wall
  dims.push({ a: [o.a, ENV.d], b: [o.b, ENV.d], off: o.id === 'slider' ? -10 : 14, text: `${o.id === 'slider' ? 'slider' : 'window'} ${ftin(o.b - o.a)}` });
const pct = ((area.grossSqFt / VIEW.listingSqFt - 1) * 100).toFixed(1);
label(`Gross ${ftin(ENV.w)} × ${ftin(ENV.d)} = ${area.grossSqFt} sq ft · listing ${VIEW.listingSqFt} sq ft (${pct > 0 ? '+' : ''}${pct}%) · deck excluded`, ENV.w / 2, -32, 'dim total');

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(SVGNS, 'svg'); svg.id = 'dimlines'; svg.setAttribute('aria-hidden', 'true'); app.appendChild(svg);
const mk = (tag, parent) => parent.appendChild(document.createElementNS(SVGNS, tag));
for (const d of dims) { d.g = mk('g', svg); d.path = mk('path', d.g); d.txt = mk('text', d.g); d.txt.textContent = d.text; }
const _v = new THREE.Vector3();
const toScreen = (x, y) => { _v.set(m(x), m(ENV.ceiling), m(y)).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; };
function drawDims() {
  for (const d of dims) {
    const horiz = d.a[1] === d.b[1], o = horiz ? [0, d.off] : [d.off, 0];
    const [ax, ay] = toScreen(d.a[0], d.a[1]), [bx, by] = toScreen(d.b[0], d.b[1]);
    const [px, py] = toScreen(d.a[0] + o[0], d.a[1] + o[1]), [qx, qy] = toScreen(d.b[0] + o[0], d.b[1] + o[1]);
    const t = 5, tick = (x, y) => `M${x - t} ${y + t}L${x + t} ${y - t}`; // 45° architectural tick
    const ext = d.off ? `M${ax} ${ay}L${px} ${py}M${bx} ${by}L${qx} ${qy}` : '';
    d.path.setAttribute('d', `M${px} ${py}L${qx} ${qy}${tick(px, py)}${tick(qx, qy)}${ext}`);
    const cx = (px + qx) / 2, cy = (py + qy) / 2;
    d.txt.setAttribute('transform', `translate(${cx} ${cy}) rotate(${horiz ? 0 : -90}) translate(0 -5)`);
  }
}
function setDims(on) {
  overlay.visible = on; labels.domElement.style.display = svg.style.display = on ? 'block' : 'none';
  $('dims').setAttribute('aria-pressed', on);
}

// ---------------------------------------------------------------- modes
const orbit = new OrbitControls(persp, renderer.domElement);
orbit.target.copy(center); orbit.maxPolarAngle = Math.PI / 2.05; orbit.enableDamping = true;
orbit.minDistance = 2; orbit.maxDistance = 40;
const planCtl = new OrbitControls(ortho, renderer.domElement);
planCtl.enableRotate = false; planCtl.screenSpacePanning = true; planCtl.minZoom = 0.6; planCtl.maxZoom = 8;
planCtl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
planCtl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
const walk = new PointerLockControls(persp, renderer.domElement);
const hint = $('hint');
const HINT = {
  dollhouse: 'Drag to orbit · scroll to zoom · drag furniture to move it',
  walk: 'Click to look around · WASD to walk · ←/→ turn · Esc releases the mouse',
  plan: 'Drag to pan · scroll to zoom · drag furniture · M toggles dimensions',
};
let mode;
function setMode(next) {
  mode = next;
  if (walk.isLocked) walk.unlock();
  select(null);
  const showCeil = next === 'walk';
  shell.userData.ceilings.visible = showCeil;
  scene.traverse((o) => { if (o.userData.hideInDollhouse) o.visible = showCeil; });
  orbit.enabled = next === 'dollhouse'; planCtl.enabled = next === 'plan';
  camera = next === 'plan' ? ortho : persp;
  renderPass.camera = camera; gtao.camera = camera;
  if (next === 'dollhouse') {
    const [x, e, y] = VIEW.dollPos;
    persp.fov = VIEW.dollFov; persp.position.set(m(x), m(e), m(y)); orbit.target.copy(center); persp.lookAt(center); orbit.update();
  }
  if (next === 'plan') {
    ortho.zoom = 1; ortho.updateProjectionMatrix();
    ortho.position.set(planCenter.x, 30, planCenter.z); ortho.up.set(0, 0, -1); planCtl.target.copy(planCenter); ortho.lookAt(planCenter); planCtl.update();
  }
  if (next === 'walk') {
    persp.fov = VIEW.walkFov; persp.position.set(m(VIEW.walkStart[0]), m(ENV.eye), m(VIEW.walkStart[1]));
    persp.lookAt(m(VIEW.walkLook[0]), m(ENV.eye - 6), m(VIEW.walkLook[1]));
  }
  persp.updateProjectionMatrix();
  if (next !== 'plan') setDims(false);
  hint.textContent = HINT[next];
  document.querySelectorAll('#ui [data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === next));
}
document.querySelectorAll('#ui [data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
const toggleDims = () => { if (mode !== 'plan') setMode('plan'); setDims(!overlay.visible); };
$('dims').addEventListener('click', toggleDims);
renderer.domElement.addEventListener('click', () => { if (mode === 'walk' && !walk.isLocked) walk.lock(); });
walk.addEventListener('lock', () => document.body.classList.add('locked'));
walk.addEventListener('unlock', () => document.body.classList.remove('locked'));

// help panel
const helpBtn = $('helpBtn'), helpPanel = $('help');
function toggleHelp(force) {
  const open = force ?? helpPanel.hidden; helpPanel.hidden = !open; helpBtn.setAttribute('aria-expanded', open);
}
helpBtn.addEventListener('click', () => toggleHelp());

// toolbar: roving arrow-key focus (WAI-ARIA toolbar pattern); Tab enters/leaves the toolbar, buttons stay natively clickable
const toolbar = $('ui'), tbButtons = [...toolbar.querySelectorAll('button')];
toolbar.addEventListener('keydown', (e) => {
  const i = tbButtons.indexOf(document.activeElement); if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tbButtons.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault(); e.stopPropagation();
  tbButtons[(j + tbButtons.length) % tbButtons.length].focus();
});

// ---------------------------------------------------------------- collision (2D, plan inches)
const hits = ([ax0, ay0, ax1, ay1], [bx0, by0, bx1, by1]) => ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
const box3 = new THREE.Box3();
function bounds6(obj) { box3.setFromObject(obj); const { min, max } = box3; return [min.x / IN, min.z / IN, max.x / IN, max.z / IN, min.y / IN, max.y / IN]; }
const footprint = (obj) => bounds6(obj).slice(0, 4);

const statics = wallColliders();
// closed doors block too (entry, linen, bypass closet doors); open swing doors are passable
for (const [id, d] of Object.entries(DOORS)) {
  if (!(d.openDeg === 0 || d.type?.startsWith('bypass'))) continue;
  const w = WALLS.find((q) => q.id === d.wall), o = w?.openings.find((q) => q.id === id); if (!o) continue;
  statics.push(w.axis === 'x' ? [o.a, w.c, o.b, w.c + w.t] : [w.c, o.a, w.c + w.t, o.b]);
}
// ponytail: built-ins (cabinets, appliances, tub, toilet, W/D, condenser, deck rail) are derived from the bounding boxes of the
// room modules' direct children that occupy body height; L-shaped/room-sized groups are skipped. Give modules explicit
// `userData.collider` rects if a piece ever needs finer control.
for (const mod of ['kitchen', 'bathroom', 'closets', 'deck']) {
  for (const c of scene.getObjectByName(mod)?.children ?? []) {
    const [x0, y0, x1, y1, e0, e1] = bounds6(c);
    if (!(e0 < 30 && e1 > 6) || (x1 - x0 > 40 && y1 - y0 > 40) || !isFinite(x0)) continue;
    statics.push([x0, y0, x1, y1]);
  }
}
const deckZone = [deckR[0], ENV.d - 24, deckR[2], deckR[3]]; // the deck, reached through the slider
const within = ([x0, y0, x1, y1], [X0, Y0, X1, Y1]) => x0 >= X0 && y0 >= Y0 && x1 <= X1 && y1 <= Y1;
const inside = (rect) => within(rect, [0, 0, ENV.w, ENV.d]) || within(rect, deckZone);
let fpCache = new Map(); // furniture footprints, invalidated whenever a piece moves
const fp = (f) => fpCache.get(f) ?? fpCache.set(f, footprint(f)).get(f);
const blocked = (rect, ignore) => !inside(rect) || statics.some((w) => hits(rect, w)) ||
  furniture.children.some((f) => f !== ignore && hits(rect, fp(f)));

// ---------------------------------------------------------------- walk
const keys = new Set();
const isTyping = (e) => e.target.closest?.('#ui, #help');
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const dir = new THREE.Vector3(), right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function stepWalk(dt) {
  if (mode !== 'walk' || shotName) return;
  const k = (...c) => (c.some((x) => keys.has(x)) ? 1 : 0);
  const turn = k('ArrowLeft', 'KeyQ') - k('ArrowRight', 'KeyE');
  if (turn) persp.rotateOnWorldAxis(UP, turn * VIEW.turnSpeed * dt);
  const f = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), s = k('KeyD') - k('KeyA');
  if (!f && !s) return;
  persp.getWorldDirection(dir); dir.y = 0; dir.normalize(); right.crossVectors(dir, UP);
  const v = dir.multiplyScalar(f).add(right.multiplyScalar(s)).normalize().multiplyScalar(VIEW.walkSpeed * dt);
  const R = VIEW.bodyR;
  for (const axis of ['x', 'z']) { // resolve axes independently so the walker slides along walls and furniture
    const p = persp.position.clone(); p[axis] += v[axis];
    const px = p.x / IN, py = p.z / IN;
    if (!blocked([px - R, py - R, px + R, py + R])) persp.position[axis] = p[axis];
  }
  persp.position.y = m(ENV.eye);
}

// ---------------------------------------------------------------- furniture: select, drag, rotate, nudge, reset
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), floorPlane = new THREE.Plane(UP, 0);
let selected = null, dragging = null, downAt = null;
const grab = new THREE.Vector3(), at = new THREE.Vector3();
const halo = new THREE.BoxHelper(undefined, VIEW.highlight); halo.visible = false; halo.material.depthTest = false; halo.renderOrder = 10; scene.add(halo);
const status = $('status');
function select(obj) {
  selected = obj; halo.visible = !!obj;
  if (obj) halo.setFromObject(obj);
  $('rotate').disabled = !obj;
  status.textContent = obj ? `${obj.name} selected — drag or arrow keys to move, R to rotate, Esc to deselect` : '';
}
const onCarpet = (x, y) => [ROOMS.bedroom.r, ROOMS.bedCloset.r].some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
/** Try to move a piece by (dx, dz) metres: axis-separated so it slides along obstacles; never leaves the floor. */
function moveBy(obj, dx, dz) {
  const wasStuck = blocked(fp(obj), obj); // a piece that already overlaps something may always be pulled free
  for (const [axis, d] of [['x', dx], ['z', dz]]) {
    if (!d) continue;
    for (const k of [1, 0.5, 0.25, 0.125]) { // on contact retry shorter steps so the piece closes up to the obstacle
      obj.position[axis] += d * k; fpCache.delete(obj);
      if (wasStuck || !blocked(fp(obj), obj)) break;
      obj.position[axis] -= d * k; fpCache.delete(obj);
    }
  }
  obj.position.y = onCarpet(obj.position.x / IN, obj.position.z / IN) ? m(ENV.carpetT) : 0;
  halo.setFromObject(obj);
}
function rotateSelected() {
  if (!selected) return;
  selected.rotation.y += Math.PI / 2; fpCache.delete(selected);
  if (blocked(fp(selected), selected)) { selected.rotation.y -= Math.PI / 2; fpCache.delete(selected); status.textContent = `No room to rotate the ${selected.name} here`; }
  halo.setFromObject(selected);
}
const setPtr = (e) => { ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); };
const pick = (e) => {
  setPtr(e);
  const hit = ray.intersectObjects(furniture.children, true)[0];
  let o = hit?.object; while (o && !o.userData.draggable) o = o.parent;
  return o ? { obj: o, hit } : null;
};
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode === 'walk' || e.button !== 0) return;
  const p = pick(e); if (!p) { select(null); return; }
  select(p.obj); dragging = p.obj; downAt = [e.clientX, e.clientY];
  ray.ray.intersectPlane(floorPlane, grab); grab.sub(dragging.position); grab.y = 0;
  orbit.enabled = planCtl.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});
addEventListener('pointermove', (e) => {
  if (!dragging) { if (mode !== 'walk') renderer.domElement.style.cursor = pick(e) ? 'grab' : ''; return; }
  renderer.domElement.style.cursor = 'grabbing';
  setPtr(e); if (!ray.ray.intersectPlane(floorPlane, at)) return;
  moveBy(dragging, at.x - grab.x - dragging.position.x, at.z - grab.z - dragging.position.z);
});
addEventListener('pointerup', (e) => {
  if (!dragging) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4;
  if (!moved) { let o = pick(e)?.hit.object; while (o && !o.userData.onClick) o = o.parent; o?.userData.onClick(); }
  dragging = null; orbit.enabled = mode === 'dollhouse'; planCtl.enabled = mode === 'plan';
});
function resetFurniture() {
  furniture.children.forEach((g) => { const D = FURNITURE[g.userData.key]; place(g, D.pos[0], D.pos[1], g.position.y / IN, D.rot); g.position.y = onCarpet(D.pos[0], D.pos[1]) ? m(ENV.carpetT) : 0; });
  fpCache = new Map(); select(null); status.textContent = 'Furniture reset';
}
$('reset').addEventListener('click', resetFurniture);
$('rotate').addEventListener('click', rotateSelected);

// keyboard: shortcuts + keyboard-only furniture editing (N = next piece, arrows nudge in plan axes)
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Escape') { toggleHelp(false); select(null); return; }
  if (isTyping(e) && (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Enter')) return; // toolbar owns these
  keys.add(e.code);
  const go = { Digit1: 'dollhouse', Digit2: 'walk', Digit3: 'plan' }[e.code];
  if (go) return setMode(go);
  if (e.code === 'KeyM') return toggleDims();
  if (e.code === 'KeyH' || e.key === '?') return toggleHelp();
  if (mode === 'walk') { if (e.code.startsWith('Arrow')) e.preventDefault(); return; }
  if (e.code === 'KeyR') return rotateSelected();
  if (e.code === 'KeyN') { const f = furniture.children; return select(f[(f.indexOf(selected) + 1) % f.length]); }
  const step = m(e.shiftKey ? VIEW.nudgeBig : VIEW.nudge);
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.code];
  if (d && selected) { e.preventDefault(); moveBy(selected, d[0], d[1]); }
});

// ---------------------------------------------------------------- shots
function applyShot(name) {
  const s = SHOTS[name]; if (!s) throw new Error(`unknown shot "${name}" — see src/shots.js`);
  document.body.classList.add('shot');
  setMode('walk');
  persp.fov = s.vfov; persp.position.set(m(s.pos[0]), m(s.pos[2]), m(s.pos[1]));
  persp.lookAt(m(s.target[0]), m(s.target[2]), m(s.target[1]));
  for (const [id, deg] of Object.entries(s.doors ?? {})) { // the photos were taken with doors in different states (e.g. W/D door shut in IMG_3933)
    const leaf = scene.getObjectByName(`door:${id}:leaf`);
    if (!leaf) continue;
    if (DOORS[id]?.openDeg) leaf.rotation.y *= deg / DOORS[id].openDeg; // keeps the module's swing direction
    else leaf.rotation.y = THREE.MathUtils.degToRad(deg); // door modelled shut: value is the signed leaf angle
  }
  if (s.roll) persp.rotateZ(THREE.MathUtils.degToRad(s.roll)); // handheld photos are rarely level
  persp.updateProjectionMatrix();
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
  if (overlay.visible) { labels.render(scene, camera); drawDims(); }
  if (++frames === 8) window.__ready = true; // tools/shot.mjs waits for this
});

// Debug/measurement hook for tools/*.mjs and critics.
window.__apt = {
  THREE, scene, renderer, SHOTS, area, failed, furniture,
  get camera() { return camera; }, get mode() { return mode; }, get selected() { return selected?.name ?? null; },
  setMode, blocked, colliders: statics,
  find: (name) => scene.getObjectByName(name),
  names: () => { const n = []; scene.traverse((o) => o.name && n.push(o.name)); return n; },
  size: (name) => { const o = scene.getObjectByName(name); return o ? sizeInches(o) : null; },
  bounds: (name) => { // plan-space inches: [x0, y0, x1, y1, elev0, elev1]
    const o = scene.getObjectByName(name); if (!o) return null;
    return bounds6(o).map((v) => Math.round(v * 100) / 100);
  },
  eye: () => [persp.position.x / IN, persp.position.z / IN, persp.position.y / IN].map((v) => Math.round(v * 10) / 10), // plan x, y, elev
  /** Screen pixel of a plan-space point (for Playwright pointer tests). */
  screen: (x, y, elev = 0) => { const v = new THREE.Vector3(m(x), m(elev), m(y)).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: null }),
};
