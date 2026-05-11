// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * J-REVENUE-01: 売上分析ページ → 集計・レポートハブに移行済み
 * - /adminページが管理タブ付きで表示される
 * - /admin/reportsでレポートハブが表示される
 */

async function setupRevenueMocks(page) {
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

test('J-REVENUE-01a: /adminページが管理タブ付きで表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin')

  await expect(page.getByTestId('admin-top-tabs')).toBeVisible({ timeout: 8000 })
})

test('J-REVENUE-01b: /admin/reportsでレポートハブが表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')

  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})

test('J-REVENUE-01c: /admin/reportsへの遷移が動作する', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')

  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})

test('J-REVENUE-01d: /admin/reportsページが描画される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')

  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})

test('J-REVENUE-01e: /admin/reportsページが正常表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')

  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})
