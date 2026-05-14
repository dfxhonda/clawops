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
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    // ギャラリーボタンで画像選択をシミュレート
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    // 1x1 JPEG をダミーとして渡す
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

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
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    // 高バッジ
    await expect(page.getByTestId('meter-card-0').getByText('高')).toBeVisible()
    // 中バッジ
    await expect(page.getByTestId('meter-card-1').getByText('中')).toBeVisible()
    // 低バッジ
    await expect(page.getByTestId('meter-card-2').getByText('低')).toBeVisible()
  })

  test('J-PATROL-OCR-fix-03-c: 整合NG — A+B≠IN で警告表示', async ({ page }) => {
    // A=100, B=120, IN=200 → A+B=220, 差=20 → NG
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
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

    await expect(page.getByTestId('reconciliation')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('reconciliation')).toContainText('警告')
    await expect(page.getByTestId('reconciliation')).toContainText('差=20')
  })

  test('J-PATROL-OCR-fix-03-d: 整合OK — A+B=IN で emerald 表示', async ({ page }) => {
    // A=100, B=120, IN=220 → A+B=220, 差=0 → OK
    await page.route('/api/ocr', route =>
      route.fulfill({
        json: {
          meters: [
            { value: 100, type: 'out_a', confidence: 0.9 },
            { value: 220, type: 'in',    confidence: 0.9 },
            { value: 120, type: 'out_b', confidence: 0.9 },
          ],
        },
      })
    )
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

    await expect(page.getByTestId('reconciliation')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('reconciliation')).toContainText('整合 OK')
    await expect(page.getByTestId('reconciliation')).toContainText('A+B=220')
  })

  test('J-PATROL-OCR-fix-03-e: タイムアウト → OCR失敗メッセージ表示', async ({ page }) => {
    // 10秒待ってもレスポンスを返さない (8秒でタイムアウト)
    await page.route('/api/ocr', async route => {
      await new Promise(r => setTimeout(r, 10000))
      await route.fulfill({ json: { meters: [] } })
    })
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

    await expect(page.getByText('OCR失敗、手入力してください')).toBeVisible({ timeout: 10000 })
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
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

    await expect(page.getByTestId('meter-card-0')).toBeVisible({ timeout: 5000 })
    // B段カード (index=2) をタップ
    await page.getByTestId('meter-card-2').click()
    // B段カードがフォーカスされたことを確認 (border color が border に含まれる)
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
    await page.goto('/ocr-test')
    await page.selectOption('select:nth-of-type(1)', 'TST01')
    await page.selectOption('select:nth-of-type(2)', 'TST01-B01')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('ギャラリーから選択').click(),
    ])
    const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC', 'base64')
    await fileChooser.setFiles([{ name: 'test.jpg', mimeType: 'image/jpeg', buffer: buf }])

    // 単一入力フィールドが表示され、reconciliation は表示されない
    await expect(page.locator('input[value="12345"]')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('reconciliation')).not.toBeVisible()
    await expect(page.getByTestId('meter-card-1')).not.toBeVisible()
  })
})
