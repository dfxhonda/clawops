import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-06 gate_4 (input側): 自示署名廃止 — 署名なしで確定可能、レシート/確定/PDF動作。

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
const TINY_PNG = Buffer.from(TINY_PNG_BASE64, 'base64')

test.describe('J-COLLECTION-06 input', () => {
  test('mobile 390x844: 署名なしで確定OK + レシートupload + PDF (console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin', staffId: 'staff-test-001', name: 'テスト担当' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    const inserted: any = { collections: [], booths: [] }
    const storageUploads: string[] = []

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/storage/v1/object/receipts/**', async route => {
      storageUploads.push(route.request().url())
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'receipts/x' }) })
    })
    await page.route('**/rest/v1/stores**', async route => {
      const body = isObj(route)
        ? { store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)' }
        : [{ store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)', is_active: true }]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.route('**/rest/v1/booths**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: 'TST01-M04-B02', machine_code: 'TST01-M04', booth_number: 2, booth_label: null, is_active: true }]),
    }))
    await page.route('**/rest/v1/machines**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ machine_code: 'TST01-M04', machine_name: '機械A', machine_number: null }]),
    }))
    await page.route('**/rest/v1/meter_readings**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: 'TST01-M04-B02', in_meter: 150, patrol_date: '2026-05-22', created_at: '2026-05-22T10:00:00Z' }]),
    }))
    await page.route('**/rest/v1/cash_collections**', async route => {
      const m = route.request().method()
      if (m === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      if (m === 'POST') { inserted.collections.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      if (isObj(route)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ collection_id: 'TST01-20260528-01', store_code: 'TST01', collected_at: '2026-05-28', prev_collection_date: null, status: 'confirmed' })}); return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/cash_collection_booths**', async route => {
      const m = route.request().method()
      if (m === 'POST') { inserted.booths.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        id: 'b1', collection_id: 'TST01-20260528-01', booth_code: 'TST01-M04-B02',
        machine_code: 'TST01-M04', total: 0, advance_payment: 0, notes: null,
        in_meter_prev: 150, in_meter_current: 150,
        receipt_photo_url: null, receipt_photo_path: null,
      }]) })
    })

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()

    await page.getByTestId('collection-store-select').selectOption('TST01')
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()

    // SignatureCanvas が無い (fix_2)
    await expect(page.getByTestId('signature-canvas')).toHaveCount(0)
    // 署名なしでも 確定ボタン enabled
    await expect(page.getByTestId('collection-confirm-button')).toBeEnabled()

    // レシート撮影
    await page.setInputFiles('[data-testid="booth-receipt-input-TST01-M04-B02"]', {
      name: 'r.png', mimeType: 'image/png', buffer: TINY_PNG,
    })
    await expect.poll(() => storageUploads.length).toBeGreaterThan(0)

    await page.getByTestId('collection-confirm-button').click()
    await expect(page.getByTestId('collection-confirmed-badge')).toBeVisible()
    expect(inserted.collections[0].status).toBe('confirmed')

    const dl = page.waitForEvent('download')
    await page.getByTestId('collection-pdf-button').click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('.pdf')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
