import { startServer } from './app.js';
const app = await startServer({
  port: Number(process.env.PORT ?? 2568), host: process.env.HOST ?? '0.0.0.0',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean)
});
console.log(`Slide-a-Llama läuft auf http://localhost:${app.port}`);
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
