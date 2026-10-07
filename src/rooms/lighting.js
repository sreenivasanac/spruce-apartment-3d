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
export const RENDER = { exposure: 0.9, envIntensity: 0.45 };

// Tuning (not real-world sizes). Colours are camera-white-balanced, i.e. 2700-3000 K as the photos show it.
const WARM = 0xffe2c2, LENS = 0xfff1dc, LED_STRIP = 0xffa85a, SKY = 0xe4ebf2, SUN_COLOR = 0xffe2c0;
const LENS_GLOW = 8; // emissive strength that clips an opal lens to warm white after ACES, as every lit fixture photographs
const P = (x, y, elev) => new THREE.Vector3(m(x), m(elev), m(y)); // plan inches -> world

const lens = (k) => Object.assign(MAT.lensLit.clone(), { emissive: new THREE.Color(LENS), emissiveIntensity: LENS_GLOW * k });

/** Additive gradient "light card" (w x h inches, in its own XY plane facing +Z): the soft spill a lit lens leaves on the surface it is mounted to. */
function glowCard(w, h, color, k, stops, radial = true) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), grad = radial ? ctx.createRadialGradient(64, 64, 0, 64, 64, 64) : ctx.createLinearGradient(0, 0, 0, 128);
  stops.forEach(([at, v]) => grad.addColorStop(at, `rgb(${v},${v},${v})`));
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(k), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(m(w), m(h)), mat);
}
const HALO = [[0, 255], [0.3, 150], [0.55, 52], [0.8, 12], [1, 0]]; // fixture hides the centre; ~0.6 m of falloff outside the rim
/** Ceiling halo around a flush fixture of plan size l (along y) x w (along x). */
function ceilingHalo(o, l, w, elev, k, name) {
  const reach = 26, card = glowCard(w + reach * 2, l + reach * 2, WARM, k, HALO);
  card.name = name; card.rotation.x = Math.PI / 2; card.position.copy(P(o.cx, o.cy, elev - 0.06));
  return card;
}

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
/** 32" oval flush (IMG_3946): slim brushed-nickel rim, shallow opal lens, a thin nickel rail just inside the rim along each long side. */
function kitchenOval() {
  const o = F.kitchenOval, a = o.l / 2, b = o.w / 2, top = ENV.kitchenCeiling, R = o.rail;
  const lensProfile = [[0, -o.h], [b * 0.45, -o.h + 0.2], [b * 0.7, -o.h + 0.75], [b * 0.8, -o.h + 1.2], [b - 1.1, -o.rimH + 0.2]];
  const railY = lensProfile[3][1] - R.t * 0.3; // rails sit proud of the lens at r = R.at * b
  const oval = group('',
    lathe([[b - 1.1, -o.rimH], [b - 0.15, -o.rimH - 0.12], [b, -o.rimH + 0.1], [b, -0.15], [b - 0.15, 0]], MAT.nickel, 'lighting:kitchen-oval:rim'),
    lathe(lensProfile, lens(1), 'lighting:kitchen-oval:lens'));
  const arc = THREE.MathUtils.degToRad(R.arcDeg);
  for (const side of [0, Math.PI]) { // circle space: +/-x become the long sides once the group is stretched along z
    const rail = new THREE.Mesh(new THREE.TorusGeometry(m(b * R.at), m(R.t / 2), 8, 40, arc), MAT.nickel);
    rail.name = 'lighting:kitchen-oval:rail'; rail.rotation.set(Math.PI / 2, 0, side - arc / 2); rail.position.y = m(railY); rail.scale.z = 0.6; // flat strap
    oval.add(rail);
    for (const e of [-1, 1]) { // end clips tying the rail back to the rim
      const t = side + (e * arc) / 2, r = b * (R.at + 1) / 2 - 0.3;
      const clip = box(b * (1 - R.at), R.t, R.clip * (b / a), MAT.nickel, 'lighting:kitchen-oval:clip');
      clip.position.set(m(r * Math.cos(t)), m(railY + 0.1), m(-r * Math.sin(t))); clip.rotation.y = t;
      oval.add(clip);
    }
  }
  oval.scale.z = a / b; // circle -> ellipse, long axis along plan y
  const g = group('lighting:kitchen-oval', oval);
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
  const aims = [[132, 72, 0], [150, 84, 0], [186, 6, 58], [217, 34, 30]]; // varied yaw: 1+2 face the hall (the two blown-out faces in the photo), 3 washes the E wall, 4 the stub wall
  const down = new THREE.Vector3(0, -1, 0);
  aims.forEach((aim, i) => {
    const x = o.cx - o.l / 2 + 3 + (i * (o.l - 6)) / (o.heads - 1);
    const pivot = P(x, o.cy, barElev - o.bar - o.stem);
    const stem = cyl(0.2, o.stem, MAT.nickel); stem.position.copy(P(x, o.cy, barElev - o.bar - o.stem / 2));
    const head = group(`lighting:dining-track:head-${i + 1}`);
    const can = cyl(o.headDia / 2, o.headL, MAT.nickel); can.position.y = -m(o.headL / 2 - 0.6);
    const back = new THREE.Mesh(new THREE.SphereGeometry(m(o.headDia / 2), 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.nickel); back.position.y = m(0.6); back.scale.y = 0.45;
    const face = new THREE.Mesh(new THREE.CircleGeometry(m(o.headDia / 2 - 0.22), 24), lens(1.8)); face.rotation.x = Math.PI / 2; face.position.y = -m(o.headL - 0.6 + 0.07); // just proud of the bezel, or its end cap hides the glow
    const bezel = cyl(o.headDia / 2 + 0.02, 0.3, MAT.nickel); bezel.position.y = -m(o.headL - 0.6 - 0.1); // hides the lens edge
    head.add(can, back, bezel, face);
    const dir = P(...aim).sub(pivot).normalize();
    head.quaternion.setFromUnitVectors(down, dir); head.position.copy(pivot);
    g.add(stem, head);
    if (i === 3) return; // ponytail: 3 unshadowed spots carry the look (floor x2 + E-wall wash); all 4 lenses glow
    const spot = new THREE.SpotLight(WARM, i === 2 ? 5 : 7, 5.5, 0.7, 0.9, 2);
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
  const haloCard = glowCard(L + 30, 34, WARM, 0.22, HALO); // soft spill on the wall behind/above the bar
  haloCard.name = 'lighting:vanity-bar:halo'; haloCard.rotation.y = Math.PI / 2; haloCard.position.copy(P(X.northInt + 0.06, cy, elev + 2));
  g.add(haloCard);
  return g;
}

/**
 * Warm LED tape under the upper cabinets (IMG_3946): emissive strip + additive gradient "light cards" on the wall and the
 * quartz — the even linear wash of a real tape, which point lights can't give (scallops) and RectAreaLights can't either
 * (unoccluded: they mirrored the tape onto the dining floor).
 */
function underCabinet() {
  const o = F.underCab, g = group('lighting:undercab');
  const RAMP = [[0, 255], [0.18, 190], [0.5, 90], [1, 14]]; // brightest right under the tape
  const washBottom = KITCHEN.counterH, washH = KITCHEN.upperBottom - washBottom; // floats just proud of the 4" splash so that glows too
  const splashT = 0.8, poolD = KITCHEN.upperD + 4; // tuning: card stand-off past the backsplash, reach of the pool on the quartz
  for (const run of o.runs) {
    const len = run.b - run.a, mid = (run.a + run.b) / 2, east = run.wall === 'E';
    const at = (off) => (east ? [mid, Y.eastInt + off] : [X.southInt - off, mid]);
    const strip = east ? box(len, o.t, o.w, lens(1.5)) : box(o.w, o.t, len, lens(1.5));
    strip.name = `lighting:undercab:${run.id}`; strip.position.copy(P(...at(o.inset), o.elev + o.t / 2));
    const wash = glowCard(len, washH, LED_STRIP, 1.5, RAMP, false);
    wash.name = `lighting:undercab:${run.id}:wash`; wash.position.copy(P(...at(splashT), washBottom + washH / 2)); wash.rotation.y = east ? 0 : -Math.PI / 2;
    const pool = glowCard(len, poolD, LED_STRIP, 0.7, RAMP, false); // same ramp lying on the counter, bright edge at the wall
    pool.name = `lighting:undercab:${run.id}:pool`; pool.rotation.set(-Math.PI / 2, 0, east ? 0 : Math.PI / 2);
    pool.position.copy(P(...at(splashT + poolD / 2), KITCHEN.counterH + 0.06));
    g.add(strip, wash, pool);
  }
  return g; // no real lights: point lights this close to the wall scallop it; the cards carry the look
}

// ---------------------------------------------------------------- daylight
/** Sun direction (scene -> sun), world space. */
function sunDir() {
  const az = THREE.MathUtils.degToRad(SUN.azimuthFromWestDeg), el = THREE.MathUtils.degToRad(SUN.elevationDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/**
 * Invisible shadow-only "foliage" between the sun and the bedroom window: the redwoods break that window's sun into the
 * soft dapple seen in IMG_3935/3937/3941, while the slider's sun stays clean (crisp rail stripes, IMG_3933).
 * One quad with a blurred leaf-gap canvas; the blur is noise-dithered to 1 bit so alphaTest + PCF average it back into a
 * soft penumbra (a shadow map has no partial occlusion). colorWrite/depthWrite off => never drawn, only in the shadow pass.
 */
function foliageGobo(dir) {
  const dist = 12, spanU = 3.6, spanV = 2.8, W = 288, H = 224, K = 6; // metres / px; sun rays are parallel, so window + margin covers every ray that enters
  const r = rng(42), small = document.createElement('canvas'); small.width = W; small.height = H;
  const ctx = small.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); // white = blocked
  ctx.filter = 'blur(3px)'; // ponytail: browsers without canvas filter (Safari) get harder-edged dapple
  ctx.fillStyle = '#000';
  for (let i = 0; i < 30; i++) { // openings between boughs: clusters of big soft gaps (10-35 cm) ...
    const cx = r() * W, cy = r() * H, n = 2 + Math.floor(r() * 4);
    for (let j = 0; j < n; j++) {
      ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * 60, cy + (r() - 0.5) * 44, 8 + r() * 20, 5 + r() * 12, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#fff'; ctx.filter = 'blur(2px)';
  for (let i = 0; i < 260; i++) { // ... broken up again by twigs and leaves
    ctx.globalAlpha = 0.5 + r() * 0.5;
    ctx.beginPath(); ctx.ellipse(r() * W, r() * H, 2 + r() * 6, 1 + r() * 2.5, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  const src = ctx.getImageData(0, 0, W, H).data, big = document.createElement('canvas'); big.width = W * K; big.height = H * K;
  const bctx = big.getContext('2d'), out = bctx.createImageData(W * K, H * K), d = out.data;
  for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) {
    // bilinear sample of the blurred map, then 1-bit noise dither
    const fx = Math.min(x / K, W - 1.001), fy = Math.min(y / K, H - 1.001), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
    const s = (xx, yy) => src[(yy * W + xx) * 4];
    const v = (s(x0, y0) * (1 - tx) + s(x0 + 1, y0) * tx) * (1 - ty) + (s(x0, y0 + 1) * (1 - tx) + s(x0 + 1, y0 + 1) * tx) * ty;
    const k = (y * W * K + x) * 4; d[k] = d[k + 1] = d[k + 2] = v > r() * 255 ? 255 : 0; d[k + 3] = 255;
  }
  bctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(big); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const mat = new THREE.MeshBasicMaterial({ alphaMap: tex, alphaTest: 0.5, colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spanU, spanV), mat);
  mesh.name = 'lighting:foliage-gobo'; mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.position.copy(P((BED_WINDOW.a + BED_WINDOW.b) / 2, Y.westInt, (BED_WINDOW.sill + BED_WINDOW.head) / 2).addScaledVector(dir, dist));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
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

  // soft bounce. Ground colour is what the CEILING receives: keep it a warm mid-tone or ceilings go blue-grey next to the walls
  lights.add(new THREE.HemisphereLight(0xf0e9dc, 0x77695c, 0.42));

  // Sun: WSW, 13 deg up. Frustum is fitted to the unit so the 5.5" rail slats resolve to crisp stripes on the LVP.
  const dir = sunDir(), c = P(ENV.w / 2, ENV.d / 2, 0);
  const sun = new THREE.DirectionalLight(SUN_COLOR, 4.5);
  sun.name = 'sun';
  sun.position.copy(c).addScaledVector(dir, 25);
  sun.target.position.copy(c);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 5, bottom: -5, near: 5, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  lights.add(sun, sun.target, foliageGobo(dir));

  // Shadow-only roof: the ceiling is a zero-thickness plane almost parallel to the 13-degree sun, so shadow bias let a
  // sliver of sun onto the wall/ceiling joints. A thick caster whose FRONT faces go into the shadow map closes that leak.
  const roofT = 14, over = 12; // inches; tuning, not a real-world size
  const roof = box(ENV.w + over * 2, roofT, ENV.d + over, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: THREE.FrontSide }), 'lighting:shadow-roof');
  roof.position.copy(P(ENV.w / 2, (ENV.d - over) / 2, ENV.ceiling + 0.25 + roofT / 2));
  roof.receiveShadow = false;
  roof.userData.hideInDollhouse = true; // no ceiling there, and it must stay out of the AO depth pre-pass
  g.add(roof);
  // Same idea for the vertical joints of the sun-facing wall: walls butt (no overlap), so the inside corners showed a hairline
  // of sun. Shadow-only posts buried INSIDE the west wall (invisible to the AO pre-pass) put a caster well ahead of each joint.
  const postMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: THREE.DoubleSide });
  for (const [x0, x1] of [[0, 16], [X.bedLivA - 10, X.bedLivB + 10], [ENV.w - 16, ENV.w]]) {
    const post = box(x1 - x0, ENV.ceiling + 1, ENV.extWall - 1, postMat, 'lighting:shadow-corner');
    post.position.copy(P((x0 + x1) / 2, Y.westInt + ENV.extWall / 2, ENV.ceiling / 2)); post.receiveShadow = false;
    g.add(post);
  }

  // Sky fill: the glazing acts as a cool area light (gives the falloff away from the windows that a flat ambient can't).
  const sky = (a, b, sill, head, k) => {
    const l = new THREE.RectAreaLight(SKY, k, m(b - a), m(head - sill));
    l.position.copy(P((a + b) / 2, Y.westInt - 0.5, (sill + head) / 2));
    l.lookAt(P((a + b) / 2, 0, (sill + head) / 2));
    return l;
  };
  const skySlider = sky(SLIDER.a, SLIDER.b, 24, SLIDER.h, 1.6); // lower edge lifted: a full-height panel mirrored in the satin LVP as a white sheet skySlider.name = 'light:sky-slider';
  const skyWindow = sky(BED_WINDOW.a, BED_WINDOW.b, BED_WINDOW.sill, BED_WINDOW.head, 2.1); skyWindow.name = 'light:sky-bed-window';
  lights.add(skySlider, skyWindow);

  // fixtures (ceiling-mounted ones disappear with the ceiling in dollhouse/plan views)
  const track = diningTrack();
  const ceilingMounted = [kitchenOval(), track.fixture, flushDome(F.hallFlush, 'lighting:hall-flush'), flushDome(F.entryFlush, 'lighting:entry-flush'), flushDome(F.bathFlush, 'lighting:bath-flush')];
  const dome = (o, name, k = 0.3) => ceilingHalo(o, o.dia, o.dia, ENV.ceiling, k, `${name}:halo`);
  ceilingMounted.push(ceilingHalo(F.kitchenOval, F.kitchenOval.l, F.kitchenOval.w, ENV.kitchenCeiling, 0.4, 'lighting:kitchen-oval:halo'),
    dome(F.hallFlush, 'lighting:hall-flush'), dome(F.entryFlush, 'lighting:entry-flush'), dome(F.bathFlush, 'lighting:bath-flush', 0.22));
  ceilingMounted.forEach((f) => { f.userData.hideInDollhouse = true; });
  g.add(...ceilingMounted.map(noShadow), noShadow(vanityBar()), noShadow(underCabinet()));
  lights.add(track.lights);

  const below = (o, elev, gap) => P(o.cx, o.cy, elev - o.h - gap); // just under the lens so the ceiling around it still catches light
  const kitchen = pointLight('light:kitchen-oval', below(F.kitchenOval, ENV.kitchenCeiling, 3), 3.5, 7, true);
  const hall = pointLight('light:hall-flush', below(F.hallFlush, ENV.ceiling, 2), 1.3, 5, true);
  // Unshadowed down-light from the oval: the soft pool on the kitchen floor. (Lowering the shadowed point light instead
  // drew hard wall-top shadow edges across the dining ceiling.)
  const pool = new THREE.SpotLight(WARM, 5, 4, 0.75, 1, 2); pool.name = 'light:kitchen-oval-pool';
  pool.position.copy(below(F.kitchenOval, ENV.kitchenCeiling, 1)); pool.target.position.copy(P(F.kitchenOval.cx, F.kitchenOval.cy, 0));
  lights.add(pool, pool.target);
  lights.add(kitchen, hall,
    pointLight('light:entry-flush', below(F.entryFlush, ENV.ceiling, 2), 1.3, 5),
    pointLight('light:bath-flush', below(F.bathFlush, ENV.ceiling, 2), 0.7, 3.2),
    pointLight('light:vanity-bar', P(X.northInt + F.vanityBar.standoff + F.vanityBar.dia + 3, (Y.vanityA + Y.vanityB) / 2, BATH.vanity.light.elev - 1), 1.0, 3));

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
