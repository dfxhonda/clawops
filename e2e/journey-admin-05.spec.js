import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

const MOCK_PRIZES = [
  {
    prize_id: 'pr-001', prize_name: 'テスト景品A', short_name: 'テA',
    category: 'ぬいぐるみ', status: 'active', original_cost: 500,
    supplier_name: 'テスト商事', phase: 'normal', registered_at: '2026-05-01T00:00:00Z',
  },
  {
    prize_id: 'pr-002', prize_name: 'テスト景品B', short_name: 'テB',
    category: 'フィギュア', status: 'provisional', original_cost: 300,
    supplier_name: 'テスト商事', phase: 'normal', registered_at: '2026-05-02T00:00:00Z',
  },
]

const MOCK_ORDERS = [
  {
    order_id: 'ord-001', order_date: '2026-05-01', prize_name_raw: 'テスト景品A (raw)',
    prize_name_short: 'テA', supplier_id: 'SUP-001', case_count: 2,
    unit_cost: 480, total_tax_included: 1056, status: 'arrived',
    destination: '久留米', ordered_by: 'スタッフ1', expected_date: '2026-05-05',
    arrived_at: '2026-05-04', is_fully_received: true,
  },
  {
    order_id: 'ord-002', order_date: '2026-05-03', prize_name_raw: 'テスト景品B (raw)',
    prize_name_short: 'テB', supplier_id: 'SUP-002', case_count: 1,
    unit_cost: 300, total_tax_included: 330, status: 'ordered',
    destination: '本社', ordered_by: 'スタッフ2', expected_date: '2026-05-10',
    arrived_at: null, is_fully_received: false,
  },
]

async function mockBase(page) {
  await page.route('**/rest/v1/feature_flags**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) }),
  )
  await page.route('**/rest/v1/glossary_terms**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/rest/v1/prize_masters**', async (r) => {
    if (r.request().method() === 'GET') {
      const url = r.request().url()
      const isSingle = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (isSingle || url.includes('prize_id=eq.')) {
        const body = { ...MOCK_PRIZES[0], prize_name_kana: '', aliases: '', series: '', size: '', supplier_id: 'SUP-001', supplier_item_code: '', jan_code: '', default_case_quantity: 10, image_url: '', notes: '', order_rules: '', tags: '', default_tag: '', weight_g: 200, organization_id: '14e907a7-65a3-4891-9a3c-20ea0a7c14fd', updated_at: null, updated_by: null, registered_by: 'staff-test' }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRIZES) })
    }
    // INSERT / PATCH
    return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/rest/v1/prize_orders**', async (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ORDERS) })
    }
    return r.continue()
  })
}

// J-ADMIN-05a: 景品マスタ一覧
test('J-ADMIN-05a: /admin/masters/prizes を開く → prize-list に行表示、検索・フィルタ存在確認', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/masters/prizes')
  await expect(page.locator('[data-testid="prize-list"]')).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('[data-testid="prize-row"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="prize-search"]')).toBeVisible()
  await expect(page.locator('[data-testid="prize-filter-category"]')).toBeVisible()
  await expect(page.locator('[data-testid="prize-filter-status"]')).toBeVisible()
  await expect(page.locator('[data-testid="prize-new-button"]')).toBeVisible()
})

// J-ADMIN-05b: 行タップ → 詳細モーダル展開
test('J-ADMIN-05b: 景品行タップ → prize-modal 展開、保存/廃止ボタン表示', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/masters/prizes')
  await expect(page.locator('[data-testid="prize-row"]').first()).toBeVisible({ timeout: 8_000 })
  await page.locator('[data-testid="prize-row"]').first().click()
  await expect(page.locator('[data-testid="prize-modal"]')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-testid="prize-save-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="prize-delete-button"]')).toBeVisible()
})

// J-ADMIN-05c: 新規登録ボタン → モーダル展開、廃止ボタンなし
test('J-ADMIN-05c: 「+ 新規登録」tap → prize-modal 展開、prize-delete-button 非表示', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/masters/prizes')
  await expect(page.locator('[data-testid="prize-new-button"]')).toBeVisible({ timeout: 8_000 })
  await page.locator('[data-testid="prize-new-button"]').click()
  await expect(page.locator('[data-testid="prize-modal"]')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-testid="prize-delete-button"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="prize-save-button"]')).toBeVisible()
})

// J-ADMIN-05d: 発注履歴一覧
test('J-ADMIN-05d: /admin/audit/orders を開く → order-list に行表示、フィルタ存在確認', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/audit/orders')
  await expect(page.locator('[data-testid="order-list"]')).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('[data-testid="order-row"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="order-filter-status"]')).toBeVisible()
  await expect(page.locator('[data-testid="order-filter-received"]')).toBeVisible()
})

// J-ADMIN-05e: 発注行タップ → READ ONLY モーダル、編集ボタンなし
test('J-ADMIN-05e: 発注行タップ → order-modal 表示、保存ボタンなし (READ ONLY)', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/audit/orders')
  await expect(page.locator('[data-testid="order-row"]').first()).toBeVisible({ timeout: 8_000 })
  await page.locator('[data-testid="order-row"]').first().click()
  await expect(page.locator('[data-testid="order-modal"]')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-testid="prize-save-button"]')).not.toBeVisible()
})

// J-ADMIN-05f: マスタハブ「景品」タイル navigate
test('J-ADMIN-05f: AdminMastersHubPage 「景品」タイル → /admin/masters/prizes navigate', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/masters')
  await expect(page.locator('[data-testid="hub-tile-景品"]')).toBeVisible({ timeout: 5_000 })
  await page.locator('[data-testid="hub-tile-景品"]').click()
  await page.waitForURL('**/admin/masters/prizes', { timeout: 5_000 })
  await expect(page.locator('[data-testid="prize-list"]')).toBeVisible({ timeout: 8_000 })
})

// J-ADMIN-05g: 監査ハブ「発注履歴」タイル navigate
test('J-ADMIN-05g: AdminAuditHubPage 「発注履歴」タイル → /admin/audit/orders navigate', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await mockBase(page)
  await page.goto('/admin/audit')
  await expect(page.locator('[data-testid="hub-tile-発注履歴"]')).toBeVisible({ timeout: 5_000 })
  await page.locator('[data-testid="hub-tile-発注履歴"]').click()
  await page.waitForURL('**/admin/audit/orders', { timeout: 5_000 })
  await expect(page.locator('[data-testid="order-list"]')).toBeVisible({ timeout: 8_000 })
})

// J-ADMIN-05h: J-ADMIN-01/02 regression
test('J-ADMIN-05h: J-ADMIN-01 regression — AdminBoothEditPage + AdminStorePage 既存ルート維持', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await page.route('**/rest/v1/feature_flags**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) }),
  )
  await page.route('**/rest/v1/glossary_terms**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/rest/v1/stores**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ store_code: 'S01', store_name: 'テスト店舗' }]) }),
  )
  await page.goto('/admin/audit/booth-edit')
  await expect(page.locator('[data-testid="admin-store-list"]')).toBeVisible({ timeout: 8_000 })
})
