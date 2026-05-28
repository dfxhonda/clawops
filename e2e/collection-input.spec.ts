import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-02 gate_4: viewport 390x844 全フロー
// login -> /collection/input -> 集金日(today)/前回集金日(空)/店舗選択 -> 読込
// -> 集金額(金種ドロワー)+立替(直入力) -> 確定 -> PDF出力
// console errors 0 / 確定後 PDFボタン有効 / advance_payment保存 を検証

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

test.describe('J-COLLECTION-02', () => {
  test('mobile 390x844: 日付/店舗->読込->金種/立替->確定->PDF (console errors 0)', async ({ page }) => {
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
      body: JSON.stringify([{ booth_code: 'TST01-M01-B01', machine_code: 'TST01-M01', booth_number: 1, booth_label: 'B01', is_active: true }]),
    }))
    await page.route('**/rest/v1/machines**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ machine_code: 'TST01-M01', machine_name: '機械A' }]),
    }))
    await page.route('**/rest/v1/meter_readings**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: 'TST01-M01-B01', in_meter: 100, out_meter: 50, patrol_date: '2026-05-26', created_at: '2026-05-26T10:00:00Z' }]),
    }))
    await page.route('**/rest/v1/cash_collections**', async route => {
      const m = route.request().method()
      if (m === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      if (m === 'POST') {
        inserted.collections.push(JSON.parse(route.request().postData() || '{}'))
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return
      }
      // GET single detail (PDF表示用)
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ collection_id: 'TST01-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-01', store_code: 'TST01', collected_at: '2026-05-28', prev_collection_date: null, status: 'confirmed' }),
      })
    })
    await page.route('**/rest/v1/cash_collection_booths**', async route => {
      const m = route.request().method()
      if (m === 'POST') {
        inserted.booths.push(JSON.parse(route.request().postData() || '{}'))
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ id: 'b1', collection_id: 'X', booth_code: 'TST01-M01-B01', machine_code: 'TST01-M01', total: 5000, advance_payment: 100, bill_1000: 5, in_meter_prev: null, in_meter_current: 100, out_meter_prev: null, out_meter_current: 50 }]),
      })
    })

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()

    // 店舗選択 -> 読込
    await page.getByTestId('collection-store-select').selectOption('TST01')
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-booth-row')).toHaveCount(1)

    // メーターcurrentが最新meter_readingsからプリフィルされている
    await expect(page.getByTestId('booth-in-TST01-M01-B01')).toHaveValue('100')
    await expect(page.getByTestId('booth-out-TST01-M01-B01')).toHaveValue('50')

    // 集金額: タップ -> 金種ドロワー -> 千5枚 (native input on chromium)
    await page.getByTestId('booth-amount-TST01-M01-B01').click()
    await expect(page.getByTestId('denom-drawer')).toBeVisible()
    await page.getByTestId('denom-input-bill_1000').fill('5')
    await expect(page.getByTestId('denom-subtotal')).toHaveText('5,000 円')
    await page.getByTestId('denom-done').click()

    // 立替を直入力 (native NumpadField)
    await page.getByTestId('booth-advance-TST01-M01-B01').fill('100')

    // 合計反映 (advance除く)
    await expect(page.getByTestId('collection-total')).toHaveText('5,000 円')

    // 確定 -> PDF
    await page.getByTestId('collection-confirm-button').click()
    await expect(page.getByTestId('collection-confirmed-badge')).toBeVisible()
    expect(inserted.collections[0].status).toBe('confirmed')
    expect(inserted.collections[0].collected_by).toBe('staff-test-001')
    expect(inserted.booths[0][0].advance_payment).toBe(100)
    expect(inserted.booths[0][0].bill_1000).toBe(5)

    const dl = page.waitForEvent('download')
    await page.getByTestId('collection-pdf-button').click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('.pdf')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
