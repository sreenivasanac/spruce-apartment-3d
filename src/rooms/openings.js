// all doors (entry, interior slab, louver, bypass closet) + casings, slider, bedroom window, blinds
// Contract: build() returns a THREE.Group in WORLD coordinates (use lib/build.js helpers; inches in, metres out).
// Name every significant mesh/group (obj.name) so tools/measure.mjs can find it.
import { group } from '../lib/build.js';

export function build() {
  return group('openings');
}
