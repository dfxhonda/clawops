import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-COLLECTION-ACTIVE-FIELD-HIGHLIGHT-01 (D-054) gate_4:
// 390x844 で集金入力の金種行を開き、1フィールドをアクティブ化した状態の視覚証跡を撮る。
// AC1/AC2 の機械検証は vitest 側 (collectionActiveFieldHighlight.test.jsx)。ここは screenshot 専用。

const BOOTH = 'TST01-M04-B02'

test.describe('D-054 active field highlight gate_4', () => {
  test('mobile 390x844: denom row with one active field screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin', staffId: 'staff-test-001', name: 'テスト担当' })

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/stores**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)', locality: 'テスト', locality_kana: 'テスト', is_active: true }]),
    }))
    // ピン留めして StorePickerSheet の既定 ★ タブに TST01 を表示させる
    await page.route('**/rest/v1/staff_pinned_stores**', async r => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([{ store_code: 'TST01' }]),
    }))
    await page.route('**/rest/v1/booths**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: BOOTH, machine_code: 'TST01-M04', booth_number: 2, booth_label: null, is_active: true }]),
    }))
    await page.route('**/rest/v1/machines**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ machine_code: 'TST01-M04', machine_name: '機械A', machine_number: null }]),
    }))
    await page.route('**/rest/v1/meter_readings**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: BOOTH, in_meter: 150, patrol_date: '2026-05-22', created_at: '2026-05-22T10:00:00Z' }]),
    }))
    await page.route('**/rest/v1/cash_collections**', async route => {
      const m = route.request().method()
      if (m === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()
    await page.getByTestId('store-picker-trigger').click()
    await page.getByTestId('store-picker-item-TST01').click()
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()

    // 金種行を開く
    await page.getByTestId(`booth-amount-${BOOTH}`).click()
    const denomRow = page.getByTestId(`denom-inline-${BOOTH}`)
    await expect(denomRow).toBeVisible()

    // 1フィールドをアクティブ化 (onPointerDown -> activate -> currentField.testId 一致で強調)
    const field = page.getByTestId(`denom-input-bill_10000-${BOOTH}`)
    await field.dispatchEvent('pointerdown')

    // 強調が乗ったこと (2px ring boxShadow) を確認してから撮影
    await expect(page.getByTestId('numpad-active-label')).toContainText('入力中')
    await expect.poll(async () => field.evaluate(el => (el as HTMLElement).style.boxShadow)).not.toBe('')

    await page.screenshot({ path: 'test-results/d054-active-field-390x844.png', fullPage: false })
    // 金種行のクローズアップも
    await denomRow.screenshot({ path: 'test-results/d054-denom-row-390x844.png' })
  })
})
