// @ts-check
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/** ランチャー経由のクレサポ/タナサポ遷移用の REST 最小モック */
async function setupLauncherNavMocks(page) {
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/staff**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/staff_public**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { store_code: 'AKB01', store_name: 'アキバ本店', locality: '秋葉原', locality_kana: 'アキハバラ' },
      ]),
    })
  })
  await page.route('**/rest/v1/locations**', async (route) => {
    const url = route.request().url()
    if (url.includes('location_type=in.')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { location_id: 'KRM02', location_name: '久留米倉庫', location_type: 'warehouse' },
        ]),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
  })
  await page.route('**/rest/v1/staff_pinned_stores**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    }
  })
  await page.route('**/rest/v1/stocktake_sessions**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else {
      await route.continue()
    }
  })
}

test.describe('J-LAUNCHER-01: モジュールランチャー', () => {
  test('ログイン後セッションありで /login からランチャーへ遷移する', async ({ page }) => {
    await setupAuth(page, { role: 'patrol' })
    await setupLauncherNavMocks(page)
    await page.goto('/login')
    await page.waitForURL('**/launcher', { timeout: 8000 })
    await expect(page.getByText('クレサポ巡回')).toBeVisible({ timeout: 5000 })
  })

  test('タイルタップで各モジュールへ遷移する（管理者）', async ({ page }) => {
    await setupAuth(page, { role: 'admin' })
    await setupLauncherNavMocks(page)
    await page.goto('/launcher')
    await expect(page.getByTestId('launcher-tile-clawsupport')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('launcher-tile-clawsupport').click()
    await page.waitForURL('**/clawsupport', { timeout: 8000 })

    await page.goto('/launcher')
    await page.getByTestId('launcher-tile-tanasupport').click()
    await page.waitForURL('**/tanasupport', { timeout: 8000 })

    await page.goto('/launcher')
    await page.getByTestId('launcher-tile-manesupport').click()
    await page.waitForURL('**/admin', { timeout: 8000 })
    await expect(page.getByTestId('admin-top-tabs')).toBeVisible()
  })

  test('ヘッダー「メニュー」でランチャーに戻る', async ({ page }) => {
    await setupAuth(page, { role: 'admin' })
    await setupLauncherNavMocks(page)

    await page.goto('/clawsupport')
    await expect(page.getByText('クレサポ')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('header-launcher-menu').click()
    await page.waitForURL('**/launcher', { timeout: 8000 })

    await page.goto('/tanasupport')
    await expect(page.getByText('タナサポ')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('header-launcher-menu').click()
    await page.waitForURL('**/launcher', { timeout: 8000 })

    await page.goto('/admin')
    await expect(page.getByTestId('admin-top-tabs')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('header-launcher-menu').click()
    await page.waitForURL('**/launcher', { timeout: 8000 })
  })

  test('ロール=新人(staff)はクレサポ巡回のみモジュールタイル表示', async ({ page }) => {
    await setupAuth(page, { role: 'staff', name: '新人テスト' })
    await setupLauncherNavMocks(page)
    await page.goto('/launcher')
    await expect(page.getByTestId('launcher-tile-clawsupport')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('launcher-tile-tanasupport')).toHaveCount(0)
    await expect(page.getByTestId('launcher-tile-manesupport')).toHaveCount(0)
    await expect(page.getByTestId('launcher-tile-m3_sales')).toBeVisible()
    await expect(page.getByTestId('launcher-tile-m4_master')).toBeVisible()
  })

  test('ロール=管理者はクレサポ・タナサポ・マネサポのタイルが表示', async ({ page }) => {
    await setupAuth(page, { role: 'admin' })
    await setupLauncherNavMocks(page)
    await page.goto('/launcher')
    await expect(page.getByTestId('launcher-tile-clawsupport')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('launcher-tile-tanasupport')).toBeVisible()
    await expect(page.getByTestId('launcher-tile-manesupport')).toBeVisible()
    await expect(page.getByTestId('launcher-tile-m3_sales')).toBeVisible()
  })
})
