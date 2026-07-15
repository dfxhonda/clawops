import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) gate_4 (AC6):
// 390x844 集金入力: 金種展開(Collapse)→金種入力(numpad)→閉→レシートボタンタップ、console error ゼロ。

const BOOTH = 'TST01-M04-B02'
function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test.describe('D-069 collection motion gate_4', () => {
  test('mobile 390x844: 金種展開->入力->閉->レシート (console errors 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'manager', staffId: 'staff-test-001', name: 'テスト管理者' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    await page.route('**/rest/v1/**', jsonRoute([]))
    await page.route('**/rest/v1/stores**', async route => {
      const isObj = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
        isObj ? { store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店', is_active: true }
              : [{ store_code: 'TST01', store_name: 'テスト店', locality: 'テスト', locality_kana: 'テスト', is_active: true }]) })
    })
    await page.route('**/rest/v1/staff_pinned_stores**', jsonRoute([{ store_code: 'TST01' }]))
    await page.route('**/rest/v1/booths**', jsonRoute([{ booth_code: BOOTH, machine_code: 'TST01-M04', booth_number: 2, booth_label: null, is_active: true }]))
    await page.route('**/rest/v1/machines**', jsonRoute([{ machine_code: 'TST01-M04', machine_name: '機械A', machine_number: null }]))
    await page.route('**/rest/v1/meter_readings**', jsonRoute([{ booth_code: BOOTH, in_meter: 150, patrol_date: '2026-05-22', created_at: '2026-05-22T10:00:00Z' }]))
    await page.route('**/rest/v1/cash_collections**', async route => {
      if (route.request().method() === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/cash_collection_booths**', jsonRoute([]))
    await page.route('**/rest/v1/nextCollectionId**', jsonRoute({}))

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()
    await page.getByTestId('store-picker-trigger').click()
    await page.getByTestId('store-picker-item-TST01').click()
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()

    // 金種展開 (Collapse open)
    await page.getByTestId(`booth-amount-${BOOTH}`).click()
    const denomField = page.getByTestId(`denom-input-bill_10000-${BOOTH}`)
    await expect(denomField).toBeVisible()

    // 金種入力: numpad open (slot) -> 数字キー
    await denomField.dispatchEvent('pointerdown')
    await expect(page.getByTestId('numpad-active-label')).toContainText('入力中')
    await page.locator('[data-numpad-key="1"]').dispatchEvent('pointerdown')
    await expect(denomField).toHaveValue('1')

    await page.screenshot({ path: 'test-results/d069-collection-motion-390x844.png', fullPage: false })

    // 閉じる
    await page.getByTestId(`denom-close-${BOOTH}`).click()

    // レシートボタンタップ (誤爆せず反応すること)
    await expect(page.getByTestId(`booth-receipt-btn-${BOOTH}`)).toBeVisible()
    await page.getByTestId(`booth-receipt-btn-${BOOTH}`).click({ trial: true })

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
