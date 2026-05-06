// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-STOCKTAKE-02: 機械タブ — M1由来スナップショット理論値 READ ONLY 表示
 * Stage 2 Acceptance:
 * - /tanasupport/stocktake にアクセス
 * - 機械タブが表示されていること
 * - スナップショット済みの場合: 理論値が表示される (READ ONLY)
 * - スナップショット未取得の場合: 「月末23:59に自動取得」メッセージ表示
 */

const MANAGER_SESSION = {
  access_token: 'test-manager-token',
  token_type:   'bearer',
  expires_in:   7200,
  expires_at:   Math.floor(Date.now() / 1000) + 7200,
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

const MOCK_SESSION = {
  session_id: 'sess-test-001',
  month:      '2026-05-01',
  status:     'open',
}

const MOCK_MACHINE_ITEMS = [
  {
    session_id:        'sess-test-001',
    prize_id:          'P-M01',
    owner_type:        'booth',
    owner_code:        'B-KRM-01',
    actual_count:      5,
    theoretical_count: 5,
    prize:             { prize_name: '機械景品アルファ' },
  },
  {
    session_id:        'sess-test-001',
    prize_id:          'P-M02',
    owner_type:        'booth',
    owner_code:        'B-KRM-01',
    actual_count:      3,
    theoretical_count: 3,
    prize:             { prize_name: '機械景品ベータ' },
  },
]

async function setupManagerAuth(page) {
  await page.addInitScript((session) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key && key.endsWith('-auth-token')) return JSON.stringify(session)
      return orig.call(this, key)
    }
  }, MANAGER_SESSION)

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/signout')) {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MANAGER_SESSION.user),
      })
    }
  })
}

async function setupSessionMocks(page, { machineItems = MOCK_MACHINE_ITEMS } = {}) {
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]),
    })
  })

  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // stocktake_sessions
  await page.route('**/rest/v1/stocktake_sessions**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      const accept = route.request().headers()['accept'] ?? ''
      const isSingle = accept.includes('vnd.pgrst.object')
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: isSingle ? JSON.stringify(MOCK_SESSION) : JSON.stringify([MOCK_SESSION]),
      })
    } else if (method === 'POST') {
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify([MOCK_SESSION]),
      })
    } else {
      await route.continue()
    }
  })

  // stocktake_items — machine items (owner_type=booth), others empty
  await page.route('**/rest/v1/stocktake_items**', async (route) => {
    const url = route.request().url()
    if (url.includes('owner_type=eq.booth')) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(machineItems),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
  })

  // stocktake_zero_declarations
  await page.route('**/rest/v1/stocktake_zero_declarations**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test('J-STOCKTAKE-02a: 機械タブにスナップショット済み理論値が READ ONLY で表示される', async ({ page }) => {
  await setupManagerAuth(page)
  await setupSessionMocks(page)

  await page.goto('/tanasupport/stocktake')

  // ページロード確認
  await expect(page.getByTestId('stocktake-session')).toBeVisible({ timeout: 8000 })

  // 機械タブが選択されていること (default tab)
  await expect(page.getByTestId('tab-machine')).toBeVisible()
  await expect(page.getByTestId('machine-tab')).toBeVisible({ timeout: 5000 })

  // 理論値が表示されていること
  await expect(page.getByText('機械景品アルファ')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('機械景品ベータ')).toBeVisible()

  // READ ONLY バッジが表示されていること
  await expect(page.getByText(/READ ONLY/)).toBeVisible()

  // 数値入力フィールドが存在しないこと（READ ONLY）
  const inputs = page.locator('[data-testid="machine-tab"] input')
  await expect(inputs).toHaveCount(0)
})

test('J-STOCKTAKE-02b: スナップショット未取得時は「月末23:59に自動取得」メッセージを表示', async ({ page }) => {
  await setupManagerAuth(page)
  await setupSessionMocks(page, { machineItems: [] })

  await page.goto('/tanasupport/stocktake')

  await expect(page.getByTestId('machine-tab')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('スナップショット未取得')).toBeVisible()
  await expect(page.getByText(/月末23:59に自動取得/)).toBeVisible()
})

test('J-STOCKTAKE-02c: 合計タブで全社合計 = 倉庫 + 機械 + 個人 が表示される', async ({ page }) => {
  await setupManagerAuth(page)
  // stocktake_items: location=20, booth=8, staff=0
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]),
    })
  })
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/stocktake_sessions**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: accept.includes('pgrst.object') ? JSON.stringify(MOCK_SESSION) : JSON.stringify([MOCK_SESSION]),
    })
  })
  await page.route('**/rest/v1/stocktake_items**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { owner_type: 'location', actual_count: 20, theoretical_count: null },
        { owner_type: 'booth',    actual_count: 8,  theoretical_count: 8  },
        { owner_type: 'staff',    actual_count: 2,  theoretical_count: null },
      ]),
    })
  })
  await page.route('**/rest/v1/stocktake_zero_declarations**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tanasupport/stocktake')
  await expect(page.getByTestId('stocktake-session')).toBeVisible({ timeout: 8000 })

  // 合計タブに切り替え
  await page.getByTestId('tab-summary').click()
  await expect(page.getByTestId('summary-tab')).toBeVisible()

  // 各カテゴリの値が表示されていること
  await expect(page.getByTestId('summary-count-倉庫')).toContainText('20')
  await expect(page.getByTestId('summary-count-機械内')).toContainText('8')
  await expect(page.getByTestId('summary-count-個人')).toContainText('2')
  await expect(page.getByTestId('summary-count-全社合計')).toContainText('30')
})
