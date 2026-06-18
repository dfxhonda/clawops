import { type Page } from '@playwright/test'

/**
 * UI reproduction login for E2E tests.
 * Clicks the first available staff tile, then enters PIN from E2E_HIRO_PIN env.
 * Never hardcodes a PIN — read from environment only.
 */
export async function loginViaUI(page: Page): Promise<void> {
  const pin = process.env.E2E_HIRO_PIN
  if (!pin) throw new Error('E2E_HIRO_PIN env var must be set')
  if (!/^\d+$/.test(pin)) throw new Error('E2E_HIRO_PIN must contain only digits')

  await page.goto('/login')

  // Click the first available staff tile (login-staff-<staff_id> pattern)
  const firstStaffTile = page.locator('[data-testid^="login-staff-"]').first()
  await firstStaffTile.waitFor({ state: 'visible', timeout: 10_000 })
  await firstStaffTile.click()

  // Enter each digit via the numpad
  for (const digit of pin) {
    await page.getByTestId(`pin-key-${digit}`).click()
  }

  // Wait for navigation away from /login (indicates successful authentication)
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}
