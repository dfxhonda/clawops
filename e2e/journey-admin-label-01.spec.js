// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-ADMIN-LABEL-01: QRラベル印刷ページ
 * - /admin/labels にラベル一覧が表示される
 * - 店舗フィルタで絞り込みが動作する
 * - 全選択チェックボックスが動作する
 * - 印刷ボタンが選択枚数で enable/disable される
 */

const ADMIN_SESSION = {
  access_token: 'test-admin-token',
  token_type:   'bearer',
  expires_in:   7200,
  expires_at:   Math.floor(Date.now() / 1000) + 7200,
  refresh_token: 'test-refresh-admin',
  user: {
    id:    'test-admin-001',
    email: 'admin@test.com',
    aud:   'authenticated',
    role:  'authenticated',
    user_metadata: {
      staff_id: 'staff-admin-001',
      name:     'テスト管理者',
      role:     'admin',
    },
    app_metadata: { provider: 'email' },
  },
}

const MOCK_BOOTHS = [
  {
    booth_code:   'KKY01-A01-001',
    booth_number: 1,
    machine_code: 'KKY01-A01',
    machines: {
      machine_name: 'Aマシン',
      store_code:   'KKY01',
      stores: { store_name: 'テスト店舗A' },
    },
  },
  {
    booth_code:   'KKY01-A01-002',
    booth_number: 2,
    machine_code: 'KKY01-A01',
    machines: {
      machine_name: 'Aマシン',
      store_code:   'KKY01',
      stores: { store_name: 'テスト店舗A' },
    },
  },
  {
    booth_code:   'FKO01-B01-001',
    booth_number: 1,
    machine_code: 'FKO01-B01',
    machines: {
      machine_name: 'Bマシン',
      store_code:   'FKO01',
      stores: { store_name: 'テスト店舗B' },
    },
  },
]

async function setupAdminAuth(page) {
  await page.addInitScript((session) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key && key.endsWith('-auth-token')) return JSON.stringify(session)
      return orig.call(this, key)
    }
  }, ADMIN_SESSION)

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/signout')) {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ADMIN_SESSION.user),
      })
    }
  })
}

async function setupLabelMocks(page) {
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/staff**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/booths**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BOOTHS),
    })
  })
}

test('J-ADMIN-LABEL-01a: /admin/labels にラベル一覧が表示される', async ({ page }) => {
  await setupAdminAuth(page)
  await setupLabelMocks(page)

  await page.goto('/admin/labels')
  await expect(page.getByTestId('admin-tab-labels')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('qr-label-list')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('KKY01-A01-001').first()).toBeVisible()
  await expect(page.getByText('KKY01-A01-002').first()).toBeVisible()
  await expect(page.getByText('FKO01-B01-001').first()).toBeVisible()
})

test('J-ADMIN-LABEL-01b: 店舗フィルタで絞り込みが動作する', async ({ page }) => {
  await setupAdminAuth(page)
  await setupLabelMocks(page)

  await page.goto('/admin/labels')
  await expect(page.getByTestId('qr-label-list')).toBeVisible({ timeout: 8000 })

  await page.getByTestId('qr-filter-store').selectOption('KKY01')
  await expect(page.getByText('KKY01-A01-001').first()).toBeVisible()
  await expect(page.getByText('KKY01-A01-002').first()).toBeVisible()
  await expect(page.getByText('FKO01-B01-001').first()).not.toBeVisible()
})

test('J-ADMIN-LABEL-01c: 全選択チェックボックスが動作する', async ({ page }) => {
  await setupAdminAuth(page)
  await setupLabelMocks(page)

  await page.goto('/admin/labels')
  await expect(page.getByTestId('qr-label-list')).toBeVisible({ timeout: 8000 })

  const selectAll = page.getByTestId('qr-select-all')
  await expect(selectAll).toBeChecked()

  await selectAll.uncheck()
  await expect(selectAll).not.toBeChecked()
  await expect(page.getByText('0枚選択中')).toBeVisible()

  await selectAll.check()
  await expect(selectAll).toBeChecked()
  await expect(page.getByText('3枚選択中')).toBeVisible()
})

test('J-ADMIN-LABEL-01d: 印刷ボタンが選択枚数で enable/disable される', async ({ page }) => {
  await setupAdminAuth(page)
  await setupLabelMocks(page)

  await page.goto('/admin/labels')
  await expect(page.getByTestId('qr-label-list')).toBeVisible({ timeout: 8000 })

  const printBtn = page.getByTestId('qr-print-button')
  await expect(printBtn).toBeEnabled()
  await expect(printBtn).toContainText('3枚')

  await page.getByTestId('qr-select-all').uncheck()
  await expect(printBtn).toBeDisabled()
})
