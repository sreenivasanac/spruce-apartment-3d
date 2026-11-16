// Shared bootstrapping for the interaction tests (same recipe as tools/shot.mjs: own Vite server on a free port + Chrome).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';

export async function boot(query) {
  const server = await createServer({ root: resolve(import.meta.dirname, '..'), logLevel: 'error', server: { port: 0, host: '127.0.0.1', watch: null } });
  await server.listen();
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); }
  catch { browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  await page.addInitScript(() => { try { localStorage.setItem('spruce.intro', '1'); } catch { /* no storage */ } }); // skip the first-visit intro card
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${query}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  let fails = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
  const done = async () => {
    check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
    await browser.close(); await server.close();
    process.exit(fails ? 1 : 0);
  };
  return { page, check, done };
}
