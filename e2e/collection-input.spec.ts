import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-03 gate_4: viewport 390x844 全フロー (1行テーブルレイアウト)
// 列: レンタルコード/機械名/ブース/前回IN/今回IN/差/集金額/立替/備考
// login -> /collection/input -> 店舗選択 -> 読込 -> テーブル表示 ->
// 前回IN入力 -> 差自動計算 -> 集金額(金種ドロワー)+立替+備考 -> 確定 -> PDF

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

test.describe('J-COLLECTION-03', () => {
  test('mobile 390x844: テーブル表示 -> 前回IN/差/金種/立替/備考 -> 確定 -> PDF (console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin', staffId: 'staff-test-001', name: 'テスト担当' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    const inserted: any = { collections: [], booths: [] }

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.route('**/rest/v1/stores**', async route => {
      const body = isObj(route)
        ? { store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)' }
        : [{ store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)', is_active: true }]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.route('**/rest/v1/booths**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: 'TST01-M01-B01', machine_code: 'TST01-M01', booth_number: 1, booth_label: null, is_active: true }]),
    }))
    await page.route('**/rest/v1/machines**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ machine_code: 'TST01-M01', machine_name: '機械A', machine_number: 'R-001' }]),
    }))
    await page.route('**/rest/v1/meter_readings**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: 'TST01-M01-B01', in_meter: 100, out_meter: null, patrol_date: '2026-05-26', created_at: '2026-05-26T10:00:00Z' }]),
    }))
    await page.route('**/rest/v1/cash_collections**', async route => {
      const m = route.request().method()
      if (m === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      if (m === 'POST') { inserted.collections.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ collection_id: 'X-01', store_code: 'TST01', collected_at: '2026-05-28', prev_collection_date: null, status: 'confirmed' }) })
    })
    await page.route('**/rest/v1/cash_collection_booths**', async route => {
      const m = route.request().method()
      if (m === 'POST') { inserted.booths.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'b1', collection_id: 'X-01', booth_code: 'TST01-M01-B01', machine_code: 'TST01-M01', total: 5000, advance_payment: 100, notes: 'テスト備考', bill_1000: 5, in_meter_prev: 50, in_meter_current: 100 }]) })
    })

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()

    await page.getByTestId('collection-store-select').selectOption('TST01')
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()
    await expect(page.getByTestId('collection-booth-row')).toHaveCount(1)

    // レンタルコード = machine_number 'R-001'、ブース = B01 (booth_label null → fallback)
    await expect(page.getByText('R-001').first()).toBeVisible()
    await expect(page.getByText('B01').first()).toBeVisible()

    // 今回IN プリフィル(100)
    await expect(page.getByTestId('booth-in-cur-TST01-M01-B01')).toHaveValue('100')
    // 前回IN 入力 50 → 差 +50
    await page.getByTestId('booth-in-prev-TST01-M01-B01').fill('50')
    await expect(page.getByTestId('booth-in-diff-TST01-M01-B01')).toHaveText('+50')

    // 集金額: 金種ドロワー千5枚
    await page.getByTestId('booth-amount-TST01-M01-B01').click()
    await expect(page.getByTestId('denom-drawer')).toBeVisible()
    await page.getByTestId('denom-input-bill_1000').fill('5')
    await expect(page.getByTestId('denom-subtotal')).toHaveText('5,000 円')
    await page.getByTestId('denom-done').click()

    // 立替 + 備考
    await page.getByTestId('booth-advance-TST01-M01-B01').fill('100')
    await page.getByTestId('booth-notes-TST01-M01-B01').fill('テスト備考')

    // 合計 (advance除く)
    await expect(page.getByTestId('collection-total')).toHaveText('5,000 円')

    // 確定
    await page.getByTestId('collection-confirm-button').click()
    await expect(page.getByTestId('collection-confirmed-badge')).toBeVisible()
    expect(inserted.collections[0].status).toBe('confirmed')
    expect(inserted.collections[0].collected_by).toBe('staff-test-001')
    const b0 = inserted.booths[0][0]
    expect(b0.advance_payment).toBe(100)
    expect(b0.notes).toBe('テスト備考')
    expect(b0.bill_1000).toBe(5)
    expect(Number(b0.in_meter_prev)).toBe(50)

    // PDF
    const dl = page.waitForEvent('download')
    await page.getByTestId('collection-pdf-button').click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('.pdf')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
