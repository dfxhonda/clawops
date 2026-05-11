import { test, expect } from '@playwright/test'
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-013',
  booth_code: 'TST-B13',
  in_meter: 70000,
  out_meter: 0,
  out_meter_2: null,
  out_meter_3: null,
  prize_stock_count: 163,
  prize_restock_count: 0,
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
  theoretical_stock: 163,
  payout_rate: 0.25,
  prize_cost: 300,
  prize_cost_1: null,
  prize_cost_2: null,
  prize_cost_3: null,
  patrol_date: '2026-05-08',
  read_time: '2026-05-08T10:00:00+09:00',
}

function makeMachine(outMeterCount = 1) {
  return {
    machine_code: 'TST01-M013',
    machine_name: 'テスト機13',
    store_code: 'TST01',
    machine_models: { out_meter_count: outMeterCount, meter_unit_price: 100 },
    machine_lockers: [],
    booths: [],
  }
}

async function mockCommon(page) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = { store_code: 'TST01', store_name: 'テスト店舗', is_collection_day: false }
    const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PREV_READING]) })
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

async function gotoPatrolBooth(page, { outMeterCount = 1 } = {}) {
  await setupAuth(page)
  await mockCommon(page)
  await injectRouteState(page, '/clawsupport/booth/TST-B13', {
    machine: makeMachine(outMeterCount),
    booth: { booth_code: 'TST-B13', booth_number: 13 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B13')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

// ── 機能13: active field focus可視化 ────────────────────────────────────────

// J-PATROL-13a: focus → ring-blue-500 + bg-blue-50
test('J-PATROL-13a: フィールドfocus → ring-blue-500 + bg-blue-50', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await page.waitForTimeout(250)

  const inCell = page.locator('[data-tabindex="1"]').locator('../..')
  await expect(inCell).toHaveClass(/ring-blue-500/)
  await expect(inCell).toHaveClass(/bg-blue-50/)
})

// J-PATROL-13b: numpad 上ラベル「入力中: IN」表示
test('J-PATROL-13b: numpad上ラベル 入力中: IN 表示', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await page.waitForTimeout(150)

  await expect(page.locator('[data-testid="numpad-active-label"]')).toHaveText('入力中: IN')
})

// J-PATROL-13c: Enter→次フィールド ring追従 200ms
test('J-PATROL-13c: Enter→次フィールド ring追従', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await page.waitForTimeout(100)
  await page.locator('[data-tabindex="1"]').press('Enter')
  await page.waitForTimeout(300)

  // tabindex=2(OUT) が activated されてリング追従
  const outCell = page.locator('[data-tabindex="2"]').locator('../..')
  await expect(outCell).toHaveClass(/ring-blue-500/)

  // tabindex=1(IN) のリングは外れる
  const inCell = page.locator('[data-tabindex="1"]').locator('../..')
  const inClass = await inCell.getAttribute('class')
  expect(inClass).not.toMatch(/ring-blue-500/)
})

// J-PATROL-13d: 未focus → 「タップして選択」グレー
test('J-PATROL-13d: 未focus → タップして選択 グレー表示', async ({ page }) => {
  await gotoPatrolBooth(page)

  await expect(page.locator('[data-testid="numpad-active-label"]')).toHaveText('タップして選択')
})

// J-PATROL-13e: Tooltip と focus highlight 独立動作
test('J-PATROL-13e: Tooltip開閉と focus highlight は独立', async ({ page }) => {
  await gotoPatrolBooth(page)

  // フィールドをフォーカス
  await page.locator('[data-tabindex="1"]').click()
  await page.waitForTimeout(150)

  const inCell = page.locator('[data-tabindex="1"]').locator('../..')
  await expect(inCell).toHaveClass(/ring-blue-500/)

  // Tooltipをタップ
  await page.locator('[data-testid="tooltip-label-tt-field-in-meter"]').dispatchEvent('pointerdown')
  await page.waitForTimeout(100)

  // Tooltipバルーンが表示
  await expect(page.locator('[data-testid="tooltip-balloon-tt-field-in-meter"]')).toBeVisible()

  // ring は維持
  await expect(inCell).toHaveClass(/ring-blue-500/)
})

// ── 機能14: フィールド幅 + O段分け ─────────────────────────────────────────

// J-PATROL-14a: out_meter_count=1 flex比率 IN5/OUT5/差3/残4/補2
test('J-PATROL-14a: out_meter_count=1 row_1 flex比率確認', async ({ page }) => {
  await gotoPatrolBooth(page, { outMeterCount: 1 })

  // meter-row は flex コンテナ
  const meterRow = page.locator('[data-testid="meter-row"]')
  const meterClass = await meterRow.getAttribute('class')
  expect(meterClass).toMatch(/\bflex\b/)
  expect(meterClass).not.toMatch(/\bgrid\b/)

  const inWidth = (await page.locator('[data-tabindex="1"]').boundingBox()).width
  const outWidth = (await page.locator('[data-tabindex="2"]').boundingBox()).width
  const stockWidth = (await page.locator('[data-tabindex="5"]').boundingBox()).width
  const restockWidth = (await page.locator('[data-tabindex="6"]').boundingBox()).width

  // IN ≈ OUT (両方 flex-[5])
  expect(Math.abs(inWidth - outWidth)).toBeLessThan(20)
  // 残(flex-[4]) > 補(flex-[2])
  expect(stockWidth).toBeGreaterThan(restockWidth)
  // 残:補 ≈ 2:1
  const stockRestockRatio = stockWidth / restockWidth
  expect(stockRestockRatio).toBeGreaterThan(1.5)
  expect(stockRestockRatio).toBeLessThan(3.0)
})

// J-PATROL-14b: out_meter_count=2 OUT1+OUT2両方 flex-[5]
test('J-PATROL-14b: out_meter_count=2 OUT1/OUT2 表示 + 同幅', async ({ page }) => {
  await gotoPatrolBooth(page, { outMeterCount: 2 })

  await expect(page.locator('[data-tabindex="2"]')).toBeVisible()
  await expect(page.locator('[data-tabindex="3"]')).toBeVisible()

  const out1Width = (await page.locator('[data-tabindex="2"]').boundingBox()).width
  const out2Width = (await page.locator('[data-tabindex="3"]').boundingBox()).width
  const inWidth = (await page.locator('[data-tabindex="1"]').boundingBox()).width

  // IN ≈ OUT1 ≈ OUT2 (すべて flex-[5])
  expect(Math.abs(inWidth - out1Width)).toBeLessThan(30)
  expect(Math.abs(out1Width - out2Width)).toBeLessThan(10)
})

// J-PATROL-14c: 残セル 4桁(163等)収まる
test('J-PATROL-14c: 残セル 4桁値が収まる', async ({ page }) => {
  await gotoPatrolBooth(page)

  const stockInput = page.locator('[data-tabindex="5"]')
  await expect(stockInput).toBeVisible()

  // PREV_READING.prize_stock_count = 163 が前回値として入っている
  const value = await stockInput.inputValue()
  expect(value).toBe('163')

  // 入力が表示可能 (overflow hidden等で隠れていない)
  const box = await stockInput.boundingBox()
  expect(box.width).toBeGreaterThan(20)
})

// J-PATROL-14d: 補セル 2桁(0等)収まる
test('J-PATROL-14d: 補セル 2桁値が収まる', async ({ page }) => {
  await gotoPatrolBooth(page)

  const restockInput = page.locator('[data-tabindex="6"]')
  await expect(restockInput).toBeVisible()

  const box = await restockInput.boundingBox()
  expect(box.width).toBeGreaterThan(15)
})

// J-PATROL-14e: row_4 設定O w-full 横幅100%
test('J-PATROL-14e: 設定O フィールドが row_1 の IN より広い (単独行)', async ({ page }) => {
  await gotoPatrolBooth(page)

  const oBox = await page.locator('#field-set-o').boundingBox()
  const inBox = await page.locator('#field-in-meter').boundingBox()

  // Oフィールドは単独行なので IN フィールドより大幅に広い
  expect(oBox.width).toBeGreaterThan(inBox.width * 2)
})

// J-PATROL-14f: 設定O placeholder "メモ"
test('J-PATROL-14f: 設定O placeholder "メモ"', async ({ page }) => {
  await gotoPatrolBooth(page)

  await expect(page.locator('#field-set-o')).toHaveAttribute('placeholder', 'メモ')
})

// J-PATROL-14g: ACLR grid-cols-4 均等幅
test('J-PATROL-14g: 設定ACLR が均等幅 (grid-cols-4)', async ({ page }) => {
  await gotoPatrolBooth(page)

  const aBox = await page.locator('[data-testid="field-set-a"]').boundingBox()
  const cBox = await page.locator('[data-testid="field-set-c"]').boundingBox()
  const lBox = await page.locator('[data-testid="field-set-l"]').boundingBox()
  const rBox = await page.locator('[data-testid="field-set-r"]').boundingBox()

  // 4列均等 → ほぼ同じ幅
  expect(Math.abs(aBox.width - cBox.width)).toBeLessThan(5)
  expect(Math.abs(aBox.width - lBox.width)).toBeLessThan(5)
  expect(Math.abs(aBox.width - rBox.width)).toBeLessThan(5)
})

// J-PATROL-14h: 主要項目がnumpad上部より上に収まる
test('J-PATROL-14h: meter-row が numpad より上に表示', async ({ page }) => {
  await gotoPatrolBooth(page)

  const meterRowBox = await page.locator('[data-testid="meter-row"]').boundingBox()
  const numpadBox = await page.locator('[data-testid="numpad-footer"]').boundingBox()

  expect(meterRowBox.y).toBeLessThan(numpadBox.y)
  expect(meterRowBox.y + meterRowBox.height).toBeLessThan(numpadBox.y)
})
