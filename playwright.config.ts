import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:2579', channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/browser-server.mjs', url: 'http://127.0.0.1:2579/ready', env: { PORT: '2579' }, reuseExistingServer: false, timeout: 15_000 },
});
