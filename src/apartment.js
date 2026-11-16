// Assembles the whole apartment from the per-item modules.
// Modules are loaded dynamically and individually guarded, so one broken module never blanks the scene
// (failures are listed in window.__apt.failed and logged as warnings).
import { FURNITURE, floorAt } from './dimensions.js';
import { buildShell } from './shell.js';
import { group, place } from './lib/build.js';

const ROOM_MODS = import.meta.glob('./rooms/*.js');
const FURN_MODS = import.meta.glob('./furniture/*.js');
const ROOM_ORDER = ['finishes', 'openings', 'deck', 'kitchen', 'bathroom', 'closets', 'lighting']; // lighting last

export const failed = [];
export const timings = {}; // ms spent building each module (window.__apt.timings), for load-time profiling
async function load(mods, path, ctx) {
  const t = performance.now();
  try { return (await mods[path]()).build(ctx); } catch (e) { failed.push(`${path}: ${e.message}`); console.warn(`[module failed] ${path}`, e); return null; }
  finally { timings[path] = Math.round(performance.now() - t); }
}

export async function buildApartment(ctx) {
  const shell = buildShell();
  const root = group('apartment', shell);
  const furniture = group('furniture');
  root.add(furniture);
  for (const key of Object.keys(FURNITURE)) {
    const g = await load(FURN_MODS, `./furniture/${FURNITURE[key].module ?? key}.js`, ctx); // `module` lets two pieces share a model
    if (!g) continue;
    const D = FURNITURE[key];
    place(g, D.pos[0], D.pos[1], floorAt(D.pos[0], D.pos[1]), D.rot); // carpet / LVP / deck floor height
    g.userData.draggable = true;
    g.userData.key = key;
    g.name = key;
    furniture.add(g);
  }
  for (const name of ROOM_ORDER) {
    const g = await load(ROOM_MODS, `./rooms/${name}.js`, ctx);
    if (g) root.add(g);
  }
  return { root, shell, furniture };
}
