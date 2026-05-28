import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-05 gate_4: viewport 390x844
// fix_A PDFヘッダ/注意書き(画面に影響なし、PDF生成検証は download まで)
// fix_B 署名Canvas (描画してconfirm有効化)
// fix_C レシート撮影 → Storage upload (mock) → receipt_photo_url 保存検証
// fix_D PDF page2+ レシートページ (downloadのみ検証)
// fix_E 前回IN = patrol_date>=prev_date 最古 (effective prev = 自動confirmed)

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

// 1x1 PNG (compressImage が読み込めれば何でも良い)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
const TINY_PNG = Buffer.from(TINY_PNG_BASE64, 'base64')

test.describe('J-COLLECTION-05', () => {
  test('mobile 390x844: 署名+レシート+確定+PDF (console 0)', async ({ page }) => {
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
    // fix_E: patrol_date >= effectivePrev の最古 in_meter (150)
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
      // confirmed list (auto prev_date 取得)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ collection_id: 'PREV-01', collected_at: '2026-05-20' }]) })
    })
    await page.route('**/rest/v1/cash_collection_booths**', async route => {
      const m = route.request().method()
      if (m === 'POST') { inserted.booths.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); return }
      // PDF detail
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        id: 'b1', collection_id: 'TST01-20260528-01', booth_code: 'TST01-M04-B02',
        machine_code: 'TST01-M04', total: 5000, advance_payment: 0, notes: null,
        in_meter_prev: 150, in_meter_current: 150,
        receipt_photo_url: null, receipt_photo_path: null,
      }]) })
    })

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()

    await page.getByTestId('collection-store-select').selectOption('TST01')
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()

    // fix_E: 前回IN=150 (patrol_date>=自動prev の最古 in_meter)
    await expect(page.getByTestId('booth-in-prev-TST01-M04-B02')).toHaveValue('150')

    // fix_C: レシート撮影 → 圧縮 → Storage upload → サムネ表示
    await page.setInputFiles('[data-testid="booth-receipt-input-TST01-M04-B02"]', {
      name: 'r.png', mimeType: 'image/png', buffer: TINY_PNG,
    })
    await expect.poll(() => storageUploads.length).toBeGreaterThan(0)

    // 確定ボタンは署名なしでdisabled
    await expect(page.getByTestId('collection-confirm-button')).toBeDisabled()

    // fix_B: 署名Canvas に線描画
    const canvas = page.getByTestId('signature-canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas box not found')
    await page.mouse.move(box.x + 10, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + 60)
    await page.mouse.move(box.x + 150, box.y + 80)
    await page.mouse.up()
    await expect(page.getByTestId('collection-confirm-button')).toBeEnabled()

    // 確定 -> receipt_photo_url が payloadに乗る
    await page.getByTestId('collection-confirm-button').click()
    await expect(page.getByTestId('collection-confirmed-badge')).toBeVisible()
    expect(inserted.collections[0].status).toBe('confirmed')
    const b0 = inserted.booths[0][0]
    expect(typeof b0.receipt_photo_url).toBe('string')
    expect(b0.receipt_photo_url).toContain('receipts')

    // PDF (page1=サマリ+署名、page2=レシート、download発火)
    const dl = page.waitForEvent('download')
    await page.getByTestId('collection-pdf-button').click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('.pdf')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
