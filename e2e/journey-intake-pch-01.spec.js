import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-INTAKE-PCH-EXCEL-fix-01 gate: 390x844 全経路 console errors 0 / 戻る動線 / カード表示
test.describe('J-INTAKE-PCH-EXCEL-fix-01 取込ハブ', () => {
  async function mockRest(page, sgpRange = '0-0/0') {
    // 全 rest を空配列で受ける (catch-all を先に登録 → prize_orders が後勝ち)
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/prize_orders**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': sgpRange }, body: '[]',
    }))
  }
  function collectErrors(page) {
    const errors = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push(e.message))
    return errors
  }

  test('390x844: masters に取込カード / /admin/import 到達 / 戻る動線 / console errors 0', async ({ page }) => {
    const errors = collectErrors(page)
    await setupAuth(page, { role: 'admin' })
    await mockRest(page)
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/admin/masters')
    await expect(page.getByTestId('hub-tile-取込')).toBeVisible()

    await page.goto('/admin/import')
    await expect(page.getByText('iPad以上の画面で開いてください')).toBeVisible()
    await expect(page.getByText('← 戻る')).toBeVisible()

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('iPad幅: PCH取込カード + SGP状態確認 表示 / console errors 0', async ({ page }) => {
    const errors = collectErrors(page)
    await setupAuth(page, { role: 'admin' })
    await mockRest(page, '0-2426/2427')
    await page.setViewportSize({ width: 1024, height: 1366 })

    await page.goto('/admin/import')
    await expect(page.getByTestId('pch-import-card')).toBeVisible()
    await expect(page.getByText('SGP状態確認')).toBeVisible()
    await expect(page.getByText('change過去CSV取込')).toBeVisible()

    expect(errors, errors.join('\n')).toEqual([])
  })
})
