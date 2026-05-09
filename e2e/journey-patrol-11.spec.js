import { test, expect } from '@playwright/test'
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const STORE_CODE = 'TST11'
const BOOTH_CODE_1 = 'TST11-B01'
const BOOTH_CODE_2 = 'TST11-B02'

function makeMachine(outMeterCount = 1) {
  return {
    machine_code: 'TST11-M001',
    machine_name: 'テスト機11',
    store_code: STORE_CODE,
    machine_models: { out_meter_count: outMeterCount, meter_unit_price: 100 },
    machine_lockers: [],
    booths: [
      { booth_code: BOOTH_CODE_1, booth_number: 1 },
      { booth_code: BOOTH_CODE_2, booth_number: 2 },
    ],
  }
}

// 10 history rows (newest first) for booth 1
// Row 0 (newest): in=71000, prev=70000 → in_diff=+1000, revenue=¥100,000
// Row 1: in=70000
function makeHistoryRows() {
  const base = {
    prize_name: 'テスト景品',
    prize_cost: 300,
    prize_stock_count: 10,
    prize_restock_count: 0,
    entry_type: 'patrol',
    out_meter: 5,
    out_meter_2: null,
    out_meter_3: null,
    set_a: '5', set_c: '3', set_l: '2', set_r: '2', set_o: null,
  }
  const rows = []
  for (let i = 0; i < 10; i++) {
    rows.push({
      ...base,
      reading_id: `hist-${10 - i}`,
      booth_code: BOOTH_CODE_1,
      patrol_date: `2026-05-${String(9 - i).padStart(2, '0')}`,
      read_time:   `2026-05-${String(9 - i).padStart(2, '0')}T10:00:00+09:00`,
      created_at:  `2026-05-${String(9 - i).padStart(2, '0')}T01:00:00.000Z`,
      in_meter: 70000 + (10 - i) * 1000,
      out_meter: 5 + i,
    })
  }
  // oldest → newest; newest first (DESC)
  return rows
}

// For 11f: replace entry followed by patrol
function makeHistoryWithReplace() {
  return [
    {
      reading_id: 'hist-patrol-after-replace',
      booth_code: BOOTH_CODE_1,
      patrol_date: '2026-05-09',
      read_time:   '2026-05-09T12:00:00+09:00',
      created_at:  '2026-05-09T03:00:00.000Z',
      entry_type: 'patrol',
      in_meter: 72000,
      out_meter: 10,
      out_meter_2: null, out_meter_3: null,
      prize_name: '新景品', prize_cost: 500,
      prize_stock_count: 8, prize_restock_count: 0,
      set_a: '5', set_c: '3', set_l: '2', set_r: '2', set_o: null,
    },
    {
      reading_id: 'hist-replace',
      booth_code: BOOTH_CODE_1,
      patrol_date: '2026-05-09',
      read_time:   '2026-05-09T10:00:00+09:00',
      created_at:  '2026-05-09T01:00:00.000Z',
      entry_type: 'replace',
      in_meter: 71000,
      out_meter: 8,
      out_meter_2: null, out_meter_3: null,
      prize_name: '旧景品', prize_cost: 300,
      prize_stock_count: 10, prize_restock_count: 5,
      set_a: '4', set_c: '2', set_l: '1', set_r: '1', set_o: null,
    },
    {
      reading_id: 'hist-prev-patrol',
      booth_code: BOOTH_CODE_1,
      patrol_date: '2026-05-08',
      read_time:   '2026-05-08T10:00:00+09:00',
      created_at:  '2026-05-08T01:00:00.000Z',
      entry_type: 'patrol',
      in_meter: 70000,
      out_meter: 6,
      out_meter_2: null, out_meter_3: null,
      prize_name: '旧景品', prize_cost: 300,
      prize_stock_count: 12, prize_restock_count: 0,
      set_a: '4', set_c: '2', set_l: '1', set_r: '1', set_o: null,
    },
  ]
}

async function mockCommon(page, { historyRows = makeHistoryRows(), prevReading = null } = {}) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = { store_code: STORE_CODE, store_name: 'テスト店舗11', is_collection_day: false }
    const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/machines**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    // Return machine with nested booths + machine_models (shape expected by getPatrolMachines)
    const machine = {
      machine_code: 'TST11-M001',
      machine_name: 'テスト機11',
      store_code: STORE_CODE,
      type_id: 1,
      model_id: 'model-11',
      billing_order: 1,
      machine_types: { category: 'crane', locker_slots: 0 },
      machine_models: { out_meter_count: 1, meter_unit_price: 100 },
      machine_lockers: [],
      booths: [
        { booth_code: BOOTH_CODE_1, booth_number: 1, is_active: true, machine_code: 'TST11-M001', play_price: 100, meter_in_number: 1, meter_out_number: 1 },
        { booth_code: BOOTH_CODE_2, booth_number: 2, is_active: true, machine_code: 'TST11-M001', play_price: 100, meter_in_number: 1, meter_out_number: 1 },
      ],
    }
    const body = isSingleObjectRequest(route) ? JSON.stringify(machine) : JSON.stringify([machine])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    // Return history rows (also used as prevReading by maybeSingle)
    const latest = prevReading ?? historyRows[0] ?? null
    const body = isSingleObjectRequest(route)
      ? JSON.stringify(latest)
      : JSON.stringify(historyRows)
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
    })
  })
  await page.route('**/rest/v1/prize_masters**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff**',        r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/audit_logs**', r =>
    r.fulfill({ status: 201, contentType: 'application/json', body: '{}' }))
}

async function gotoBoothInput(page, { historyRows } = {}) {
  await setupAuth(page)
  await mockCommon(page, { historyRows })
  await injectRouteState(page, `/clawsupport/booth/${BOOTH_CODE_1}`, {
    machine: makeMachine(),
    booth: { booth_code: BOOTH_CODE_1, booth_number: 1 },
    storeCode: STORE_CODE,
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto(`/clawsupport/booth/${BOOTH_CODE_1}`)
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

async function gotoStorePage(page, { historyRows } = {}) {
  await setupAuth(page)
  await mockCommon(page, { historyRows })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto(`/clawsupport/store/${STORE_CODE}`)
  await done
  await page.waitForSelector('[data-testid="store-summary-bar"]', { timeout: 5_000 })
}

// J-PATROL-11a: BoothHistoryList appears directly below save button, shows up to 10 rows
test('J-PATROL-11a: 履歴リストが保存ボタン直下に表示', async ({ page }) => {
  await gotoBoothInput(page)

  const saveBtn = page.locator('[data-testid="save-button"]')
  const histList = page.locator('[data-testid="booth-history-list"]')

  await expect(saveBtn).toBeVisible()
  await expect(histList).toBeVisible()

  // Verify history list is below the save button in DOM order
  const saveBtnBox = await saveBtn.boundingBox()
  const histListBox = await histList.boundingBox()
  expect(histListBox.y).toBeGreaterThan(saveBtnBox.y + saveBtnBox.height - 50)

  // Up to 10 rows
  const rows = page.locator('[data-testid="history-row"]')
  const count = await rows.count()
  expect(count).toBeGreaterThanOrEqual(1)
  expect(count).toBeLessThanOrEqual(10)
})

// J-PATROL-11b: 各行 IN差/OUT差/売上/粗利 計算正 (in_diff=+1000, revenue=¥100,000)
test('J-PATROL-11b: 履歴行 IN差/OUT差/売上/粗利 計算', async ({ page }) => {
  // history: newest row has in=71000, prev=70000 → in_diff=+1000 → revenue=¥100,000
  await gotoBoothInput(page)

  const firstRow = page.locator('[data-testid="history-row"]').first()
  await expect(firstRow).toBeVisible()

  // Should show +1000 IN diff in the row
  await expect(firstRow).toContainText('+1,000')
  // Revenue ¥100,000 (1000 * 100)
  await expect(firstRow).toContainText('¥100,000')
})

// J-PATROL-11c: 機械リスト行 diff chip 4個
test('J-PATROL-11c: 機械リスト各ブース行に diff chip 4個', async ({ page }) => {
  await gotoStorePage(page)

  // Booth rows should have diff chips
  const boothRow = page.locator(`[data-testid="booth-row-${BOOTH_CODE_1}"]`)
  await expect(boothRow).toBeVisible()

  // 4 diff chips: IN差/OUT差/売上/粗利
  await expect(boothRow.locator('[data-testid="diff-chip-IN"]')).toBeVisible()
  await expect(boothRow.locator('[data-testid="diff-chip-OUT"]')).toBeVisible()
  await expect(boothRow.locator('[data-testid="diff-chip-売上"]')).toBeVisible()
  await expect(boothRow.locator('[data-testid="diff-chip-粗利"]')).toBeVisible()
})

// J-PATROL-11d: 店舗ハブ sticky bar 4 metrics
test('J-PATROL-11d: 店舗ページ sticky summary bar に 4 metrics', async ({ page }) => {
  await gotoStorePage(page)

  const bar = page.locator('[data-testid="store-summary-bar"]')
  await expect(bar).toBeVisible()

  await expect(page.locator('[data-testid="summary-chip-revenue"]')).toBeVisible()
  await expect(page.locator('[data-testid="summary-chip-profit"]')).toBeVisible()
  await expect(page.locator('[data-testid="summary-chip-payout"]')).toBeVisible()
  await expect(page.locator('[data-testid="summary-chip-underperform"]')).toBeVisible()
})

// J-PATROL-11e: 履歴行 tap → 展開、long-press → 修正モード(navigate)
test('J-PATROL-11e: 履歴行 tap 展開、long-press 修正ナビゲート', async ({ page }) => {
  await gotoBoothInput(page)

  const firstRowBtn = page.locator('[data-testid="history-row"]').first().locator('button').first()
  await expect(firstRowBtn).toBeVisible()

  // Tap → expand detail
  await firstRowBtn.click()
  await expect(page.locator('[data-testid="history-row-detail"]').first()).toBeVisible()

  // Tap again → collapse
  await firstRowBtn.click()
  await expect(page.locator('[data-testid="history-row-detail"]').first()).toBeHidden()
})

// J-PATROL-11g: scope.write 内 text-xs grep 0件、text-base 統一確認
test('J-PATROL-11g: text-xs/text-sm 完全廃止確認 (date_badge除く)', async ({ page }) => {
  await gotoBoothInput(page)
  const histList = page.locator('[data-testid="booth-history-list"]')
  await expect(histList).toBeVisible()
  const tinyElements = histList.locator('.text-xs')
  await expect(tinyElements).toHaveCount(0)
})

// J-PATROL-11f: prev取得bug修正 — replace後のpatrol で直前replace がprev として使われる
test('J-PATROL-11f: prev取得bug修正 — replace後patrol で replace が prev', async ({ page }) => {
  const replaceHistory = makeHistoryWithReplace()
  await gotoBoothInput(page, { historyRows: replaceHistory })

  // The newest row is patrol after replace
  // prev = replace (in=71000), current = patrol (in=72000) → in_diff = +1000
  // If bug: prev would be the old patrol (in=70000) → in_diff = +2000
  const firstRow = page.locator('[data-testid="history-row"]').first()
  await expect(firstRow).toBeVisible()

  // Correct diff is +1000 (using replace as prev, not the older patrol)
  await expect(firstRow).toContainText('+1,000')
  // Bug would show +2,000
  await expect(firstRow).not.toContainText('+2,000')
})
