import { test, expect } from '@playwright/test';

for (const [difficulty, name, label] of [['easy', 'Chico', 'Leicht'], ['medium', 'Paco', 'Mittel'], ['hard', 'Inti', 'Schwer']] as const) {
  test(`Start page selects ${label} against ${name} and keeps the choice`, async ({ page }) => {
    await page.setViewportSize(difficulty === 'hard' ? { width: 390, height: 844 } : { width: 1280, height: 1000 });
    await page.goto('/');
    if (difficulty === 'easy') await page.locator('#theme-toggle').click();
    await expect(page.locator('#cpu-difficulty option')).toHaveCount(3);
    await page.getByLabel('CPU-Gegner').selectOption(difficulty);
    await expect(page.locator('#practice')).toContainText(`Mit ${name} üben`);
    await expect(page.locator('#cpu-description')).toContainText(name);
    await page.reload();
    await expect(page.getByLabel('CPU-Gegner')).toHaveValue(difficulty);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/cpu-selection-${difficulty}.png`, fullPage: true });
    await page.locator('#name').fill('Alex'); await page.locator('#practice').click();
    await expect(page.locator('#player-1')).toContainText(name);
    await expect(page.locator('#mode-badge')).toContainText(label.toUpperCase());
    await expect(page.locator('#room-help')).toContainText(name);
    await page.reload();
    await expect(page.locator('#player-1')).toContainText(name);
    await expect(page.locator('#mode-badge')).toContainText(label.toUpperCase());
    await page.locator('#resign').click(); await page.locator('#confirm-yes').click();
    await expect(page.locator('#result')).toBeVisible();
    await page.locator('#rematch').click();
    await expect(page.locator('#round')).toHaveText('2');
    await expect(page.locator('#player-1')).toContainText(name);
    await expect(page.locator('#current-tile')).toHaveAttribute('data-team', '1');
    await expect(page.locator('#current-tile')).toHaveCSS('border-top-color', 'rgb(85, 83, 191)');
  });
}
