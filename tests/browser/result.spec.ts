import { test, expect } from '@playwright/test';
import { newGame, play, type Seat } from '../../shared/game';

for (const you of [0, 1] as const) test(`Lama result for seat ${you} waits for the final move and keeps the cast until rematch`, async ({ page }) => {
  let game = newGame(); game.scores = [290, 0];
  game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
  game.board[4][0] = game.board[4][1] = 'cherry'; game.queue[0] = 'cherry';
  let round = 1, requested = false, finishMove: () => void, nextRound: () => void;
  await page.addInitScript(theme => localStorage.setItem('lama:theme', theme), you === 0 ? 'retro' : 'modern');
  await page.routeWebSocket('**/ws', socket => {
    const send = () => socket.send(JSON.stringify({ type: 'snapshot', state: {
      room: 'AABBCCDD', you, players: [0, 1].map(seat => ({ name: seat ? 'Sam' : 'Alex', connected: true, bot: false, rematch: requested && seat === you, reconnectUntil: null })),
      game, phase: game.winner === null ? 'playing' : 'finished', deadline: game.winner === null ? Date.now() + 30000 : null,
      availableAt: 0, serverTime: Date.now(), turnSeconds: 30, round, wins: game.winner === null ? [0, 0] : [1, 0], endReason: 'Alle zehn Lamas sind überzeugt!'
    } }));
    finishMove = () => { game = play(game, 0, { side: 'left', lane: 4 }); send(); };
    nextRound = () => { game = newGame(undefined, 1 as Seat, game.revision + 1); round++; send(); };
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'create') { socket.send(JSON.stringify({ type: 'welcome', room: 'AABBCCDD', token: 'result-test', seat: you })); send(); }
      else if (message.type === 'move') finishMove();
      else if (message.type === 'rematch') { requested = true; send(); }
    });
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#name').fill(you === 0 ? 'Alex' : 'Sam'); await page.locator('#create').click();
  await expect(page.locator('#player-0 .score')).toContainText('290');
  if (you === 0) await page.locator('[data-move="left:4"]').click(); else finishMove!();
  await expect(page.locator('#board-controls .matched')).toHaveCount(3);
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('.is-crossing')).toHaveCount(1);
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result')).toHaveAttribute('data-outcome', you === 0 ? 'won' : 'lost');
  await expect(page.locator('.endgame-team[data-team="0"]')).toHaveAttribute('data-mood', 'happy');
  await expect(page.locator('.endgame-team[data-team="1"]')).toHaveAttribute('data-mood', 'sad');
  await expect(page.locator('.endgame-llama')).toHaveCount(6);
  await expect(page.locator('[data-mood=happy] .result-mouth')).toHaveCount(3);
  await expect(page.locator('[data-mood=sad] .result-head').first()).toHaveAttribute('transform', 'rotate(24 84 116)');
  expect(await page.locator('#herd-llamas').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  expect(await page.locator('.endgame-scene').evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'running'))).toBe(true);
  await page.screenshot({ path: `test-results/llama-result-${you === 0 ? 'won' : 'lost'}.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.endgame-scene').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  await page.locator('.result-card').screenshot({ path: `test-results/result-expressions-${you}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#result #rematch')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/llama-result-mobile-${you}.png`, fullPage: true });
  await page.locator('.endgame-scene').evaluate(el => el.setAttribute('data-retained', 'yes'));
  await page.locator('#rematch').click();
  await expect(page.locator('#rematch')).toBeDisabled();
  await expect(page.locator('.endgame-scene')).toHaveAttribute('data-retained', 'yes');
  nextRound!();
  await expect(page.locator('#result')).toBeHidden(); await expect(page.locator('.endgame-scene')).toHaveCount(0);
  expect(errors).toEqual([]);
});
