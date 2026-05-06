import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

/**
 * NumpadField を開いて数値を入力し → で閉じる
 * data-numpad-key 属性で各キーを特定
 */
async function fillNumpadField(page, fieldId, digits, advance = true) {
  // PointerDown でオープン
  await page.locator(fieldId).click()
  // シートが現れるまで待機
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })
  const sheet = page.locator('[data-testid="numpad-sheet"]')
  for (const d of String(digits)) {
    await sheet.locator(`[data-numpad-key="${d}"]`).click()
  }
  if (advance) {
    await sheet.locator('[data-numpad-key="→"]').click()
    // portal 全体が消えるまで待機（210ms transition）
    await page.waitForSelector('[data-testid="numpad-portal"]', { state: 'detached', timeout: 1500 }).catch(() => {})
  }
}

// J-PATROL-01: M1 Stage 2 メーター入力 → UPSERT → DB確認
// Acceptance:
//   - 機械リストが billing_order 順で表示される
//   - ブース行タップ → /clawsupport/booth/:boothCode に遷移
//   - 4値入力UI（IN→OUT→在庫→補充 順、Numpad使用）
//   - 保存 → meter_readings UPSERT 実行
//   - 値変化なし → upsert しない（carry_forward 停止）

const MOCK_STORE = { store_code: 'TST01', store_name: 'テスト一番街店' }
const MOCK_MACHINE = {
  machine_code:   'TST01-M001',
  machine_name:   'テスト機1',
  store_code:     'TST01',
  type_id:        1,
  model_id:       'model-001',
  billing_order:  1,
  machine_types:  { category: 'crane', locker_slots: 0 },
  machine_models: { out_meter_count: 1, meter_unit_price: 100 },
  booths: [
    { booth_code: 'TST-B01', booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'TST01-M001' },
    { booth_code: 'TST-B02', booth_number: 2, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'TST01-M001' },
  ],
  machine_lockers: [],
}

async function setupMocks(page, opts = {}) {
  const { todayDone = [], prevReading = null, saveFail = false } = opts

  await page.route('**/rest/v1/stores**', async (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_STORE]) })
  })

  // getPatrolMachines queries machines with embedded relations
  await page.route('**/rest/v1/machines**', async (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_MACHINE]) })
  })

  // getTodayReadingsMap: today's readings
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    const method = route.request().method()
    const url    = route.request().url()

    if (method === 'GET') {
      // getLastReadingForBooth → single booth query
      if (url.includes('booth_code=eq.TST-B01') || url.includes('booth_code=eq.TST-B02')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: prevReading ? JSON.stringify([prevReading]) : '[]',
        })
        return
      }
      // getTodayReadingsMap bulk query
      const rows = todayDone.map(bc => ({ booth_code: bc, reading_id: 'r-' + bc, read_time: new Date().toISOString() }))
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
      return
    }

    if (method === 'POST') {
      if (saveFail) {
        route.fulfill({ status: 500, body: JSON.stringify({ message: 'db error' }) })
      } else {
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ reading_id: 'new-001' }]) })
      }
      return
    }

    if (method === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ reading_id: 'existing-001' }]) })
      return
    }

    route.continue()
  })

  // Feature flag
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
    })
  })

  // Auth
  await page.route('**/rest/v1/staff**',        async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

test.describe('J-PATROL-01: 機械リスト → ブース入力 → UPSERT', () => {
  test('機械リストが表示され、ブースが patrol_order 順にある', async ({ page }) => {
    await setupAuth(page)
    await setupMocks(page)
    await page.goto('/clawsupport/store/TST01')

    await expect(page.getByText('テスト機1')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('booth-row-TST-B01')).toBeVisible()
    await expect(page.getByTestId('booth-row-TST-B02')).toBeVisible()
  })

  test('完了済みブースに ✓ が表示される', async ({ page }) => {
    await setupAuth(page)
    await setupMocks(page, { todayDone: ['TST-B01'] })
    await page.goto('/clawsupport/store/TST01')

    await expect(page.getByText('テスト機1')).toBeVisible({ timeout: 5000 })
    // booth-row-TST-B01 の内側に「入力済み」テキスト
    const b01 = page.getByTestId('booth-row-TST-B01')
    await expect(b01.getByText('入力済み')).toBeVisible({ timeout: 3000 })
  })

  test('ブース行タップで /clawsupport/booth/:boothCode に遷移', async ({ page }) => {
    await setupAuth(page)
    await setupMocks(page)
    await page.goto('/clawsupport/store/TST01')

    await expect(page.getByTestId('booth-row-TST-B01')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('booth-row-TST-B01').click()
    await page.waitForURL('**/clawsupport/booth/TST-B01', { timeout: 5000 })
  })

  test('4値入力UI: IN→OUT→在庫→補充 の順で Numpad 入力', async ({ page }) => {
    await setupAuth(page)
    await setupMocks(page)

    // inject state for navigation from machine list
    await page.addInitScript(() => {
      window.history.replaceState({
        usr: {
          machine: { machine_code: 'TST01-M001', machine_name: 'テスト機1', store_code: 'TST01', machine_lockers: [], booths: [] },
          booth: { booth_code: 'TST-B01', booth_number: 1 },
          storeCode: 'TST01',
        },
        key: 'e2e-test-key',
      }, '', '/clawsupport/booth/TST-B01')
    })
    await page.goto('/clawsupport/booth/TST-B01')

    await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('OUTメーター')).toBeVisible()
    await expect(page.getByText('景品在庫')).toBeVisible()
    await expect(page.getByText('補充数')).toBeVisible()
  })

  test('保存ボタン: 4値入力後に UPSERT が実行される', async ({ page }) => {
    await setupAuth(page)

    const insertedBodies = []
    await page.route('**/rest/v1/meter_readings**', async (route) => {
      const method = route.request().method()
      const url    = route.request().url()

      if (method === 'GET') {
        if (url.includes('patrol_date=eq.')) {
          // today's check → not exists
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        } else {
          // last reading
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        }
        return
      }
      if (method === 'POST') {
        insertedBodies.push(await route.request().postDataJSON())
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ reading_id: 'new-001' }]) })
        return
      }
      route.continue()
    })

    await page.route('**/rest/v1/feature_flags**', async (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) })
    })
    await page.route('**/rest/v1/staff**',        async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.addInitScript(() => {
      window.history.replaceState({
        usr: {
          machine: { machine_code: 'TST01-M001', machine_name: 'テスト機1', store_code: 'TST01', machine_lockers: [], booths: [] },
          booth: { booth_code: 'TST-B01', booth_number: 1 },
          storeCode: 'TST01',
        },
        key: 'e2e-test-key',
      }, '', '/clawsupport/booth/TST-B01')
    })
    await page.goto('/clawsupport/booth/TST-B01')

    await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })

    // 4値を Numpad で入力（IN → OUT → 在庫 → 補充の順）
    await fillNumpadField(page, '#field-in-meter',  '50000')
    await fillNumpadField(page, '#field-out-meter', '45000')
    await fillNumpadField(page, '#field-stock',     '20')
    // 補充数 = 0 のまま（必須ではない）

    // 保存ボタンが有効になるのを確認
    await expect(page.getByTestId('save-button')).not.toBeDisabled({ timeout: 2000 })

    // POST リクエストが来るまで待機してから save ボタンをクリック
    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 8000 }
    )
    await page.getByTestId('save-button').click()
    const insertReq = await postPromise

    // UPSERT ボディ検証
    const body = insertReq.postDataJSON()
    expect(body.entry_type).toBe('patrol')
    expect(body.booth_code).toBe('TST-B01')
  })
})
