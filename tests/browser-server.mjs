import { startServer } from '../dist/server/server/app.js';
// Reproducible boards keep UI assertions independent of rare winning cascades.
let seed = 42;
const server = await startServer({ port: Number(process.env.PORT ?? 2579), host: '127.0.0.1',
  ...(process.env.ANDROID_BUNDLE ? { staticDir: 'dist/android' } : {}), random: () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
} });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
