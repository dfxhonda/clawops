import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-STORE-REGISTER-TYPE-DROPDOWN-AND-ORG-DEFAULT-01 (D-063) gate_4:
// 390x844 店舗新規登録モーダルで店舗種別がドロップダウン描画されることの視覚証跡。
// insert org / store_type payload の機械検証は vitest (storeRegisterTypeOrgDefault01.test.jsx)。

function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test.describe('D-063 store register type dropdown gate_4', () => {
  test('mobile 390x844: 店舗種別 dropdown in new-store modal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    await page.route('**/rest/v1/**', jsonRoute([]))
    await page.route('**/rest/v1/stores**', jsonRoute([]))

    await page.goto('/admin/masters/store-list')
    await page.getByTestId('store-list-new-button').click()

    const typeSelect = page.getByTestId('store-edit-type')
    await expect(typeSelect).toBeVisible()
    // 5 正規化選択肢
    await expect(typeSelect.locator('option')).toHaveCount(5)
    await expect(typeSelect.locator('option')).toHaveText(['未設定', 'ドンキ', 'テナント', '外部', 'その他'])

    // donki を選択した状態を撮る
    await typeSelect.selectOption('donki')
    await page.getByTestId('store-edit-name').fill('日商天文館')

    await page.screenshot({ path: 'test-results/d063-store-type-390x844.png', fullPage: false })
    await page.getByTestId('store-list-modal').screenshot({ path: 'test-results/d063-store-type-modal.png' })
  })
})
