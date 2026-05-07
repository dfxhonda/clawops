// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'
import * as fs from 'fs'

/**
 * J-REVENUE-03: CSV出力 + URLステート
 * - CSVファイル名が revenue_${period}_${YYYY-MM-DD} 形式
 * - CSVがUTF-8 BOM (﻿) で始まる
 * - ranking_tab パラメータがURLに反映される
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

test('J-REVENUE-03a: CSVファイル名が revenue_${period}_${YYYY-MM-DD} 形式', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('[data-rank="1"]')).toBeVisible({ timeout: 5000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('csv-download-btn').click(),
  ])

  const filename = download.suggestedFilename()
  expect(filename).toMatch(/^revenue_today_\d{4}-\d{2}-\d{2}\.csv$/)
})

test('J-REVENUE-03b: CSVファイルがUTF-8 BOMで始まる', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('[data-rank="1"]')).toBeVisible({ timeout: 5000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('csv-download-btn').click(),
  ])

  const filePath = await download.path()
  const buf = fs.readFileSync(filePath)
  // UTF-8 BOM: EF BB BF
  expect(buf[0]).toBe(0xef)
  expect(buf[1]).toBe(0xbb)
  expect(buf[2]).toBe(0xbf)
})

test('J-REVENUE-03c: ranking_tabパラメータがURLに反映される', async ({ page }) => {
  await setupAuth(page, { role: 'admin' })
  await setupRevenueMocks(page)
  await page.goto('/admin/revenue')

  await expect(page.getByTestId('kpi-section')).toBeVisible({ timeout: 8000 })

  await page.getByRole('tab', { name: '機械別' }).click()
  await expect(page).toHaveURL(/ranking_tab=machine/, { timeout: 3000 })

  await page.getByRole('tab', { name: '景品別' }).click()
  await expect(page).toHaveURL(/ranking_tab=prize/, { timeout: 3000 })
})
