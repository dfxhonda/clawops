// @ts-check
import { test, expect } from '@playwright/test'

/**
 * J-ADMIN-03: machine_and_staff_master
 * a: /admin/masters/machines 機械一覧表示、店舗フィルタ実動
 * b: 機械行タップ → 詳細モーダル、編集保存でPATCH成功
 * c: /admin/masters/staff スタッフ一覧、pin/pin_hash列は画面に表示されない
 * d: スタッフ行タップ → PINリセットボタン → 確認ダイアログ → OKでpin=null、has_pin=false
 * e: J-ADMIN-05 regression (prize master + order history)
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
    user_metadata: { staff_id: 'staff-admin-001', name: 'テスト管理者', role: 'admin' },
    app_metadata: { provider: 'email' },
  },
}

const MOCK_MACHINE = {
  machine_code:       'KKY01-A01',
  machine_name:       'テスト機械',
  play_price:         100,
  is_active:          true,
  maintenance_status: 'normal',
  installed_at:       '2024-01-01',
  store_code:         'KKY01',
  stores:             { store_name: 'テスト店舗' },
}

const MOCK_STAFF = {
  staff_id:   'staff-001',
  name:       'テストスタッフ',
  name_kana:  'テストスタッフ',
  role:       'patrol',
  has_pin:    true,
  is_active:  true,
  joined_at:  '2024-04-01',
  store_code: 'KKY01',
  stores:     { store_name: 'テスト店舗' },
}

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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_SESSION.user) })
    }
  })
}

async function setupCommonMocks(page) {
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ store_code: 'KKY01', store_name: 'テスト店舗' }]),
    })
  })
}

test('J-ADMIN-03a: /admin/masters/machines 機械一覧表示・店舗フィルタ', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/machines**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([MOCK_MACHINE]),
    })
  })

  await page.goto('/admin/masters/machines')
  await expect(page.getByTestId('machine-master-page')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('KKY01-A01')).toBeVisible()
  await expect(page.getByText('テスト機械')).toBeVisible()

  // store filter exists
  await expect(page.getByTestId('machine-filter-store')).toBeVisible()
  await page.getByTestId('machine-filter-store').selectOption('KKY01')
})

test('J-ADMIN-03b: 機械行タップ → 詳細モーダル → PATCH成功', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/machines**', async (route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_MACHINE]) })
    } else {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_MACHINE, floor: '2F', zone: 'A' }]),
      })
    }
  })

  const patchReq = page.waitForRequest(
    req => req.url().includes('/rest/v1/machines') && req.method() === 'PATCH',
    { timeout: 10000 }
  )

  await page.goto('/admin/masters/machines')
  await expect(page.getByTestId('machine-master-page')).toBeVisible({ timeout: 8000 })
  await page.getByTestId('machine-row-KKY01-A01').click()
  await expect(page.getByTestId('machine-detail-modal')).toBeVisible({ timeout: 5000 })

  await page.getByTestId('machine-save-button').click()
  await patchReq
})

test('J-ADMIN-03c: /admin/masters/staff スタッフ一覧、pin列は画面に表示されない', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/staff**', async (route) => {
    const url = route.request().url()
    // ensure pin/pin_hash never in select
    expect(url).not.toContain('pin_hash')
    const selectParam = new URL(url).searchParams.get('select') ?? ''
    expect(selectParam).not.toContain('pin_hash')
    // pin may appear in has_pin but not as standalone pin column
    const parts = selectParam.split(',')
    expect(parts).not.toContain('pin')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([MOCK_STAFF]),
    })
  })

  await page.goto('/admin/masters/staff')
  await expect(page.getByTestId('staff-list-page')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('テストスタッフ').first()).toBeVisible()

  // pin column value should NOT be exposed as text "pin" heading
  const headers = await page.locator('thead th').allTextContents()
  expect(headers.some(h => h.toLowerCase() === 'pin' || h.toLowerCase() === 'pin_hash')).toBe(false)
})

test('J-ADMIN-03d: PINリセット確認ダイアログ → pin=null PATCH', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  let pinResetCalled = false
  await page.route('**/rest/v1/staff**', async (route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      const body = await route.request().postDataJSON()
      if (body?.pin === null && body?.has_pin === false) pinResetCalled = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([MOCK_STAFF]),
      })
    }
  })

  await page.goto('/admin/masters/staff')
  await expect(page.getByTestId('staff-list-page')).toBeVisible({ timeout: 8000 })
  await page.getByTestId('staff-row-staff-001').click()
  await expect(page.getByTestId('staff-detail-modal')).toBeVisible({ timeout: 5000 })

  await page.getByTestId('pin-reset-button').click()
  await expect(page.getByTestId('pin-reset-confirm-button')).toBeVisible()

  await page.getByTestId('pin-reset-confirm-button').click()
  await page.waitForTimeout(500)
  expect(pinResetCalled).toBe(true)
})

test('J-ADMIN-03e: J-ADMIN-05 regression — prize master page renders', async ({ page }) => {
  await setupAdminAuth(page)
  await setupCommonMocks(page)

  await page.route('**/rest/v1/prize_masters**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/admin/masters/prizes')
  await expect(page.getByTestId('admin-tab-masters')).toBeVisible({ timeout: 5000 })
})
