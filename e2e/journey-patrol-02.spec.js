import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

function isSingleRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

async function mockStoreCollectionDay(page, isCollectionDay) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = {
      store_code: 'TST01',
      store_name: 'テスト店舗',
      is_collection_day: isCollectionDay,
    }
    const body = isSingleRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}

// J-PATROL-02: 入替判定 — 同一ブース連続2レコード差分から entry_type='replace' 自動分類
// Acceptance:
//   - 前回と同じメーター値 + 異なる景品名 → entry_type='replace' で新規 INSERT
//   - 前回と同じメーター値 + 異なる設定値 → entry_type='replace' で新規 INSERT
//   - replace は既存レコードを UPDATE しない（新規 INSERT）

const PREV_READING = {
  reading_id:          'prev-001',
  in_meter:            50000,
  out_meter:           45000,
  prize_stock_count:   20,
  prize_restock_count: 0,
  prize_name:          '景品A',
  set_a:               '3',
  set_c:               null,
  set_l:               null,
  set_r:               null,
  set_o:               null,
  patrol_date:         '2026-05-05',
  read_time:           '2026-05-05T10:00:00+09:00',
}

async function setupBoothMocks(page, opts = {}) {
  const { prevReading = PREV_READING } = opts

  await mockStoreCollectionDay(page, false)

  await page.route('**/rest/v1/meter_readings**', async (route) => {
    const method = route.request().method()
    const url    = route.request().url()

    if (method === 'GET') {
      if (url.includes('entry_type=eq.patrol')) {
        // 当日 patrol レコードなし
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      // getLastReadingForBooth
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: prevReading ? JSON.stringify([prevReading]) : '[]',
      })
    }

    if (method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ reading_id: 'new-replace-001' }]),
      })
    }

    if (method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{}]),
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
      key: 'e2e-replace-key',
    }, '', '/clawsupport/booth/TST-B01')
  })
}

async function gotoPatrolBooth(page) {
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B01')
  await done
  await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })
}

async function fillNumpadField(page, fieldId, digits) {
  await page.locator(fieldId).click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })
  const sheet = page.locator('[data-testid="numpad-sheet"]')
  for (const d of String(digits)) {
    await sheet.locator(`[data-numpad-key="${d}"]`).click()
  }
  await page.locator('[data-testid="numpad-sheet"] [data-numpad-key="→"]').click()
  await page.waitForSelector('[data-testid="numpad-portal"]', { state: 'detached', timeout: 1500 }).catch(() => {})
}

test.describe('J-PATROL-02: 入替判定', () => {
  test('前回と同じメーター + 異なる景品名 → entry_type="replace" で新規 INSERT', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    // 前回と同じメーター値を入力
    await fillNumpadField(page, '#field-in-meter',  '50000')
    await fillNumpadField(page, '#field-out-meter', '45000')
    await fillNumpadField(page, '#field-stock',     '20')

    // 景品名を変更（入替トリガー）
    await page.locator('#field-prize-name').fill('景品B')

    // entry_type バッジが「入替/設定変更」になることを確認
    await expect(page.getByText('入替/設定変更')).toBeVisible({ timeout: 2000 })

    // POST リクエストを待つ
    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 8000 }
    )
    await page.getByTestId('save-button').click()
    const insertReq = await postPromise
    const body = insertReq.postDataJSON()

    expect(body.entry_type).toBe('replace')
    expect(body.prize_name).toBe('景品B')
    expect(body.booth_code).toBe('TST-B01')
  })

  test('前回と同じメーター + 異なる設定値 → entry_type="replace" で新規 INSERT', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    await fillNumpadField(page, '#field-in-meter',  '50000')
    await fillNumpadField(page, '#field-out-meter', '45000')
    await fillNumpadField(page, '#field-stock',     '20')

    // 設定値を変更（設定調整トリガー）: NumpadField に変更されたため fillNumpadField を使用
    await fillNumpadField(page, '#field-set-a', '5')

    await expect(page.getByText('入替/設定変更')).toBeVisible({ timeout: 2000 })

    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 8000 }
    )
    await page.getByTestId('save-button').click()
    const insertReq = await postPromise
    const body = insertReq.postDataJSON()

    expect(body.entry_type).toBe('replace')
    expect(body.set_a).toBe('5')
  })

  test('前回と異なるメーター値 → entry_type="patrol" で通常保存', async ({ page }) => {
    await setupAuth(page)
    await setupBoothMocks(page)
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    // メーター値を変更 → patrol
    await fillNumpadField(page, '#field-in-meter',  '51000')
    await fillNumpadField(page, '#field-out-meter', '46000')
    await fillNumpadField(page, '#field-stock',     '18')

    await expect(page.getByText('通常巡回')).toBeVisible({ timeout: 2000 })

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
