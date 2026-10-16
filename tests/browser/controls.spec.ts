import { test, expect } from '@playwright/test';
import { newGame, play, TILES } from '../../shared/game';

async function prepare(page: import('@playwright/test').Page, ejection = false) {
  let game = newGame(); game.scores = [60, 0];
  game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
  game.board[4][0] = game.board[4][1] = 'bar'; game.queue[0] = 'bar';
  if (ejection) { game.board = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => TILES[(row + col) % TILES.length])); game.queue[0] = 'cherry'; }
  await page.addInitScript(() => {
    Object.assign(window, { originalSounds: [], originalTimes: [], mediaPauses: [] });
    Math.random = () => .1;
    HTMLMediaElement.prototype.play = function () {
      (window as any).originalSounds.push(this.src);
      (window as any).originalTimes.push({ src: this.src, at: performance.now() });
      setTimeout(() => this.dispatchEvent(new Event('ended')), 200);
      return Promise.resolve();
    };
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { (window as any).mediaPauses.push(this.src); pause.call(this); };
  });
  await page.routeWebSocket('**/ws', socket => {
    const send = () => socket.send(JSON.stringify({ type: 'snapshot', state: {
      room: 'AABBCCDD', you: 0, players: ['Alex', 'Sam'].map(name => ({ name, connected: true, bot: false, rematch: false, reconnectUntil: null })),
      game, phase: 'playing', deadline: Date.now() + 60000, availableAt: 0, serverTime: Date.now(), turnSeconds: 60, round: 1, wins: [0, 0]
    } }));
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'create') { socket.send(JSON.stringify({ type: 'welcome', room: 'AABBCCDD', token: 'controls-test', seat: 0 })); send(); }
      if (message.type === 'move') { game = play(game, 0, message.move); send(); }
    });
  });
  await page.goto('/'); await page.locator('#name').fill('Alex'); await page.locator('#create').click();
}

test('Desktop controls show a direction preview; BAR scores and the counter follows the active team', async ({ page }) => {
  await prepare(page);
  const heights = await page.locator('.site-header nav>button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
  expect(await page.locator('.site-header nav').evaluate(nav => nav.firstElementChild?.classList.contains('connection'))).toBe(true);
  await expect(page.locator('#timer')).toHaveText('60');
  await expect(page.locator('#turn-counter')).toHaveAttribute('data-team', '0');
  await expect(page.locator('.turn-counter-left')).toBeVisible();
  await expect(page.locator('.timer-track,.turn-line .timer')).toHaveCount(0);
  await expect(page.locator('.lead-track')).toHaveCount(0);
  for (const [move, side] of [['left:4', 'left'], ['right:2', 'right'], ['top:1', 'top']]) {
    const button = page.locator(`[data-move="${move}"]`); await button.hover();
    await expect(page.locator('#insertion-preview')).toBeVisible();
    await expect(page.locator('#insertion-preview')).toHaveAttribute('data-side', side);
    await expect(page.locator('#insertion-preview img')).toHaveAttribute('src', '/retro/bar.png');
    await expect(button.locator('svg')).toHaveCSS('visibility', 'hidden');
  }
  await page.screenshot({ path: 'test-results/bar-insertion-desktop.png', fullPage: true });
  await page.locator('[data-move="left:4"]').click();
  await expect(page.locator('#player-0 .score')).toContainText('160');
  await expect.poll(() => page.evaluate(() => (window as any).originalSounds.some((src: string) => /fruit6-/.test(src)))).toBe(true);
  await expect(page.locator('#turn-counter')).toHaveAttribute('data-team', '1');
  await expect(page.locator('#timer')).toHaveText(/^(?:5\d|60)$/);
  await expect(page.locator('.turn-counter-right')).toBeVisible();
  await expect(page.locator('#insertion-preview')).toBeHidden();
});

test('SFX and the original looping music have independent switches', async ({ page }) => {
  await prepare(page);
  await expect(page.locator('#sfx-toggle')).toHaveText('SFX');
  await expect.poll(() => page.evaluate(() => (window as any).originalSounds.some((src: string) => src.endsWith('background-music.mp3')))).toBe(true);
  await page.locator('#sfx-toggle').click();
  await expect(page.locator('#sfx-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#music')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as any).mediaPauses.filter((src: string) => src.endsWith('background-music.mp3')).length)).toBe(0);
  await page.locator('#music').click();
  await expect(page.locator('#music')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => (window as any).mediaPauses.some((src: string) => src.endsWith('background-music.mp3')))).toBe(true);
  expect(await page.evaluate(() => [localStorage.getItem('lama:sfx'), localStorage.getItem('lama:music')])).toEqual(['off', 'off']);
});

test('An ejected stone tips, falls behind the pillars and bursts at floor impact', async ({ page }) => {
  await prepare(page, true);
  const started = await page.evaluate(() => performance.now());
  await page.locator('[data-move="left:2"]').click();
  await expect(page.locator('.ejected-stone')).toHaveCount(1);
  await expect(page.locator('.stone-fragment')).toHaveCount(0);
  const motion = await page.locator('.ejected-stone').evaluate(el => {
    const effect = el.getAnimations()[0].effect as KeyframeEffect;
    return { duration: effect.getTiming().duration, transforms: effect.getKeyframes().map(frame => frame.transform) };
  });
  expect(motion.duration).toBe(1350); expect(motion.transforms[2]).toContain('18deg'); expect(motion.transforms[3]).toContain('48deg');
  expect(await page.locator('.temple-foreground').evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(5);
  await expect(page.locator('.ejected-stone')).toHaveCount(0);
  await expect.poll(() => page.locator('.stone-fragment').count()).toBe(4);
  const ground = await page.locator('.stone-fragment').first().evaluate(el => ({ top: parseFloat((el as HTMLElement).style.top), size: parseFloat((el as HTMLElement).style.height), scene: el.closest('.board-scene')!.getBoundingClientRect().height }));
  expect(Math.abs(ground.top + ground.size - (ground.scene - 8))).toBeLessThan(2);
  const impact = await page.evaluate(() => (window as any).originalTimes.find((event: any) => event.src.endsWith('stone-burst.mp3'))?.at);
  expect(impact - started).toBeGreaterThanOrEqual(1300);
  await page.screenshot({ path: 'test-results/stone-ground-impact.png', fullPage: true });
});

test('Mobile keeps visible arrows, equal button heights and all seven symbols', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await prepare(page);
  await expect(page.locator('.points-grid>div')).toHaveCount(7);
  await expect(page.locator('.move-button:enabled')).toHaveCount(15);
  for (const button of await page.locator('.move-button').all()) { await expect(button).toHaveCSS('opacity', '1'); await expect(button.locator('svg')).toBeVisible(); }
  await expect(page.locator('#insertion-preview')).toBeHidden();
  await expect(page.locator('.connection')).toBeVisible();
  const heights = await page.locator('.site-header nav>button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/bar-insertion-mobile.png', fullPage: true });
  await context.close();
});

test('Quiet matches occasionally play original Lama reactions and muting voices stops them', async ({ page }) => {
  await page.clock.install(); await prepare(page);
  await page.clock.fastForward(3000);
  await expect(page.locator('#timer')).toHaveText('57');
  await page.clock.fastForward(26000);
  await expect.poll(() => page.evaluate(() => (window as any).originalSounds.filter((src: string) => /lama-idle-/.test(src)).length)).toBe(1);
  await page.locator('#sfx-toggle').click(); await page.clock.fastForward(60000);
  expect(await page.evaluate(() => (window as any).originalSounds.filter((src: string) => /lama-idle-/.test(src)).length)).toBe(1);
});
