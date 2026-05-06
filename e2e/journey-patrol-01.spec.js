import { test, expect } from '@playwright/test';

test('J-PATROL-01: ハブ→店舗→ダッシュ→旧巡回入力画面 到達', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/clawsupport$/, { timeout: 5000 });
  await page.locator('[data-store-code="KKY01"]').click();
  await expect(page).toHaveURL(/.*\/clawsupport\/store\/KKY01$/, { timeout: 5000 });
  await page.locator('[data-action="legacy-patrol"]').click();
  await expect(page).toHaveURL(/.*\/patrol\/input/, { timeout: 5000 });
  const meterField = page.locator('[data-field="in-meter"]').first();
  await expect(meterField).toBeVisible({ timeout: 5000 });
});
