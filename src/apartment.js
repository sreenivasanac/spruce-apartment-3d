// Assembles the whole apartment from the per-item modules.
// Modules are loaded dynamically and individually guarded, so one broken module never blanks the scene
// (failures are listed in window.__apt.failed and logged as warnings).
import { FURNITURE } from './dimensions.js';
import { buildShell } from './shell.js';
import { group, place } from './lib/build.js';

const ROOM_MODS = import.meta.glob('./rooms/*.js');
const FURN_MODS = import.meta.glob('./furniture/*.js');
const ROOM_ORDER = ['finishes', 'openings', 'deck', 'kitchen', 'bathroom', 'closets', 'lighting']; // lighting last

export const failed = [];
async function load(mods, path, ctx) {
  try { return (await mods[path]()).build(ctx); } catch (e) { failed.push(`${path}: ${e.message}`); console.warn(`[module failed] ${path}`, e); return null; }
}

export async function buildApartment(ctx) {
  const shell = buildShell();
  const root = group('apartment', shell);
  const furniture = group('furniture');
  root.add(furniture);
  for (const key of Object.keys(FURNITURE)) {
    const g = await load(FURN_MODS, `./furniture/${key}.js`, ctx);
    if (!g) continue;
    const D = FURNITURE[key];
    place(g, D.pos[0], D.pos[1], key === 'bed' ? 0.5 : 0, D.rot); // bed sits on carpet
    g.userData.draggable = true;
    g.userData.key = key;
    furniture.add(g);
  }
  for (const name of ROOM_ORDER) {
    const g = await load(ROOM_MODS, `./rooms/${name}.js`, ctx);
    if (g) root.add(g);
  }
  return { root, shell, furniture };
}
