import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// マネサポ書式統一 (ad-hoc, Aプラン text-sm + ダークトークン) gate_4
// 最も変更が大きい AdminMasterMachinePage が light→dark トークン化され、
// 390x844 で console errors 0、旧 light テーマ(slate/bg-white)クラスが残っていないことを検証。

test.describe('マネサポ書式統一', () => {
  test('AdminMasterMachinePage: dark token化 + console errors 0 (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.goto('/admin/masters/machines')
    await expect(page.getByTestId('admin-layout')).toBeVisible()

    // 旧 light テーマのクラスが残っていない (slate-* / bg-white)
    await expect(page.locator('[class*="slate-"]')).toHaveCount(0)
    await expect(page.locator('[class*="bg-white"]')).toHaveCount(0)

    // ルート背景がダーク (bg-bg トークン = 低輝度)
    const bg = await page.evaluate(() => {
      const el = document.querySelector('.min-h-screen') || document.body
      return getComputedStyle(el as Element).backgroundColor
    })
    const m = bg.match(/rgba?\(([0-9]+),\s*([0-9]+),\s*([0-9]+)/)
    if (m) {
      const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]
      expect(lum, `bg=${bg}`).toBeLessThan(80) // ダーク
    }

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
