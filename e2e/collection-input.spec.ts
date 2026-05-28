import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-01 gate_4: viewport 390x844 全操作フロー
// login -> /collection/input -> 店舗/担当選択 -> 読込 -> ブース金種入力(テンキー) -> 確定 -> PDF出力
// console errors 0 / 確定後 PDFボタン有効化 / PDF生成(download)発火 を検証 (Supabase REST はモック)

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

const FLAGGED = [
  { store_code: 'SMD01', booth_code: 'SMD01-M01-B01', machine_code: 'SMD01-M01', in_meter: 100, out_meter: 50, patrol_date: '2026-04-14', is_collected: true },
]

test.describe('J-COLLECTION-01', () => {
  test('mobile 390x844: 店舗/担当選択->読込->金種入力->確定->PDF (console errors 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    const inserted: any = { collections: [], booths: [] }

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.route('**/rest/v1/meter_readings**', async r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FLAGGED) }))

    await page.route('**/rest/v1/stores**', async route => {
      const body = isObj(route)
        ? { store_code: 'SMD01', store_name: 'SMDテスト店', store_name_official: 'SMDテスト店(正式)' }
        : [{ store_code: 'SMD01', store_name: 'SMDテスト店', store_name_official: 'SMDテスト店(正式)' }]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.route('**/rest/v1/staff**', async r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ staff_id: 'st1', name: '担当太郎' }]) }))
    await page.route('**/rest/v1/machines**', async r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ machine_code: 'SMD01-M01', machine_name: '機械X' }]) }))
    await page.route('**/rest/v1/booths**', async r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ booth_code: 'SMD01-M01-B01', booth_number: 1 }]) }))

    await page.route('**/rest/v1/cash_collections**', async route => {
      const m = route.request().method()
      if (m === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      if (m === 'POST') { inserted.collections.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      // GET detail (single)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ collection_id: 'SMD01-20260414-01', store_code: 'SMD01', collected_at: '2026-04-14', status: 'confirmed' }) })
    })
    await page.route('**/rest/v1/cash_collection_booths**', async route => {
      const m = route.request().method()
      if (m === 'POST') { inserted.booths.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'b1', collection_id: 'SMD01-20260414-01', booth_code: 'SMD01-M01-B01', machine_code: 'SMD01-M01', total: 5000, bill_1000: 5, in_meter_prev: null, in_meter_current: 100, out_meter_prev: null, out_meter_current: 50 }]) })
    })

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()

    // 店舗 (is_collected店舗のみ) + 担当 選択 -> 読み込む
    await page.getByTestId('collection-store-select').selectOption('SMD01')
    await page.getByTestId('collection-staff-select').selectOption('st1')
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-booth-row')).toHaveCount(1)

    // ブース金種入力: 千を5枚 -> 小計5000 (非iPhone=native input経路)
    await page.getByTestId('collection-booth-row').first().click()
    await expect(page.getByTestId('denom-drawer')).toBeVisible()
    await page.getByTestId('denom-input-bill_1000').fill('5')
    await expect(page.getByTestId('denom-subtotal')).toHaveText('5,000 円')
    await page.getByTestId('denom-done').click()

    // 合計反映 -> 確定
    await expect(page.getByTestId('collection-total')).toHaveText('5,000 円')
    await page.getByTestId('collection-confirm-button').click()
    await expect(page.getByTestId('collection-confirmed-badge')).toBeVisible()
    expect(inserted.collections[0].status).toBe('confirmed')
    expect(inserted.booths[0][0].bill_1000).toBe(5)

    // PDF出力 -> download発火
    const dl = page.waitForEvent('download')
    await page.getByTestId('collection-pdf-button').click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('.pdf')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
