// Lights popover: time of day (day / evening / night) + one switch per fixture. Fixtures are also clickable in the 3D view.
// The lighting itself lives in rooms/lighting.js (group.userData.lighting); this file is only the UI wiring.
const $ = (id) => document.getElementById(id);

export function createLightsPanel(V, lightingGroup) {
  const panel = $('lights'), btn = $('lightsBtn'), L = lightingGroup?.userData.lighting;
  if (!L) { btn.hidden = true; return { toggle() {}, setTime() {} }; }
  const seg = $('timeSeg'), list = $('fixtureList');
  const fixtureObjects = []; lightingGroup.traverse((o) => { if (o.userData.fixture) fixtureObjects.push(o); });

  function refresh() {
    for (const b of seg.children) b.setAttribute('aria-pressed', b.dataset.time === L.time);
    for (const c of list.querySelectorAll('input')) c.checked = L.fixtures[c.value].on;
    for (const o of fixtureObjects) { const f = L.fixtures[o.userData.fixture]; o.userData.actionLabel = `Switch the ${f.label.toLowerCase()} light ${f.on ? 'off' : 'on'}`; }
    V.shadowsDirty();
  }
  function setTime(name, announce = true) {
    L.setTime(name); refresh();
    if (announce) V.say(`${L.TIMES[name].label}: ${L.TIMES[name].fixtures ? 'lights on' : 'lights off, daylight only'}`);
  }
  function setFixture(id, on) { L.setFixture(id, on); refresh(); }

  for (const [name, T] of Object.entries(L.TIMES)) seg.insertAdjacentHTML('beforeend', `<button type="button" data-time="${name}" aria-pressed="false">${T.label}</button>`);
  seg.addEventListener('click', (e) => { const t = e.target.dataset?.time; if (t) setTime(t); });
  for (const [id, f] of Object.entries(L.fixtures)) list.insertAdjacentHTML('beforeend', `<label><input type="checkbox" value="${id}">${f.label}</label>`);
  list.addEventListener('change', (e) => setFixture(e.target.value, e.target.checked));
  for (const o of fixtureObjects) o.userData.onClick = () => { const id = o.userData.fixture; setFixture(id, !L.fixtures[id].on); };

  const toggle = (force) => { const open = force ?? panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', open); };
  btn.addEventListener('click', () => toggle());
  refresh();
  return { toggle, setTime, get time() { return L.time; } };
}
