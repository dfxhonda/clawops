import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * ペルソナ別ランチャー: ロールで表示タイルが切り替わることを検証。
 * MODULE_ACCESS: clawsupport=全ロール / tanasupport=admin,manager / manesupport=admin
 * setupAuth({role}) で各ペルソナを再現。token0(npm run test:e2e)。
 */
const CASES = [
  { role: 'admin',   sees: ['clawsupport', 'tanasupport', 'manesupport'], hidden: [] },
  { role: 'manager', sees: ['clawsupport', 'tanasupport'], hidden: ['manesupport'] },
  { role: 'patrol',  sees: ['clawsupport'], hidden: ['tanasupport', 'manesupport'] },
  { role: 'staff',   sees: ['clawsupport'], hidden: ['tanasupport', 'manesupport'] },
]

test.describe('ランチャー ペルソナ別タイル表示', () => {
  for (const c of CASES) {
    test(`${c.role}: ${c.sees.join('/')} 表示・${c.hidden.join('/') || 'なし'} 非表示`, async ({ page }) => {
      await setupAuth(page, { role: c.role })
      await page.goto('/launcher', { waitUntil: 'domcontentloaded' })

      for (const k of c.sees) {
        await expect(page.getByTestId(`launcher-tile-${k}`)).toBeVisible({ timeout: 10_000 })
      }
      for (const k of c.hidden) {
        await expect(page.getByTestId(`launcher-tile-${k}`)).toHaveCount(0)
      }
    })
  }
})
