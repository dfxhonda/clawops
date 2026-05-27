import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-ADMIN-MACHINE-BOOTH-CRUD-01 gate_4: viewport 390x844 全操作フロー
// login -> store-list -> tap store -> add machine -> open machine -> add booth -> back
// console errors 0 / "Cannot coerce" 非表示 を検証 (Supabase REST は page.route でモック)

const STORE = {
  store_id: 'store-001', store_code: 'TST01', store_name: 'テスト店舗',
  store_name_official: 'テスト店舗(正式)', brand_name: 'TESTブランド', store_type: '',
  phone: '', address: 'テスト住所', region: '', locality: '', locality_kana: '',
  is_active: true, opened_at: null, closed_at: null, is_collection_day: false, notes: '',
}

function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  }
}

test.describe('J-ADMIN-MACHINE-BOOTH-CRUD-01', () => {
  test('mobile 390x844: 店舗->機械追加->ブース追加->戻る (console errors 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    // stateful mocks
    const machines: any[] = [
      { machine_code: 'TST01-M01', machine_name: '機械1', model_id: 'model-001', is_active: true, store_code: 'TST01', machine_models: { model_name: 'テストモデル' }, booths: [{ booth_code: 'TST01-M01-B01' }] },
    ]
    const booths: any[] = [
      { booth_code: 'TST01-M01-B01', booth_number: 1, play_price: 100, is_active: true, machine_code: 'TST01-M01', store_code: 'TST01' },
    ]

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    // fallback first (lowest priority), specific routes after (win)
    await page.route('**/rest/v1/**', jsonRoute([]))

    await page.route('**/rest/v1/stores**', jsonRoute([STORE]))
    await page.route('**/rest/v1/machine_models**', jsonRoute([
      { model_id: 'model-001', model_name: 'テストモデル', booth_count: 2 },
    ]))
    await page.route('**/rest/v1/machines**', async route => {
      const req = route.request()
      if (req.method() === 'POST') {
        const body = JSON.parse(req.postData() || '{}')
        machines.push({ ...body, machine_models: { model_name: 'テストモデル' }, booths: [] })
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([body]) })
      } else if (req.method() === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}')
        const m = req.url().match(/machine_code=eq\.([^&]+)/)
        const code = m ? decodeURIComponent(m[1]) : null
        const target = machines.find(x => x.machine_code === code)
        if (target && 'is_active' in body) target.is_active = body.is_active
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(machines) })
      }
    })
    await page.route('**/rest/v1/booths**', async route => {
      const req = route.request()
      if (req.method() === 'POST') {
        const body = JSON.parse(req.postData() || '{}')
        booths.push(body)
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([body]) })
      } else if (req.method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(booths) })
      }
    })

    await page.goto('/admin/masters/store-list')

    // bug fix: "Cannot coerce" が画面に出ていない
    await expect(page.getByTestId('store-list-table')).toBeVisible()
    await expect(page.getByText(/Cannot coerce/i)).toHaveCount(0)

    // 店舗行タップ -> 詳細ドロワー (機械一覧)
    await page.getByTestId('store-list-row').first().click()
    await expect(page.getByTestId('store-crud-drawer')).toBeVisible()
    await expect(page.getByTestId('machine-list')).toBeVisible()
    await expect(page.getByText('TST01-M01')).toBeVisible()

    // 機械追加: 自動採番プレビュー = TST01-M02
    await page.getByTestId('machine-add-button').click()
    await expect(page.getByTestId('machine-form')).toBeVisible()
    await expect(page.getByTestId('machine-code-input')).toHaveValue('TST01-M02')
    await page.getByTestId('machine-name-input').fill('機械2')
    await page.getByTestId('machine-model-select').selectOption('model-001')
    await page.getByTestId('machine-save-button').click()
    // 追加後、一覧に即表示
    await expect(page.getByText('機械2')).toBeVisible()

    // is_activeトグル即時反映 (機械1 を無効化 -> 無効 pill)
    const machine1Row = page.getByTestId('machine-row').filter({ hasText: '機械1' })
    await expect(machine1Row.getByText('有効')).toBeVisible()
    await machine1Row.getByTestId('machine-active-toggle').click()
    await expect(machine1Row.getByText('無効')).toBeVisible()

    // 機械タップ -> ブース一覧
    await page.getByText('機械1').click()
    await expect(page.getByTestId('booth-list')).toBeVisible()
    await expect(page.getByText('TST01-M01-B01')).toBeVisible()

    // ブース追加: 自動採番プレビュー = TST01-M01-B02
    await page.getByTestId('booth-add-button').click()
    await expect(page.getByTestId('booth-form')).toBeVisible()
    await expect(page.getByTestId('booth-code-input')).toHaveValue('TST01-M01-B02')
    await page.getByTestId('booth-save-button').click()
    await expect(page.getByText('TST01-M01-B02')).toBeVisible()

    // 戻る動線: ブース -> 機械一覧
    await page.getByTestId('drawer-back').click()
    await expect(page.getByTestId('machine-list')).toBeVisible()

    // ドロワーを閉じる
    await page.getByTestId('drawer-close').click()
    await expect(page.getByTestId('store-crud-drawer')).toHaveCount(0)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
