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
// Every module starts downloading at once; they are then built one at a time in a fixed order. (Awaiting each import
// in turn cost one network round trip per module: about 3.5 s on the deployed site.)
const fetching = new Map();
function fetchModule(mods, path) {
  if (!fetching.has(path)) { const p = mods[path]?.() ?? Promise.reject(new Error('no such module')); p.catch(() => {}); fetching.set(path, p); }
  return fetching.get(path);
}
async function load(mods, path, ctx) {
  const mod = await fetchModule(mods, path).catch((e) => e);
  const t = performance.now();
  try { if (mod instanceof Error) throw mod; return mod.build(ctx); } catch (e) { failed.push(`${path}: ${e.message}`); console.warn(`[module failed] ${path}`, e); return null; }
  finally { timings[path] = Math.round(performance.now() - t); }
}

export async function buildApartment(ctx) {
  const furniturePath = (key) => `./furniture/${FURNITURE[key].module ?? key}.js`; // `module` lets two pieces share a model
  Object.keys(FURNITURE).forEach((key) => fetchModule(FURN_MODS, furniturePath(key)));
  ROOM_ORDER.forEach((name) => fetchModule(ROOM_MODS, `./rooms/${name}.js`));
  const shell = buildShell();
  const root = group('apartment', shell);
  const furniture = group('furniture');
  root.add(furniture);
  for (const key of Object.keys(FURNITURE)) {
    const g = await load(FURN_MODS, furniturePath(key), ctx);
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
