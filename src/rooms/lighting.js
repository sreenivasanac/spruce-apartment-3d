// light fixtures + all scene lights, sun, environment
// Contract: build(ctx) returns a THREE.Group in WORLD coordinates. ctx = { scene, renderer }.
// Look: 6:20 PM golden hour (refs IMG_3933/3935/3937) — low WSW sun through slider + bedroom window, cool sky fill
// from the glazing, every real fixture switched on (warm LED), soft IBL/hemisphere bounce.
// Shadow budget: sun (every frame) + kitchen oval + hall dome (static cube shadows, refreshed only when furniture moves).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ENV, X, Y, SLIDER, BED_WINDOW, BATH, KITCHEN, FIXTURES as F, SUN, m } from '../dimensions.js';
import { MAT, rng } from '../materials.js';
import { box, cyl, group } from '../lib/build.js';

/** Viewer wiring: tone-mapping exposure + IBL strength that the light intensities below were tuned for. */
export const RENDER = { exposure: 1.0, envIntensity: 0.3 };

// Tuning (not real-world sizes). Colours are camera-white-balanced, i.e. 2700-3000 K as the photos show it.
const WARM = 0xffe2c2, LED_STRIP = 0xffc98e, SKY = 0xcfe0f5, SUN_COLOR = 0xffc995;
const P = (x, y, elev) => new THREE.Vector3(m(x), m(elev), m(y)); // plan inches -> world

const lens = (k) => Object.assign(MAT.lensLit.clone(), { emissiveIntensity: MAT.lensLit.emissiveIntensity * k });

/** Solid of revolution from an [r, elev] profile in inches (elev <= 0 hangs below the mounting plane). */
function lathe(profile, mat, name) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(m(r), m(y))), 56);
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = name;
  return mesh;
}
const noShadow = (g) => { g.traverse((o) => { o.castShadow = false; }); return g; };

function pointLight(name, pos, intensity, distance, shadow) {
  const l = new THREE.PointLight(WARM, intensity, distance, 2);
  l.name = name; l.position.copy(pos);
  if (shadow) {
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    Object.assign(l.shadow.camera, { near: 0.05, far: distance });
    l.shadow.bias = -0.002; l.shadow.normalBias = 0.03; l.shadow.radius = 3;
    l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; // static; see the tick in build()
  }
  return l;
}

// ---------------------------------------------------------------- fixtures
/** 32" oval flush (IMG_3946): brushed-nickel rim band, shallow opal lens, two nickel straps across the short axis. */
function kitchenOval() {
  const o = F.kitchenOval, a = o.l / 2, b = o.w / 2, top = ENV.kitchenCeiling;
  const lensProfile = [[0, -o.h], [b * 0.45, -o.h + 0.1], [b * 0.72, -o.h + 0.5], [b * 0.85, -o.h + 1], [b - 1.1, -o.rimH + 0.2]];
  const lensY = (rho) => { // lens elevation at normalised radius rho (0 centre .. 1 rim)
    const r = rho * b; let i = 1; while (i < lensProfile.length - 1 && lensProfile[i][0] < r) i++;
    const [r0, y0] = lensProfile[i - 1], [r1, y1] = lensProfile[i];
    return y0 + (y1 - y0) * THREE.MathUtils.clamp((r - r0) / (r1 - r0), 0, 1);
  };
  const oval = group('',
    lathe([[b - 1.1, -o.rimH], [b - 0.15, -o.rimH], [b, -o.rimH + 0.15], [b, -0.15], [b - 0.15, 0]], MAT.nickel, 'lighting:kitchen-oval:rim'),
    lathe(lensProfile, lens(1), 'lighting:kitchen-oval:lens'));
  oval.scale.z = a / b; // circle -> ellipse, long axis along plan y
  const g = group('lighting:kitchen-oval', oval);
  for (const s of [-o.strapAt, o.strapAt]) {
    const half = b * Math.sqrt(1 - (s / a) ** 2);
    const pts = Array.from({ length: 9 }, (_, i) => { const x = -half + (half * 2 * i) / 8; return new THREE.Vector3(m(x), m(lensY(Math.hypot(x / b, s / a)) - 0.12), 0); });
    const strap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, m(0.14), 8), MAT.nickel);
    strap.scale.z = o.strapW / 0.28; strap.position.z = m(s); strap.name = 'lighting:kitchen-oval:strap';
    g.add(strap);
  }
  g.position.copy(P(o.cx, o.cy, top));
  return g;
}

/** 13" flush dome (IMG_3937/3945): nickel pan with two bands and a shadow groove, shallow opal bowl. */
function flushDome(o, name, elev = ENV.ceiling) {
  const r = o.dia / 2, pan = o.h * 0.4;
  const g = group(name,
    lathe([[r - 0.5, -pan], [r - 0.05, -pan + 0.05], [r, -pan * 0.6], [r - 0.2, -pan * 0.56], [r - 0.2, -pan * 0.44], [r, -pan * 0.4], [r, -0.05], [r - 0.1, 0]], MAT.nickel, `${name}:pan`),
    lathe([[0, -o.h], [r * 0.4, -o.h + 0.1], [r * 0.7, -o.h + 0.55], [r * 0.86, -o.h + 1.3], [r - 0.5, -pan]], lens(1), `${name}:lens`));
  g.position.copy(P(o.cx, o.cy, elev));
  return g;
}

/** 4-head track on a round canopy (IMG_3934). Returns the fixture + one spot per head. */
function diningTrack() {
  const o = F.diningTrack, top = ENV.ceiling, barElev = top - o.drop;
  const g = group('lighting:dining-track'), lights = group('lighting:dining-track:lights');
  const canopy = lathe([[0, -o.canopyH], [o.canopyDia * 0.3, -o.canopyH], [o.canopyDia * 0.46, -o.canopyH * 0.6], [o.canopyDia / 2, 0]], MAT.nickel, 'lighting:dining-track:canopy');
  canopy.position.copy(P(o.cx, o.cy, top));
  const drop = cyl(0.3, o.drop - o.canopyH, MAT.nickel); drop.position.copy(P(o.cx, o.cy, (top - o.canopyH + barElev) / 2));
  const bar = box(o.l, o.bar, o.bar, MAT.nickel, 'lighting:dining-track:bar'); bar.position.copy(P(o.cx, o.cy, barElev - o.bar / 2));
  g.add(canopy, drop, bar);
  // aim points [plan x, plan y, elev]: two light the dining floor (toward the hall, as the glowing heads in the photo), two wash the entry (E) wall
  const aims = [[122, 78, 0], [152, 72, 0], [182, 6, 40], [206, 6, 46]];
  const down = new THREE.Vector3(0, -1, 0);
  aims.forEach((aim, i) => {
    const x = o.cx - o.l / 2 + 3 + (i * (o.l - 6)) / (o.heads - 1);
    const pivot = P(x, o.cy, barElev - o.bar - o.stem);
    const stem = cyl(0.2, o.stem, MAT.nickel); stem.position.copy(P(x, o.cy, barElev - o.bar - o.stem / 2));
    const head = group(`lighting:dining-track:head-${i + 1}`);
    const can = cyl(o.headDia / 2, o.headL, MAT.nickel); can.position.y = -m(o.headL / 2 - 0.6);
    const back = new THREE.Mesh(new THREE.SphereGeometry(m(o.headDia / 2), 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.nickel); back.position.y = m(0.6); back.scale.y = 0.45;
    const face = new THREE.Mesh(new THREE.CircleGeometry(m(o.headDia / 2 - 0.22), 24), lens(1.6)); face.rotation.x = Math.PI / 2; face.position.y = -m(o.headL - 0.6 - 0.25);
    const bezel = cyl(o.headDia / 2 + 0.02, 0.3, MAT.nickel); bezel.position.y = -m(o.headL - 0.6 - 0.1); // hides the lens edge
    head.add(can, back, bezel, face);
    const dir = P(...aim).sub(pivot).normalize();
    head.quaternion.setFromUnitVectors(down, dir); head.position.copy(pivot);
    g.add(stem, head);
    if (i % 2) return; // ponytail: 2 real spots (one floor, one wall wash) carry the look; all 4 lenses glow. Add the other 2 if GPU budget allows
    const spot = new THREE.SpotLight(WARM, 6, 5.5, 0.75, 0.8, 2);
    spot.name = `light:dining-track-${i + 1}`;
    spot.position.copy(pivot).addScaledVector(dir, m(o.headL));
    spot.target.position.copy(P(...aim));
    lights.add(spot, spot.target);
  });
  return { fixture: g, lights };
}

/** 24" vanity bar (IMG_3941): opal cylinder between two nickel end cages on a wall plate, on the N wall above the mirror. */
function vanityBar() {
  const o = F.vanityBar, L = BATH.vanity.light.w, elev = BATH.vanity.light.elev, r = o.dia / 2;
  const g = group('lighting:vanity-bar');
  const axisX = X.northInt + o.plateT + o.standoff + r, cy = (Y.vanityA + Y.vanityB) / 2;
  const tube = cyl(r, L - o.cage * 2, lens(0.75), 'lighting:vanity-bar:lens', 32); tube.rotation.x = Math.PI / 2; tube.position.copy(P(axisX, cy, elev));
  g.add(tube);
  const plate = box(o.plateT, o.plateH, L, MAT.nickel, 'lighting:vanity-bar:plate'); plate.position.copy(P(X.northInt + o.plateT / 2, cy, elev));
  g.add(plate);
  for (const s of [-1, 1]) {
    const y0 = cy + s * (L / 2 - o.cage / 2);
    for (const dy of [-o.cage / 2 + 0.2, o.cage / 2 - 0.2]) { const ring = cyl(r + 0.22, 0.4, MAT.nickel, '', 32); ring.rotation.x = Math.PI / 2; ring.position.copy(P(axisX, y0 + dy, elev)); g.add(ring); }
    const core = cyl(r - 0.25, o.cage, MAT.nickel, '', 32); core.rotation.x = Math.PI / 2; core.position.copy(P(axisX, y0, elev)); g.add(core);
    const arm = box(o.standoff + r, 0.35, o.cage - 0.4, MAT.nickel); arm.position.copy(P(X.northInt + o.plateT + (o.standoff + r) / 2, y0, elev + r + 0.2)); g.add(arm);
    const arm2 = arm.clone(); arm2.position.y = m(elev - r - 0.2); g.add(arm2);
  }
  return g;
}

/**
 * Warm LED tape under the upper cabinets (IMG_3946): emissive strip + one short-range point light per run, plus an additive
 * gradient "light card" on the wall between backsplash and uppers — that gives the even linear wash of a real tape, which a
 * few point lights can't (hot spots) and RectAreaLights can't either (unoccluded: they mirrored the tape onto the dining floor).
 */
function underCabinet() {
  const o = F.underCab, g = group('lighting:undercab'), lights = group('lighting:undercab:lights');
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const ctx = c.getContext('2d'), grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.35, '#777'); grad.addColorStop(1, '#000');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const washMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(LED_STRIP).multiplyScalar(0.55), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const washBottom = KITCHEN.counterH + KITCHEN.backsplashH + 0.75, washH = KITCHEN.upperBottom - washBottom;
  for (const run of o.runs) {
    const len = run.b - run.a, mid = (run.a + run.b) / 2, east = run.wall === 'E';
    const at = (off) => (east ? [mid, Y.eastInt + off] : [X.southInt - off, mid]);
    const strip = east ? box(len, o.t, o.w, lens(1.5)) : box(o.w, o.t, len, lens(1.5));
    strip.name = `lighting:undercab:${run.id}`; strip.position.copy(P(...at(o.inset), o.elev + o.t / 2));
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(m(len), m(washH)), washMat);
    wash.name = `lighting:undercab:${run.id}:wash`; wash.position.copy(P(...at(0.08), washBottom + washH / 2)); wash.rotation.y = east ? 0 : -Math.PI / 2;
    g.add(strip, wash);
    const l = new THREE.PointLight(LED_STRIP, 0.9, 1.8, 2);
    l.name = `light:undercab:${run.id}`; l.position.copy(P(...at(o.inset + 3), o.elev - 3));
    lights.add(l);
  }
  return { fixture: g, lights };
}

// ---------------------------------------------------------------- daylight
/** Sun direction (scene -> sun), world space. */
function sunDir() {
  const az = THREE.MathUtils.degToRad(SUN.azimuthFromWestDeg), el = THREE.MathUtils.degToRad(SUN.elevationDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/**
 * Invisible shadow-only "foliage" between the sun and the bedroom window: the redwoods break that window's sun into the
 * dappled patches seen in IMG_3935/3937/3941, while the slider's sun stays clean (crisp rail stripes, IMG_3933).
 * colorWrite/depthWrite off => never drawn, but the shadow pass (own depth material) still renders it.
 */
function foliageGobo(dir) {
  const N = 380, dist = 12, spanU = 3.4, spanV = 2.6; // metres; spans cover the window + margin, no overlap with the slider's rays
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), mat, N);
  mesh.name = 'lighting:foliage-gobo'; mesh.castShadow = true; mesh.frustumCulled = false;
  const c = P((BED_WINDOW.a + BED_WINDOW.b) / 2, Y.westInt, (BED_WINDOW.sill + BED_WINDOW.head) / 2).addScaledVector(dir, dist);
  const u = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(u, dir);
  const r = rng(42), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), M = new THREE.Matrix4();
  const clumps = Array.from({ length: 24 }, () => [(r() - 0.5) * spanU, (r() - 0.5) * spanV]); // boughs, with clear sun between them
  for (let i = 0; i < N; i++) {
    const [cu, cv] = clumps[i % clumps.length], spread = () => (r() + r() + r() - 1.5) * 0.4;
    const pos = c.clone().addScaledVector(u, cu + spread()).addScaledVector(v, cv + spread()).addScaledVector(dir, (r() - 0.5) * 2);
    const roll = new THREE.Quaternion().setFromAxisAngle(dir, r() * Math.PI);
    mesh.setMatrixAt(i, M.compose(pos, roll.multiply(q), new THREE.Vector3(0.07 + r() * 0.1, 0.04 + r() * 0.05, 1)));
  }
  return mesh;
}

export function build({ scene, renderer }) {
  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = RENDER.envIntensity;
  scene.background = new THREE.Color(0xd4e1ea);
  renderer.toneMappingExposure = RENDER.exposure;

  const g = group('lighting');
  const lights = group('lighting:lights'); // never hidden: the dollhouse view keeps the interior lit
  g.add(lights);

  // soft bounce: warm-grey from the ceiling/walls, dark espresso from the floor
  lights.add(new THREE.HemisphereLight(0xe6e2da, 0x3a2f2a, 0.3));

  // Sun: WSW, 13 deg up. Frustum is fitted to the unit so the 5.5" rail slats resolve to crisp stripes on the LVP.
  const dir = sunDir(), c = P(ENV.w / 2, ENV.d / 2, 0);
  const sun = new THREE.DirectionalLight(SUN_COLOR, 7);
  sun.name = 'sun';
  sun.position.copy(c).addScaledVector(dir, 25);
  sun.target.position.copy(c);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 5, bottom: -5, near: 5, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 2.5;
  lights.add(sun, sun.target, foliageGobo(dir));

  // Shadow-only roof: the ceiling is a zero-thickness plane almost parallel to the 13-degree sun, so shadow bias let a
  // sliver of sun onto the wall/ceiling joints. A thick caster whose FRONT faces go into the shadow map closes that leak.
  const roofT = 14, over = 12; // inches; tuning, not a real-world size
  const roof = box(ENV.w + over * 2, roofT, ENV.d + over, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: THREE.FrontSide }), 'lighting:shadow-roof');
  roof.position.copy(P(ENV.w / 2, (ENV.d - over) / 2, ENV.ceiling + 0.25 + roofT / 2));
  roof.receiveShadow = false;
  roof.userData.hideInDollhouse = true; // no ceiling there, and it must stay out of the AO depth pre-pass
  g.add(roof);

  // Sky fill: the glazing acts as a cool area light (gives the falloff away from the windows that a flat ambient can't).
  const sky = (a, b, sill, head, k) => {
    const l = new THREE.RectAreaLight(SKY, k, m(b - a), m(head - sill));
    l.position.copy(P((a + b) / 2, Y.westInt - 0.5, (sill + head) / 2));
    l.lookAt(P((a + b) / 2, 0, (sill + head) / 2));
    return l;
  };
  const skySlider = sky(SLIDER.a, SLIDER.b, 0, SLIDER.h, 3); skySlider.name = 'light:sky-slider';
  const skyWindow = sky(BED_WINDOW.a, BED_WINDOW.b, BED_WINDOW.sill, BED_WINDOW.head, 3.5); skyWindow.name = 'light:sky-bed-window';
  lights.add(skySlider, skyWindow);

  // fixtures (ceiling-mounted ones disappear with the ceiling in dollhouse/plan views)
  const track = diningTrack(), under = underCabinet();
  const ceilingMounted = [kitchenOval(), track.fixture, flushDome(F.hallFlush, 'lighting:hall-flush'), flushDome(F.entryFlush, 'lighting:entry-flush'), flushDome(F.bathFlush, 'lighting:bath-flush')];
  ceilingMounted.forEach((f) => { f.userData.hideInDollhouse = true; });
  g.add(...ceilingMounted.map(noShadow), noShadow(vanityBar()), noShadow(under.fixture));
  lights.add(track.lights, under.lights);

  const below = (o, elev, gap) => P(o.cx, o.cy, elev - o.h - gap); // just under the lens so the ceiling around it still catches light
  const kitchen = pointLight('light:kitchen-oval', below(F.kitchenOval, ENV.kitchenCeiling, 2), 3.2, 7, true);
  const hall = pointLight('light:hall-flush', below(F.hallFlush, ENV.ceiling, 2), 1.3, 5, true);
  lights.add(kitchen, hall,
    pointLight('light:entry-flush', below(F.entryFlush, ENV.ceiling, 2), 1.3, 5),
    pointLight('light:bath-flush', below(F.bathFlush, ENV.ceiling, 2), 0.7, 3.2),
    pointLight('light:vanity-bar', P(X.northInt + F.vanityBar.standoff + F.vanityBar.dia + 3, (Y.vanityA + Y.vanityB) / 2, BATH.vanity.light.elev - 1), 0.6, 3));

  // The two fixture shadow maps are static; re-render them only when a furniture piece has been moved/rotated.
  let sig = NaN, furn;
  lights.userData.tick = () => {
    furn ??= scene.getObjectByName('furniture');
    let s = 0;
    for (const f of furn?.children ?? []) s += f.position.x * 3 + f.position.z * 7 + f.rotation.y * 11;
    if (s !== sig) { sig = s; kitchen.shadow.needsUpdate = hall.shadow.needsUpdate = true; }
  };
  return g;
}
