import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('mantiene la arena estable durante una ejecución prolongada', async ({ page }) => {
  const durationSeconds = Number(process.env.SOAK_DURATION_SECONDS || '20');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.locator('#btnDemoToggle').evaluate((button: HTMLButtonElement) => {
    if (button.textContent?.includes('OFF')) button.click();
  });

  await page.waitForTimeout(durationSeconds * 1000);

  await expect(page.locator('#arenaCanvas')).toBeVisible();
  await expect(page.locator('#timerPill')).toBeVisible();
  await expect(page.locator('#timerText')).not.toHaveText('');
  expect(pageErrors).toEqual([]);
});
