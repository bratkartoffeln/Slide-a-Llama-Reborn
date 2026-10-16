import { test, expect, type Page } from '@playwright/test';
import { botMove, MOVES, newGame, play, TILES, type Game, type Tile } from '../../shared/game';

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
    const times = { sliding: 0, drops: [] as number[] };
    Object.assign(window, { mechanicalSounds: [], mechanicalTimes: times });
    document.addEventListener('DOMContentLoaded', () => {
      const scene = document.querySelector<HTMLElement>('.board-scene')!;
      new MutationObserver(() => { if (scene.dataset.motionPhase === 'sliding') times.sliding = performance.now(); })
        .observe(scene, { attributes: true, attributeFilter: ['data-motion-phase'] });
    });
    HTMLMediaElement.prototype.play = function () {
      (window as any).mechanicalSounds.push(this.src);
      if (this.src.endsWith('stone-drop-original.mp3')) times.drops.push(performance.now());
      return Promise.resolve();
    };
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
  const rowBefore = await page.locator('#board-controls [data-row="1"][data-col="0"] img').getAttribute('src');
  const wheelWindow = await page.locator('.wheel-window').boundingBox(), wheel = await page.locator('#queue-wheel').boundingBox();
  expect(wheelWindow!.width).toBeLessThan(wheel!.width * .55);
  const currentStone = await page.locator('#current-tile').boundingBox();
  for (const stone of await page.locator('#next-tiles>div').all()) {
    const bounds = (await stone.boundingBox())!;
    expect(currentStone!.width).toBeGreaterThan(bounds.width);
    expect(currentStone!.y + currentStone!.height).toBeGreaterThan(bounds.y + bounds.height);
  }
  await target.click();
  await expect(page.locator('.board-scene')).toHaveAttribute('data-motion-phase', 'cracking');
  await expect(page.locator('.stone-cracks')).toHaveCount(1);
  await expect(page.locator('#board-controls [data-row="1"][data-col="0"] img')).toHaveAttribute('src', rowBefore!);
  await expect.poll(() => page.locator('#queue-wheel').evaluate(el => el.getAnimations().some(animation => animation.playState === 'running'))).toBe(true);
  expect(await page.locator('#queue-wheel').evaluate(el => (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes()[0].rotate)).toBe('45deg');
  await page.screenshot({ path: 'test-results/stone-cracking.png', fullPage: true });
  await expect(page.locator('.board-scene')).toHaveAttribute('data-motion-phase', 'bursting');
  await expect(page.locator('#board-controls [data-row="1"][data-col="0"] img')).toHaveAttribute('src', rowBefore!);
  await expect(page.locator('.board-scene')).toHaveAttribute('data-motion-phase', 'sliding');
  await expect(page.locator('#current-tile img')).toHaveAttribute('src', next!);
  await expect.poll(() => page.evaluate(() => (window as any).mechanicalSounds.some((src: string) => src.endsWith('stone-burst.mp3')))).toBe(true);
  await expect(page.locator('.ejected-stone')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).mechanicalSounds.filter((src: string) => src.endsWith('stone-drop-original.mp3')).length)).toBe(1);
  const times = await page.evaluate(() => (window as any).mechanicalTimes);
  expect(times.sliding).toBeGreaterThan(0);
  expect(times.drops[0] - times.sliding).toBeGreaterThanOrEqual(300);
  await page.screenshot({ path: 'test-results/stone-wheel-retro.png', fullPage: true });
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'test-results/stone-wheel-modern.png', fullPage: true });
});

test('A top stone crosses an empty gap in one fall and plays its sound only on landing', async ({ page }) => {
  let game = newGame(); game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
  game.board[4][0] = 'bell'; game.board[3][0] = 'lemon'; game.queue[0] = 'cherry';
  await page.addInitScript(() => {
    const records = { started: 0, calls: [] as any[], landed: [] as number[] };
    Object.assign(window, { fallRecords: records });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches('#board-controls > .tile')) { records.started = performance.now(); records.calls.push({ frames, options }); }
      return animate.call(this, frames, options);
    };
    HTMLMediaElement.prototype.play = function () {
      if (this.src.endsWith('stone-drop-original.mp3')) records.landed.push(performance.now() - records.started);
      return Promise.resolve();
    };
  });
  await page.routeWebSocket('**/ws', socket => {
    const snapshot = () => JSON.stringify({ type: 'snapshot', state: {
      room: 'AABBCCDD', you: 0, players: [0, 1].map(seat => ({ name: seat ? 'Sam' : 'Alex', connected: true, bot: false, rematch: false, reconnectUntil: null })),
      game, phase: 'playing', deadline: Date.now() + 30000, availableAt: 0, serverTime: Date.now(), turnSeconds: 30, round: 1, wins: [0, 0], endReason: null
    } });
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'create') {
        socket.send(JSON.stringify({ type: 'welcome', room: 'AABBCCDD', token: 'test-session', seat: 0 }));
        socket.send(snapshot()); socket.send(JSON.stringify({ type: 'chat', messages: [] }));
      } else if (message.type === 'move') {
        game = play(game, 0, message.move); socket.send(snapshot()); socket.send(snapshot());
      }
    });
  });
  await page.goto('/'); await page.locator('#name').fill('Alex'); await page.locator('#create').click();
  await expect(page.locator('.move-button:enabled')).toHaveCount(15);
  await page.locator('[data-move="top:0"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).fallRecords.landed.length)).toBe(1);
  const records = await page.evaluate(() => (window as any).fallRecords);
  expect(records.calls).toHaveLength(1); expect(records.calls[0].options.duration).toBe(540);
  expect(records.calls[0].options.easing).toBe('linear'); expect(records.landed[0]).toBeGreaterThanOrEqual(500);
  await expect(page.locator('.stone-cracks')).toHaveCount(0);
});
