// Storage-cabinet comparison panel: one slot, four products, compared in place (panel, C key, ?cabinet=1..4).
// V = the viewer context built in main.js.
import { inches } from './format.js';

const $ = (id) => document.getElementById(id);

export function createCabinetPanel(V, cab) {
  const panel = $('cabinets');
  if (!cab) { panel.hidden = true; return { cycle() {}, set() {} }; }
  const size = (C) => `${inches(C.w)} W × ${inches(C.d)} D × ${inches(C.h)} H`;

  function set(i, announce = true) {
    cab.userData.setOption(i);
    V.moved(cab);
    try { localStorage.setItem('spruce.cabinet', String(i + 1)); } catch { /* private mode */ }
    for (const r of panel.querySelectorAll('input[name=cab]')) r.checked = Number(r.value) === i;
    const o = cab.userData.options[i];
    $('cabNow').textContent = $('cabNowWalk').textContent = o ? `${o.letter} · ${o.info.short}` : 'none';
    $('cabOpen').disabled = $('cabLook').disabled = !o;
    if (announce) V.say(o ? `Cabinet ${o.letter} · ${o.info.title} · ${size(o.info)}` : 'No cabinet');
  }

  const list = $('cabList');
  cab.userData.options.forEach((o, i) => {
    const C = o.info, id = `cab-${i}`;
    list.insertAdjacentHTML('beforeend', `<label for="${id}"><input type="radio" name="cab" id="${id}" value="${i}"><span><b>${o.letter} · ${C.title}</b><small>${size(C)} · ${C.finish}</small>${C.url ? `<a href="${C.url}" target="_blank" rel="noopener noreferrer">listing ↗</a>` : '<small>from your photo</small>'}</span></label>`);
  });
  list.insertAdjacentHTML('beforeend', '<label for="cab-none"><input type="radio" name="cab" id="cab-none" value="-1"><span><b>None</b><small>see the empty spot</small></span></label>');
  list.addEventListener('change', (e) => set(Number(e.target.value)));
  $('cabOpen').addEventListener('click', () => V.use(cab));
  $('cabLook').addEventListener('click', () => V.lookAt(cab));
  const fold = (collapsed) => {
    panel.dataset.collapsed = collapsed; $('cabFold').setAttribute('aria-expanded', !collapsed); $('cabFold').textContent = collapsed ? '+' : '–';
    try { localStorage.setItem('spruce.cabFold', collapsed ? '1' : '0'); } catch { /* private mode */ }
  };
  $('cabFold').addEventListener('click', () => fold(panel.dataset.collapsed !== 'true'));
  let stored = null; try { stored = localStorage.getItem('spruce.cabFold'); } catch { /* private mode */ }
  fold(stored === null ? V.compact : stored === '1'); // phones start collapsed: the panel would cover a third of the screen
  set(cab.userData.index, false);

  return {
    set,
    cycle: () => set(((cab.userData.index + 2) % (cab.userData.options.length + 1)) - 1), // A → B → C → D → none → A
  };
}
