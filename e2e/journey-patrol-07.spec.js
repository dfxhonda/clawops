import { test, expect } from '@playwright/test'
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-007',
  booth_code: 'TST-B07',
  in_meter: 70000,
  out_meter: 0,
  out_meter_2: null,
  out_meter_3: null,
  prize_stock_count: 10,
  prize_restock_count: 2,
  prize_id: null,
  prize_name: '前回景品',
  prize_name_2: null,
  prize_name_3: null,
  set_a: '5',
  set_c: '3',
  set_l: '2',
  set_r: '2',
  set_o: null,
  stock_2: null,
  stock_3: null,
  restock_2: null,
  restock_3: null,
  theoretical_stock: 10,
  payout_rate: 0.25,
  prize_cost: 300,
  prize_cost_1: null,
  prize_cost_2: null,
  prize_cost_3: null,
  patrol_date: '2026-05-07',
  read_time: '2026-05-07T10:00:00+09:00',
}

function makeMachine(outMeterCount = 1) {
  return {
    machine_code: 'TST01-M007',
    machine_name: 'テスト機7',
    store_code: 'TST01',
    machine_models: { out_meter_count: outMeterCount, meter_unit_price: 100 },
    machine_lockers: [],
    booths: [],
  }
}

async function mockCommon(page, { prevReading = PREV_READING, isCollectionDay = false } = {}) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = { store_code: 'TST01', store_name: 'テスト店舗', is_collection_day: isCollectionDay }
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
  await injectRouteState(page, '/clawsupport/booth/TST-B07', {
    machine: makeMachine(outMeterCount),
    booth: { booth_code: 'TST-B07', booth_number: 7 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B07')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

// J-PATROL-07a: ラベル「IN」tap で balloon 表示、外側 tap で close
test('J-PATROL-07a: ラベル「IN」tap → balloon 開閉', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inLabel   = page.locator('[data-testid="tooltip-label-tt-field-in-meter"]')
  const inBalloon = page.locator('[data-testid="tooltip-balloon-tt-field-in-meter"]')

  await expect(inBalloon).toBeHidden()

  await inLabel.click()
  await expect(inBalloon).toBeVisible()

  await page.locator('[data-testid="theory-row"]').click()
  await expect(inBalloon).toBeHidden()
})

// J-PATROL-07b: ラベル「@」tap で「景品 1個あたりの仕入れ価格」balloon 表示
test('J-PATROL-07b: ラベル「@」tap → 景品原価 balloon', async ({ page }) => {
  await gotoPatrolBooth(page)

  const costLabel   = page.locator('[data-testid="tooltip-label-tt-field-prize-cost"]')
  const costBalloon = page.locator('[data-testid="tooltip-balloon-tt-field-prize-cost"]')

  await costLabel.click()
  await expect(costBalloon).toBeVisible()
  await expect(costBalloon).toContainText('景品')
})

// J-PATROL-07c: out_meter_count=3 機械で row_1 が 6 列 (IN/OUT1/OUT2/OUT3/残/補) レンダリング
test('J-PATROL-07c: out_meter_count=3 で row_1 が 6 列 (IN/OUT1/OUT2/OUT3/残/補)', async ({ page }) => {
  await gotoPatrolBooth(page, { outMeterCount: 3 })

  const meterRow = page.locator('[data-testid="meter-row"]')
  await expect(meterRow).toBeVisible()
  await expect(meterRow).toHaveClass(/flex/)

  await expect(page.locator('[data-testid="tooltip-label-tt-field-in-meter"]')).toBeVisible()
  await expect(page.locator('[data-testid="tooltip-label-tt-field-out-meter"]')).toContainText('OUT1')
  await expect(page.locator('[data-testid="tooltip-label-tt-field-out-meter-2"]')).toContainText('OUT2')
  await expect(page.locator('[data-testid="tooltip-label-tt-field-out-meter-3"]')).toContainText('OUT3')
  await expect(page.locator('[data-testid="tooltip-label-tt-field-stock"]')).toBeVisible()
  await expect(page.locator('[data-testid="tooltip-label-tt-field-restock"]')).toBeVisible()
})

// J-PATROL-07d: 保存ボタンが viewport 上半分内 (boundingBox.top < window.innerHeight * 0.5)
test('J-PATROL-07d: 保存ボタンが viewport 上半分 (top < 50vh)', async ({ page }) => {
  await gotoPatrolBooth(page, { prevReading: null })

  const saveBtn = page.getByTestId('save-button')
  await expect(saveBtn).toBeVisible()

  const box = await saveBtn.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(box.y).toBeLessThan(viewport.height * 0.5)
})

// J-PATROL-07e: data-testid='info-icon' が画面に 0 件 (ⓘ廃止確認)
test('J-PATROL-07e: ⓘ アイコン廃止 (info-icon 0件)', async ({ page }) => {
  await gotoPatrolBooth(page)
  await expect(page.locator('[data-testid="info-icon"]')).toHaveCount(0)
})

// J-PATROL-07f: ラベル要素が text-blue-500 + font-bold + role=button スタイル
test('J-PATROL-07f: ラベルが text-blue-500 + font-bold + role=button', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inLabel = page.locator('[data-testid="tooltip-label-tt-field-in-meter"]')
  await expect(inLabel).toBeVisible()
  await expect(inLabel).toHaveClass(/text-blue-500/)
  await expect(inLabel).toHaveClass(/font-bold/)
  await expect(inLabel).toHaveAttribute('role', 'button')
})

// J-PATROL-07g: balloon が画面端でハミ出さない
test('J-PATROL-07g: balloon が viewport 内に収まる', async ({ page }) => {
  await gotoPatrolBooth(page)

  const costLabel   = page.locator('[data-testid="tooltip-label-tt-field-prize-cost"]')
  const costBalloon = page.locator('[data-testid="tooltip-balloon-tt-field-prize-cost"]')

  await costLabel.click()
  await expect(costBalloon).toBeVisible()

  const box = await costBalloon.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
})
