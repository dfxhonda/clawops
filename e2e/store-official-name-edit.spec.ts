import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-STORE-OFFICIAL-NAME-EDIT-01 (D-057) gate_4:
// 390x844 で店舗編集フォームに「正式名称」フィールドが表示されることの視覚証跡。
// AC1 の機械検証は vitest 側 (storeOfficialNameEdit.test.jsx)。ここは screenshot 専用。

const STORE = {
  store_code: 'TST01', store_name: 'テスト店舗', store_name_official: 'テスト店舗(正式)',
  brand_name: 'TESTブランド', store_type: '', phone: '', address: '', region: '',
  locality: '', locality_kana: '', is_active: true, opened_at: null, closed_at: null,
  is_collection_day: false, notes: '',
}

function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test.describe('D-057 store official name edit gate_4', () => {
  test('mobile 390x844: 正式名称 field in edit form screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    await page.route('**/rest/v1/**', jsonRoute([]))
    await page.route('**/rest/v1/stores**', jsonRoute([STORE]))

    await page.goto('/admin/masters/store-list')
    await page.getByTestId('store-list-new-button').click()

    const official = page.getByTestId('store-edit-name-official')
    await expect(official).toBeVisible()
    await expect(page.getByText('集金帳票の宛名に使用。空の場合は店舗名を使用')).toBeVisible()

    // フォールバック placeholder 可視化 + 入力状態を撮る
    await page.getByTestId('store-edit-name').fill('ドンキ鹿児島')
    await expect(official).toHaveAttribute('placeholder', 'ドンキ鹿児島')
    await official.fill('株式会社ナイスランド鹿児島店')

    await page.screenshot({ path: 'test-results/d057-store-official-390x844.png', fullPage: false })
    await page.getByTestId('store-list-modal').screenshot({ path: 'test-results/d057-store-official-modal.png' })
  })
})
