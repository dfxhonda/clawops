import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-06 gate_4 (input側): 自示署名廃止 — 署名なしで確定可能、レシート/確定/PDF動作。

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
const TINY_PNG = Buffer.from(TINY_PNG_BASE64, 'base64')

test.describe('J-COLLECTION-12 input', () => {
  test('mobile 390x844: R2削除確認/R3 2段サイン/R4 20pt閾値/弊社署名Storage/確定/PDF (console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin', staffId: 'staff-test-001', name: 'テスト担当' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    const inserted: any = { collections: [], booths: [] }
    const storageUploads: string[] = []
    const storageDeletes: string[] = [] // J-COLLECTION-09 fix_4

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    // J-COLLECTION-09 fix_4: Storage DELETE は POST '/storage/v1/object/receipts' (body=prefixes[]) で来る。
    await page.route('**/storage/v1/object/receipts', async route => {
      if (route.request().method() === 'DELETE') {
        storageDeletes.push(route.request().postData() || '')
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return
      }
      await route.continue()
    })
    await page.route('**/storage/v1/object/receipts/**', async route => {
      // PUT/POST upload (upsert) + GET (publicUrl 直 fetch は別経路) を一律 200。
      const m = route.request().method()
      if (m === 'DELETE') {
        storageDeletes.push(route.request().url())
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return
      }
      storageUploads.push(route.request().url())
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'receipts/x' }) })
    })
    await page.route('**/rest/v1/stores**', async route => {
      // J-COLLECTION-13: getCollectionDetail 側 single 取得時に billing_entity_id を返して issuer 解決
      const body = isObj(route)
        ? { store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)', billing_entity_id: '5a3b7937-be08-46cf-948e-4c480902dd41' }
        : [{ store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店(正式)', is_active: true }]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    // J-COLLECTION-13: billing_entities fetch → naceland 完全行を返し、issuer ヘッダ+角印 path を実走
    await page.route('**/rest/v1/billing_entities**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: '5a3b7937-be08-46cf-948e-4c480902dd41',
        company_name: '株式会社ナイスランド',
        zip: '〒901-2133',
        address: '沖縄県浦添市城間3-15-1 レジデンス吉元102',
        tel: 'TEL/FAX 098-874-8106',
        seal_image_path: null,
      }),
    }))
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

    // J-COLLECTION-12 R3: 初期は「サイン」ボタン (signature canvas 非表示)
    await expect(page.getByTestId('collection-sign-toggle-button')).toBeVisible()
    await expect(page.getByTestId('signature-canvas')).toHaveCount(0)
    await expect(page.getByTestId('collection-confirm-button')).toHaveCount(0)

    // レシート撮影
    await page.setInputFiles('[data-testid="booth-receipt-input-TST01-M04-B02"]', {
      name: 'r.png', mimeType: 'image/png', buffer: TINY_PNG,
    })
    await expect.poll(() => storageUploads.length).toBeGreaterThan(0)
    const uploadsAfterFirst = storageUploads.length

    // J-COLLECTION-12 R2: × → 確認ダイアログ。背景タップ=キャンセル (写真残る)
    const deleteBtn = page.getByTestId('booth-receipt-delete-TST01-M04-B02')
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()
    await expect(page.getByTestId('receipt-delete-dialog')).toBeVisible()
    // 背景タップでキャンセル
    await page.getByTestId('receipt-delete-dialog-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('receipt-delete-dialog')).toHaveCount(0)
    expect(storageDeletes.length).toBe(0)
    await expect(deleteBtn).toBeVisible() // 写真は残ったまま

    // 再 ×→ 「キャンセル」ボタン
    await deleteBtn.click()
    await page.getByTestId('receipt-delete-cancel').click()
    await expect(page.getByTestId('receipt-delete-dialog')).toHaveCount(0)
    expect(storageDeletes.length).toBe(0)
    await expect(deleteBtn).toBeVisible()

    // 再 ×→ 「削除」ボタン → 実削除
    await deleteBtn.click()
    await page.getByTestId('receipt-delete-confirm').click()
    await expect(deleteBtn).toHaveCount(0)
    await expect.poll(() => storageDeletes.length).toBeGreaterThan(0)

    // 再アップロード
    await page.setInputFiles('[data-testid="booth-receipt-input-TST01-M04-B02"]', {
      name: 'r2.png', mimeType: 'image/png', buffer: TINY_PNG,
    })
    await expect.poll(() => storageUploads.length).toBeGreaterThan(uploadsAfterFirst)

    // J-COLLECTION-12 R3: 「サイン」タップで signature canvas 出現
    await page.getByTestId('collection-sign-toggle-button').click()
    await expect(page.getByTestId('signature-canvas')).toBeVisible()
    // canvas 出現直後 (points=0) は「サイン」 disabled、 'collection-confirm-button' は disabled state で表示
    await expect(page.getByTestId('collection-confirm-button')).toBeDisabled()
    await expect(page.getByTestId('collection-confirm-button')).toHaveText('サイン')

    // J-COLLECTION-12 R4: 20pt 未満は disabled のまま (3 move dispatch のみ → points=3)
    const canvas = page.getByTestId('signature-canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('signature canvas box not found')
    await page.mouse.move(box.x + 20, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 30, box.y + 35)
    await page.mouse.move(box.x + 40, box.y + 40)
    await page.mouse.move(box.x + 50, box.y + 45)
    await page.mouse.up()
    await expect(page.getByTestId('collection-confirm-button')).toBeDisabled()
    await expect(page.getByTestId('collection-confirm-button')).toHaveText('サイン')

    // 20pt 以上で「確定」 enabled に変化 (追加で 30 移動で計 33+)
    await page.mouse.move(box.x + 60, box.y + 50)
    await page.mouse.down()
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(box.x + 60 + i * 3, box.y + 50 + (i % 5))
    }
    await page.mouse.up()
    await expect(page.getByTestId('collection-confirm-button')).toBeEnabled()
    await expect(page.getByTestId('collection-confirm-button')).toHaveText('確定')

    await page.getByTestId('collection-confirm-button').click()
    await expect(page.getByTestId('collection-confirmed-badge')).toBeVisible()
    expect(inserted.collections[0].status).toBe('confirmed')

    // J-COLLECTION-09 fix_1: 弊社署名がStorage保存され、staff_signature_url が cash_collections POST に乗る
    expect(storageUploads.some(u => u.includes('staff_sig.png'))).toBe(true)
    expect(inserted.collections[0].staff_signature_url).toBeTruthy()
    expect(inserted.collections[0].staff_signature_path).toContain('staff_sig.png')

    // 確定後は × ボタン消失 (locked → 非表示)
    await expect(page.getByTestId('booth-receipt-delete-TST01-M04-B02')).toHaveCount(0)

    const dl = page.waitForEvent('download')
    await page.getByTestId('collection-pdf-button').click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('.pdf')

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
