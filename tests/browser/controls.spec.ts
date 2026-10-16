import { test, expect } from '@playwright/test';
import { newGame, play, resolve, TILES, type Tile } from '../../shared/game';
import { burstPlan } from '../../shared/feedback';

async function prepare(page: import('@playwright/test').Page, ejection = false, length = 3, vertical = false, cross = false, kind: Tile = 'bar') {
  const aims: { side: string; lane: number }[] = [];
  let game = newGame(); game.scores = [60, 0];
  game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
  for (let index = 0; index < length - 1; index++) game.board[vertical ? 4 - index : 4][vertical ? 2 : index] = kind;
  if (cross) game.board[2][1] = game.board[3][1] = kind;
  game.queue[0] = kind;
  if (ejection) { game.board = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => TILES[(row + col) % TILES.length])); game.queue[0] = 'cherry'; }
  await page.addInitScript(() => {
    Object.assign(window, { originalSounds: [], originalTimes: [], mediaPauses: [], walkSamples: [] });
    document.addEventListener('DOMContentLoaded', () => {
      Object.assign(window, { burstEvents: [] });
      new MutationObserver(records => {
        for (const record of records) {
          const tile = record.target as HTMLElement;
          if (tile.matches('#board-controls>.tile.matched')) (window as any).burstEvents.push({ at: performance.now(), hidden: getComputedStyle(tile).visibility, count: document.querySelectorAll('#board-controls>.tile.matched').length });
        }
      }).observe(document.querySelector('#board-controls')!, { subtree: true, attributes: true, attributeFilter: ['class'] });
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
      if (message.type === 'aim') aims.push(message.move);
    });
  });
  await page.goto('/'); await page.locator('#name').fill('Alex'); await page.locator('#create').click();
  // The click sends a WebSocket request; wait for its snapshot to reveal and enable the board.
  await expect(page.locator('#board-controls')).toBeVisible();
  await expect(page.locator('.move-button:enabled')).toHaveCount(15);
  return { aims };
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

function wideSequence() {
  for (const tile of TILES) for (const length of [3, 4, 5]) {
    const board = Array.from({ length: 5 }, () => Array<Tile | null>(5).fill(null));
    for (let col = 0; col < length; col++) board[4][col] = tile;
    const plan = burstPlan(resolve(board).frames[0]);
    if (plan.sequential && plan.scattered) return { tile, length };
  }
  throw new Error('Missing wide sequential fixture');
}

test('Sequential bursts hide only each exploding stone and throw shards across the board with dust', async ({ page }) => {
  const { tile, length } = wideSequence(); await prepare(page, false, length, false, false, tile);
  await page.locator('[data-move="left:4"]').click();
  await expect(page.locator('.board-scene')).toHaveAttribute('data-burst-style', 'sequence-wide');
  await expect.poll(() => page.evaluate(() => (window as any).burstEvents.length)).toBe(length);
  const events = await page.evaluate(() => (window as any).burstEvents);
  expect(events[0].count).toBe(1); expect(events.at(-1).count).toBe(length);
  expect(events.every((event: any) => event.hidden === 'hidden')).toBe(true);
  expect(events.at(-1).at - events[0].at).toBeGreaterThanOrEqual((length - 1) * 180 - 45);
  await expect(page.locator('.stone-dust-cloud')).toHaveCount(length * 2);
  const travel = await page.locator('.stone-fragment').evaluateAll(shards => shards.map(shard => {
    const frames = (shard.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
    const y = (index: number) => new DOMMatrix(String(frames[index].transform)).m42;
    const coordinates = String(frames.at(-1)!.transform).match(/-?[\d.]+(?=px)/g)!.map(Number);
    return { travel: Math.hypot(...coordinates) / shard.closest('.board-scene')!.getBoundingClientRect().width, frames: frames.length, easing: shard.getAnimations()[0].effect!.getTiming().easing, acceleration: y(12) - 2 * y(8) + y(4), noScaling: frames.every(frame => !String(frame.transform).includes('scale')) };
  }));
  expect(Math.max(...travel.map(shard => shard.travel))).toBeGreaterThan(.35);
  expect(travel.every(shard => shard.frames === 17 && shard.easing === 'linear' && shard.acceleration > 0 && shard.noScaling)).toBe(true);
  await page.screenshot({ path: 'test-results/stone-chain-wide-dust.png', fullPage: true });
});

test('Disabling motion cancels pending stone explosions and dust', async ({ page }) => {
  const { tile, length } = wideSequence(); await prepare(page, false, length, false, false, tile);
  await page.locator('[data-move="left:4"]').click();
  await expect(page.locator('.board-scene')).toHaveAttribute('data-burst-style', 'sequence-wide');
  await page.locator('#motion-toggle').click();
  await expect(page.locator('.stone-fragment,.stone-dust-cloud')).toHaveCount(0);
  await page.waitForTimeout((length - 1) * 180 + 50);
  await expect(page.locator('.stone-fragment,.stone-dust-cloud')).toHaveCount(0);
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

test('Outer slots sit outside pillars, remember their choice, and supply the incoming stone animation origin', async ({ page }) => {
  const { aims } = await prepare(page);
  const geometry = await page.locator('.board-scene').evaluate(scene => {
    const image = scene.querySelector('.retro-temple')!.getBoundingClientRect();
    const left = scene.querySelector('[data-move="left:4"]')!.getBoundingClientRect();
    const right = scene.querySelector('[data-move="right:4"]')!.getBoundingClientRect();
    return { left: left.right, pillarLeft: image.left + image.width * .16, right: right.left, pillarRight: image.left + image.width * .84 };
  });
  expect(geometry.left).toBeLessThan(geometry.pillarLeft); expect(geometry.right).toBeGreaterThan(geometry.pillarRight);
  await page.locator('[data-move="right:3"]').hover();
  await expect.poll(() => aims.at(-1)).toEqual({ side: 'right', lane: 3 });
  await page.locator('[data-row="2"][data-col="2"]').hover();
  await expect(page.locator('#insertion-preview')).toBeHidden();
  expect(aims.at(-1)).toEqual({ side: 'right', lane: 3 });
  await page.locator('[data-move="left:4"]').hover();
  await expect.poll(() => aims.at(-1)).toEqual({ side: 'left', lane: 4 });
  const slot = (await page.locator('[data-move="left:4"]').boundingBox())!;
  await page.locator('[data-move="left:4"]').click();
  const start = await page.locator('[data-row="4"][data-col="0"]').evaluate(element => {
    const animation = element.getAnimations().find(a => a.effect!.getTiming().duration === 320)!;
    const transform = (animation.effect as KeyframeEffect).getKeyframes()[0].transform as string;
    const [x, y] = transform.match(/-?[\d.]+(?=px)/g)!.map(Number);
    // Read the final grid position without the current animation offset.
    const current = getComputedStyle(element).transform;
    const matrix = current === 'none' ? new DOMMatrix() : new DOMMatrix(current);
    const rect = element.getBoundingClientRect();
    return { x: rect.left - matrix.e + x, y: rect.top - matrix.f + y, size: rect.width,
      depth: Number(getComputedStyle(element).zIndex),
      pillarDepth: Number(getComputedStyle(document.querySelector('.temple-foreground')!).zIndex) };
  });
  expect(Math.abs(start.x + start.size / 2 - (slot.x + slot.width / 2))).toBeLessThan(8);
  expect(Math.abs(start.y + start.size / 2 - (slot.y + slot.height / 2))).toBeLessThan(8);
  expect(start.depth).toBeLessThan(start.pillarDepth);
  await expect(page.locator('[data-row="4"][data-col="0"]')).toHaveCSS('z-index', '8');
});

test('Crossing rows trigger a visible Combo and its original sound in the first cascade', async ({ page }) => {
  await prepare(page, false, 3, false, true);
  await page.locator('[data-move="left:4"]').click();
  await expect(page.locator('.combo-factor b')).toHaveText('×2', { timeout: 7000 });
  await expect.poll(() => page.evaluate(() => (window as any).originalSounds.filter((src: string) => src.endsWith('retro-combo.mp3')).length)).toBe(1);
});

test('Upper previews leave clearance above occupied stones throughout their swing', async ({ page }) => {
  await prepare(page, true);
  for (let col = 0; col < 5; col++) {
    await page.locator(`[data-move="top:${col}"]`).hover();
    const clearance = await page.locator('#insertion-preview').evaluate(preview => {
      const rect = preview.getBoundingClientRect(), first = document.querySelector('[data-row="0"][data-col="0"]')!.getBoundingClientRect();
      // Six pixels of swing plus the stone's five-pixel lower edge.
      return first.top - (rect.bottom + 6 + 5);
    });
    expect(clearance).toBeGreaterThanOrEqual(4);
  }
});

test('Following stones accelerate over the fall distance and sound at contact before the landing bounce', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { gravityStarted: 0 });
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches('#board-controls>.tile') && Array.isArray(frames) && frames.length === 16) (window as any).gravityStarted = performance.now();
      return original.call(this, frames, options);
    };
  });
  await prepare(page);
  await page.locator('[data-move="left:0"]').click();
  const cell = page.locator('[data-row="3"][data-col="0"]');
  await expect.poll(() => cell.evaluate(element => element.getAnimations().some(a => (a.effect as KeyframeEffect).getKeyframes().length === 16))).toBe(true);
  const motion = await cell.evaluate(element => {
    const effect = element.getAnimations().find(a => (a.effect as KeyframeEffect).getKeyframes().length === 16)!.effect as KeyframeEffect;
    return { duration: effect.getTiming().duration, frames: effect.getKeyframes() };
  });
  const flight = Math.round(320 * Math.sqrt(3));
  expect(motion.duration).toBe(flight + 120);
  const y = (index: number) => Number(String(motion.frames[index].transform).match(/-?[\d.]+(?=px)/)![0]);
  expect(y(6) / y(0)).toBeCloseTo(.75, 3);
  expect(y(9) / y(0)).toBeCloseTo(1 - .75 ** 2, 3);
  expect(y(12)).toBe(0);
  expect(motion.frames[13].transform).toContain('scale');
  await expect.poll(() => page.evaluate(() => (window as any).originalTimes.some((event: any) => event.src.endsWith('stone-drop-original.mp3')))).toBe(true);
  const elapsed = await page.evaluate(() => (window as any).originalTimes.find((event: any) => event.src.endsWith('stone-drop-original.mp3')).at - (window as any).gravityStarted);
  expect(elapsed).toBeGreaterThanOrEqual(flight - 45); expect(elapsed).toBeLessThan(flight + 100);
});

test('Continuous mouse movement within a slot still sends its timeout choice', async ({ page }) => {
  await page.clock.install();
  const { aims } = await prepare(page);
  const slot = (await page.locator('[data-move="right:3"]').boundingBox())!;
  for (let index = 0; index < 8; index++) {
    await page.mouse.move(slot.x + slot.width / 2 + index % 2, slot.y + slot.height / 2);
    await page.clock.fastForward(30);
  }
  await expect.poll(() => aims.at(-1)).toEqual({ side: 'right', lane: 3 });
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
    const blinking = await page.locator('.match-outline').evaluateAll(outlines => outlines.flatMap(outline => outline.getAnimations().filter(a => a.effect!.getTiming().iterations === 3).map(a => ({ duration: a.effect!.getTiming().duration, iterations: a.effect!.getTiming().iterations }))));
    expect(blinking).toHaveLength(cross ? 5 : length);
    expect(blinking.every(animation => animation.duration === 400 && animation.iterations === 3)).toBe(true);
    await expect(page.locator('.stone-fragment,.match-announcement')).toHaveCount(0);
    const title = page.locator('.match-announcement');
    const word = length === 5 ? 'Five' : length === 4 ? 'Four' : 'Three';
    await expect(title).toHaveAttribute('aria-label', `${word} of a Kind`);
    await expect(title).toHaveAttribute('data-length', String(length));
    await expect(title.locator('svg>g>use')).toHaveCount(length === 3 ? 12 : 11);
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

for (const [index, entrance] of ['whole-float', 'whole-sweep', 'letters-fall', 'letters-weave'].entries()) {
  test(`Match title randomly enters with ${entrance}`, async ({ page }) => {
    await prepare(page);
    await page.evaluate(value => { Math.random = () => value; }, (index + .1) / 4);
    await page.locator('[data-move="left:4"]').click();
    const title = page.locator('.match-announcement');
    await expect(title).toHaveAttribute('data-entrance', entrance);
    const animations = await title.evaluate(element => [...element.querySelectorAll('svg,svg>g>use')].flatMap(child => child.getAnimations().map(animation => ({ tag: child.tagName, delay: animation.effect!.getTiming().delay, frames: (animation.effect as KeyframeEffect).getKeyframes() }))));
    expect(animations).toHaveLength(index < 2 ? 1 : 12);
    expect(animations.every(animation => animation.tag === (index < 2 ? 'svg' : 'use'))).toBe(true);
    expect(animations.map(animation => animation.delay ?? 0).sort((a, b) => a - b)).toEqual(index < 2 ? [0] : Array.from({ length: 12 }, (_, index) => index * 22));
    expect(animations[0].frames[0].translate).not.toBe('0px');
    await page.locator('#motion-toggle').click();
    await expect(title).toHaveCount(0);
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
