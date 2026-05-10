import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { setupAuth, injectRouteState } from './helpers'

const STORE_CODE  = 'ADM01'
const BOOTH_CODE  = 'ADM01-B01'

const MOCK_STORES = [{ store_code: STORE_CODE, store_name: 'テスト店舗ADM01', is_active: true }]

const MOCK_MACHINES = [{
  machine_code:    'ADM01-M001',
  machine_name:    'テスト機ADM01',
  store_code:      STORE_CODE,
  type_id:         1,
  model_id:        'model-adm',
  billing_order:   1,
  machine_types:   { category: 'crane', locker_slots: 0 },
  machine_models:  { out_meter_count: 1, meter_unit_price: 100 },
  machine_lockers: [],
  booths: [{ booth_code: BOOTH_CODE, booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'ADM01-M001' }],
}]

const MOCK_READING = {
  reading_id: 'adm-r-001', booth_code: BOOTH_CODE,
  patrol_date: '2026-05-09', read_time: '2026-05-09T10:00:00+09:00',
  created_at: '2026-05-09T01:00:00.000Z', updated_at: '2026-05-09T01:00:00.000Z',
  entry_type: 'patrol', in_meter: 71000, out_meter: 5,
  out_meter_2: null, out_meter_3: null,
  prize_name: 'テスト景品', prize_cost: 300, prize_stock_count: 10, prize_restock_count: 0,
  set_a: '5', set_c: '3', set_l: '2', set_r: '2', set_o: null,
  note: null, created_by: 'staff-test', updated_by: null,
  organization_id: '14e907a7-65a3-4891-9a3c-20ea0a7c14fd',
}

function isSingle(route) {
  return (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
}

async function mockBase(page) {
  await page.route('**/rest/v1/feature_flags**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) }),
  )
  await page.route('**/rest/v1/glossary_terms**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/rest/v1/stores**', async (r) => {
    if (r.request().method() !== 'GET') return r.continue()
    const body = isSingle(r) ? JSON.stringify(MOCK_STORES[0]) : JSON.stringify(MOCK_STORES)
    await r.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/machines**', async (r) => {
    if (r.request().method() !== 'GET') return r.continue()
    const body = isSingle(r) ? JSON.stringify(MOCK_MACHINES[0]) : JSON.stringify(MOCK_MACHINES)
    await r.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/meter_readings**', async (r) => {
    if (r.request().method() !== 'GET') return r.continue()
    const body = isSingle(r) ? JSON.stringify(MOCK_READING) : JSON.stringify([MOCK_READING])
    await r.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/staff**',         r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**',  r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/audit_logs**',    r => r.fulfill({ status: 201, contentType: 'application/json', body: '{}' }))
  await page.route('**/rest/v1/prize_masters**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

// J-ADMIN-02a
test('J-ADMIN-02a: /admin → /admin/masters redirect、MastersHub + 上タブ 4 個表示', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin')
  await page.waitForURL('**/admin/masters', { timeout: 5_000 })
  await expect(page.locator('[data-testid="admin-masters-hub"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-top-tabs"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-tab-masters"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-tab-audit"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-tab-reports"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-tab-settings"]')).toBeVisible()
})

// J-ADMIN-02b
test('J-ADMIN-02b: 上タブ active 状態 — /admin/masters でマスタタブがアクティブ', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/masters')
  await expect(page.locator('[data-testid="admin-top-tabs"]')).toBeVisible({ timeout: 5_000 })
  const mastersTab = page.locator('[data-testid="admin-tab-masters"]')
  await expect(mastersTab).toBeVisible()
  await expect(mastersTab).toHaveClass(/border-blue-500/)
  const auditTab = page.locator('[data-testid="admin-tab-audit"]')
  await expect(auditTab).not.toHaveClass(/border-blue-500/)
})

// J-ADMIN-02c
test('J-ADMIN-02c: マスタ hub tile「店舗」→ AdminStorePage navigate + パンくず正しい', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  const storeLoaded = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 8_000 },
  )
  await page.goto('/admin/masters')
  await expect(page.locator('[data-testid="hub-tile-店舗"]')).toBeVisible({ timeout: 5_000 })
  await page.locator('[data-testid="hub-tile-店舗"]').click()
  await storeLoaded
  await expect(page.locator('[data-testid="admin-store-list"]')).toBeVisible({ timeout: 5_000 })
  const bc = page.locator('[data-testid="admin-breadcrumb"]')
  await expect(bc).toBeVisible()
  await expect(bc).toContainText('マスタ')
  await expect(bc).toContainText('店舗')
})

// J-ADMIN-02d
test('J-ADMIN-02d: 監査・履歴タブ → AdminAuditHub、過去メーター編集 tile → 店舗ピッカー', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  const storeLoaded = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 8_000 },
  )
  await page.goto('/admin/masters')
  await page.locator('[data-testid="admin-tab-audit"]').click()
  await expect(page.locator('[data-testid="admin-audit-hub"]')).toBeVisible({ timeout: 5_000 })
  await page.locator('[data-testid="hub-tile-過去メーター編集"]').click()
  await storeLoaded
  await expect(page.locator('[data-testid="admin-store-list"]')).toBeVisible({ timeout: 5_000 })
})

// J-ADMIN-02e: J-ADMIN-01 regression — AdminBoothEditPage 旧ルート + 楽観ロック維持
test('J-ADMIN-02e: AdminBoothEditPage 旧ルート動作維持 (J-ADMIN-01 regression)', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await injectRouteState(page, `/admin/booth-edit/${BOOTH_CODE}`, {
    machine:   MOCK_MACHINES[0],
    booth:     MOCK_MACHINES[0].booths[0],
    storeCode: STORE_CODE,
  })
  const readingLoaded = page.waitForResponse(
    r => r.url().includes('/rest/v1/meter_readings') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto(`/admin/booth-edit/${BOOTH_CODE}`)
  await readingLoaded
  await expect(page.locator('[data-testid="booth-history-list"]')).toBeVisible({ timeout: 5_000 })
})

// J-ADMIN-02f
test('J-ADMIN-02f: 未実装ハブタイル tap → AdminPlaceholderPage 表示', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/masters')
  await expect(page.locator('[data-testid="admin-masters-hub"]')).toBeVisible({ timeout: 5_000 })
  await page.locator('[data-testid="hub-tile-機械"]').click()
  await expect(page.locator('[data-testid="admin-placeholder"]')).toBeVisible({ timeout: 5_000 })
})

// J-ADMIN-02g
test('J-ADMIN-02g: 非 admin /admin/masters → unauthorized-toast + redirect', async ({ page }) => {
  await setupAuth(page, { role: 'patrol' })
  await mockBase(page)
  await page.goto('/admin/masters')
  await expect(page.locator('[data-testid="unauthorized-toast"]')).toBeVisible({ timeout: 5_000 })
  await page.waitForURL('**/clawsupport', { timeout: 5_000 })
})

// J-ADMIN-02h
test('J-ADMIN-02h: src/admin/_legacy/ 旧実装ファイル移動済み', () => {
  const root = process.cwd()
  expect(existsSync(resolve(root, 'src/admin/_legacy/AdminTop.jsx'))).toBe(true)
  expect(existsSync(resolve(root, 'src/admin/_legacy/revenue/RevenueDashboard.jsx'))).toBe(true)
  expect(existsSync(resolve(root, 'src/admin/_legacy/AdminSidebar.jsx'))).toBe(true)
  expect(existsSync(resolve(root, 'src/admin/AdminSidebar.jsx'))).toBe(false)
  expect(existsSync(resolve(root, 'src/admin/AdminTop.jsx'))).toBe(false)
})
