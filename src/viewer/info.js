// Info card for the selected piece of furniture: product size, clear space on each side, and W / D / H tags on its box.
// This is the "will it fit?" readout the model was built for.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FURNITURE, IN } from '../dimensions.js';
import { ftin, inches } from './format.js';

const $ = (id) => document.getElementById(id);

// Display names and where each size came from. Sizes themselves are read from FURNITURE in dimensions.js.
const ABOUT = {
  desk: ['Desk', 'Size from the product listing'],
  chair: ['Office chair', 'Estimated from product photos'],
  futon: ['Futon', 'Typical click-clack futon; folds flat into a bed'],
  liftTop: ['Lift-top coffee table', 'Width and depth from the listing, height estimated'],
  mandir: ['Mandir (bookcase)', 'Typical 5-shelf bookcase with doors'],
  bed: ['Full bed', 'Full mattress on a steel frame with a headboard'],
  wifeDesk: ['Second desk', 'IKEA top on a drawer unit and two legs'],
  wifeChair: ['Office chair', 'Estimated from product photos'],
  wardrobe: ['Portable wardrobe', 'Size from the product listing'],
  cabinet: ['Storage cabinet', ''],
  shed: ['Deck storage shed', 'Size from the manufacturer spec sheet'],
  shoeRack: ['Shoe rack', 'Size from the product listing'],
};
const MAX_GAP = 120, STEP = 0.5; // inches: clearance is searched in half-inch steps up to 10 ft
const SLACK = 2; // inches trimmed off each end of the probe strip (see gap())
const TIGHT = 24; // inches: gaps under this are highlighted (too narrow to walk through)

/** Name, note and product size {w, d, h} in inches for a furniture group. */
function describe(obj) {
  const key = obj.userData.key, [name, note] = ABOUT[key] ?? [obj.name, ''];
  if (key === 'cabinet') {
    const o = obj.userData.options[obj.userData.index];
    return o ? { name: `Cabinet ${o.letter} · ${o.info.title}`, note: o.info.finish, ...o.info } : null;
  }
  const D = FURNITURE[key];
  if (key === 'shoeRack') { const fit = obj.userData.fit; return { name: `${name} · ${fit.tiers} tiers`, note: fit.fits ? `Clears the closet rod by ${inches(fit.clearanceBelowRod)}` : `Hits the closet rod by ${inches(-fit.clearanceBelowRod)}`, w: D.w, d: D.d, h: fit.height }; }
  if (key === 'bed') return { name, note, w: D.frameW, d: D.frameL, h: D.headH };
  return { name, note, w: D.w, d: D.d, h: D.h };
}

export function createInfo(V) {
  const card = $('info');
  const tags = ['w', 'd', 'h'].map(() => { const el = document.createElement('div'); el.className = 'dim size'; const o = new CSS2DObject(el); o.visible = false; V.labelScene.add(o); return o; });
  const box = new THREE.Box3();
  let shown = null;

  /** Free distance (inches) from the footprint in plan direction (dx, dy), stopping at walls, built-ins and other furniture. */
  function gap(obj, [x0, y0, x1, y1], dx, dy) {
    // The probe strip is SLACK narrower than the piece on each side: a duvet or chair arm that brushes the wall beside
    // the piece must not count as an obstacle in front of it.
    const ax = Math.min(SLACK, (x1 - x0) / 4), ay = Math.min(SLACK, (y1 - y0) / 4);
    for (let d = STEP; d <= MAX_GAP; d += STEP) {
      const strip = dx ? (dx > 0 ? [x1, y0 + ay, x1 + d, y1 - ay] : [x0 - d, y0 + ay, x0, y1 - ay]) : (dy > 0 ? [x0 + ax, y1, x1 - ax, y1 + d] : [x0 + ax, y0 - d, x1 - ax, y0]);
      if (V.blocked(strip, obj)) return d - STEP;
    }
    return Infinity;
  }

  function refresh() {
    const obj = shown, D = obj && describe(obj);
    card.hidden = !D || V.cinematic; tags.forEach((t) => { t.visible = !!D && !V.cinematic; });
    if (!D) return;
    $('infoName').textContent = D.name;
    $('infoSize').textContent = `${inches(D.w)} W × ${inches(D.d)} D × ${inches(D.h)} H`;
    $('infoNote').textContent = D.note; $('infoNote').hidden = !D.note;
    // sides are named from the piece's own point of view: its front is local +Z
    const fp = V.fp(obj), q = Math.round(obj.rotation.y / (Math.PI / 2)), turn = ((q % 4) + 4) % 4;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // plan direction of the front for 0 / 90 / 180 / 270 degrees
    const side = (k) => dirs[(turn + k) % 4];
    const rows = [['Front', side(0)], ['Back', side(2)], ['Left', side(3)], ['Right', side(1)]].map(([label, [dx, dy]]) => {
      const g = gap(obj, fp, dx, dy);
      return `<dt>${label}</dt><dd class="${g < TIGHT && g >= 1 ? 'tight' : ''}">${g === Infinity ? 'over 10 ft' : g < 1 ? 'against it' : `${inches(g)} (${ftin(g)})`}</dd>`;
    });
    $('infoGaps').innerHTML = rows.join('');
    const useBtn = $('infoUse'); useBtn.hidden = !obj.userData.onClick; useBtn.textContent = V.actionLabel(obj);
    // W / D / H tags on the edges of the bounding box nearest the camera side (+x, +z)
    box.setFromObject(obj);
    const { min, max } = box, c = box.getCenter(new THREE.Vector3()), alongX = turn % 2 === 0 ? D.w : D.d, alongZ = turn % 2 === 0 ? D.d : D.w;
    tags[0].position.set(c.x, min.y, max.z); tags[0].element.textContent = inches(alongX);
    tags[1].position.set(max.x, min.y, c.z); tags[1].element.textContent = inches(alongZ);
    tags[2].position.set(max.x, c.y, max.z); tags[2].element.textContent = `${inches(D.h)} H`;
    if ((max.y - min.y) / IN < 1) tags[2].visible = false; // empty cabinet slot
  }

  $('infoClose').addEventListener('click', () => V.select(null));
  $('infoUse').addEventListener('click', () => shown && V.use(shown));
  $('infoRotate').addEventListener('click', () => V.rotateSelected());
  return { show(obj) { shown = obj; refresh(); }, refresh };
}
