import { test, expect, type Page } from '@playwright/test';
import { WebSocket } from 'ws';

async function native(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('lama:android:server', 'https://game.test:9443');
    localStorage.setItem('lama:motion', 'off'); localStorage.setItem('lama:music', 'off');
    const callbacks: Record<string, (data?: unknown) => void> = {};
    const qa = { calls: [] as string[], copied: '', shared: null as unknown, shareError: '', emit: (event: string, data?: unknown) => callbacks[event]?.(data) };
    (window as any).androidQA = qa;
    (window as any).androidBridge = { postMessage() {} };
    (window as any).Capacitor = {
      PluginHeaders: ['App', 'Clipboard', 'Share', 'SystemBars'].map(name => ({ name, methods:
        (name === 'App' ? ['addListener', 'minimizeApp'] : name === 'Clipboard' ? ['write'] : name === 'Share' ? ['share'] : ['show', 'hide'])
          .map(name => ({ name, rtype: name === 'addListener' ? 'callback' : 'promise' })) })),
      async nativePromise(plugin: string, method: string, options: any = {}) {
        qa.calls.push(`${plugin}.${method}`);
        if (plugin === 'Clipboard') qa.copied = options.string;
        if (plugin === 'Share') {
          qa.shared = options;
          if (qa.shareError) throw new Error(qa.shareError);
        }
        return {};
      },
      nativeCallback(_plugin: string, _method: string, options: any, callback: (data?: unknown) => void) {
        callbacks[options.eventName] = callback; return options.eventName;
      },
    };
  });
  // Only the transport destination is redirected; real client/server messages are unchanged.
  await page.routeWebSocket('wss://game.test:9443/ws', socket => {
    const upstream = new WebSocket('ws://127.0.0.1:2580/ws', { origin: 'https://localhost' });
    const pending: (string | Buffer)[] = [];
    socket.onMessage(data => { if (upstream.readyState === WebSocket.OPEN) upstream.send(data); else pending.push(data); });
    upstream.on('open', () => { for (const data of pending) upstream.send(data); pending.length = 0; });
    upstream.on('message', data => socket.send(data.toString()));
    upstream.on('error', () => socket.close());
    upstream.on('close', () => socket.close());
    socket.onClose(() => upstream.close());
  });
}

test('Bundled Android client shares rooms, moves and chat with a browser and handles native controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const app = await context.newPage(); const errors: string[] = []; app.on('pageerror', e => errors.push(e.message));
  await native(app); await app.goto('/');
  await expect(app.locator('html')).toHaveAttribute('data-native', 'true');
  await expect(app.locator('#server-address')).toHaveValue('https://game.test:9443');
  await app.locator('#name').fill('Handy'); await app.locator('#create').click();
  await expect(app.locator('#room-code')).toHaveText(/^[A-F0-9]{8}$/);
  const room = (await app.locator('#room-code').textContent())!;
  const invitation = `https://game.test:9443/?room=${room}`;
  await expect(app.locator('#invite-link')).toHaveValue(invitation);
  await app.locator('#share-link').click();
  await expect.poll(() => app.evaluate(() => (window as any).androidQA.shared)).toEqual({
    title: 'Slide-a-Llama', text: 'Spiel eine Runde Slide-a-Llama mit mir!',
    url: invitation, dialogTitle: 'Einladungslink teilen',
  });
  await expect(app.locator('#share-link')).toBeEnabled();
  await app.evaluate(() => { (window as any).androidQA.shareError = 'Share canceled'; });
  await app.locator('#share-link').click();
  await expect(app.locator('#share-link')).toBeEnabled();
  await expect(app.locator('#toast')).toBeHidden();
  await app.evaluate(() => { (window as any).androidQA.shareError = 'Unavailable'; });
  await app.locator('#share-link').click();
  await expect(app.locator('#toast')).toContainText('Teilen nicht möglich');
  await expect(app.locator('#share-link')).toBeEnabled();
  await app.locator('#copy-link').click();
  await expect.poll(() => app.evaluate(() => (window as any).androidQA.copied)).toBe(invitation);
  const guestContext = await browser.newContext(); const guest = await guestContext.newPage();
  await guest.goto('/'); await guest.locator('#motion-toggle').click();
  await guest.locator('#name').fill('Browser'); await guest.locator('#room-input').fill(room);
  await guest.locator('#join-form button').click();
  await expect(app.locator('.move-button:enabled')).toHaveCount(15);
  await app.locator('#fullscreen-toggle').click();
  await expect(app.locator('#fullscreen-close')).toBeVisible();
  expect(await app.evaluate(() => (window as any).androidQA.calls)).toContain('SystemBars.hide');
  await app.locator('[data-move="top:1"]').click();
  await expect(guest.locator('#turn-label')).toContainText('Du bist dran');
  await app.evaluate(() => (window as any).androidQA.emit('backButton'));
  await expect(app.locator('#fullscreen-close')).toBeHidden();
  expect(await app.evaluate(() => (window as any).androidQA.calls)).toContain('SystemBars.show');
  await app.locator('#chat-input').fill('Hallo vom Handy'); await app.locator('#send-chat').click();
  await expect(guest.locator('#messages')).toContainText('Hallo vom Handy');
  await app.evaluate(() => (window as any).androidQA.emit('appStateChange', { isActive: false }));
  await expect(app.locator('html')).toHaveAttribute('data-app-active', 'false');
  await app.evaluate(() => (window as any).androidQA.emit('appStateChange', { isActive: true }));
  await expect(app.locator('#player-1')).toContainText('Browser');
  await app.reload(); await expect(app.locator('#player-1')).toContainText('Browser');
  await app.evaluate(() => (window as any).androidQA.emit('backButton'));
  await expect(app.locator('#confirm')).toBeVisible();
  await app.evaluate(() => (window as any).androidQA.emit('backButton'));
  await expect(app.locator('#confirm')).toBeHidden();
  await app.evaluate(() => (window as any).androidQA.emit('backButton'));
  await app.locator('#confirm-yes').click();
  await app.evaluate(() => (window as any).androidQA.emit('backButton'));
  await expect.poll(() => app.evaluate(() => (window as any).androidQA.calls.includes('App.minimizeApp'))).toBe(true);
  expect(errors).toEqual([]);
  await guestContext.close(); await context.close();
});

test('Android rejects foreign invitations and keeps its bundled lobby when the server is offline', async ({ page }) => {
  await native(page);
  await page.routeWebSocket('wss://game.test:9443/ws', socket => socket.close());
  await page.goto('/'); await page.locator('#name').fill('Offline');
  await page.locator('#room-input').fill('https://other.example/?room=AABBCCDD');
  await page.locator('#join-form button').click();
  await expect(page.locator('#toast')).toContainText('anderen Spielserver');
  await page.locator('#practice').click();
  await expect(page.locator('#toast')).toContainText('nicht erreichbar');
  await expect(page.locator('#setup')).toBeVisible();
  await page.locator('#server-address').fill('http://insecure.example');
  await page.locator('#save-server').click();
  await expect(page.locator('#server-message')).toContainText('HTTPS');
});
