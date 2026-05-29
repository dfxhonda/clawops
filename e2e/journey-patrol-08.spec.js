import { test, expect } from '@playwright/test'
// device分岐: 本specはiPhoneカスタムテンキーUXを検証するため iPhone UA を固定
test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' })
// J-COLLECTION-12 派生 (ad-hoc 2026-05-29): カスタムテンキー無効化試行中、本 spec は旧 UX 検証のため強制 enable。
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__USE_CUSTOM_NUMPAD__ = true })
})
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-008',
  booth_code: 'TST-B08',
  in_meter: 70000,
  out_meter: 1000,
  out_meter_2: null,
  out_meter_3: null,
  prize_stock_count: 10,
  prize_restock_count: 2,
  prize_id: null,
  prize_name: '前回景品',
  prize_name_2: null,
  prize_name_3: null,
  set_a: '5', set_c: '3', set_l: '2', set_r: '2', set_o: null,
  stock_2: null, stock_3: null, restock_2: null, restock_3: null,
  theoretical_stock: 10, payout_rate: 0.25,
  prize_cost: 300, prize_cost_1: null, prize_cost_2: null, prize_cost_3: null,
  patrol_date: '2026-05-08',
  read_time: '2026-05-08T10:00:00+09:00',
}

function makeMachine(outMeterCount = 1) {
  return {
    machine_code: 'TST01-M008',
    machine_name: 'テスト機8',
    store_code: 'TST01',
    machine_models: { out_meter_count: outMeterCount, meter_unit_price: 100 },
    machine_lockers: [],
    booths: [],
  }
}

async function mockCommon(page, { prevReading = PREV_READING } = {}) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = { store_code: 'TST01', store_name: 'テスト店舗', is_collection_day: false }
    const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const body = prevReading ? JSON.stringify([prevReading]) : '[]'
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
    })
  })
  await page.route('**/rest/v1/prize_masters**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function gotoPatrolBooth(page, { outMeterCount = 1, prevReading = PREV_READING } = {}) {
  await setupAuth(page)
  await mockCommon(page, { prevReading })
  await injectRouteState(page, '/clawsupport/booth/TST-B08', {
    machine: makeMachine(outMeterCount),
    booth: { booth_code: 'TST-B08', booth_number: 8 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B08')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

async function fillNumpad(page, testId, value) {
  await page.locator(`[data-testid="${testId}"]`).click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { state: 'visible', timeout: 3_000 })
  for (const ch of String(value)) {
    await page.locator(`[data-numpad-key="${ch}"]`).click()
  }
  await page.locator('[data-numpad-key="→"]').click()
}

// J-PATROL-08a: in_meter 入力前は 差セル IN行に '--' (text-gray-400) 表示
test('J-PATROL-08a: 入力前の差セルは -- (gray)', async ({ page }) => {
  await gotoPatrolBooth(page)
  const inDiff = page.locator('[data-testid="in-diff"]')
  await expect(inDiff).toBeVisible()
  await expect(inDiff).toHaveText('--')
  await expect(inDiff).toHaveClass(/text-gray-400/)
})

// J-PATROL-08b: in_meter 入力後 IN差分が正値=text-green-600 + プラス記号
test('J-PATROL-08b: IN入力後 正値=green+プラス記号', async ({ page }) => {
  await gotoPatrolBooth(page) // prev.in_meter=70000
  await fillNumpad(page, 'field-in-meter', '71000')
  const inDiff = page.locator('[data-testid="in-diff"]')
  await expect(inDiff).toHaveText('+1000')
  await expect(inDiff).toHaveClass(/text-green-600/)
})

// J-PATROL-08c: out_meter 入力後 OUT差分が負値=text-red-600
test('J-PATROL-08c: OUT入力後 負値=red', async ({ page }) => {
  await gotoPatrolBooth(page) // prev.out_meter=1000
  await fillNumpad(page, 'field-out-meter', '500')
  const outDiff = page.locator('[data-testid="out-diff"]')
  await expect(outDiff).toHaveText('-500')
  await expect(outDiff).toHaveClass(/text-red-600/)
})

// J-PATROL-08d: out_meter_count=3 機械で row_1 が 7 列 (IN/OUT1/OUT2/OUT3/差/残/補)
test('J-PATROL-08d: out_meter_count=3 で row_1 が 7 列', async ({ page }) => {
  await gotoPatrolBooth(page, { outMeterCount: 3 })
  const meterRow = page.locator('[data-testid="meter-row"]')
  await expect(meterRow).toBeVisible()
  await expect(meterRow).toHaveClass(/flex/)
  await expect(page.locator('[data-testid="tooltip-label-tt-field-in-meter"]')).toBeVisible()
  await expect(page.locator('[data-testid="tooltip-label-tt-field-diff"]')).toBeVisible()
  await expect(page.locator('[data-testid="tooltip-label-tt-field-stock"]')).toBeVisible()
  await expect(page.locator('[data-testid="tooltip-label-tt-field-restock"]')).toBeVisible()
})

// J-PATROL-08e: 差分=0 の場合 text-gray-400
test('J-PATROL-08e: 差分=0 で text-gray-400', async ({ page }) => {
  await gotoPatrolBooth(page) // prev.in_meter=70000
  await fillNumpad(page, 'field-in-meter', '70000')
  const inDiff = page.locator('[data-testid="in-diff"]')
  await expect(inDiff).toHaveText('0')
  await expect(inDiff).toHaveClass(/text-gray-400/)
})

// J-PATROL-08f: prev=null (新規ブース) の場合 '--' 表示
test('J-PATROL-08f: prev=null 新規ブースでは IN入力後も -- 表示', async ({ page }) => {
  await gotoPatrolBooth(page, { prevReading: null })
  await fillNumpad(page, 'field-in-meter', '70000')
  const inDiff = page.locator('[data-testid="in-diff"]')
  await expect(inDiff).toHaveText('--')
  await expect(inDiff).toHaveClass(/text-gray-400/)
})

// J-PATROL-08g: ラベル「差」tap で tooltip 表示「前回保存値からの差分...」
test('J-PATROL-08g: ラベル「差」tap で tooltip 表示', async ({ page }) => {
  await gotoPatrolBooth(page)
  const diffLabel   = page.locator('[data-testid="tooltip-label-tt-field-diff"]')
  const diffBalloon = page.locator('[data-testid="tooltip-balloon-tt-field-diff"]')
  await expect(diffBalloon).toBeHidden()
  await diffLabel.click()
  await expect(diffBalloon).toBeVisible()
  await expect(diffBalloon).toContainText('前回保存値からの差分')
})
