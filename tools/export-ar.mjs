// Regenerates public/ar/*.usdz (+ .jpg thumbnails) from the cabinet modules. Run after changing a cabinet:
//   node tools/export-ar.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), outDir = resolve(root, 'public/ar');
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.error(e); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tools/ar-export.html`);
  await page.waitForFunction('window.__ar', null, { timeout: 120000 });
  for (const { file, usdz, jpg } of await page.evaluate('window.__ar')) {
    writeFileSync(resolve(outDir, `${file}.usdz`), Buffer.from(usdz, 'base64'));
    writeFileSync(resolve(outDir, `${file}.jpg`), Buffer.from(jpg.split(',')[1], 'base64'));
    console.log(`${file}.usdz  ${(Buffer.from(usdz, 'base64').length / 1e6).toFixed(2)} MB`);
  }
} finally { await browser.close(); await server.close(); }
