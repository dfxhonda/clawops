import { type Page } from '@playwright/test'

const KANA_TABS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

/**
 * Logs in as STAFF-03 (pinned-store actor) via UI reproduction.
 * Tries the initial ★ tab first, then iterates kana tabs until login-staff-STAFF-03 is visible.
 * PIN is read from E2E_HIRO_PIN env — never hardcoded.
 */
export async function loginViaUI(page: Page): Promise<void> {
  const pin = process.env.E2E_HIRO_PIN
  if (!pin) throw new Error('E2E_HIRO_PIN env var must be set')
  if (!/^\d+$/.test(pin)) throw new Error('E2E_HIRO_PIN must contain only digits')

  await page.goto('/login')

  const staffTile = page.getByTestId('login-staff-STAFF-03')

  // Wait for the page to render at least one staff tile
  await page.locator('[data-testid^="login-staff-"]').first().waitFor({ state: 'visible', timeout: 10_000 })

  // Try ★ tab first; if STAFF-03 not visible, iterate kana tabs
  if (!await staffTile.isVisible()) {
    let found = false
    for (const tab of KANA_TABS) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await page.waitForTimeout(300)
      if (await staffTile.isVisible()) {
        found = true
        break
      }
    }
    if (!found) {
      throw new Error('login-staff-STAFF-03 not found on any login tab — verify testid exists in StaffList')
    }
  }

  await staffTile.click()

  // Enter each digit via the numpad
  for (const digit of pin) {
    await page.getByTestId(`pin-key-${digit}`).click()
  }

  // Wait for navigation away from /login (indicates successful authentication)
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}
