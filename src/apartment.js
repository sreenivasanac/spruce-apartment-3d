// Assembles the whole apartment from the per-item modules.
import { FURNITURE } from './dimensions.js';
import { buildShell } from './shell.js';
import { group, place } from './lib/build.js';
import * as finishes from './rooms/finishes.js';
import * as openings from './rooms/openings.js';
import * as kitchen from './rooms/kitchen.js';
import * as bathroom from './rooms/bathroom.js';
import * as closets from './rooms/closets.js';
import * as lighting from './rooms/lighting.js';
import * as desk from './furniture/desk.js';
import * as chair from './furniture/chair.js';
import * as futon from './furniture/futon.js';
import * as liftTop from './furniture/liftTop.js';
import * as mandir from './furniture/mandir.js';
import * as bed from './furniture/bed.js';

const FURN = { desk, chair, futon, liftTop, mandir, bed };

export function buildApartment(ctx) {
  const shell = buildShell();
  const rooms = [finishes, openings, kitchen, bathroom, closets].map((mod) => mod.build(ctx));
  const furniture = group('furniture');
  for (const [key, mod] of Object.entries(FURN)) {
    const g = mod.build(ctx);
    const D = FURNITURE[key];
    place(g, D.pos[0], D.pos[1], key === 'bed' ? 0.5 : 0, D.rot); // bed sits on carpet
    g.userData.draggable = true;
    g.userData.key = key;
    furniture.add(g);
  }
  const lights = lighting.build(ctx); // last: may reference fixtures/windows
  return { root: group('apartment', shell, ...rooms, furniture, lights), shell, furniture };
}
