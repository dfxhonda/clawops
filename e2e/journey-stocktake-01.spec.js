// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-STOCKTAKE-01: セッション作成 → 倉庫入力 → 保存
 * Stage 1 Acceptance:
 * - /tanasupport ハブに倉庫表示
 * - 倉庫タップ → /tanasupport/location/:locationId/stocktake
 * - 当月セッション自動作成
 * - 景品×数量入力 → stocktake_items UPSERT
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
      staff_id:  'staff-mgr-001',
      name:      'テストマネージャー',
      role:      'manager',
    },
    app_metadata: { provider: 'email' },
  },
}

const MOCK_LOCATION = {
  location_id:   'KRM02',
  location_name: '久留米倉庫',
  location_type: 'warehouse',
}

const MOCK_PRIZE = {
  prize_id:   'P001',
  quantity:   10,
  prize:      { prize_name: 'テスト景品A' },
}

const MOCK_SESSION = {
  session_id:      'sess-test-001',
  month:           '2026-05-01',
  status:          'open',
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

async function setupStocktakeMocks(page) {
  // feature_flags
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]),
    })
  })

  // glossary (global)
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // stores (hub)
  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { store_code: 'KKY01', store_name: 'テスト店舗', locality: '久留米', locality_kana: 'ク' },
      ]),
    })
  })

  // locations (warehouses for hub)
  await page.route('**/rest/v1/locations**', async (route) => {
    const url = route.request().url()
    if (url.includes('location_type=in.')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_LOCATION]),
      })
    } else if (url.includes('location_id=eq.KRM02')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_LOCATION]),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
  })

  // staff_pinned_stores
  await page.route('**/rest/v1/staff_pinned_stores**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // stocktake_sessions (GET → return existing, POST → create)
  await page.route('**/rest/v1/stocktake_sessions**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      const accept = route.request().headers()['accept'] ?? ''
      const isSingle = accept.includes('vnd.pgrst.object')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingle ? JSON.stringify(MOCK_SESSION) : JSON.stringify([MOCK_SESSION]),
      })
    } else if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_SESSION]),
      })
    } else {
      await route.continue()
    }
  })

  // prize_stocks (prizes for location)
  await page.route('**/rest/v1/prize_stocks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_PRIZE]),
    })
  })

  // stocktake_items (GET existing items, POST/PATCH UPSERT)
  let upsertCalled = false
  await page.route('**/rest/v1/stocktake_items**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else if (method === 'POST' || method === 'PATCH') {
      upsertCalled = true
      await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    } else {
      await route.continue()
    }
  })

  return { getUpsertCalled: () => upsertCalled }
}

test('J-STOCKTAKE-01: ハブ→倉庫タップ→セッション作成→景品カウント入力', async ({ page }) => {
  await setupManagerAuth(page)
  const { getUpsertCalled } = await setupStocktakeMocks(page)

  // 1. ハブ表示
  await page.goto('/tanasupport')
  await expect(page.getByText('久留米倉庫')).toBeVisible({ timeout: 8000 })

  // 2. 倉庫カードをタップ
  await page.getByText('久留米倉庫').click()

  // 3. 棚卸し入力画面に遷移
  await expect(page).toHaveURL(/\/tanasupport\/location\/KRM02\/stocktake/, { timeout: 5000 })
  await expect(page.getByTestId('stocktake-input')).toBeVisible({ timeout: 8000 })

  // 4. 景品が表示されていること
  await expect(page.getByText('テスト景品A')).toBeVisible({ timeout: 5000 })

  // 5. カウント入力 → UPSERT
  const input = page.getByTestId('prize-input-P001')
  await input.fill('5')
  await input.blur()

  // 6. 保存確認（UPSERT が呼ばれた）
  await page.waitForTimeout(500)
  expect(getUpsertCalled()).toBe(true)
})
