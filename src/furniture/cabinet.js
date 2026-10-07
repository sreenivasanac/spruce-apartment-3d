// Storage-cabinet slot: holds ONE of the three purchase options at a time so they can be compared in place.
// Origin = the cabinet's back corner nearest the balcony (CABINETS.anchor), so every option keeps its back on the wall and
// its end 2" short of the slider wall whichever width it has. Local +x runs along the wall, +z = front.
// API (used by main.js): userData.options, userData.index, userData.setOption(i | -1 for none), onClick toggles doors.
import { CABINETS, m } from '../dimensions.js';
import { group } from '../lib/build.js';
import * as rustic from './cabinets/rustic.js';
import * as pantry from './cabinets/pantry.js';
import * as beadboard from './cabinets/beadboard.js';

export const OPTIONS = [
  { key: 'rustic', letter: 'A', build: rustic.build },
  { key: 'pantry', letter: 'B', build: pantry.build },
  { key: 'beadboard', letter: 'C', build: beadboard.build },
].map((o) => ({ ...o, info: CABINETS[o.key] }));

export function build() {
  const g = group('cabinet');
  const built = new Map(); // lazily built, then cached
  const get = (i) => {
    if (!built.has(i)) {
      const v = OPTIONS[i].build(), C = OPTIONS[i].info;
      v.position.set(m(-C.w / 2), 0, m(C.d / 2));
      built.set(i, v);
    }
    return built.get(i);
  };
  let current = null;
  g.userData.options = OPTIONS;
  g.userData.index = -1;
  g.userData.setOption = (i) => {
    if (current) g.remove(current);
    current = i >= 0 ? get(i) : null;
    if (current) { current.userData.snap(false); g.add(current); }
    g.userData.index = i;
    g.userData.actionLabel = current ? `${current.userData.isOpen() ? 'Close' : 'Open'} the cabinet doors & drawers` : null;
  };
  g.userData.onClick = () => {
    if (!current) return;
    current.userData.setOpen(!current.userData.isOpen());
    g.userData.actionLabel = `${current.userData.isOpen() ? 'Close' : 'Open'} the cabinet doors & drawers`;
  };
  g.userData.tick = (dt) => current?.userData.animate(dt);
  let start = 0;
  try { start = Number(new URLSearchParams(location.search).get('cabinet') ?? localStorage.getItem('spruce.cabinet') ?? 1) - 1; } catch { /* storage blocked */ }
  g.userData.setOption(Number.isInteger(start) && start >= -1 && start < OPTIONS.length ? start : 0);
  return g;
}
