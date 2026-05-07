// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * J-REVENUE-02: ランキングテーブルの表示・属性
 * - 店舗ランキングがrevenue DESC順
 * - 払出率が閾値超えの行にdata-payout-warning="true"
 * - 機械別タブへの切り替え
 * - 景品別タブのdata-underperformer属性
 */

// S01: revenue=8000, payout_rate=80/100*100=80% → warning(>75)
// S02: revenue=4000, payout_rate=25/50*100=50%  → no warning
const MOCK_READINGS = [
  {
    reading_id: 'r1', store_code: 'S01', machine_code: 'S01-M1',
    patrol_date: '2026-05-07', revenue: 8000, in_diff: 100, out_diff_1: 80, out_diff_2: null, out_diff_3: null,
    prize_name: '景品A', prize_id: 'P01', prize_cost: 50, prize_cost_1: 50,
    entry_type: 'patrol', organization_id: 'org1',
  },
  {
    reading_id: 'r2', store_code: 'S02', machine_code: 'S02-M1',
    patrol_date: '2026-05-07', revenue: 4000, in_diff: 50, out_diff_1: 25, out_diff_2: null, out_diff_3: null,
    prize_name: '景品B', prize_id: 'P02', prize_cost: 2000, prize_cost_1: 2000,
    entry_type: 'patrol', organization_id: 'org1',
  },
]

const MOCK_STORES = [
  { store_code: 'S01', store_name: 'テスト店A', is_active: true, organization_id: 'org1' },
  { store_code: 'S02', store_name: 'テスト店B', is_active: true, organization_id: 'org1' },
]

const MOCK_MACHINES = [
  { machine_code: 'S01-M1', machine_name: 'クレーンA', store_code: 'S01', is_active: true },
  { machine_code: 'S02-M1', machine_name: 'クレーンB', store_code: 'S02', is_active: true },
]

async function setupRevenueMocks(page) {
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_READINGS) })
  })
  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STORES) })
  })
  await page.route('**/rest/v1/machines**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MACHINES) })
  })
  await page.route('**/rest/v1/staff**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/staff_public**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test('J-REVENUE-02a: 店舗ランキングがrevenue DESCで並ぶ', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })
  // Wait for rows to appear (data-rank=1 should be S01 with 8000)
  await expect(page.locator('[data-rank="1"]')).toBeVisible({ timeout: 5000 })

  const rank1 = page.locator('[data-rank="1"]')
  const rank2 = page.locator('[data-rank="2"]')

  await expect(rank1).toContainText('テスト店A')
  await expect(rank1).toContainText('8,000')
  await expect(rank2).toContainText('テスト店B')
  await expect(rank2).toContainText('4,000')
})

test('J-REVENUE-02b: 払出率が閾値超えの行にdata-payout-warningが付く', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('[data-rank="1"]')).toBeVisible({ timeout: 5000 })

  // S01: payout_rate=80% > 75 → warning
  const rank1 = page.locator('[data-rank="1"]')
  await expect(rank1).toHaveAttribute('data-payout-warning', 'true')

  // S02: payout_rate=50% ≤ 75 → no warning
  const rank2 = page.locator('[data-rank="2"]')
  await expect(rank2).not.toHaveAttribute('data-payout-warning')
})

test('J-REVENUE-02c: 機械別タブに切り替えると機械ランキングが表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })

  await page.getByRole('tab', { name: '機械別' }).click()
  await expect(page.locator('[data-rank="1"]')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('クレーンA')).toBeVisible()
})

test('J-REVENUE-02d: 景品別タブでdata-underperformerが負利益率の行に付く', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })

  await page.getByRole('tab', { name: '景品別' }).click()
  await expect(page.locator('[data-rank="1"]')).toBeVisible({ timeout: 5000 })

  // P01: revenue=8000, cost=50*80=4000 → margin=50% → no underperformer
  // P02: revenue=4000, cost=2000*25=50000 → margin<0 → underperformer
  // sorted DESC by revenue: P01 first, P02 second
  const rank1 = page.locator('[data-rank="1"]')
  const rank2 = page.locator('[data-rank="2"]')

  await expect(rank1).not.toHaveAttribute('data-underperformer')
  await expect(rank2).toHaveAttribute('data-underperformer', 'true')
})
