// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * J-REVENUE-01: 売上分析ダッシュボード基本表示
 * - AdminTopに売上分析タイルが存在する
 * - /admin/revenueでKPIセクションが表示される
 * - 期間タブクリックでURLが変わる
 * - 前期比デルタが表示される
 * - カスタム期間で日付入力が表示される
 */

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

test('J-REVENUE-01a: AdminTopに売上分析タイルが表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin')

  await expect(page.getByTestId('revenue-tile')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('revenue-tile')).toContainText('売上分析')
})

test('J-REVENUE-01b: /admin/revenueでKPIセクションが表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('売上合計')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('巡回機械数')).toBeVisible()
})

test('J-REVENUE-01c: 期間タブクリックでURLのperiodパラメータが変わる', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })

  await page.getByRole('tab', { name: '今週' }).first().click()
  await expect(page).toHaveURL(/period=week/, { timeout: 3000 })

  await page.getByRole('tab', { name: '今月' }).first().click()
  await expect(page).toHaveURL(/period=month/, { timeout: 3000 })
})

test('J-REVENUE-01d: KPIデルタ要素が表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('kpi-delta')).toBeVisible({ timeout: 5000 })
})

test('J-REVENUE-01e: カスタム期間タブで日付入力が表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })

  await page.getByRole('tab', { name: 'カスタム' }).first().click()
  await expect(page).toHaveURL(/period=custom/, { timeout: 3000 })
  await expect(page.getByTestId('custom-start-date')).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('custom-end-date')).toBeVisible()
})
