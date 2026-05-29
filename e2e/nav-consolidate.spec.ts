import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-NAV-CONSOLIDATE-01 gate_4: viewport 390x844
// 1) マネサポ top nav から 'import' タブが消えていること
// 2) AdminMastersHubPage で '取込' カードを押下 → /admin/import に遷移して PCH取込ハブが表示されること
// 3) AdminTopTabs の '集金' タブ押下 → /admin/collection-flag に遷移すること
// 4) クレサポ store dash から '集金' タイルが消えていること
// console errors 0 必須

test.describe('J-NAV-CONSOLIDATE-01 nav consolidation', () => {
  test('PCH取込: タブ消失 + masters hub の取込カードから遷移可 (390x844, console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    // Supabase REST はすべて空配列 (本テストはナビ専用)
    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.goto('/admin/masters')
    await expect(page.getByTestId('admin-top-tabs')).toBeVisible()

    // PCH取込タブは存在しない
    await expect(page.getByTestId('admin-tab-import')).toHaveCount(0)

    // 集金タブ + マスタタブは生存
    await expect(page.getByTestId('admin-tab-collection')).toBeVisible()
    await expect(page.getByTestId('admin-tab-masters')).toBeVisible()

    // masters hub の '取込' カード押下 → /admin/import 遷移
    await page.getByTestId('hub-tile-取込').click()
    await expect(page).toHaveURL(/\/admin\/import$/)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('集金: マネサポタブから /admin/collection-flag 遷移 (390x844, console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.goto('/admin/masters')
    await expect(page.getByTestId('admin-top-tabs')).toBeVisible()

    await page.getByTestId('admin-tab-collection').click()
    await expect(page).toHaveURL(/\/admin\/collection-flag$/)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('クレサポ store dash: 集金タイル消失 (390x844, console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'manager' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/stores**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ store_name: 'TEST店' }]) }))

    await page.goto('/clawsupport/store/TST01/dash')

    // 「巡回」「入替」「売上」は残るが「集金」は消えていること
    await expect(page.getByText('巡回', { exact: true })).toBeVisible()
    await expect(page.getByText('集金', { exact: true })).toHaveCount(0)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })
})
