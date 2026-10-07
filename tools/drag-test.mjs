// Proves furniture editing: drag moves a piece on the floor, walls/other furniture stop it, R rotates, click fires onClick, Reset restores.
//   node tools/drag-test.mjs
import { boot } from './boot.mjs';
const { page, check, done } = await boot('?view=plan');
const bounds = (n) => page.evaluate(`__apt.bounds('${n}')`);
const mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

/** Drag the named piece by (dx, dy) plan inches with real pointer events. */
async function drag(name, dx, dy) {
  const b = await bounds(name), [cx, cy] = mid(b);
  const [x0, y0] = await page.evaluate(`__apt.screen(${cx}, ${cy}, ${b[5]})`);
  const [x1, y1] = await page.evaluate(`__apt.screen(${cx + dx}, ${cy + dy}, ${b[5]})`);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 25 }); await page.mouse.up();
  return bounds(name);
}

const t0 = await bounds('liftTop');
let t = await drag('liftTop', 40, 30);
check(Math.abs(t[0] - t0[0] - 40) < 3 && Math.abs(t[1] - t0[1] - 30) < 3, `free drag follows the pointer (+40,+30): ${t0.slice(0, 2)} -> ${t.slice(0, 2)}`);
check(t[4] === t0[4], `stays on the floor (elev ${t[4]})`);
check(await page.evaluate('__apt.selected') === 'liftTop', 'dragged piece is selected (highlight on)');

const f = await bounds('futon');
t = await drag('liftTop', -120, 0);
check(t[0] >= f[2] - 0.01 && t[0] < f[2] + 1.5, `other furniture blocks: table x0 ${t[0]} >= futon x1 ${f[2]}`);

let d = await drag('desk', 80, 60);
check(d[2] <= 310.5 + 0.01 && d[3] <= 301 + 0.01, `walls block: desk max corner ${d.slice(2, 4)} inside 310.5 / 301`);
check(d[3] > 270, `...and the piece slid along the wall instead of sticking: y1 ${d[3]}`);

await drag('chair', -30, -70); await drag('desk', -60, -40); // chair out of the way, desk into open floor so there is room to rotate
const r0 = await page.evaluate("__apt.size('desk')");
await page.keyboard.press('KeyR');
const r1 = await page.evaluate("__apt.size('desk')");
check(Math.abs(r0.w - r1.d) < 0.5 && Math.abs(r0.d - r1.w) < 0.5, `R rotates 90°: ${r0.w}x${r0.d} -> ${r1.w}x${r1.d}`);

await page.keyboard.press('KeyN'); const sel = await page.evaluate('__apt.selected'); const k0 = await bounds(sel);
await page.keyboard.press('Shift+ArrowDown'); const k1 = await bounds(sel);
check(sel && Math.abs(k1[1] - k0[1] - 6) < 0.1, `keyboard: N selects ${sel}, Shift+Down nudges 6": ${k0[1]} -> ${k1[1]}`);

await page.click('#reset');
const back = await bounds('liftTop'), deskBack = await bounds('desk');
check(back.every((v, i) => Math.abs(v - t0[i]) < 0.01), `Reset restores the table: ${back.slice(0, 2)}`);
check(Math.abs(deskBack[2] - 310) < 0.6, `Reset restores the desk rotation + position: ${deskBack.slice(0, 4)}`);

const [px, py] = await page.evaluate(`__apt.screen(${mid(t0)[0] + 6}, ${mid(t0)[1] + 10}, ${t0[5]})`);
await page.mouse.click(px, py); await page.waitForTimeout(1600);
const up = await bounds('liftTop');
check(up[5] > t0[5] + 3, `click (no drag) reaches userData.onClick: lift-top rose ${t0[5]} -> ${up[5]}`);
await done();
