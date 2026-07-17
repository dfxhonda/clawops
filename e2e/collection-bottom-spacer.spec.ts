import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-COLLECTION-BOTTOM-SPACER-01 (D-083): 集金リスト末尾の固定 50svh spacer で、numpad(最大70svh)迫り上がり時に
// 金種入力行を Slot より上へ逃がせることを chromium+webkit 両engineで検証。

const BOOTH = 'TST01-M04-B02'
function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test.use({ viewport: { width: 390, height: 844 } })

test.describe('D-083 collection bottom spacer', () => {
  test('spacer 実在(50svh) + 金種行が numpad Slot より上に可視', async ({ page }) => {
    await setupAuth(page, { role: 'manager', staffId: 'staff-test-001', name: 'テスト管理者' })

    await page.route('**/rest/v1/**', jsonRoute([]))
    await page.route('**/rest/v1/stores**', async (route) => {
      const isObj = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
        isObj ? { store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店', is_active: true }
              : [{ store_code: 'TST01', store_name: 'テスト店', locality: 'テスト', locality_kana: 'テスト', is_active: true }]) })
    })
    await page.route('**/rest/v1/staff_pinned_stores**', jsonRoute([{ store_code: 'TST01' }]))
    await page.route('**/rest/v1/booths**', jsonRoute([{ booth_code: BOOTH, machine_code: 'TST01-M04', booth_number: 2, booth_label: null, is_active: true }]))
    await page.route('**/rest/v1/machines**', jsonRoute([{ machine_code: 'TST01-M04', machine_name: '機械A', machine_number: null }]))
    await page.route('**/rest/v1/meter_readings**', jsonRoute([{ booth_code: BOOTH, in_meter: 150, patrol_date: '2026-05-22', created_at: '2026-05-22T10:00:00Z' }]))
    await page.route('**/rest/v1/cash_collections**', async (route) => {
      if (route.request().method() === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/cash_collection_booths**', jsonRoute([]))

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()
    await page.getByTestId('store-picker-trigger').click()
    await page.getByTestId('store-picker-item-TST01').click()
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()

    // AC1: spacer 実在 (height 50svh = 50% of 844 ≈ 422px)
    const spacer = page.getByTestId('collection-bottom-spacer')
    await expect(spacer).toBeAttached()
    const spacerBox = await spacer.boundingBox()
    expect(spacerBox && spacerBox.height).toBeGreaterThan(300) // 50svh は十分大きい

    // 金種展開 → 最下の金種フィールドをタップ → numpad open
    await page.getByTestId(`booth-amount-${BOOTH}`).click()
    const denomField = page.getByTestId(`denom-input-bill_10000-${BOOTH}`)
    await expect(denomField).toBeVisible()
    await denomField.dispatchEvent('pointerdown')
    await expect(page.getByTestId('numpad-active-label')).toContainText('入力中')
    await page.waitForTimeout(400) // numpad 展開 + scrollIntoView 追従

    // AC2: 当該金種行が numpad Slot より上に可視 (行の下端 <= Slot の上端)
    const fieldBox = await denomField.boundingBox()
    const slotBox = await page.getByTestId('numpad-slot').boundingBox()
    expect(fieldBox, 'denom field should be visible').not.toBeNull()
    expect(slotBox, 'numpad slot should be visible').not.toBeNull()
    if (fieldBox && slotBox) {
      expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(slotBox.y + 1)
    }
  })
})
