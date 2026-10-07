// Proves first-person collision: walls stop you, you slide along them, open doorways and the slider let you through.
//   node tools/walk-test.mjs
import { boot } from './boot.mjs';
const { page, check, done } = await boot('?view=walk');

/** Stand at plan (x,y), face plan direction (dx,dy), hold the keys for ms, return the eye [x, y, elev] in inches. */
async function walk(x, y, dx, dy, ms, keys = ['KeyW']) {
  await page.evaluate(([x, y, dx, dy]) => {
    const c = __apt.camera, IN = 0.0254;
    c.position.set(x * IN, c.position.y, y * IN); c.lookAt((x + dx) * IN, c.position.y, (y + dy) * IN);
  }, [x, y, dx, dy]);
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  return page.evaluate('__apt.eye()');
}

let e = await walk(125, 60, 0, -1, 2500);
check(Math.abs(e[1] - 14) < 1.5 && e[2] === 67, `closed entry door stops the walker at y=14 (6" wall + 8" body), eye 67": ${e}`);

e = await walk(200, 160, -1, 0.35, 2500);
check(Math.abs(e[0] - 160.5) < 1.5 && e[1] > 168, `slides along the bedroom|living wall (x pinned 160.5, y advanced): ${e}`);
check(e[1] < 182, `...until the futon blocks (y < 181): ${e}`);

e = await walk(228, 250, 0, 1, 4000);
check(e[1] > 315, `walks through the slider onto the deck: ${e}`);
check(e[1] <= 373 - 8 + 0.5, `deck rail stops the walker: ${e}`);

e = await walk(130, 111.5, -1, 0, 2500);
check(e[0] < 96, `passes the open bedroom/hall doorway: ${e}`);

e = await walk(265, 170, 0, -1, 2500);
check(e[1] >= 148 - 0.5, `pony wall / peninsula blocks (y >= 148): ${e}`);

e = await walk(250, 70, 1, 0, 2500);
check(e[0] < 281.2 - 8 + 1, `range blocks inside the kitchen: ${e}`);

const before = await page.evaluate('__apt.eye()');
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
const yaw = await page.evaluate('(() => { const d = new __apt.THREE.Vector3(); __apt.camera.getWorldDirection(d); return [d.x, d.z]; })()');
check(Math.abs(yaw[0] - 1) > 0.05, `arrow keys turn without the mouse: dir ${yaw.map((v) => v.toFixed(2))}, eye ${before}`);
await done();
