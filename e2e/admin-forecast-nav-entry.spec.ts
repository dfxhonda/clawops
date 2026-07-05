import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-ADMIN-FORECAST-CYCLE-S2B-NAV-ENTRY-FIX-01
// S2 added the 売上予測 menu entry to a dead component (manesupport/pages/AdminTop.jsx)
// never rendered by App.jsx's route graph. This test drives the REAL reachable path:
// admin layout -> 分析 tab -> AdminReportsHubPage tile grid -> 売上予測 tile -> ForecastList.
// A render-only assertion on the tile's label is not sufficient (that was S2's false-pass
// mode) -- this must prove the click actually lands on /admin/forecast with real content.

const LIST_ROW = {
  store_code: 'KOS01', cycle_start: '2026-06-16', next_collection: '2026-07-16',
  days_elapsed: 19, days_remaining: 11, ctd_revenue: 284442.86, dma7_daily: 16897.62,
  projected_landing: 504111.9, booth_count: 23, origin_source: 'collection', last_reading_date: '2026-07-03',
}

test.describe('売上予測 ナビゲーション到達性', () => {
  test('AC2: 分析タブ → 売上予測タイル → ForecastList表示、console error 0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    // catch-all first (lower priority); specific routes registered after win for overlapping matches
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/rpc/fn_forecast_store_list', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([LIST_ROW]) }))
    await page.route('**/rest/v1/stores*', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ store_code: 'KOS01', store_name: '古賀店', locality: '', locality_kana: '', is_active: true }]) }))

    await page.goto('/admin')
    await page.getByTestId('admin-tab-reports').click()
    await expect(page).toHaveURL(/\/admin\/reports/)
    await expect(page.getByTestId('admin-reports-hub')).toBeVisible()

    const tile = page.getByTestId('hub-tile-売上予測')
    await expect(tile).toBeVisible()
    await expect(tile.getByText('実装済')).toBeVisible()

    await tile.click()
    await expect(page).toHaveURL(/\/admin\/forecast/)
    await expect(page.getByTestId('forecast-store-row-KOS01')).toBeVisible()

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('AC3: 売上予測タイルはグリッド先頭', async ({ page }) => {
    await setupAuth(page, { role: 'admin' })
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.goto('/admin/reports')
    const tiles = page.locator('[data-testid^="hub-tile-"]')
    await expect(tiles.first()).toHaveAttribute('data-testid', 'hub-tile-売上予測')
  })
})
