import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist/client' },
  server: { host: '0.0.0.0', proxy: { '/ws': { target: 'ws://127.0.0.1:2568', ws: true }, '/ready': 'http://127.0.0.1:2568' } }
});
