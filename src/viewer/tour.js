// Guided tour + first-visit intro. Each stop flies the camera to a pose (plan inches: [x, y, elevation]) and can run
// a small scripted action (cycle the cabinets, lift the table, show the shoe-rack clash). Leaving a stop undoes its action.
import { DOORS } from '../dimensions.js';
import { SHOTS } from '../shots.js';

const $ = (id) => document.getElementById(id);
const OVERVIEW = { view: 'dollhouse', fov: 42 }; // no pose: setMode('dollhouse') already frames the whole plan for the screen shape
const shot = (name, fov) => ({ view: 'walk', pos: SHOTS[name].pos, target: SHOTS[name].target, fov: fov ?? SHOTS[name].vfov });

export function createTour(V, { cabinets }) {
  const card = $('tour'), find = (name) => V.scene.getObjectByName(name);
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(() => { fn(); V.animating(); }, ms));
  const setOpen = (name, open) => { find(name)?.userData.setOpen?.(open); V.animating(); };

  const STEPS = [
    { ...OVERVIEW, title: 'Our apartment, to the inch',
      text: 'One bedroom, 676 sq ft. Every wall, door and cabinet comes from the floor plan, 30 photos of the empty unit and a tape measure.' },
    { ...shot('living'), title: 'Living room',
      text: 'The 63-inch desk sits on the gray accent wall. The futon and the lift-top coffee table face the balcony door.' },
    { ...shot('cabinet'), title: 'Four cabinets, one corner',
      text: 'Four storage cabinets from four listings, compared in the corner where one of them will stand. Press C any time to switch.',
      enter() { const cab = find('cabinet'), start = cab.userData.index; this.undo = () => cabinets.set(start, false); [0, 1, 2, 3].forEach((i) => later(900 + i * 1700, () => cabinets.set(i, false))); },
      leave() { this.undo?.(); } },
    { ...shot('liftTop', 45), title: 'Things open',
      text: 'The coffee-table top lifts, the futon folds flat, and doors, drawers and the wardrobe open. Click them, or press F in Walk mode.',
      enter() { later(1200, () => setOpen('liftTop', true)); }, leave() { setOpen('liftTop', false); } },
    { ...shot('bedroom'), title: 'Bedroom',
      text: 'A full bed, a three-door wardrobe and a second desk by the window. Click a piece to see its size and the clear space on each side.',
      enter() { later(1200, () => setOpen('wardrobe', true)); }, leave() { setOpen('wardrobe', false); } },
    { view: 'walk', pos: [166, 30, 58], target: [80, 22, 46], fov: 64, title: 'The shoe rack that would not fit',
      text: 'The 10-tier rack is 68.5 inches tall and would hit the closet rod by about an inch. The 9-tier version clears it, so that is the one to buy.',
      enter() {
        const door = find('door:coatCloset'), rack = find('shoeRack'), tiers = () => rack.userData.fit.tiers;
        door?.userData.setBypass?.('left');
        later(1800, () => { if (tiers() === 9) rack.userData.onClick(); });
        later(5200, () => { if (tiers() === 10) rack.userData.onClick(); });
        this.undo = () => { if (tiers() === 10) rack.userData.onClick(); door?.userData.setBypass?.(DOORS.coatCloset?.open ?? 'closed'); };
      },
      leave() { this.undo?.(); } },
    { ...shot('shed'), title: 'Deck',
      text: 'A resin storage shed at the end of the balcony, sized from the manufacturer spec sheet so the doors and lid have room to open.',
      enter() { later(1200, () => setOpen('shed', true)); }, leave() { setOpen('shed', false); } },
    { ...OVERVIEW, title: 'Your turn',
      text: 'Drag to orbit and scroll to zoom. Try Plan for dimensions, Measure for a tape, and Lights for day and night.' },
  ];

  let i = -1;
  const dots = $('tourDots'); dots.innerHTML = STEPS.map(() => '<i></i>').join('');
  function leaveStep() { timers.forEach(clearTimeout); timers = []; if (i >= 0) STEPS[i].leave?.(); }
  function go(n) {
    leaveStep();
    i = n;
    const s = STEPS[i], cut = V.mode !== s.view; // changing view mode is a cut (ceilings appear / disappear); otherwise fly
    if (cut) V.setMode(s.view);
    if (s.pos) V.fly({ pos: s.pos, target: s.target, fov: s.fov, ms: cut ? 0 : 1800 }); else if (!cut) V.setMode(s.view);
    s.enter?.();
    $('tourTitle').textContent = s.title; $('tourText').textContent = s.text;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    $('tourBack').disabled = i === 0; $('tourNext').textContent = i === STEPS.length - 1 ? 'Done' : 'Next';
    V.animating();
  }
  function start() {
    if (i >= 0) return;
    V.select(null); V.cinematic = true;
    document.body.classList.add('touring'); card.hidden = false;
    go(0);
  }
  function exit() {
    if (i < 0) return;
    leaveStep(); i = -1;
    V.cinematic = false; document.body.classList.remove('touring'); card.hidden = true;
    V.setMode('dollhouse');
  }
  const next = () => (i === STEPS.length - 1 ? exit() : go(i + 1));
  const back = () => i > 0 && go(i - 1);
  $('tourNext').addEventListener('click', next); $('tourBack').addEventListener('click', back); $('tourExit').addEventListener('click', exit);
  $('tourBtn').addEventListener('click', () => (i >= 0 ? exit() : start()));

  // first-visit intro (skipped for tooling URLs and once dismissed)
  const intro = $('intro');
  const closeIntro = () => { intro.hidden = true; try { localStorage.setItem('spruce.intro', '1'); } catch { /* private mode */ } };
  $('introTour').addEventListener('click', () => { closeIntro(); start(); });
  $('introSkip').addEventListener('click', closeIntro);
  intro.addEventListener('click', (e) => { if (e.target === intro) closeIntro(); });

  return {
    get active() { return i >= 0; }, get step() { return i; }, start, exit, next, back, steps: STEPS.length,
    maybeIntro() { let seen = false; try { seen = localStorage.getItem('spruce.intro') === '1'; } catch { /* private mode */ } if (!seen) { intro.hidden = false; $('introTour').focus(); } },
    closeIntro, get introOpen() { return !intro.hidden; },
    /** Keys while the tour runs. Returns true when handled. */
    key(e) {
      if (['ArrowRight', 'Enter', 'Space'].includes(e.code)) { next(); return true; }
      if (e.code === 'ArrowLeft') { back(); return true; }
      if (e.code === 'Escape') { exit(); return true; }
      return false;
    },
  };
}
