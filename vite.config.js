import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// iOS AR Quick Look only opens USDZ served as model/vnd.usdz+zip; Vite's static server sends no type for .usdz.
const usdzMime = (server) => {
  server.middlewares.use((req, res, next) => {
    if (req.url?.split(/[?#]/)[0].endsWith('.usdz')) res.setHeader('Content-Type', 'model/vnd.usdz+zip');
    next();
  });
}; // (no return value: a returned function would be treated as a post-middleware hook)

// Two pages: the 3D apartment (index.html) and the phone AR cabinet viewer (ar.html).
export default defineConfig({
  plugins: [{ name: 'usdz-mime', configureServer: usdzMime, configurePreviewServer: usdzMime }],
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), ar: resolve(import.meta.dirname, 'ar.html') } } },
});
