import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

/**
 * OCR一式(UNIFY-01)フロー E2E: 読み取り(ファイル入力) → ocr-meter モック → 確認画面(3分割)。
 * ocr-meter edge function と storage を全モックして token0 で実行。
 */
function injectState(page, path, state) {
  return page.addInitScript(
    ({ p, s }) => { window.history.replaceState({ usr: s, key: 'e2e-ocr' }, '', p) },
    { p: path, s: state },
  )
}

// 1x1 の有効JPEG (canvas decode 用)
const JPEG_1x1_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q=='

test('読み取り → OCR(ocr-meterモック) → 確認画面3分割に値が入る', async ({ page }) => {
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)

  // storage(写真アップロード)モック
  await page.route('**/storage/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: 'x.jpg', Key: 'meter-photos/x.jpg', signedURL: '/s/x.jpg', signedUrl: '/s/x.jpg' }) }),
  )
  // ocr-meter edge function モック (meters + 後方互換 left_in)
  await page.route('**/functions/v1/ocr-meter', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        meters: [
          { label: 'IN', type: 'in', value: 12345, confidence: 0.9 },
          { label: 'OUT', type: 'out', value: 3000, confidence: 0.9 },
        ],
        confidence: 0.9,
        raw_text: '',
        left_in: 12345, left_out: 3000, right_in: null, right_out: null,
      }),
    }),
  )

  const machine = {
    machine_code: 'TST01-M001', machine_name: 'テスト機', store_code: 'TST01',
    machine_models: { out_meter_count: 1, meter_unit_price: 100 },
    booths: [{ booth_code: 'TST-M01-B01', booth_number: 1 }],
  }
  const state = {
    machine, booth: machine.booths[0], storeCode: 'TST01',
    boothList: [{ booth: machine.booths[0], machine }], boothIndex: 0,
  }
  await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
  await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

  // 「読み取り」のファイル入力に画像を渡す(=純正カメラ/ギャラリーで撮った想定)
  await expect(page.getByText('読み取り')).toBeVisible({ timeout: 10_000 })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'meter.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(JPEG_1x1_B64, 'base64'),
  })

  // 確認画面(3分割): 使う/撮り直す + OCR値が IN欄に反映
  await expect(page.getByText('使う')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('撮り直す')).toBeVisible()
  await expect(page.getByTestId('ocr-confirm-in')).toHaveValue('12345')
})

test('OCR確認画面で✕を押すと 手入力フォームに戻る(confirmingが閉じる)', async ({ page }) => {
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)
  await page.route('**/storage/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: 'x.jpg', signedUrl: '/s/x.jpg' }) }),
  )
  await page.route('**/functions/v1/ocr-meter', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ meters: [{ label: 'IN', type: 'in', value: 12345, confidence: 0.9 }], confidence: 0.9, raw_text: '', left_in: 12345, left_out: null, right_in: null, right_out: null }),
    }),
  )

  const machine = {
    machine_code: 'TST01-M001', machine_name: 'テスト機', store_code: 'TST01',
    machine_models: { out_meter_count: 1, meter_unit_price: 100 },
    booths: [{ booth_code: 'TST-M01-B01', booth_number: 1 }],
  }
  const state = { machine, booth: machine.booths[0], storeCode: 'TST01', boothList: [{ booth: machine.booths[0], machine }], boothIndex: 0 }
  await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
  await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('読み取り')).toBeVisible({ timeout: 10_000 })
  await page.locator('input[type="file"]').setInputFiles({ name: 'm.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(JPEG_1x1_B64, 'base64') })

  // confirming表示 → ✕(閉じる)でフォーム復帰
  await expect(page.getByText('使う')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '閉じる' }).click()

  // フォームに戻る: 読み取りボタン復活 / 確認画面の「使う」は消える
  await expect(page.getByText('読み取り')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('使う')).toHaveCount(0)
})
