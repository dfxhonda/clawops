import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-06 gate_4 (history側):
// fix_1 PDFダウンロード正常 / fix_3 先方署名モーダル -> 描画 -> 保存 -> 署名済バッジ

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

test.describe('J-COLLECTION-11 history', () => {
  test('mobile 390x844: PDFダウンロード+staff/customer_sig埋込+先方署名→customer_sig.png保存+DB UPDATE+連打ガード (console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin', staffId: 'staff-test-001', name: 'テスト担当' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    let signedSaved = false
    let patchPayload: any = null
    const storageUploads: string[] = []
    // J-COLLECTION-09 fix_2 / J-COLLECTION-11: 弊社+先方署名 PNG fetch カウント
    let staffSigFetchCount = 0
    let customerSigFetchCount = 0
    const STAFF_SIG_URL = 'https://example.test/14e907a7-65a3-4891-9a3c-20ea0a7c14fd/TST01-20260528-01/staff_sig.png'
    const CUSTOMER_SIG_URL = 'https://example.test/14e907a7-65a3-4891-9a3c-20ea0a7c14fd/TST01-20260528-01/customer_sig.png'

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.route('**/storage/v1/object/receipts/**', async route => {
      storageUploads.push(route.request().url())
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'receipts/x' }) })
    })

    // J-COLLECTION-09 fix_2: staff_signature_url の publicUrl fetch を 1x1 PNG で応答
    const TINY_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    )
    await page.route(STAFF_SIG_URL, async route => {
      staffSigFetchCount += 1
      await route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
    })
    await page.route(CUSTOMER_SIG_URL, async route => {
      customerSigFetchCount += 1
      await route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
    })

    // cash_collections: list (no signed first) / PATCH signed update / single detail
    await page.route('**/rest/v1/cash_collections**', async route => {
      const m = route.request().method()
      if (m === 'PATCH') {
        patchPayload = JSON.parse(route.request().postData() || '{}')
        signedSaved = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return
      }
      if (isObj(route)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          collection_id: 'TST01-20260528-01', store_code: 'TST01', collected_at: '2026-05-28',
          prev_collection_date: null, status: 'confirmed', signed_pdf_url: signedSaved ? 'https://x/signed.pdf' : null,
          // J-COLLECTION-09 fix_2: staff_signature_url を返す
          staff_signature_url: STAFF_SIG_URL,
          staff_signature_path: '14e907a7-65a3-4891-9a3c-20ea0a7c14fd/TST01-20260528-01/staff_sig.png',
          // J-COLLECTION-11: 保存後は customer_signature_url を返す
          customer_signature_url: signedSaved ? CUSTOMER_SIG_URL : null,
          customer_signature_path: signedSaved ? '14e907a7-65a3-4891-9a3c-20ea0a7c14fd/TST01-20260528-01/customer_sig.png' : null,
        })}); return
      }
      // list
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        collection_id: 'TST01-20260528-01', store_code: 'TST01', collected_at: '2026-05-28',
        status: 'confirmed', collected_by: 'staff-test-001',
        signed_pdf_url: signedSaved ? 'https://x/signed.pdf' : null,
        customer_signed_at: signedSaved ? '2026-05-28T12:00:00Z' : null,
      }]) })
    })
    await page.route('**/rest/v1/cash_collection_booths**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'b1', collection_id: 'TST01-20260528-01', booth_code: 'TST01-M04-B02', machine_code: 'TST01-M04', total: 5000, advance_payment: 0, notes: null, in_meter_prev: 150, in_meter_current: 200, receipt_photo_url: null }]),
    }))
    await page.route('**/rest/v1/stores**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(isObj(r as any) ? { store_name: 'テスト店', store_name_official: 'テスト店(正式)' } : [{ store_code: 'TST01', store_name: 'テスト店' }]),
    }))
    await page.route('**/rest/v1/machines**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ machine_code: 'TST01-M04', machine_name: '機械A', machine_number: null }]),
    }))
    await page.route('**/rest/v1/booths**', async r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ booth_code: 'TST01-M04-B02', booth_label: null, booth_number: 2 }]),
    }))

    await page.goto('/collection/history')
    await expect(page.getByTestId('collection-history')).toBeVisible()
    await expect(page.getByTestId('collection-history-row')).toHaveCount(1)

    // fix_1: PDFダウンロード正常 (ERR-COLLECTION-003 が出ない、download発火)
    const dl = page.waitForEvent('download')
    await page.getByTestId('download-pdf-TST01-20260528-01').click()
    await (await dl).suggestedFilename()
    await expect(page.locator('text=ERR-COLLECTION-003')).toHaveCount(0)
    // J-COLLECTION-09 fix_2: download時にも staff_signature_url が fetch される
    expect(staffSigFetchCount).toBeGreaterThan(0)
    const fetchAfterDownload = staffSigFetchCount

    // fix_3: 先方署名モーダルを開く
    await page.getByTestId('sign-btn-TST01-20260528-01').click()
    await expect(page.getByTestId('customer-sign-modal')).toBeVisible()
    await expect(page.getByTestId('customer-sign-pdf')).toBeVisible()
    // J-COLLECTION-09 fix_2: モーダル open時にも staff_sig 取り直し
    expect(staffSigFetchCount).toBeGreaterThan(fetchAfterDownload)
    // 署名なしで保存は disabled
    await expect(page.getByTestId('customer-sign-save')).toBeDisabled()

    // signature 描画
    const canvas = page.getByTestId('signature-canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas box not found')
    await page.mouse.move(box.x + 20, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 100, box.y + 70)
    await page.mouse.move(box.x + 180, box.y + 90)
    await page.mouse.up()
    await expect(page.getByTestId('customer-sign-save')).toBeEnabled()

    // 保存 -> Storage upload + cash_collections PATCH + トースト + 署名済バッジ
    await page.getByTestId('customer-sign-save').click()
    await expect(page.getByTestId('signed-toast')).toBeVisible()
    expect(storageUploads.some(u => u.includes('signed.pdf'))).toBe(true)
    // J-COLLECTION-11 fix_A: 先方署名 PNG が Storage に保存され、URL が DB に書き戻される
    expect(storageUploads.some(u => u.includes('customer_sig.png'))).toBe(true)
    expect(patchPayload?.signed_pdf_url).toBeTruthy()
    expect(patchPayload?.customer_signed_at).toBeTruthy()
    expect(patchPayload?.customer_signature_url).toBeTruthy()
    expect(patchPayload?.customer_signature_path).toContain('customer_sig.png')
    await expect(page.getByTestId('signed-badge-TST01-20260528-01')).toBeVisible()

    // J-COLLECTION-11 fix_B: PDF生成 連打ガード。
    //   await click() を直列に並べると 1 click → downloadPdf 完走 → 次 click... となり
    //   ref ロックが解除されたタイミングで通り抜けてしまう (本番iOSのタップ間隔より test の方が遅い)。
    //   実機の連打を再現するため、page.evaluate で同期的に 5 click を発火し、
    //   React state コミット前に複数の onClick を当てる。
    let dlCount = 0
    page.on('download', () => { dlCount += 1 })
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="download-pdf-TST01-20260528-01"]') as HTMLButtonElement | null
      if (!btn) throw new Error('download button not found')
      for (let i = 0; i < 5; i++) btn.click() // 同期 5 連打
    })
    await page.waitForTimeout(800) // download + 後続 fetch / state 反映を待つ
    expect(dlCount).toBeLessThanOrEqual(1) // ref ロックで再入不能 → download は 1 回まで
    await expect(page.locator('text=ERR-COLLECTION-003')).toHaveCount(0)
    // 連打後 download 時にも customer_sig が DB から fetch される
    expect(customerSigFetchCount).toBeGreaterThan(0)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
