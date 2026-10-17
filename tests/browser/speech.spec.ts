import { test, expect, type Page } from '@playwright/test';
import { newGame, play } from '../../shared/game';

async function prepare(page: Page, theme: string) {
  let game = newGame();
  game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
  game.board[4][0] = game.board[4][1] = 'bar'; game.queue[0] = 'bar';
  await page.addInitScript(theme => {
    localStorage.setItem('lama:theme', theme); Math.random = () => .1;
    (window as any).speechSamples = [];
    HTMLMediaElement.prototype.play = function () {
      if (/transhappy|transpissed|lama-idle-/.test(this.src)) {
        (window as any).speechSamples.push(this);
        setTimeout(() => this.dispatchEvent(new Event('playing')), 0);
      } else setTimeout(() => this.dispatchEvent(new Event('ended')), 10);
      return Promise.resolve();
    };
  }, theme);
  await page.routeWebSocket('**/ws', socket => {
    const send = () => socket.send(JSON.stringify({ type: 'snapshot', state: {
      room: 'AABBCCDD', you: 0, players: ['Alex', 'Sam'].map(name => ({ name, connected: true, bot: false, rematch: false, reconnectUntil: null })),
      game, phase: 'playing', deadline: Date.now() + 60000, availableAt: 0, serverTime: Date.now(), turnSeconds: 60, round: 1, wins: [0, 0]
    } }));
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'create') { socket.send(JSON.stringify({ type: 'welcome', room: 'AABBCCDD', token: 'speech-test', seat: 0 })); send(); }
      if (message.type === 'move') { game = play(game, 0, message.move); send(); }
    });
  });
  await page.goto('/'); await page.locator('#name').fill('Alex'); await page.locator('#create').click();
  await expect(page.locator('.move-button:enabled')).toHaveCount(15);
}

for (const theme of ['retro', 'modern']) {
  test(`${theme}: one transferred llama speaks until its voice ends`, async ({ page }) => {
    await prepare(page, theme);
    await page.locator('[data-move="left:4"]').click();
    const speaker = page.locator('#herd-llamas .is-speaking');
    await expect(speaker).toHaveCount(1, { timeout: 15000 });
    // The last blue llama is the one that moved to the red team.
    await expect(speaker).toHaveAttribute('data-llama', '9');
    await expect(speaker).toHaveAttribute('data-team', '0');
    await expect(speaker.locator('.llama-speaking-mouth:visible')).toHaveCount(1);
    expect(await speaker.locator('.llama-mouth-open:visible').evaluate(el => el.getAnimations().some(a => a.playState === 'running'))).toBe(true);
    await page.locator('#herd-llamas').screenshot({ path: `test-results/speaking-transfer-${theme}.png` });
    await page.evaluate(() => (window as any).speechSamples.at(-1).dispatchEvent(new Event('ended')));
    await expect(speaker).toHaveCount(0);
  });

  test(`${theme}: a random idle llama speaks and mute immediately closes its mouth`, async ({ page }) => {
    await page.clock.install(); await prepare(page, theme);
    await page.clock.runFor(23000);
    const speaker = page.locator('#herd-llamas .is-speaking');
    await expect(speaker).toHaveCount(1);
    await expect(speaker.locator('.llama-speaking-mouth:visible')).toHaveCount(1);
    await page.locator('#sfx-toggle').click();
    await expect(speaker).toHaveCount(0);
    await page.clock.runFor(30000); await expect(speaker).toHaveCount(0);
  });
}
