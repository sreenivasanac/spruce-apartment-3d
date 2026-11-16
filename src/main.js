// Viewer: renderer + post, three view modes (dollhouse / walk / plan), furniture drag, ?shot= poses.
// Feature UI lives in src/viewer/* (plan overlay, cabinet panel, info card, tape measure, lights, tour); each gets the
// viewer context `V` defined below.
// Rendering is ON DEMAND: a frame is drawn only after input, while something animates, or while the camera moves.
// Shadow maps are static and re-rendered only when something that casts a shadow has moved (see shadowsDirty()).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { ENV, ROOMS, WALLS, DOORS, FURNITURE, floorAt, m, IN } from './dimensions.js';
import { buildApartment, failed, timings } from './apartment.js';
import { wallColliders, areaReport } from './shell.js';
import { MAT } from './materials.js';
import { sizeInches, place } from './lib/build.js';
import { SHOTS } from './shots.js';
import { createPlanOverlay } from './viewer/planOverlay.js';
import { createCabinetPanel } from './viewer/cabinetPanel.js';
import { createLightsPanel } from './viewer/lightsPanel.js';
import { createInfo } from './viewer/info.js';
import { createMeasure } from './viewer/measure.js';
import { createTour } from './viewer/tour.js';

// ---------------------------------------------------------------- viewer tuning (not real-world sizes)
const VIEW = {
  listingSqFt: 676,
  walkSpeed: 1.3, // m/s, a stroll
  turnSpeed: 1.6, // rad/s for keyboard turning in walk mode
  bodyR: 8, // walker half-width, inches (16" body passes the 26" bath door)
  walkStart: [150, 44], walkLook: [205, 290], walkFov: 72, // inside the entry, past the open washer/dryer door, facing the living room
  dollFov: 42, dollPos: [300, 590, 530], // plan x, elevation, plan y (inches): from above the deck/SW corner
  planMargin: 44, // inches of paper around envelope + deck in plan view
  nudge: 1, nudgeBig: 6, // keyboard furniture nudge, inches
  highlight: 0xffb020,
  settleMs: 250, // keep rendering this long after the last input, so damping and hover states finish
  animMs: 3000, // longest open/close animation (staggered cabinet doors); frames + shadows refresh for this long after a click
  mirrorRange: 5, // metres: planar mirror reflections are only re-rendered when the walker is this close
};

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const app = document.getElementById('app');
const $ = (id) => document.getElementById(id);

// Quality tier. Phones and tablets (coarse pointer) get a lighter setup; they are view-only (no Walk, no furniture drag).
const TOUCH = matchMedia('(pointer: coarse)').matches && !shotName;
const QUALITY = TOUCH
  ? { maxDpr: 1.5, sunMap: 2048, mirrors: false }
  : { maxDpr: 2, sunMap: 4096, mirrors: true };
const AO_SCALE = 0.5; // ambient occlusion is low-frequency: on HiDPI screens it is computed at half resolution
document.body.classList.toggle('touch', TOUCH);

// ---------------------------------------------------------------- renderer + post
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!shotName });
renderer.setPixelRatio(shotName ? 1 : Math.min(devicePixelRatio, QUALITY.maxDpr));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // static shadows: see shadowsDirty()
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', '3D view of the apartment');
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
app.appendChild(labels.domElement);

const scene = new THREE.Scene();
const labelScene = new THREE.Scene(); // CSS2D labels only (room names, size tags, tape readout): cheap to traverse every frame
const persp = new THREE.PerspectiveCamera(60, 1, 0.05, 300);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
let camera = persp;

const tBuild = performance.now();
const { root, shell, furniture } = await buildApartment({ scene, renderer });
timings.build = Math.round(performance.now() - tBuild);
scene.add(root);
const deckR = ROOMS.deck.r;
const center = new THREE.Vector3(m(ENV.w / 2), 0, m(ENV.d / 2 + 20)); // orbit pivot, nudged toward the deck
const planCenter = new THREE.Vector3(m(ENV.w / 2), 0, m(deckR[3] / 2)); // envelope + deck
const lightingGroup = scene.getObjectByName('lighting');
const sun = scene.getObjectByName('sun');
if (sun) sun.shadow.mapSize.setScalar(QUALITY.sunMap);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const gtao = new GTAOPass(scene, camera);
gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1 });
composer.addPass(renderPass); composer.addPass(gtao); composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight, a = w / h, pr = renderer.getPixelRatio();
  renderer.setSize(w, h); composer.setSize(w, h); labels.setSize(w, h);
  if (pr > 1.25) gtao.setSize(Math.round(w * pr * AO_SCALE), Math.round(h * pr * AO_SCALE));
  persp.aspect = a; persp.updateProjectionMatrix();
  // plan view fits envelope + deck + margin in both directions
  const span = Math.max(m(deckR[3] + 2 * VIEW.planMargin) / 2, m(ENV.w + 2 * VIEW.planMargin) / 2 / a);
  Object.assign(ortho, { left: -span * a, right: span * a, top: span, bottom: -span }); ortho.updateProjectionMatrix();
  invalidate();
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- on-demand rendering + static shadows
let renderUntil = 0, animUntil = 0, shadowStale = true;
/** Ask for frames for the next `ms` milliseconds. */
function invalidate(ms = VIEW.settleMs) { renderUntil = Math.max(renderUntil, performance.now() + ms); }
/** Something that casts a shadow moved or changed: refresh the shadow maps on the next frame. */
function shadowsDirty() { shadowStale = true; invalidate(); }
/** An open/close animation was started: keep drawing frames and refreshing shadows until it has finished. */
function animating(ms = VIEW.animMs) { animUntil = Math.max(animUntil, performance.now() + ms); invalidate(ms); }
for (const type of ['pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup', 'click', 'change', 'focus']) addEventListener(type, () => invalidate(), { capture: true, passive: true });
addEventListener('pointermove', (e) => { if (e.buttons) invalidate(); }, { passive: true });
document.addEventListener('visibilitychange', () => invalidate());

// Planar mirrors (vanity, bedroom closet) re-render the whole scene. They are only live in Walk mode, near the walker;
// elsewhere a plain mirror-finish stand-in is shown.
const mirrors = [];
root.traverse((o) => { if (o.type === 'Reflector') mirrors.push(o); });
for (const refl of mirrors) {
  const standIn = new THREE.Mesh(refl.geometry, MAT.mirror); standIn.name = `${refl.name}:standin`;
  standIn.position.copy(refl.position); standIn.quaternion.copy(refl.quaternion); standIn.scale.copy(refl.scale);
  refl.parent.add(standIn); refl.userData.standIn = standIn;
  const render = refl.onBeforeRender, at = new THREE.Vector3();
  refl.onBeforeRender = function (r, sc, cam, ...rest) { // keep the last reflection when the walker is far away
    if (refl.getWorldPosition(at).distanceTo(cam.position) < VIEW.mirrorRange) render.call(this, r, sc, cam, ...rest);
  };
}
function setMirrors(live) { for (const refl of mirrors) { refl.visible = live; refl.userData.standIn.visible = !live; } }

// ---------------------------------------------------------------- plan overlay (room labels + dimension lines)
const area = areaReport();
const plan = createPlanOverlay({ app, labelScene, getCamera: () => camera, area, listingSqFt: VIEW.listingSqFt });
function setDims(on) { plan.setVisible(on); $('dims').setAttribute('aria-pressed', on); invalidate(); }

// ---------------------------------------------------------------- modes
const orbit = new OrbitControls(persp, renderer.domElement);
orbit.target.copy(center); orbit.maxPolarAngle = Math.PI / 2.05; orbit.enableDamping = true;
orbit.minDistance = 2; orbit.maxDistance = 60;
const planCtl = new OrbitControls(ortho, renderer.domElement);
planCtl.enableRotate = false; planCtl.screenSpacePanning = true; planCtl.minZoom = 0.6; planCtl.maxZoom = 8;
planCtl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
planCtl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
const walk = new PointerLockControls(persp, renderer.domElement);
for (const c of [orbit, planCtl, walk]) c.addEventListener('change', () => invalidate());
const hint = $('hint');
const HINT = {
  dollhouse: TOUCH ? 'Drag to orbit · pinch to zoom · tap furniture for its size · tap doors and cabinets to open them'
    : 'Drag to orbit · scroll to zoom · drag furniture to move it · click a piece for its size, doors and cabinets to open them',
  walk: 'Click to look around · WASD to walk · ←/→ turn · F use doors/furniture · C next cabinet · Esc releases the mouse',
  plan: TOUCH ? 'Drag to pan · pinch to zoom · Dimensions shows room sizes' : 'Drag to pan · scroll to zoom · drag furniture · M toggles dimensions',
};
let mode;
/** Portrait screens see less width at the same vertical FOV: back the dollhouse camera off so the whole plan fits. */
const dollFit = () => Math.max(1, 1.2 / (innerWidth / innerHeight));
function setMode(next) {
  if (next === 'walk' && TOUCH && !V.cinematic) next = 'dollhouse'; // Walk needs a keyboard
  mode = next; flight = null;
  if (walk.isLocked) walk.unlock();
  select(null);
  const showCeil = next === 'walk';
  shell.userData.ceilings.visible = showCeil;
  scene.traverse((o) => { if (o.userData.hideInDollhouse) o.visible = showCeil; });
  setMirrors(showCeil && QUALITY.mirrors);
  orbit.enabled = next === 'dollhouse'; planCtl.enabled = next === 'plan';
  camera = next === 'plan' ? ortho : persp;
  renderPass.camera = camera; gtao.camera = camera;
  if (next === 'dollhouse') {
    const [x, e, y] = VIEW.dollPos;
    persp.fov = VIEW.dollFov; persp.position.set(m(x), m(e), m(y)).sub(center).multiplyScalar(dollFit()).add(center); orbit.target.copy(center); persp.lookAt(center); orbit.update();
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
  walkHud.hidden = next !== 'walk'; aimed = null; actionEl.hidden = true;
  document.querySelectorAll('#ui [data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === next));
  shadowsDirty(); // the ceiling and its shadow-only roof just appeared or disappeared
}
document.querySelectorAll('#ui [data-mode]').forEach((b) => b.addEventListener('click', () => { tour.exit(); setMode(b.dataset.mode); }));
const toggleDims = () => { tour.exit(); if (mode !== 'plan') setMode('plan'); setDims(!plan.visible); };
$('dims').addEventListener('click', toggleDims);
renderer.domElement.addEventListener('click', () => {
  if (mode !== 'walk' || V.cinematic) return;
  if (!walk.isLocked) walk.lock();
  else if (measure.active) measure.click(pickPoint()); // locked: measure to the point under the crosshair
});
walk.addEventListener('lock', () => document.body.classList.add('locked'));
walk.addEventListener('unlock', () => document.body.classList.remove('locked'));

// help panel
const helpBtn = $('helpBtn'), helpPanel = $('help');
function toggleHelp(force) {
  const open = force ?? helpPanel.hidden; helpPanel.hidden = !open; helpBtn.setAttribute('aria-expanded', open);
  if (open) lights.toggle(false);
}
helpBtn.addEventListener('click', () => toggleHelp());

// toolbar: roving arrow-key focus (WAI-ARIA toolbar pattern); Tab enters/leaves the toolbar, buttons stay natively clickable
const toolbar = $('ui'), tbButtons = () => [...toolbar.querySelectorAll('button')].filter((b) => b.offsetParent);
toolbar.addEventListener('keydown', (e) => {
  const btns = tbButtons(), i = btns.indexOf(document.activeElement); if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: btns.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault(); e.stopPropagation();
  btns[(j + btns.length) % btns.length].focus();
});

// ---------------------------------------------------------------- camera flights (tour stops, "look at it")
let flight = null;
const ease = (t) => t * t * (3 - 2 * t);
/** Fly the perspective camera to a pose. pos / target are plan inches [x, y, elevation]; ms = 0 cuts. */
function fly({ pos, target, fov = persp.fov, ms = 1600 }) {
  const p1 = new THREE.Vector3(m(pos[0]), m(pos[2]), m(pos[1])), look = new THREE.Vector3(m(target[0]), m(target[2]), m(target[1]));
  const probe = persp.clone(); probe.position.copy(p1); probe.lookAt(look);
  flight = { p0: persp.position.clone(), q0: persp.quaternion.clone(), f0: persp.fov, p1, q1: probe.quaternion.clone(), f1: fov, look, t: 0, ms };
  if (!ms) stepFlight(0);
  invalidate();
}
function stepFlight(dt) {
  if (!flight) return;
  const f = flight;
  f.t = f.ms ? Math.min(1, f.t + (dt * 1000) / f.ms) : 1;
  const k = ease(f.t);
  persp.position.lerpVectors(f.p0, f.p1, k); persp.quaternion.slerpQuaternions(f.q0, f.q1, k);
  persp.fov = f.f0 + (f.f1 - f.f0) * k; persp.updateProjectionMatrix();
  if (f.t >= 1) { flight = null; if (mode === 'dollhouse') { orbit.target.copy(f.look); orbit.update(); } }
  invalidate();
}

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
const isTyping = (e) => e.target.closest?.('#ui, #help, #cabinets, #lights, #info, #tour, #intro');
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const dir = new THREE.Vector3(), right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function stepWalk(dt) {
  if (mode !== 'walk' || shotName || V.cinematic) return;
  const k = (...c) => (c.some((x) => keys.has(x)) ? 1 : 0);
  const turn = k('ArrowLeft', 'KeyQ') - k('ArrowRight', 'KeyE');
  if (turn) persp.rotateOnWorldAxis(UP, turn * VIEW.turnSpeed * dt);
  const f = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), s = k('KeyD') - k('KeyA');
  if (turn || f || s) invalidate();
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
const say = (text) => { status.textContent = text; };
function select(obj) {
  selected = obj; halo.visible = !!obj;
  if (obj) halo.setFromObject(obj);
  $('rotate').disabled = !obj;
  info.show(obj);
  say(obj && !TOUCH ? 'Drag or arrow keys to move, R to rotate, Esc to deselect' : '');
  invalidate();
}
/** A furniture piece moved, turned or changed shape: drop its cached footprint, refresh highlight, info card and shadows. */
function moved(obj) {
  fpCache.delete(obj);
  if (selected === obj) { halo.setFromObject(obj); info.refresh(); }
  lightingGroup?.userData.lighting?.refreshShadows();
  shadowsDirty();
}
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
  obj.position.y = m(floorAt(obj.position.x / IN, obj.position.z / IN));
  moved(obj);
}
function rotateSelected() {
  if (!selected) return;
  selected.rotation.y += Math.PI / 2; fpCache.delete(selected);
  if (blocked(fp(selected), selected)) { selected.rotation.y -= Math.PI / 2; say('No room to rotate it here'); }
  moved(selected);
}
const setPtr = (e) => { ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); };
/** Raycaster hits include hidden objects (ceilings in dollhouse view) and shadow-only helpers: keep what is actually drawn. */
const drawn = (o) => { if (!o.isMesh || [].concat(o.material).every((q) => q.visible === false || q.colorWrite === false)) return false; for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const firstHit = (objects) => ray.intersectObjects(objects, true).find((h) => drawn(h.object));
const pick = (e) => {
  setPtr(e);
  const hit = firstHit(furniture.children);
  let o = hit?.object; while (o && !o.userData.draggable) o = o.parent;
  return o ? { obj: o, hit } : null;
};
/** World point on the nearest visible surface under the pointer (or under the crosshair when no event is given). */
function pickPoint(e) {
  if (e) setPtr(e); else ray.setFromCamera(centre, persp);
  const hit = firstHit([root]);
  return hit && hit.distance < 60 ? hit.point : null; // beyond 60 m is the sky dome
}
const actionTarget = (o) => { while (o && !o.userData.onClick) o = o.parent; return o; };
let pendingClick = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode === 'walk' || e.button !== 0 || V.cinematic) return;
  if (measure.active) { pendingClick = { measure: true, at: [e.clientX, e.clientY] }; return; }
  const p = pick(e);
  if (!p || TOUCH) { // touch: a drag always orbits; a tap selects / opens
    const hit = p ? null : firstHit(clickables); // ray already set by pick()
    pendingClick = p || hit ? { target: p ? p.obj : actionTarget(hit.object), furniture: !!p, at: [e.clientX, e.clientY] } : { at: [e.clientX, e.clientY] };
    return;
  }
  select(p.obj); dragging = p.obj; downAt = [e.clientX, e.clientY];
  ray.ray.intersectPlane(floorPlane, grab); grab.sub(dragging.position); grab.y = 0;
  orbit.enabled = planCtl.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});
let hoverAt = 0;
addEventListener('pointermove', (e) => {
  if (!dragging) {
    if (mode === 'walk' || e.buttons || e.target !== renderer.domElement || performance.now() - hoverAt < 40) return; // hover ray-casts are throttled
    hoverAt = performance.now();
    if (measure.active) measure.hover(pickPoint(e)); else renderer.domElement.style.cursor = pick(e) ? 'grab' : '';
    return;
  }
  renderer.domElement.style.cursor = 'grabbing';
  setPtr(e); if (!ray.ray.intersectPlane(floorPlane, at)) return;
  moveBy(dragging, at.x - grab.x - dragging.position.x, at.z - grab.z - dragging.position.z);
});
addEventListener('pointerup', (e) => {
  if (pendingClick) { // a click (not an orbit drag): tape point, door etc., or (touch) a furniture piece
    const c = pendingClick; pendingClick = null;
    if (Math.hypot(e.clientX - c.at[0], e.clientY - c.at[1]) > (TOUCH ? 10 : 4)) return;
    if (c.measure) measure.click(pickPoint(e));
    else if (c.furniture) { const again = selected === c.target; select(c.target); if (again || !TOUCH) use(c.target); } // touch: first tap shows the card, second tap opens
    else { select(null); use(c.target); }
  }
  if (!dragging) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4;
  if (!moved) use(actionTarget(pick(e)?.hit.object));
  dragging = null; orbit.enabled = mode === 'dollhouse'; planCtl.enabled = mode === 'plan';
});
function resetFurniture() {
  furniture.children.forEach((g) => { const D = FURNITURE[g.userData.key]; place(g, D.pos[0], D.pos[1], g.position.y / IN, D.rot); g.position.y = m(floorAt(D.pos[0], D.pos[1])); });
  fpCache = new Map(); select(null); say('Furniture reset');
  lightingGroup?.userData.lighting?.refreshShadows(); shadowsDirty();
}
$('reset').addEventListener('click', resetFurniture);
$('rotate').addEventListener('click', rotateSelected);

// keyboard: shortcuts + keyboard-only furniture editing (N = next piece, arrows nudge in plan axes)
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (tour.introOpen) { if (e.code === 'Escape') tour.closeIntro(); return; }
  if (tour.active && tour.key(e)) { e.preventDefault(); return; }
  if (e.code === 'Escape') { toggleHelp(false); lights.toggle(false); if (measure.active) measure.setActive(false); else select(null); return; }
  if (isTyping(e) && (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Enter')) return; // toolbar owns these
  keys.add(e.code);
  const go = { Digit1: 'dollhouse', Digit2: 'walk', Digit3: 'plan' }[e.code];
  if (go) { tour.exit(); return setMode(go); }
  if (e.code === 'KeyM') return toggleDims();
  if (e.code === 'KeyP') return tour.active ? tour.exit() : tour.start();
  if (tour.active) return;
  if (e.code === 'KeyT') return measure.setActive(!measure.active);
  if (e.code === 'KeyL') { toggleHelp(false); return lights.toggle(); }
  if (e.code === 'KeyH' || e.key === '?') return toggleHelp();
  if (e.code === 'KeyC') return cabinets.cycle();
  if (e.code === 'KeyG') return lookAt(cab);
  if (e.code === 'KeyF' && mode === 'walk') return use(aimed);
  if (mode === 'walk') { if (e.code.startsWith('Arrow')) e.preventDefault(); return; }
  if (e.code === 'KeyR') return rotateSelected();
  if (e.code === 'KeyN') { const f = furniture.children; return select(f[(f.indexOf(selected) + 1) % f.length]); }
  const step = m(e.shiftKey ? VIEW.nudgeBig : VIEW.nudge);
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.code];
  if (d && selected) { e.preventDefault(); moveBy(selected, d[0], d[1]); }
});

// ---------------------------------------------------------------- interaction: doors, coffee table, futon, wardrobe, cabinet
const ACTION_DEFAULT = { shoeRack: 'Toggle the shoe rack 9 ⇄ 10 tiers', shed: 'Open / close the storage shed', liftTop: 'Raise / lower the coffee-table top', futon: 'Fold the futon sofa ⇄ bed', wardrobe: 'Open / close the wardrobe doors' };
const actionLabel = (o) => o.userData.actionLabel ?? ACTION_DEFAULT[o.userData.key] ?? `Use the ${o.name}`;
function use(o) {
  if (!o?.userData.onClick) return;
  o.userData.onClick();
  say(actionLabel(o));
  animating();
  if (o.userData.draggable) moved(o); // e.g. the shoe rack changes height
}
// walk mode: whatever interactive thing is under the crosshair within reach can be used with F
const REACH = 2.6, centre = new THREE.Vector2(0, 0), walkHud = $('walkhud'), actionEl = $('action'), _v = new THREE.Vector3();
let aimed = null, aimFrame = 0;
function updateAim() {
  if (mode !== 'walk' || V.cinematic || ++aimFrame % 6) return;
  // bounding-box test, not mesh hits: louvered doors and open shelving are mostly holes, and the box is what you "point at"
  ray.setFromCamera(centre, persp);
  let best = REACH;
  aimed = null;
  for (const o of [...clickables, ...furniture.children]) {
    if (!o.userData.onClick || !o.visible) continue;
    const p = ray.ray.intersectBox(box3.setFromObject(o), _v);
    const d = p ? p.distanceTo(ray.ray.origin) : Infinity;
    if (d < best) { best = d; aimed = o; }
  }
  actionEl.hidden = !aimed;
  if (aimed) actionEl.querySelector('span').textContent = actionLabel(aimed);
}

/** Frame a piece: dollhouse orbits around it, walk mode stands you ~7 ft in front of it. */
function lookAt(obj) {
  if (!obj?.children.length) return;
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
  const front = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion); // the piece's +Z
  const inch = (v) => v / IN;
  if (mode === 'walk') {
    persp.position.set(c.x + front.x * m(84), m(ENV.eye), c.z + front.z * m(84));
    persp.lookAt(c.x, m(40), c.z); invalidate();
  } else {
    if (mode !== 'dollhouse') setMode('dollhouse');
    fly({ pos: [inch(c.x + front.x * m(110) - front.z * m(40)), inch(c.z + front.z * m(110) + front.x * m(40)), 95], target: [inch(c.x), inch(c.z), 30], ms: 900 });
  }
}

// ---------------------------------------------------------------- viewer context shared with src/viewer/*
const V = {
  scene, labelScene, furniture, cinematic: false, compact: TOUCH || innerWidth < 700,
  get mode() { return mode; }, get selected() { return selected; },
  setMode, fly, lookAt, select, use, moved, say, invalidate, animating, shadowsDirty, blocked, fp, actionLabel, rotateSelected,
};
const info = createInfo(V);
const measure = createMeasure(V);
const lights = createLightsPanel(V, lightingGroup); // also makes the fixtures clickable, so it must run before `clickables` is collected
const cab = furniture.children.find((f) => f.userData.key === 'cabinet');
const cabinets = createCabinetPanel(V, cab);
const tour = createTour(V, { cabinets });
/** Non-furniture interactive objects (doors, washer/dryer door, light fixtures): anything outside `furniture` with userData.onClick. */
const clickables = []; root.traverse((o) => { if (o.userData.onClick && !o.userData.draggable) clickables.push(o); });

// ---------------------------------------------------------------- shots
function applyShot(name) {
  const s = SHOTS[name]; if (!s) throw new Error(`unknown shot "${name}" — see src/shots.js`);
  document.body.classList.add('shot');
  setMode('walk');
  persp.fov = s.vfov; persp.position.set(m(s.pos[0]), m(s.pos[2]), m(s.pos[1]));
  persp.lookAt(m(s.target[0]), m(s.target[2]), m(s.target[1]));
  for (const [id, deg] of Object.entries(s.doors ?? {})) { // the photos were taken with doors in different states (e.g. W/D door shut in IMG_3933)
    if (typeof deg === 'string') { scene.getObjectByName(`door:${id}`)?.userData.setBypass?.(deg); continue; } // sliding doors: 'left' | 'right' | 'closed'
    const leaf = scene.getObjectByName(`door:${id}:leaf`);
    if (!leaf) continue;
    if (DOORS[id]?.openDeg) leaf.rotation.y *= deg / DOORS[id].openDeg; // keeps the module's swing direction
    else leaf.rotation.y = THREE.MathUtils.degToRad(deg); // door modelled shut: value is the signed leaf angle
  }
  if (s.hide) scene.traverse((o) => { if (s.hide.some((p) => o.name.startsWith(p))) o.visible = false; }); // cutaway shots: hide objects by name prefix
  if (s.roll) persp.rotateZ(THREE.MathUtils.degToRad(s.roll)); // handheld photos are rarely level
  persp.updateProjectionMatrix();
}

// ---------------------------------------------------------------- loop
resize();
const view = params.get('view');
if (shotName) applyShot(shotName); else setMode(['walk', 'plan'].includes(view) ? view : 'dollhouse');
if (params.has('dims')) setDims(true);
if (shotName || view) document.body.classList.toggle('shot', params.has('clean') || !!shotName);
if (params.get('time')) lights.setTime(params.get('time'), false); // ?time=day|evening|night
const tooling = shotName || view || params.has('clean');
if (!tooling) tour.maybeIntro();
if (params.has('tour')) { tour.closeIntro(); tour.start(); }

const clock = new THREE.Clock(); let frames = 0;
const tickers = []; scene.traverse((o) => { if (o.userData.tick) tickers.push(o); });
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
  stepWalk(dt);
  stepFlight(dt);
  if (orbit.enabled && !flight) orbit.update(); // damping keeps firing 'change' (-> invalidate) until it settles
  if (frames >= 8 && now > renderUntil) return; // nothing changed: skip the frame
  updateAim();
  tickers.forEach((o) => o.userData.tick(dt));
  if (shadowStale || now < animUntil) { renderer.shadowMap.needsUpdate = true; shadowStale = false; }
  composer.render();
  labels.render(labelScene, camera); plan.draw();
  if (frames === 0) { timings.total = Math.round(performance.now()); timings.firstFrame = timings.total - Math.round(tBuild) - timings.build; $('loading').classList.add('done'); }
  if (++frames === 8) window.__ready = true; // tools/shot.mjs waits for this
});
if (shotName) setInterval(() => invalidate(1000), 500); // screenshot tooling: keep frames flowing in a hidden / throttled tab

// Debug/measurement hook for tools/*.mjs and critics.
window.__apt = {
  THREE, scene, renderer, composer, gtao, SHOTS, area, failed, timings, furniture, tour, measure, lights, cabinets, V,
  get camera() { return camera; }, get mode() { return mode; }, get selected() { return selected?.name ?? null; },
  setMode, blocked, colliders: statics, setCabinet: cabinets.set, use: (name) => use(actionTarget(scene.getObjectByName(name))),
  invalidate, select: (name) => select(scene.getObjectByName(name) ?? null),
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), // of the last pass; set renderer.info.autoReset = false to total a frame
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
};
