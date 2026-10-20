import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/android', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:2580', channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/browser-server.mjs', url: 'http://127.0.0.1:2580/ready', env: { PORT: '2580', ANDROID_BUNDLE: '1' }, timeout: 15_000 },
});
