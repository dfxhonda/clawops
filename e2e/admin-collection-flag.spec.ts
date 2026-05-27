import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-COLLECTION-FLAG-01 gate_4: viewport 390x844 全操作フロー
// login -> /admin/collection-flag -> 店舗/巡回日選択 -> 読込 -> 一括集金済 -> 個別トグル -> 保存
// console errors 0 / 集金タブ表示 / is_collected UPDATE発火 を検証 (Supabase REST は page.route モック)

const READINGS = [
  { reading_id: 'r1', machine_code: 'TST01-M01', booth_code: 'TST01-M01-B01', patrol_date: '2026-05-26', entry_type: 'patrol', in_diff: 1000, out_diff: 50, revenue: 5000, is_collected: false },
  { reading_id: 'r2', machine_code: 'TST01-M01', booth_code: 'TST01-M01-B02', patrol_date: '2026-05-26', entry_type: 'patrol', in_diff: 800, out_diff: 40, revenue: 4000, is_collected: false },
]

test.describe('J-COLLECTION-FLAG-01', () => {
  test('mobile 390x844: 店舗+日選択->読込->一括/個別トグル->保存 (console errors 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    const patchPayloads: any[] = []

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/stores**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ store_code: 'TST01', store_name: 'テスト店舗', is_active: true }]) }))
    await page.route('**/rest/v1/machines**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ machine_code: 'TST01-M01', machine_name: '機械A' }]) }))
    await page.route('**/rest/v1/booths**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ booth_code: 'TST01-M01-B01', booth_number: 1 }, { booth_code: 'TST01-M01-B02', booth_number: 2 }]) }))
    await page.route('**/rest/v1/meter_readings**', async route => {
      const req = route.request()
      if (req.method() === 'PATCH') {
        patchPayloads.push(JSON.parse(req.postData() || '{}'))
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(READINGS) })
      }
    })

    await page.goto('/admin/collection-flag')

    // 集金タブ表示 + アクティブ
    await expect(page.getByTestId('admin-tab-collection')).toBeVisible()
    await expect(page.getByTestId('admin-collection-flag')).toBeVisible()

    // 店舗+巡回日選択 -> 読み込む
    await page.getByTestId('colflag-store-select').selectOption('TST01')
    await expect(page.getByTestId('colflag-date-select')).toHaveValue('2026-05-26')
    await page.getByTestId('colflag-load-button').click()

    // ブース一覧表示 (2件)
    await expect(page.getByTestId('colflag-booth-row')).toHaveCount(2)
    await expect(page.getByText('機械A / ブース 1')).toBeVisible()

    // 全ブース集金済 -> 全トグルオン
    await page.getByTestId('colflag-bulk-on').click()
    await expect(page.getByText('集金済', { exact: true }).first()).toBeVisible()
    expect(await page.getByText('集金済', { exact: true }).count()).toBe(2)

    // 個別トグル: 1件目を未集金へ戻す
    await page.getByTestId('colflag-booth-row').first().click()
    expect(await page.getByText('未集金', { exact: true }).count()).toBe(1)

    // 保存 -> PATCH発火 (is_collected:true が r2 に対して送られる)
    await page.getByTestId('colflag-save-button').click()
    await expect(page.getByTestId('colflag-save-button')).toHaveText('保存済')
    expect(patchPayloads.some(p => p.is_collected === true)).toBe(true)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
