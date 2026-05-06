// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-STOCKTAKE-05: ロック済みセッション — 修正不可
 * Stage 3 Acceptance:
 * - status='locked' のセッションでは入力フィールドが disabled
 * - ロックバナーが表示される
 * - /admin/stocktake/dashboard にクロス集計表が表示される
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

const LOCKED_SESSION = { session_id: 'sess-locked-001', month: '2026-04-01', status: 'locked' }
const MOCK_LOCATION  = { location_id: 'KRM02', location_name: '久留米倉庫', location_type: 'warehouse' }
const MOCK_PRIZE     = { prize_id: 'P001', quantity: 10, prize: { prize_name: 'テスト景品A' } }

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

test('J-STOCKTAKE-05a: ロック済みセッションは入力フィールドが disabled', async ({ page }) => {
  await setupAuth(page)

  await page.route('**/rest/v1/feature_flags**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]) })
  })
  await page.route('**/rest/v1/glossary_terms**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // ロック済みセッションを返す
  await page.route('**/rest/v1/stocktake_sessions**', async (r) => {
    const accept = r.request().headers()['accept'] ?? ''
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: accept.includes('pgrst.object')
        ? JSON.stringify(LOCKED_SESSION)
        : JSON.stringify([LOCKED_SESSION]),
    })
  })
  await page.route('**/rest/v1/locations**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_LOCATION]) })
  })
  await page.route('**/rest/v1/prize_stocks**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PRIZE]) })
  })
  await page.route('**/rest/v1/stocktake_items**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        session_id: 'sess-locked-001', prize_id: 'P001',
        owner_type: 'location', owner_code: 'KRM02',
        actual_count: 10, theoretical_count: 10, variance_rate: 0,
      }]),
    })
  })

  await page.goto('/tanasupport/location/KRM02/stocktake')
  await expect(page.getByTestId('stocktake-input')).toBeVisible({ timeout: 8000 })

  // ロックバナーが表示されていること
  await expect(page.getByTestId('lock-banner')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('🔒 このセッションはロック済みです')).toBeVisible()

  // フィルタを「全て」にして景品を表示
  await page.getByText('全て').click()
  await expect(page.getByText('テスト景品A')).toBeVisible({ timeout: 3000 })

  // 入力フィールドが disabled であること
  const input = page.getByTestId('prize-input-P001')
  await expect(input).toBeDisabled()
})

test('J-STOCKTAKE-05b: /admin/stocktake/dashboard にクロス集計テーブルが表示される', async ({ page }) => {
  // admin セッションで訪問
  const ADMIN_SESSION = {
    ...MANAGER_SESSION,
    user: {
      ...MANAGER_SESSION.user,
      user_metadata: { staff_id: 'staff-admin-001', name: 'テスト管理者', role: 'admin' },
    },
  }

  await page.addInitScript((session) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key && key.endsWith('-auth-token')) return JSON.stringify(session)
      return orig.call(this, key)
    }
  }, ADMIN_SESSION)
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(ADMIN_SESSION.user),
    })
  })
  await page.route('**/rest/v1/feature_flags**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'tanasupport_core', enabled: true }]) })
  })
  await page.route('**/rest/v1/glossary_terms**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route('**/rest/v1/stocktake_sessions**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { session_id: 'sess-2026-05', month: '2026-05-01', status: 'open',   created_at: '2026-05-01T00:00:00Z', locked_at: null },
        { session_id: 'sess-2026-04', month: '2026-04-01', status: 'locked', created_at: '2026-04-01T00:00:00Z', locked_at: '2026-04-30T14:59:00Z' },
      ]),
    })
  })

  // stocktake_items: staff-001 が 2ヶ月とも over 方向 (一貫過多)
  await page.route('**/rest/v1/stocktake_items**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { session_id: 'sess-2026-05', recorded_by: 'staff-001', actual_count: 15, theoretical_count: 10, variance_rate: 0.5 },
        { session_id: 'sess-2026-04', recorded_by: 'staff-001', actual_count: 14, theoretical_count: 10, variance_rate: 0.4 },
      ]),
    })
  })

  await page.route('**/rest/v1/staff**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ staff_id: 'staff-001', name: '田中スタッフ' }]),
    })
  })

  await page.goto('/admin/stocktake/dashboard')
  await expect(page.getByTestId('stocktake-dashboard')).toBeVisible({ timeout: 8000 })

  // テーブルが表示されていること
  await expect(page.getByTestId('dashboard-table')).toBeVisible({ timeout: 5000 })

  // 担当者名が表示されていること
  await expect(page.getByTestId('staff-name-staff-001')).toContainText('田中スタッフ')

  // 一貫方向フラグが表示されていること
  await expect(page.getByTestId('pattern-staff-001')).toContainText('常過多')
})

test('J-STOCKTAKE-05c: 月末締切後（当月23:59 JST経過）は deadline-banner と入力不可', async ({ page }) => {
  await setupAuth(page)

  const PAST_MONTH_OPEN = {
    session_id: 'sess-past-open',
    month:      '2020-01-01',
    status:     'open',
  }

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
        ? JSON.stringify(PAST_MONTH_OPEN)
        : JSON.stringify([PAST_MONTH_OPEN]),
    })
  })
  await page.route('**/rest/v1/locations**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_LOCATION]) })
  })
  await page.route('**/rest/v1/prize_stocks**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PRIZE]) })
  })
  await page.route('**/rest/v1/stocktake_items**', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/tanasupport/location/KRM02/stocktake')
  await expect(page.getByTestId('stocktake-input')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('deadline-banner')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('月末23:59 JST')).toBeVisible()

  await page.getByText('全て').click()
  await expect(page.getByText('テスト景品A')).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('prize-input-P001')).toBeDisabled()
})
