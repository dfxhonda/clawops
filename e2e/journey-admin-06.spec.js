// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-ADMIN-06: audit_history_4pages_ipad_first
 * a: AdminAuditHubPage — 全操作ログ/ログイン履歴/景品phase履歴/在庫移動履歴 タイル = 実装済
 * b: /admin/audit/operations — 一覧表示 + 行クリック → detail-modal
 * c: /admin/audit/logins — 一覧表示 + 行クリック → detail-modal
 * d: /admin/audit/prize-phases — 一覧表示 + 行クリック → detail-modal
 * e: /admin/audit/stock-moves — 一覧表示 + 行クリック → detail-modal
 * f: date preset 切替 (今日/今週/今月)
 * g: 件数ゼロ表示
 */

const ADMIN_SESSION = {
  access_token:  'test-admin-token',
  token_type:    'bearer',
  expires_in:    7200,
  expires_at:    Math.floor(Date.now() / 1000) + 7200,
  refresh_token: 'test-refresh-admin',
  user: {
    id:    'test-admin-001',
    email: 'admin@test.com',
    aud:   'authenticated',
    role:  'authenticated',
    user_metadata: { staff_id: 'staff-admin-001', name: 'テスト管理者', role: 'admin' },
    app_metadata:  { provider: 'email' },
  },
}

const MOCK_OPS_ROW = {
  id: 'op-001', created_at: '2026-05-12T10:00:00+09:00',
  staff_id: 'staff-001', action: 'UPDATE', target_table: 'prize_masters',
  target_id: 'prize-uuid-0001', reason: '入替のため', reason_code: 'replace',
  before_data: '{"prize_name":"旧景品"}', after_data: '{"prize_name":"新景品"}',
}

const MOCK_LOGIN_ROW = {
  id: 'log-001', created_at: '2026-05-12T09:00:00+09:00',
  staff_id: 'staff-001', action: 'login',
  ip_address: '192.168.1.1', user_agent: 'Mozilla/5.0 (iPhone)',
}

const MOCK_PHASE_ROW = {
  history_id: 'ph-001', changed_at: '2026-05-12T08:00:00+09:00',
  prize_id: 'prize-uuid-0001', from_phase: 'active', to_phase: 'retired',
  booth_code: 'KKY01-A01', machine_code: 'M001', trigger_type: 'manual',
  play_7dma_at_change: 3.2, reason: '売上低下', changed_by: 'staff-001',
  prize_masters: { prize_name: 'テスト景品' },
}

const MOCK_STOCK_ROW = {
  movement_id: 'mv-001', created_at: '2026-05-12T07:00:00+09:00',
  prize_id: 'prize-uuid-0001', movement_type: 'transfer',
  from_owner_type: 'warehouse', from_owner_id: 'WH01',
  to_owner_type: 'booth', to_owner_id: 'KKY01-A01',
  quantity: 10, reason: '補充', created_by: 'staff-001',
  tracking_number: null, adjustment_reason: null,
  prize_masters: { prize_name: 'テスト景品' },
}

async function setupAdminAuth(page) {
  await page.addInitScript((session) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key && key.endsWith('-auth-token')) return JSON.stringify(session)
      return orig.call(this, key)
    }
  }, ADMIN_SESSION)
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/signout')) {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_SESSION.user) })
    }
  })
}

async function setupCommonMocks(page) {
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ store_code: 'KKY01', store_name: 'テスト店舗' }]),
    })
  })
}

test('J-ADMIN-06a: AuditHub 4タイルが実装済表示', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.goto('/admin/audit')
  await expect(page.getByTestId('admin-audit-hub')).toBeVisible({ timeout: 8000 })

  for (const label of ['全操作ログ', 'ログイン履歴', '景品phase履歴', '在庫移動履歴']) {
    const tile = page.getByTestId(`hub-tile-${label}`)
    await expect(tile).toBeVisible()
    await expect(tile.getByText('実装済')).toBeVisible()
  }
})

test('J-ADMIN-06b: /admin/audit/operations 一覧 + detail-modal', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/audit_logs**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([MOCK_OPS_ROW]),
    })
  })

  await page.goto('/admin/audit/operations')
  await expect(page.getByTestId('ops-table')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('ops-row').first()).toBeVisible()
  await expect(page.getByText('UPDATE')).toBeVisible()

  await page.getByTestId('ops-row').first().click()
  await expect(page.getByTestId('detail-modal')).toBeVisible()
  await expect(page.getByTestId('detail-modal').getByText('prize_masters')).toBeVisible()

  await page.getByTestId('detail-modal').getByText('✕').click()
  await expect(page.getByTestId('detail-modal')).not.toBeVisible()
})

test('J-ADMIN-06c: /admin/audit/logins 一覧 + detail-modal', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/auth_logs**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([MOCK_LOGIN_ROW]),
    })
  })

  await page.goto('/admin/audit/logins')
  await expect(page.getByTestId('login-table')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('login-row').first()).toBeVisible()
  await expect(page.getByText('staff-001')).toBeVisible()

  await page.getByTestId('login-row').first().click()
  await expect(page.getByTestId('detail-modal')).toBeVisible()
  await expect(page.getByTestId('detail-modal').getByText('192.168.1.1')).toBeVisible()
})

test('J-ADMIN-06d: /admin/audit/prize-phases 一覧 + detail-modal', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/phase_history**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([MOCK_PHASE_ROW]),
    })
  })

  await page.goto('/admin/audit/prize-phases')
  await expect(page.getByTestId('phase-table')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('phase-row').first()).toBeVisible()
  await expect(page.getByText('テスト景品')).toBeVisible()
  await expect(page.getByText('retired')).toBeVisible()

  await page.getByTestId('phase-row').first().click()
  await expect(page.getByTestId('detail-modal')).toBeVisible()
  await expect(page.getByTestId('detail-modal').getByText('active → retired')).toBeVisible()
})

test('J-ADMIN-06e: /admin/audit/stock-moves 一覧 + detail-modal', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/stock_movements**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([MOCK_STOCK_ROW]),
    })
  })

  await page.goto('/admin/audit/stock-moves')
  await expect(page.getByTestId('stock-table')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('stock-row').first()).toBeVisible()
  await expect(page.getByText('transfer')).toBeVisible()
  await expect(page.getByText('テスト景品')).toBeVisible()

  await page.getByTestId('stock-row').first().click()
  await expect(page.getByTestId('detail-modal')).toBeVisible()
  await expect(page.getByTestId('detail-modal').getByText('warehouse:WH01')).toBeVisible()
})

test('J-ADMIN-06f: date preset 切替 (今日/今週/今月)', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  const requests = []
  await page.route('**/rest/v1/audit_logs**', async (route) => {
    requests.push(route.request().url())
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/admin/audit/operations')
  await expect(page.getByTestId('ops-table')).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: '今日' }).click()
  await page.getByRole('button', { name: '今月' }).click()
  await page.getByRole('button', { name: '今週' }).click()

  expect(requests.length).toBeGreaterThanOrEqual(3)
})

test('J-ADMIN-06g: 件数ゼロ表示', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/audit_logs**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/admin/audit/operations')
  await expect(page.getByTestId('ops-table')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('該当なし')).toBeVisible()
})
