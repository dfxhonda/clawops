// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-STOCKTAKE-04: 乖離率リアルタイム表示 + 30%超え警告ダイアログ
 * Stage 3 Acceptance:
 * - 入力値に応じて乖離率が色付きで表示される
 * - 30%超えで window.confirm ダイアログが表示される
 * - 確認 → 保存実行
 * - キャンセル → 入力値リセット
 */

const MANAGER_SESSION = {
  access_token:  'test-manager-token',
  token_type:    'bearer',
  expires_in:    7200,
  expires_at:    Math.floor(Date.now() / 1000) + 7200,
  refresh_token: 'test-refresh-manager',
  user: {
    id:    'test-manager-001',
    email: 'manager@test.com',
    aud:   'authenticated',
    role:  'authenticated',
    user_metadata: {
      staff_id: 'staff-mgr-001',
      name:     'テストマネージャー',
      role:     'manager',
    },
    app_metadata: { provider: 'email' },
  },
}

const MOCK_SESSION = { session_id: 'sess-test-001', month: '2026-05-01', status: 'open' }
const MOCK_LOCATION = { location_id: 'KRM02', location_name: '久留米倉庫', location_type: 'warehouse' }

// theoretical_count=10 → 入力50で 400% 乖離 (> 30%)
const MOCK_PRIZE = {
  prize_id: 'P001',
  quantity: 10,
  prize:    { prize_name: 'テスト景品A' },
}

async function setupAuth(page) {
  await page.addInitScript((session) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key && key.endsWith('-auth-token')) return JSON.stringify(session)
      return orig.call(this, key)
    }
  }, MANAGER_SESSION)
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MANAGER_SESSION.user),
    })
  })
}

async function setupBaseMocks(page) {
  await page.route('**/rest/v1/feature_flags**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]) })
  })
  await page.route('**/rest/v1/glossary_terms**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/stocktake_sessions**', async (r) => {
    const accept = r.request().headers()['accept'] ?? ''
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: accept.includes('pgrst.object')
        ? JSON.stringify(MOCK_SESSION)
        : JSON.stringify([MOCK_SESSION]),
    })
  })
  await page.route('**/rest/v1/locations**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_LOCATION]) })
  })
  await page.route('**/rest/v1/prize_stocks**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PRIZE]) })
  })
  await page.route('**/rest/v1/stocktake_items**', async (r) => {
    const method = r.request().method()
    if (method === 'GET')  await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    else                   await r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/audit_logs**', async (r) => {
    await r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
}

test('J-STOCKTAKE-04a: 入力値に対応した乖離率が色付きで表示される', async ({ page }) => {
  await setupAuth(page)
  await setupBaseMocks(page)

  await page.goto('/tanasupport/location/KRM02/stocktake')
  await expect(page.getByTestId('stocktake-input')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('テスト景品A')).toBeVisible({ timeout: 5000 })

  // フィルタを「全て」に切り替えて入力フィールドを表示
  await page.getByText('全て').click()

  const input = page.getByTestId('prize-input-P001')
  // 理論値10、入力12 → 乖離20% (amber)
  await input.fill('12')

  // 乖離率が表示されていること
  const rateEl = page.getByTestId('variance-rate-P001')
  await expect(rateEl).toBeVisible({ timeout: 3000 })
  await expect(rateEl).toContainText('20%')
})

test('J-STOCKTAKE-04b: 30%超え入力でキャンセル → 入力値がリセットされる', async ({ page }) => {
  await setupAuth(page)
  await setupBaseMocks(page)

  await page.goto('/tanasupport/location/KRM02/stocktake')
  await expect(page.getByTestId('stocktake-input')).toBeVisible({ timeout: 8000 })
  await page.getByText('全て').click()

  // ダイアログのキャンセルをハンドル (dismiss)
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('乖離')
    expect(dialog.message()).toContain('本当によろしいですか')
    await dialog.dismiss()
  })

  const input = page.getByTestId('prize-input-P001')
  // 理論値10、入力50 → 400% 乖離
  await input.fill('50')
  await input.blur()

  // キャンセル後は入力値がリセット (空に戻る)
  await page.waitForTimeout(300)
  await expect(input).toHaveValue('')
})

test('J-STOCKTAKE-04c: 30%超え入力で確認 → 保存が実行される', async ({ page }) => {
  await setupAuth(page)

  let upsertCalled = false
  let auditCalled  = false

  await page.route('**/rest/v1/feature_flags**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]) })
  })
  await page.route('**/rest/v1/glossary_terms**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/stocktake_sessions**', async (r) => {
    const accept = r.request().headers()['accept'] ?? ''
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: accept.includes('pgrst.object') ? JSON.stringify(MOCK_SESSION) : JSON.stringify([MOCK_SESSION]) })
  })
  await page.route('**/rest/v1/locations**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_LOCATION]) })
  })
  await page.route('**/rest/v1/prize_stocks**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PRIZE]) })
  })
  await page.route('**/rest/v1/stocktake_items**', async (r) => {
    const method = r.request().method()
    if (method === 'GET') await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    else { upsertCalled = true; await r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }) }
  })
  await page.route('**/rest/v1/audit_logs**', async (r) => {
    auditCalled = true
    await r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tanasupport/location/KRM02/stocktake')
  await expect(page.getByTestId('stocktake-input')).toBeVisible({ timeout: 8000 })
  await page.getByText('全て').click()

  // ダイアログを受け入れ
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('乖離')
    expect(dialog.message()).toContain('本当によろしいですか')
    await dialog.accept()
  })

  const input = page.getByTestId('prize-input-P001')
  await input.fill('50')
  await input.blur()

  await page.waitForTimeout(500)
  expect(upsertCalled).toBe(true)
  expect(auditCalled).toBe(true)
})
