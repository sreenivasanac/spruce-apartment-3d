// Plan-view overlay: room labels (CSS2D objects in the label scene) + dimension lines with architectural ticks (SVG).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ENV, ROOMS, WALLS, m } from '../dimensions.js';
import { ftin } from './format.js';

const BIG = 25; // sq ft: rooms at least this big get dimension lines, smaller ones get W × D in the label
const SVGNS = 'http://www.w3.org/2000/svg';

/** @param {{ app: HTMLElement, labelScene: THREE.Scene, getCamera: () => THREE.Camera, area: object, listingSqFt: number }} o */
export function createPlanOverlay({ app, labelScene, getCamera, area, listingSqFt }) {
  const overlay = new THREE.Group(); overlay.visible = false; labelScene.add(overlay);
  const label = (text, x, y, cls = 'dim') => {
    const el = document.createElement('div'); el.className = cls; el.textContent = text;
    const o = new CSS2DObject(el); o.position.set(m(x), m(ENV.ceiling), m(y)); overlay.add(o);
  };
  const dims = []; // { a:[x,y], b:[x,y], off, text }: measured points, perpendicular offset of the dim line (inches)
  for (const [key, r] of Object.entries(ROOMS)) {
    if (!r.label) continue;
    const [x0, y0, x1, y1] = r.r, name = r.label.split(' ')[0], big = area.rooms[key] >= BIG;
    label(big ? `${name} · ${Math.round(area.rooms[key])} sq ft` : `${name} ${ftin(x1 - x0)} × ${ftin(y1 - y0)}`, (x0 + x1) / 2, (y0 + y1) / 2, big ? 'dim' : 'dim minor');
    if (!big) continue;
    const inset = Math.min(30, (y1 - y0) / 4);
    dims.push({ a: [x0, y1 - inset], b: [x1, y1 - inset], off: 0, text: ftin(x1 - x0) });
    dims.push({ a: [x0 + inset, y0], b: [x0 + inset, y1], off: 0, text: ftin(y1 - y0) });
  }
  dims.push({ a: [0, 0], b: [ENV.w, 0], off: -16, text: `${ftin(ENV.w)} overall` });
  dims.push({ a: [0, 0], b: [0, ENV.d], off: -16, text: `${ftin(ENV.d)} overall` });
  for (const o of WALLS.find((w) => w.id === 'ext-west').openings) // slider + bedroom window widths, outside the deck-side wall
    dims.push({ a: [o.a, ENV.d], b: [o.b, ENV.d], off: o.id === 'slider' ? -10 : 14, text: `${o.id === 'slider' ? 'slider' : 'window'} ${ftin(o.b - o.a)}` });
  const pct = ((area.grossSqFt / listingSqFt - 1) * 100).toFixed(1);
  label(`Gross ${ftin(ENV.w)} × ${ftin(ENV.d)} = ${area.grossSqFt} sq ft · listing ${listingSqFt} sq ft (${pct > 0 ? '+' : ''}${pct}%) · deck excluded`, ENV.w / 2, -32, 'dim total');

  const svg = document.createElementNS(SVGNS, 'svg'); svg.id = 'dimlines'; svg.setAttribute('aria-hidden', 'true'); app.appendChild(svg);
  const mk = (tag, parent) => parent.appendChild(document.createElementNS(SVGNS, tag));
  for (const d of dims) { d.g = mk('g', svg); d.path = mk('path', d.g); d.txt = mk('text', d.g); d.txt.textContent = d.text; }
  const v = new THREE.Vector3();
  const toScreen = (x, y) => { v.set(m(x), m(ENV.ceiling), m(y)).project(getCamera()); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };

  return {
    get visible() { return overlay.visible; },
    setVisible(on) { overlay.visible = on; svg.style.display = on ? 'block' : 'none'; },
    /** Re-project the dimension lines; call after every rendered frame while visible. */
    draw() {
      if (!overlay.visible) return;
      for (const d of dims) {
        const horiz = d.a[1] === d.b[1], o = horiz ? [0, d.off] : [d.off, 0];
        const [ax, ay] = toScreen(d.a[0], d.a[1]), [bx, by] = toScreen(d.b[0], d.b[1]);
        const [px, py] = toScreen(d.a[0] + o[0], d.a[1] + o[1]), [qx, qy] = toScreen(d.b[0] + o[0], d.b[1] + o[1]);
        const t = 5, tick = (x, y) => `M${x - t} ${y + t}L${x + t} ${y - t}`; // 45° architectural tick
        const ext = d.off ? `M${ax} ${ay}L${px} ${py}M${bx} ${by}L${qx} ${qy}` : '';
        d.path.setAttribute('d', `M${px} ${py}L${qx} ${qy}${tick(px, py)}${tick(qx, qy)}${ext}`);
        d.txt.setAttribute('transform', `translate(${(px + qx) / 2} ${(py + qy) / 2}) rotate(${horiz ? 0 : -90}) translate(0 -5)`);
      }
    },
  };
}
