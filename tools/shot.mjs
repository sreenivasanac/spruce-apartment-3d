// Deterministic screenshots + scene measurements, self-contained (starts its own Vite server on a free port,
// so many agents can run it in parallel).
//   node tools/shot.mjs IMG_3946 futon            -> shots/IMG_3946.png, shots/futon.png
//   node tools/shot.mjs 'cabinet&cabinet=3'       -> extra query params after the shot name
//   node tools/shot.mjs --view=plan --dims        -> shots/plan.png   (also --view=dollhouse)
//   node tools/shot.mjs --out=/tmp/x IMG_3946     -> custom output dir
//   node tools/shot.mjs --eval="__apt.bounds('futon')"   -> prints JSON (no screenshot). Also: __apt.size(n), __apt.names(), __apt.area
//   node tools/shot.mjs --fps                     -> measures FPS in dollhouse view (headed GPU numbers will be higher)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}`))?.split('=').slice(1).join('=');
const has = (k) => args.some((a) => a === `--${k}` || a.startsWith(`--${k}=`));
const names = args.filter((a) => !a.startsWith('--'));
const outDir = resolve(opt('out') ?? 'shots');
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root: resolve(import.meta.dirname, '..'), logLevel: 'error', server: { port: 0, host: '127.0.0.1', watch: null } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;

let browser;
try { browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); }
catch { browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }

async function open(query, portrait) {
  const page = await browser.newPage({ viewport: portrait ? { width: 1200, height: 1600 } : { width: 1600, height: 1200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  await page.goto(base + query);
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 }).catch(() => errors.push('timeout waiting for __ready'));
  errors.push(...(await page.evaluate('window.__apt?.failed ?? []')).map((f) => `MODULE FAILED ${f}`));
  if (errors.length) console.error(`[page errors] ${query}\n  ` + errors.join('\n  '));
  return page;
}

try {
  if (has('eval')) {
    const page = await open('?shot=living');
    console.log(JSON.stringify(await page.evaluate(opt('eval')), null, 1));
  } else if (has('fps')) {
    const page = await open('?view=dollhouse&clean');
    const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => (++n, performance.now() - t0 < 3000 ? requestAnimationFrame(f) : res(n / 3)); requestAnimationFrame(f); }));
    const t = await page.evaluate(() => performance.getEntriesByType('navigation')[0].loadEventEnd);
    console.log(JSON.stringify({ fps: Math.round(fps), loadMs: Math.round(t), ...(await page.evaluate('__apt.stats()')) }));
  } else if (has('view')) {
    const v = opt('view');
    const page = await open(`?view=${v}&clean${has('dims') ? '&dims' : ''}`);
    const file = resolve(outDir, `${v}${has('dims') ? '-dims' : ''}.png`);
    await page.screenshot({ path: file }); console.log(file);
  }
  for (const n of names) { // a name may carry extra query params: `cabinet&cabinet=2` -> shots/cabinet-cabinet-2.png
    const key = n.split('&')[0];
    const portrait = await (async () => { const { SHOTS } = await server.ssrLoadModule('/src/shots.js'); if (!SHOTS[key]) throw new Error(`unknown shot ${key}`); return !!SHOTS[key].portrait; })();
    const page = await open(`?shot=${n}`, portrait);
    const file = resolve(outDir, `${n.replace(/[&=]/g, '-')}.png`);
    await page.screenshot({ path: file }); await page.close(); console.log(file);
  }
} finally { await browser.close(); await server.close(); }
