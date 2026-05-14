import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * J-PATROL-OCR-fix-03: 8秒タイマー + 複数メーター3分割UI
 */

// /api/ocr をモックしてOCRTestPage の確認画面を経由せずにロジックを検証
test.describe('J-PATROL-OCR-fix-03: OCRTestPage', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    // storesをモック
    await page.route('**/rest/v1/stores*', route =>
      route.fulfill({ json: [{ store_code: 'TST01', store_name: 'テスト店' }] })
    )
    // machinesをモック (booth有り)
    await page.route('**/rest/v1/machines*', route =>
      route.fulfill({ json: [{ machine_code: 'TST01-M01', booths: [{ booth_code: 'TST01-B01' }] }] })
    )
  })

  // ダミーJPEGバッファ
  const dummyBuf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
  const dummyFile = [{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: dummyBuf }]

  async function captureWithMock(page) {
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    await fileChooser.setFiles(dummyFile)
  }

  test('J-PATROL-OCR-fix-03-a: 3秒応答 → 3カード表示', async ({ page }) => {
    await page.route('/api/ocr', async route => {
      await route.fulfill({
        json: {
          meters: [
            { value: 100, type: 'out_a', confidence: 0.95 },
            { value: 200, type: 'in',    confidence: 0.92 },
            { value: 120, type: 'out_b', confidence: 0.88 },
          ],
        },
      })
    })
    await captureWithMock(page)

    // 3カード表示を確認
    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('meter-card-1')).toBeVisible()
    await expect(page.getByTestId('meter-card-2')).toBeVisible()
  })

  test('J-PATROL-OCR-fix-03-b: confidence バッジ高/中/低表示', async ({ page }) => {
    await page.route('/api/ocr', route =>
      route.fulfill({
        json: {
          meters: [
            { value: 100, type: 'out_a', confidence: 0.95 },
            { value: 200, type: 'in',    confidence: 0.75 },
            { value: 120, type: 'out_b', confidence: 0.4  },
          ],
        },
      })
    )
    await captureWithMock(page)

    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    // 高バッジ
    await expect(page.getByTestId('meter-card-0').getByText('高')).toBeVisible()
    // 中バッジ
    await expect(page.getByTestId('meter-card-1').getByText('中')).toBeVisible()
    // 低バッジ
    await expect(page.getByTestId('meter-card-2').getByText('低')).toBeVisible()
  })

  test('J-PATROL-OCR-fix-03-c: タイムアウト → OCR失敗メッセージ表示', async ({ page }) => {
    // 10秒待ってもレスポンスを返さない (8秒でタイムアウト)
    await page.route('/api/ocr', async route => {
      await new Promise(r => setTimeout(r, 10000))
      await route.fulfill({ json: { meters: [] } })
    })
    await captureWithMock(page)

    await expect(page.getByText('OCR失敗、手入力してください')).toBeVisible({ timeout: 10000 })
  })

  test('J-PATROL-OCR-fix-03-d: 整合チェック非表示 — slate ラベルのみ表示', async ({ page }) => {
    // A=100, B=120, IN=200 → reconciliation は /ocr-test では非表示
    await page.route('/api/ocr', route =>
      route.fulfill({
        json: {
          meters: [
            { value: 100, type: 'out_a', confidence: 0.9 },
            { value: 200, type: 'in',    confidence: 0.9 },
            { value: 120, type: 'out_b', confidence: 0.9 },
          ],
        },
      })
    )
    await captureWithMock(page)

    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    // 整合チェック (警告/OK) は非表示
    await expect(page.getByTestId('reconciliation')).not.toBeVisible()
    // slate 小ラベルが表示される
    await expect(page.getByTestId('reconciliation-deferred')).toBeVisible()
    await expect(page.getByTestId('reconciliation-deferred')).toContainText('J-PATROL-OCR-fix-04')
  })

  test('J-PATROL-OCR-fix-03-e: 4メーター (三重OUT機) → 4カード表示', async ({ page }) => {
    await page.route('/api/ocr', route =>
      route.fulfill({
        json: {
          meters: [
            { value: 500, type: 'in',    confidence: 0.9 },
            { value: 100, type: 'out_a', confidence: 0.9 },
            { value: 120, type: 'out_b', confidence: 0.9 },
            { value:  80, type: 'out_c', confidence: 0.9 },
          ],
        },
      })
    )
    await captureWithMock(page)

    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('meter-card-1')).toBeVisible()
    await expect(page.getByTestId('meter-card-2')).toBeVisible()
    await expect(page.getByTestId('meter-card-3')).toBeVisible()
    // 整合チェックは非表示
    await expect(page.getByTestId('reconciliation')).not.toBeVisible()
  })

  test('J-PATROL-OCR-fix-03-f: カードタップで focused border 切替', async ({ page }) => {
    await page.route('/api/ocr', route =>
      route.fulfill({
        json: {
          meters: [
            { value: 100, type: 'out_a', confidence: 0.9 },
            { value: 200, type: 'in',    confidence: 0.9 },
            { value: 120, type: 'out_b', confidence: 0.9 },
          ],
        },
      })
    )
    await captureWithMock(page)

    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    // B段カード (index=2) をタップ
    await page.getByTestId('meter-card-2').click()
    // B段カードがフォーカスされたことを確認 (border color が rgb(139, 92, 246) = #8b5cf6)
    const card2Style = await page.getByTestId('meter-card-2').getAttribute('style')
    // ブラウザが hex → rgb 変換するため rgb 値で確認 (#8b5cf6 = rgb(139, 92, 246))
    expect(card2Style).toContain('139, 92, 246')
  })

  test('J-PATROL-OCR-fix-03-g: 単一メーター → 1カード・整合チェックなし', async ({ page }) => {
    await page.route('/api/ocr', route =>
      route.fulfill({
        json: { meters: [{ value: 12345, type: 'in', confidence: 0.95 }] },
      })
    )
    await captureWithMock(page)

    // 単一入力フィールドが表示され、reconciliation-deferred / meter-card-1 は表示されない
    await expect(page.locator('input[value="12345"]')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('reconciliation-deferred')).not.toBeVisible()
    await expect(page.getByTestId('meter-card-1')).not.toBeVisible()
  })
})
