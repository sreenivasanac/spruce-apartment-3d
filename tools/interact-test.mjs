// Interaction checks: W/D door click (dollhouse) + F key (walk), cabinet option cycling + sizes, cabinet door toggle.
//   node tools/interact-test.mjs
import { boot } from './boot.mjs';

const { page, check, done } = await boot('?cabinet=1');
const leafAngle = () => page.evaluate(() => __apt.find('door:wdDoor:leaf').rotation.y);
const wait = (ms) => page.waitForTimeout(ms);

// dollhouse: click the W/D door leaf (centre of its current, open position)
const a0 = await leafAngle();
const at = await page.evaluate(() => { const b = new __apt.THREE.Box3().setFromObject(__apt.find('door:wdDoor:leaf')); const c = b.getCenter(new __apt.THREE.Vector3()); return __apt.screen(c.x / 0.0254, c.z / 0.0254, c.y / 0.0254); });
await page.mouse.click(at[0], at[1]); await wait(1200);
const a1 = await leafAngle();
check(Math.abs(a1) < 0.02 && Math.abs(a0) > 1, `dollhouse click closes the W/D door (${a0.toFixed(2)} → ${a1.toFixed(2)} rad)`);

// walk: stand in the dining area facing the W/D door, press F
await page.evaluate(() => { __apt.setMode('walk'); const c = __apt.camera; c.position.set(140 * 0.0254, 67 * 0.0254, 70 * 0.0254); c.lookAt(101 * 0.0254, 45 * 0.0254, 70 * 0.0254); });
await wait(400);
const prompt = await page.evaluate(() => document.querySelector('#action:not([hidden]) span')?.textContent);
check(/washer\/dryer door/.test(prompt ?? ''), `walk HUD prompts "${prompt}"`);
await page.keyboard.press('KeyF'); await wait(1200);
const a2 = await leafAngle();
check(Math.abs(a2) > 1, `F re-opens the W/D door (${a2.toFixed(2)} rad)`);

// cabinet options: C cycles A → B → C → D → none → A, each at its listed size, back on the S wall
const expect = { 0: [31.5, 13.78, 70.08], 1: [40.9, 15.7, 68.1], 2: [38.6, 13.8, 70.9], 3: [31.5, 15.7, 70.9] };
for (let k = 0; k < 5; k++) {
  const r = await page.evaluate(() => ({ i: __apt.find('cabinet').userData.index, b: __apt.bounds('cabinet') }));
  if (r.i >= 0) {
    const [W, D, H] = expect[r.i], w = r.b[3] - r.b[1], h = r.b[5] - r.b[4];
    check(Math.abs(h - H) < 0.05 && w >= W - 0.05 && w <= W + 0.7 && r.b[2] <= 310.5 && r.b[2] > 309.5,
      `option ${r.i + 1}: along-wall ${w.toFixed(2)} (≥${W}), height ${h.toFixed(2)} (${H}), back at x=${r.b[2]}, front-to-back ${(r.b[2] - r.b[0]).toFixed(2)} (body ${D} + pulls)`);
  } else check(r.b === null || !isFinite(r.b[0]), 'option none: cabinet hidden');
  await page.keyboard.press('KeyC'); await wait(150);
}
check(await page.evaluate(() => __apt.find('cabinet').userData.index) === 0, 'C wrapped back to option A');

// cabinet doors via the panel button
await page.evaluate(() => __apt.setMode('dollhouse'));
await page.click('#cabOpen'); await wait(1000);
const opened = await page.evaluate(() => __apt.find('rustic:door-upper-L').rotation.y);
check(Math.abs(opened) > 1.5, `Open / close button swings cabinet doors (${opened.toFixed(2)} rad)`);
await done();
