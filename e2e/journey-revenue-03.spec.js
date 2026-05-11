// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * J-REVENUE-03: CSV出力 + URLステート → 集計・レポートハブに移行済み
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

test('J-REVENUE-03a: /admin/reportsページが表示される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')
  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})

test('J-REVENUE-03b: /admin/reportsページが描画される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')
  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})

test('J-REVENUE-03c: /admin/reportsへの遷移が動作する', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/reports')
  await expect(page.getByTestId('admin-reports-hub')).toBeVisible({ timeout: 8000 })
})
