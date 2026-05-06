// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-STOCKTAKE-03: 個人タブ — スタッフ個人持ち回り自己申告 + ゼロ申告
 * Stage 2 Acceptance:
 * - 個人タブで「ゼロ申告」ボタンが表示される
 * - ゼロ申告ボタンタップで stocktake_zero_declarations に記録される
 * - 申告後「ゼロ申告済み ✅」に切り替わる
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

const MOCK_SESSION = {
  session_id: 'sess-test-001',
  month:      '2026-05-01',
  status:     'open',
}

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

async function setupBaseMocks(page) {
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
    const method = route.request().method()
    const accept = route.request().headers()['accept'] ?? ''
    if (method === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: accept.includes('pgrst.object')
          ? JSON.stringify(MOCK_SESSION)
          : JSON.stringify([MOCK_SESSION]),
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
  await page.route('**/rest/v1/stocktake_items**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test('J-STOCKTAKE-03a: 個人タブに「ゼロ申告」ボタンが表示される', async ({ page }) => {
  await setupManagerAuth(page)
  await setupBaseMocks(page)

  // ゼロ申告未申告状態
  await page.route('**/rest/v1/stocktake_zero_declarations**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tanasupport/stocktake')
  await expect(page.getByTestId('stocktake-session')).toBeVisible({ timeout: 8000 })

  // 個人タブに切り替え
  await page.getByTestId('tab-personal').click()
  await expect(page.getByTestId('personal-tab')).toBeVisible()

  // ゼロ申告ボタンが表示されていること
  await expect(page.getByTestId('btn-declare-zero')).toBeVisible()
  await expect(page.getByTestId('btn-declare-zero')).toContainText('ゼロ申告')
})

test('J-STOCKTAKE-03b: ゼロ申告ボタンタップで申告が記録され「済み」表示に切り替わる', async ({ page }) => {
  await setupManagerAuth(page)
  await setupBaseMocks(page)

  let declareCalled = false

  // 初期状態: 未申告
  await page.route('**/rest/v1/stocktake_zero_declarations**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      // maybeSingle の場合: pgrst.object ヘッダーなしで空配列 → null
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else if (method === 'POST') {
      declareCalled = true
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify([{
          session_id: 'sess-test-001',
          staff_id:   'staff-mgr-001',
          declared_at: new Date().toISOString(),
        }]),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto('/tanasupport/stocktake')
  await expect(page.getByTestId('stocktake-session')).toBeVisible({ timeout: 8000 })

  // 個人タブに切り替え
  await page.getByTestId('tab-personal').click()
  await expect(page.getByTestId('btn-declare-zero')).toBeVisible({ timeout: 5000 })

  // ゼロ申告ボタンを押す
  await page.getByTestId('btn-declare-zero').click()

  // 申告後: 「ゼロ申告済み」が表示されること
  await expect(page.getByText('ゼロ申告済み')).toBeVisible({ timeout: 5000 })

  // API が呼ばれたこと
  expect(declareCalled).toBe(true)
})

test('J-STOCKTAKE-03c: 既にゼロ申告済みの場合は「済み」状態で表示される', async ({ page }) => {
  await setupManagerAuth(page)
  await setupBaseMocks(page)

  const DECLARED_AT = '2026-05-31T14:59:00.000Z'

  // 申告済み状態を返す
  await page.route('**/rest/v1/stocktake_zero_declarations**', async (route) => {
    const accept = route.request().headers()['accept'] ?? ''
    const isSingle = accept.includes('pgrst.object')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: isSingle
        ? JSON.stringify({ session_id: 'sess-test-001', staff_id: 'staff-mgr-001', declared_at: DECLARED_AT })
        : JSON.stringify([{ session_id: 'sess-test-001', staff_id: 'staff-mgr-001', declared_at: DECLARED_AT }]),
    })
  })

  await page.goto('/tanasupport/stocktake')
  await expect(page.getByTestId('stocktake-session')).toBeVisible({ timeout: 8000 })

  // 個人タブに切り替え
  await page.getByTestId('tab-personal').click()
  await expect(page.getByTestId('personal-tab')).toBeVisible()

  // ゼロ申告済みが表示されていること
  await expect(page.getByText('ゼロ申告済み')).toBeVisible({ timeout: 5000 })

  // ゼロ申告ボタンは表示されていないこと
  await expect(page.getByTestId('btn-declare-zero')).not.toBeVisible()
})
