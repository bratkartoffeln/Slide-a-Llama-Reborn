import { test, expect, type Page } from '@playwright/test';
import { botMove, MOVES, play, TILES, type Game, type Tile } from '../../shared/game';

test('Resolved hits emit symbol sounds, stone fragments and exact points; followers move and react', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.addInitScript(() => {
    const observed = { sounds: [] as string[], points: [] as number[], shards: 0, crossings: 0, shakes: 0, walks: 0, sparks: 0 };
    Object.assign(window, { observedFeedback: observed });
    HTMLMediaElement.prototype.play = function () { observed.sounds.push(this.src); return Promise.resolve(); };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches('.board-scene')) observed.shakes++;
      if (this.matches('.mini-llama.is-crossing') && Array.isArray(frames) && frames[0].translate !== '0px 0') observed.walks++;
      return animate.call(this, frames, options);
    };
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) {
          if (node.matches('.score-popup')) observed.points.push(Number(node.dataset.points));
          if (node.matches('.stone-fragment')) observed.shards++;
          if (node.matches('.stone-spark,.stone-dust')) observed.sparks++;
        }
        observed.crossings = Math.max(observed.crossings, document.querySelectorAll('.is-crossing').length);
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  });
  const a = await context.newPage(), b = await context.newPage();
  const errors: string[] = []; for (const p of [a, b]) p.on('pageerror', error => errors.push(error.message));
  await a.goto('/'); await a.locator('#theme-toggle').click(); await a.locator('#name').fill('Alex'); await a.locator('#create').click();
  await expect(a.locator('#room-code')).toHaveText(/^[A-F0-9]{8}$/);
  await b.goto(await a.locator('#invite-link').inputValue());
  if (await b.locator('#sound').getAttribute('aria-pressed') !== 'true') await b.locator('#sound').click();
  await b.locator('#theme-toggle').click();
  await b.locator('#name').fill('Sam'); await b.getByRole('button', { name: 'Raum beitreten' }).click();
  let transferred = false, points = 0, captured = false;
  for (let turn = 0; turn < 35 && !transferred; turn++) {
    const page: Page = turn % 2 === 0 ? a : b;
    await expect(page.locator('.move-button:enabled')).toHaveCount(15);
    const view = await page.evaluate(tiles => {
      const board: (Tile | null)[][] = Array.from({ length: 5 }, () => Array(5).fill(null));
      document.querySelectorAll<HTMLElement>('#board-controls>.tile').forEach(el => { board[Number(el.dataset.row)][Number(el.dataset.col)] = tiles.find(tile => el.classList.contains(tile)) ?? null; });
      const symbols: Record<string, Tile> = { cherry: 'cherry', banana: 'lemon', plum: 'grape', pear: 'melon', bell: 'bell', seven: 'seven' };
      const queue = [...document.querySelectorAll<HTMLImageElement>('#current-tile img,#next-tiles img')].map(img => symbols[img.src.split('/').at(-1)!.replace('.png', '')]);
      const scores = [0, 1].map(seat => Number(document.querySelector(`#player-${seat} .score`)!.firstChild!.textContent)) as [number, number];
      return { board, queue, scores };
    }, [...TILES]);
    const game = { ...view, turn: turn % 2, revision: 0, winner: null, lastMove: null } as Game;
    // A strong first player and a deliberately generous second player exercise transfers promptly.
    const move = turn % 2 === 0 ? botMove(game) : [...MOVES].sort((a, b) => {
      const value = (move: typeof a) => {
        const next = play(game, game.turn, move, () => .5);
        return next.lastMove!.points - Math.max(...MOVES.map(reply => next.winner === null ? play(next, next.turn, reply, () => .5).lastMove!.points : 0)) * 2;
      };
      return value(a) - value(b);
    })[0];
    const before = view.scores[turn % 2];
    await page.locator(`[data-move="${move.side}:${move.lane}"]`).click();
    await expect(page.locator('.move-button:enabled')).toHaveCount(0);
    await expect((turn % 2 === 0 ? b : a).locator('.move-button:enabled')).toHaveCount(15);
    const after = Number(await page.locator(`#player-${turn % 2} .score`).evaluate(el => el.firstChild!.textContent));
    points += after - before;
    if (after > before && !captured) {
      await a.screenshot({ path: 'test-results/stone-hit-modern.png', fullPage: true });
      await b.screenshot({ path: 'test-results/stone-hit-retro.png', fullPage: true }); captured = true;
    }
    transferred = (await a.locator('#lamas-0').textContent()) !== '5';
  }
  expect(transferred).toBe(true);
  await expect.poll(async () => a.evaluate(() => (window as any).observedFeedback.sounds.filter((src: string) => /transhappy|transpissed/.test(src)).length)).toBeGreaterThan(0);
  const first = await a.evaluate(() => (window as any).observedFeedback);
  const second = await b.evaluate(() => (window as any).observedFeedback);
  expect(first.points.reduce((sum: number, value: number) => sum + value, 0)).toBe(points);
  expect(first.shards).toBeGreaterThan(0); expect(first.crossings).toBeGreaterThan(0);
  expect(first.walks).toBeGreaterThan(0); expect(first.shakes).toBeGreaterThan(0); expect(first.sparks).toBeGreaterThan(0);
  expect(first.sounds.some((src: string) => /fruit[123457]-/.test(src))).toBe(true);
  expect([first, second].some(f => f.sounds.some((src: string) => /transhappy/.test(src)))).toBe(true);
  expect([first, second].some(f => f.sounds.some((src: string) => /transpissed/.test(src)))).toBe(true);
  await a.locator('#motion-toggle').click(); await expect(a.locator('.stone-fragment,.score-popup,.is-crossing')).toHaveCount(0);
  expect(await a.locator('#herd-llamas').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  expect(await a.locator('.board-scene').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  await a.locator('#voices-toggle').click(); await expect(a.locator('#voices-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]); await context.close();
});

test('Herd blinks like the RPS figures and stops every idle motion when disabled', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => .1;
    const animate = Element.prototype.animate;
    Object.assign(window, { herdAnimationCalls: [] });
    Element.prototype.animate = function (frames, options) {
      if (this.matches('.llama-eyes,.retro-eyelid')) (window as any).herdAnimationCalls.push({ class: this.getAttribute('class'), duration: typeof options === 'object' ? options?.duration : options });
      return animate.call(this, frames, options);
    };
  });
  await page.goto('/'); await expect(page.locator('#herd-llamas>.mini-llama')).toHaveCount(10);
  await page.clock.fastForward(2200);
  const calls = await page.evaluate(() => (window as any).herdAnimationCalls);
  expect(calls.some((call: any) => call.class === 'llama-eyes' && call.duration === 160)).toBe(true);
  expect(calls.some((call: any) => call.class === 'retro-eyelid' && call.duration === 160)).toBe(true);
  await page.locator('#motion-toggle').click();
  const count = calls.length;
  await page.clock.fastForward(20000);
  expect(await page.evaluate(() => (window as any).herdAnimationCalls.length)).toBe(count);
  expect(await page.locator('#herd-llamas').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
});

test('Hidden arrow targets, green ICQ toggles, rotating preview and bottom-stone crush', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { mechanicalSounds: [] });
    HTMLMediaElement.prototype.play = function () { (window as any).mechanicalSounds.push(this.src); return Promise.resolve(); };
  });
  await page.goto('/');
  for (const id of ['theme-toggle', 'voices-toggle', 'sound', 'motion-toggle']) {
    const button = page.locator('#' + id);
    if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
    await expect(button).toHaveCSS('color', 'rgb(36, 82, 11)');
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
  }
  await page.locator('#name').fill('Steinmetz'); await page.locator('#practice').click();
  await expect(page.locator('.move-button:enabled')).toHaveCount(15);
  expect(await page.locator('.move-button').evaluateAll(buttons => buttons.every(button => getComputedStyle(button).opacity === '0'))).toBe(true);
  const target = page.locator('[data-move="top:0"]'); await target.hover();
  await expect(page.locator('.move-button.active-arrow')).toHaveCount(1);
  await expect(target).toHaveCSS('opacity', '1');
  await page.locator('[data-move="left:2"]').hover();
  await expect(page.locator('.move-button.active-arrow')).toHaveCount(1);
  await expect(target).toHaveCSS('opacity', '0');
  const next = await page.locator('#next-tiles>div').first().locator('img').getAttribute('src');
  await target.click();
  await expect(page.locator('.ejected-stone')).toHaveCount(1);
  await expect.poll(() => page.locator('#queue-wheel').evaluate(el => el.getAnimations().some(animation => animation.playState === 'running'))).toBe(true);
  await expect(page.locator('#current-tile img')).toHaveAttribute('src', next!);
  await expect.poll(() => page.evaluate(() => (window as any).mechanicalSounds.some((src: string) => src.endsWith('stone-burst.mp3')))).toBe(true);
  await expect(page.locator('.ejected-stone')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/stone-wheel-retro.png', fullPage: true });
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'test-results/stone-wheel-modern.png', fullPage: true });
});
