// deck: floor, railing, soffit, privacy partition, sconce, condenser + exterior backdrop (lawn, pool, redwoods, pool house, sky)
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Name every significant mesh/group (obj.name) so tools/measure.mjs can find it.
import { group } from '../lib/build.js';

export function build() {
  return group("deck");
}
