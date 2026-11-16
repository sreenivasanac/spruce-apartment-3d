// Tour, lights, tape measure, info card, on-demand rendering and load time.
// usage: node tools/feature-test.mjs
import { boot } from './boot.mjs';

const { page, check, done } = await boot('');
const ev = (fn, arg) => page.evaluate(fn, arg);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- load time: one procedural texture once took 23 s to rasterize (per-shape canvas blur)
const t = await ev(() => __apt.timings);
check(t.build < 6000, `apartment builds in ${t.build} ms (< 6000)`);

// ---- on-demand rendering: an idle page draws nothing
await page.waitForTimeout(1500);
const f0 = await ev(() => __apt.renderer.info.render.frame);
await page.waitForTimeout(1000);
const f1 = await ev(() => __apt.renderer.info.render.frame);
check(f1 === f0, `no frames are rendered while idle (${f1 - f0} in 1 s)`);
await page.mouse.move(640, 450); await page.mouse.down(); await page.mouse.move(700, 450, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(300);
check(await ev(() => __apt.renderer.info.render.frame) > f1, 'orbiting renders frames again');
await ev(() => __apt.setMode('dollhouse'));

// ---- mirrors: live reflections only in walk mode
const mirrors = () => ev(() => { const r = []; __apt.scene.traverse((o) => { if (o.type === 'Reflector') r.push(o.visible); }); return r; });
check((await mirrors()).every((v) => !v), 'dollhouse view shows mirror stand-ins, not live reflections');
await ev(() => __apt.setMode('walk'));
check((await mirrors()).every((v) => v), 'walk view switches the live mirrors on');
await ev(() => __apt.setMode('dollhouse'));

// ---- info card
await ev(() => __apt.select('desk'));
check(await ev(() => !document.getElementById('info').hidden && document.getElementById('infoSize').textContent) === '63″ W × 24″ D × 29″ H', 'selecting the desk shows its size card');
check(await ev(() => document.getElementById('infoGaps').textContent.includes('against it')), 'the desk card reports the wall it stands against');
await ev(() => __apt.select(null));
check(await ev(() => document.getElementById('info').hidden), 'deselecting hides the card');

// ---- tape measure: two points on the bare dining floor, 50" apart (plan view, so the clicks land on the floor)
await ev(() => { __apt.setMode('plan'); __apt.measure.setActive(true); });
for (const y of [60, 110]) { const [x, yy] = await ev((y) => __apt.screen(140, y, 0), y); await page.mouse.click(x, yy); }
const d = await ev(() => __apt.measure.result);
check(d !== null && near(d, 50, 1), `tape reads ${d?.toFixed(1)}" between floor points 50" apart`);
await page.keyboard.press('Escape');
check(await ev(() => !__apt.measure.active), 'Esc puts the tape away');
await ev(() => __apt.setMode('dollhouse'));

// ---- lights
const light = (name) => ev((name) => __apt.find(name).intensity, name);
const evening = { sun: await light('sun'), hall: await light('light:hall-flush') };
await ev(() => __apt.lights.setTime('night'));
check(await light('sun') === 0 && await light('light:hall-flush') === evening.hall, 'night: sun off, fixtures on');
await ev(() => __apt.lights.setTime('day'));
check(await light('sun') > 0 && await light('light:hall-flush') === 0, 'day: sun on, fixtures off');
await ev(() => __apt.lights.setTime('evening'));
await ev(() => __apt.use('lighting:hall-flush'));
check(await light('light:hall-flush') === 0, 'clicking a fixture switches it off');
await ev(() => __apt.use('lighting:hall-flush'));
check(await light('sun') === evening.sun && await light('light:hall-flush') === evening.hall, 'evening look is restored exactly');

// ---- tour: every stop, then back to the dollhouse with the cabinet choice untouched
const cab0 = await ev(() => __apt.find('cabinet').userData.index);
await page.keyboard.press('KeyP');
check(await ev(() => __apt.tour.active && !document.getElementById('tour').hidden), 'P starts the tour');
const steps = await ev(() => __apt.tour.steps);
for (let i = 1; i < steps; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
check(await ev(() => __apt.tour.step) === steps - 1, `arrow keys reach the last of ${steps} stops`);
await page.keyboard.press('ArrowRight');
check(await ev(() => !__apt.tour.active && __apt.mode === 'dollhouse'), 'finishing the tour returns to the dollhouse view');
check(await ev(() => __apt.find('cabinet').userData.index) === cab0, 'the tour leaves the chosen cabinet as it was');
check(await ev(() => __apt.find('shoeRack').userData.fit.tiers) === 9, 'the tour leaves the 9-tier shoe rack in place');

await done();
