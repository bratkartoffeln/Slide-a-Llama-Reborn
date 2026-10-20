import { test, expect } from '@playwright/test';

for (const theme of ['retro', 'modern']) {
  test(`${theme}: fullscreen maximizes the playable board and fits after rotation`, async ({ page }) => {
    await page.goto('/');
    if (theme === 'modern') await page.locator('#theme-toggle').click();
    await page.locator('#name').fill('Vollbild');
    await page.locator('#motion-toggle').click();
    await page.locator('#practice').click();
    await expect(page.locator('.move-button:enabled')).toHaveCount(15);
    const before = (await page.locator('#board-controls').boundingBox())!.width;
    await page.locator('#fullscreen-toggle').click();
    await expect(page.locator('body')).toHaveClass(/game-fullscreen/);
    await expect.poll(async () => (await page.locator('#board-controls').boundingBox())!.width).toBeGreaterThan(before);
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => {
        const arena = (await page.locator('#arena').boundingBox())!;
        return arena.x >= 0 && arena.y >= 48 && arena.x + arena.width <= viewport.width + 1 && arena.y + arena.height <= viewport.height + 1;
      }).toBe(true);
      for (const selector of ['#board-controls', '.temple-stage .tile-queue', '#herd-llamas', '.player-row']) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    }
    await page.screenshot({ path: `test-results/fullscreen-${theme}-landscape.png` });
    await page.locator('[data-move="top:0"]').click();
    await expect(page.locator('#turn-label')).toContainText('Paco ist am Zug');
    await page.locator('#fullscreen-close').click();
    await expect(page.locator('body')).not.toHaveClass(/game-fullscreen/);
    await expect(page.locator('#fullscreen-toggle')).toBeFocused();
    await page.locator('#resign').click(); await expect(page.locator('#confirm')).toBeVisible();
  });
}

test('Fullscreen denied by the browser still fits and Escape restores the page', async ({ page }) => {
  await page.addInitScript(() => { document.documentElement.requestFullscreen = () => Promise.reject(new Error('Unavailable')); });
  await page.goto('/'); await page.locator('#fullscreen-toggle').click();
  await expect(page.locator('#fullscreen-close')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/game-fullscreen/);
  await expect(page.locator('#create')).not.toHaveAttribute('inert');
});
