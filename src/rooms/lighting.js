// light fixtures + all scene lights, sun, environment
// Contract: build(ctx) returns a THREE.Group in WORLD coordinates. ctx = { scene, renderer }.
// Baseline only (sun + sky fill + IBL). The lighting item owns this file: add the real fixtures
// (FIXTURES in dimensions.js) with emissive lenses + matching point/spot lights, under-cabinet LEDs, etc.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ENV, SUN, m } from '../dimensions.js';
import { group } from '../lib/build.js';

export function build({ scene, renderer }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  scene.background = new THREE.Color(0xcfe0ee);

  const g = group('lighting');
  g.add(new THREE.HemisphereLight(0xdfe9f5, 0x4a3f38, 0.5));

  // Sun from the WEST (+Z), low, warm — matches the 6:20 PM reference photos.
  const sun = new THREE.DirectionalLight(0xffd2a0, 5);
  sun.name = 'sun';
  const az = THREE.MathUtils.degToRad(SUN.azimuthFromWestDeg), el = THREE.MathUtils.degToRad(SUN.elevationDeg);
  const c = new THREE.Vector3(m(ENV.w / 2), 0, m(ENV.d / 2));
  sun.position.copy(c).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(25));
  sun.target.position.copy(c);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 50 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  g.add(sun, sun.target);
  return g;
}
