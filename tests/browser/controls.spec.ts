import { test, expect } from '@playwright/test';
import { newGame, play, TILES } from '../../shared/game';

async function prepare(page: import('@playwright/test').Page, ejection = false, length = 3, vertical = false, cross = false) {
  let game = newGame(); game.scores = [60, 0];
  game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
  for (let index = 0; index < length - 1; index++) game.board[vertical ? 4 - index : 4][vertical ? 2 : index] = 'bar';
  if (cross) game.board[2][1] = game.board[3][1] = 'bar';
  game.queue[0] = 'bar';
  if (ejection) { game.board = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => TILES[(row + col) % TILES.length])); game.queue[0] = 'cherry'; }
  await page.addInitScript(() => {
    Object.assign(window, { originalSounds: [], originalTimes: [], mediaPauses: [], walkSamples: [] });
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        const matches = [...document.querySelectorAll('#board-controls>.tile.matched')];
        if (matches.length) (window as any).matchedSourcesHidden = matches.every(tile => getComputedStyle(tile).visibility === 'hidden');
      }).observe(document.querySelector('#board-controls')!, { childList: true });
      const observeWalk = () => {
        const root = document.querySelector('#herd-llamas')!.getBoundingClientRect();
        for (const llama of document.querySelectorAll<HTMLElement>('.mini-llama.is-crossing')) {
          const rect = llama.getBoundingClientRect();
          (window as any).walkSamples.push({ id: llama.dataset.llama, side: Number(llama.dataset.side), x: rect.left + rect.width / 2 - root.left - root.width / 2 });
        }
        requestAnimationFrame(observeWalk);
      };
      requestAnimationFrame(observeWalk);
    });
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
  const counter = page.locator('#turn-counter');
  await expect(counter).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(counter).toHaveCSS('border-top-width', '0px');
  const position = await counter.evaluate(element => {
    const scene = element.closest('.board-scene')!.getBoundingClientRect(), timer = element.getBoundingClientRect();
    return { x: (timer.x + timer.width / 2 - scene.x) / scene.width, y: (timer.y + timer.height / 2 - scene.y + 8) / scene.height };
  });
  expect(position.x).toBeCloseTo(.485, 2); expect(position.y).toBeCloseTo(.815, 2);
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

test('Interior edge zones choose slots, the centre stays neutral, and previews stay behind pillars', async ({ page }) => {
  await prepare(page);
  for (const [row, col, move] of [[2, 0, 'left:2'], [0, 2, 'top:2'], [2, 4, 'right:2']] as const) {
    await page.locator(`[data-row="${row}"][data-col="${col}"]`).hover();
    await expect(page.locator('#insertion-preview')).toBeVisible();
    await expect(page.locator('.active-arrow')).toHaveAttribute('data-move', move);
    await expect(page.locator('.active-arrow')).toHaveCSS('opacity', '0');
  }
  const layers = await page.locator('.board-scene').evaluate(scene => ['.insertion-preview', '.temple-foreground'].map(selector => Number(getComputedStyle(scene.querySelector(selector)!).zIndex)));
  expect(layers[0]).toBeLessThan(layers[1]);
  const inset = await page.locator('#board-controls').evaluate(board => {
    const image = board.closest('.board-scene')!.querySelector('.retro-temple')!.getBoundingClientRect();
    const left = board.querySelector('[data-row="2"][data-col="0"]')!.getBoundingClientRect();
    const right = board.querySelector('[data-row="2"][data-col="4"]')!.getBoundingClientRect();
    return { left: left.left - (image.left + image.width * .255), right: image.left + image.width * .74 - right.right };
  });
  expect(inset.left).toBeGreaterThan(0); expect(inset.right).toBeGreaterThan(0);
  await page.locator('[data-row="2"][data-col="2"]').hover();
  await expect(page.locator('#insertion-preview')).toBeHidden();
  await expect(page.locator('.active-arrow')).toHaveCount(0);
  for (const selector of ['.turn-line', '#herd-caption', '#move-feedback']) await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('.current-tile>span')).toHaveCount(0);
  await expect(page.locator('#player-0 .score')).toHaveText('0060');
  // Clicking an interior edge cell performs the exact move previewed there.
  await page.locator('[data-row="4"][data-col="0"]').click();
  await expect(page.locator('#player-0 .score')).toHaveText('0160');
});

test('Transferred followers cross the centre before adopting their new side colour and gather in groups', async ({ page }) => {
  await prepare(page);
  await page.locator('[data-move="left:4"]').click();
  await expect(page.locator('.is-crossing')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('.is-crossing')).toHaveCount(0);
  const samples = await page.evaluate(() => (window as any).walkSamples);
  expect(samples.some((sample: any) => sample.x > 6 && sample.side === 1)).toBe(true);
  expect(samples.some((sample: any) => sample.x < -6 && sample.side === 0)).toBe(true);
  expect(samples.filter((sample: any) => Math.abs(sample.x) > 6).every((sample: any) => sample.side === (sample.x < 0 ? 0 : 1))).toBe(true);
  const groups = await page.locator('#herd-llamas').evaluate(root => {
    const bounds = root.getBoundingClientRect();
    return [...root.children].map(element => {
      const rect = element.getBoundingClientRect();
      return { team: Number((element as HTMLElement).dataset.team), x: (rect.left + rect.width / 2 - bounds.left) / bounds.width, bottom: rect.bottom };
    });
  });
  expect(groups.every(llama => llama.team === 0 ? llama.x < .4 : llama.x > .6)).toBe(true);
  expect(new Set(groups.map(llama => Math.round(llama.bottom))).size).toBeGreaterThan(1);
});

for (const [length, vertical, cross] of [[3, false, false], [4, true, false], [5, false, false], [3, false, true]] as const) {
  test(`${length}-stone ${vertical ? 'vertical' : 'horizontal'} match${cross ? ' crossing' : ''}: thunder, three blinks, original title, then burst`, async ({ page }) => {
    await prepare(page, false, length, vertical, cross);
    await page.locator(`[data-move="${vertical ? 'top:2' : 'left:4'}"]`).click();
    await expect(page.locator('.board-scene')).toHaveAttribute('data-motion-phase', 'recognizing');
    await expect.poll(() => page.evaluate(() => (window as any).originalSounds.some((src: string) => src.endsWith('match-thunder.wav')))).toBe(true);
    const blinking = await page.locator('#board-controls>.tile').evaluateAll(tiles => tiles.flatMap(tile => tile.getAnimations().filter(a => a.effect!.getTiming().iterations === 3).map(a => ({ duration: a.effect!.getTiming().duration, iterations: a.effect!.getTiming().iterations }))));
    expect(blinking).toHaveLength(cross ? 5 : length);
    expect(blinking.every(animation => animation.duration === 400 && animation.iterations === 3)).toBe(true);
    await expect(page.locator('.stone-fragment,.match-announcement')).toHaveCount(0);
    const title = page.locator('.match-announcement');
    const word = length === 5 ? 'Five' : length === 4 ? 'Four' : 'Three';
    await expect(title).toHaveAttribute('aria-label', `${word} of a Kind`);
    await expect(title).toHaveAttribute('data-length', String(length));
    await expect(title.locator('img')).toHaveAttribute('src', `/retro/${word.toLowerCase()}-of-a-kind.png`);
    await expect(page.locator('.stone-fragment')).toHaveCount(0);
    if (length === 3 && !cross) await page.screenshot({ path: 'test-results/original-three-of-a-kind.png', fullPage: true });
    await expect.poll(() => page.locator('.stone-fragment').count()).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => (window as any).matchedSourcesHidden)).toBe(true);
    const sounds = await page.evaluate(() => (window as any).originalTimes);
    const thunder = sounds.find((event: any) => event.src.endsWith('match-thunder.wav'));
    const hit = sounds.find((event: any) => /fruit6-/.test(event.src));
    const burst = sounds.find((event: any) => event.src.endsWith('stone-shatter.mp3'));
    expect(hit.at - thunder.at).toBeGreaterThanOrEqual(1150);
    expect(burst.at - thunder.at).toBeGreaterThanOrEqual(2150);
  });
}

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
  const stone = (await page.locator('#board-controls>.tile').first().boundingBox())!;
  for (const button of await page.locator('.move-button').all()) {
    const box = (await button.boundingBox())!;
    expect(Math.abs(box.width - stone.width)).toBeLessThan(1);
    expect(Math.abs(box.height - stone.height)).toBeLessThan(1);
  }
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
