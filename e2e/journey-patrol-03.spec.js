import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-PATROL-03: 集金チェック — チェックボックス ON で entry_type='collection' で記録
// Acceptance:
//   - 集金チェックボックスが画面に表示される
//   - チェック ON → entry_type バッジが「集金」になる
//   - 保存 → entry_type='collection' で POST される

async function setupBoothMocks(page) {
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ reading_id: 'new-collection-001' }]),
      })
    }
    route.continue()
  })

  await page.route('**/rest/v1/feature_flags**', async (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
    })
  })

  await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function injectBoothState(page) {
  await page.addInitScript(() => {
    window.history.replaceState({
      usr: {
        machine: { machine_code: 'TST01-M001', machine_name: 'テスト機1', store_code: 'TST01', machine_lockers: [], booths: [] },
        booth:   { booth_code: 'TST-B01', booth_number: 1 },
        storeCode: 'TST01',
      },
      key: 'e2e-collection-key',
    }, '', '/clawsupport/booth/TST-B01')
  })
}

async function fillNumpadField(page, fieldId, digits) {
  await page.locator(fieldId).click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })
  const sheet = page.locator('[data-testid="numpad-sheet"]')
  for (const d of String(digits)) {
    await sheet.locator(`[data-numpad-key="${d}"]`).click()
  }
  await sheet.locator('[data-numpad-key="→"]').click()
  await page.waitForSelector('[data-testid="numpad-portal"]', { state: 'detached', timeout: 1500 }).catch(() => {})
}

test.describe('J-PATROL-03: 集金チェック', () => {
  test('集金チェックボックスが表示される', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await page.goto('/clawsupport/booth/TST-B01')

    await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('collection-checkbox')).toBeVisible()
    await expect(page.getByText('集金あり')).toBeVisible()
  })

  test('集金チェック ON で entry_type バッジが「集金」になる', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await page.goto('/clawsupport/booth/TST-B01')

    await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })

    // 初期状態: 通常巡回バッジ
    await expect(page.getByText('通常巡回')).toBeVisible()

    // 集金チェック ON
    await page.getByTestId('collection-checkbox').check()

    // バッジが「集金」に変わる（exact: true で EntryTypeBadge の span のみ対象）
    await expect(page.getByText('集金', { exact: true })).toBeVisible({ timeout: 2000 })
    await expect(page.getByText('集金記録として保存')).toBeVisible()
  })

  test('集金チェック ON + 4値入力 → entry_type="collection" で POST される', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await page.goto('/clawsupport/booth/TST-B01')

    await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })

    // 集金チェック ON
    await page.getByTestId('collection-checkbox').check()
    await expect(page.getByText('集金', { exact: true })).toBeVisible({ timeout: 2000 })

    // 4値入力
    await fillNumpadField(page, '#field-in-meter',  '52000')
    await fillNumpadField(page, '#field-out-meter', '47000')
    await fillNumpadField(page, '#field-stock',     '15')

    // POST 監視
    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 8000 }
    )
    await page.getByTestId('save-button').click()
    const insertReq = await postPromise
    const body = insertReq.postDataJSON()

    expect(body.entry_type).toBe('collection')
    expect(body.booth_code).toBe('TST-B01')
  })

  test('集金チェック OFF → entry_type="patrol" (通常)', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await page.goto('/clawsupport/booth/TST-B01')

    await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })

    // チェックしない
    await fillNumpadField(page, '#field-in-meter',  '53000')
    await fillNumpadField(page, '#field-out-meter', '48000')
    await fillNumpadField(page, '#field-stock',     '10')

    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 8000 }
    )
    await page.getByTestId('save-button').click()
    const insertReq = await postPromise
    const body = insertReq.postDataJSON()

    expect(body.entry_type).toBe('patrol')
  })
})
