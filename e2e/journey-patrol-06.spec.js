import { test, expect } from '@playwright/test'
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-006',
  booth_code: 'TST-B06',
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
    machine_code: 'TST01-M006',
    machine_name: 'テスト機6',
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

async function fillNumpad(page, fieldSelector, digits, advance = true) {
  await page.locator(fieldSelector).click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })
  const sheet = page.locator('[data-testid="numpad-sheet"]').last()
  for (const d of String(digits)) {
    await sheet.locator(`[data-numpad-key="${d}"]`).click()
  }
  if (advance) {
    await sheet.locator('[data-numpad-key="→"]').click()
    await page.waitForSelector('[data-testid="numpad-portal"]', { state: 'detached', timeout: 1500 }).catch(() => {})
  }
}

async function gotoPatrolBooth(page, { outMeterCount = 1, prevReading = PREV_READING } = {}) {
  await setupAuth(page)
  await mockCommon(page, { prevReading })
  await injectRouteState(page, '/clawsupport/booth/TST-B06', {
    machine: makeMachine(outMeterCount),
    booth: { booth_code: 'TST-B06', booth_number: 6 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B06')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

// J-PATROL-06a: 設定A/C/L/R に numpad で数値打てる、設定O はテキスト入力のまま
test('J-PATROL-06a: 設定A/C/L/R は NumpadField、設定O はテキスト入力', async ({ page }) => {
  await gotoPatrolBooth(page)

  // 設定A (data-tabindex=9) は input[type=text][readonly] → NumpadField
  const setAInput = page.locator('[data-tabindex="9"]')
  await expect(setAInput).toBeVisible()
  await expect(setAInput).toHaveAttribute('readonly', '')

  // 設定O (data-testid=field-set-o) は通常テキスト input → type=text but NOT readonly
  const setOInput = page.locator('[data-testid="field-set-o"]')
  await expect(setOInput).toBeVisible()
  await expect(setOInput).not.toHaveAttribute('readonly', '')

  // 設定A を numpad で入力できる
  await fillNumpad(page, '[data-tabindex="9"]', '7', false)
  await expect(setAInput).toHaveValue('7')
})

// J-PATROL-06b: in_meter で Enter → out_meter_1 にフォーカス移動
test('J-PATROL-06b: Enter ナビゲーション in_meter → out_meter_1', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inMeterInput  = page.locator('[data-tabindex="1"]')
  const outMeterInput = page.locator('[data-tabindex="2"]')

  await inMeterInput.focus()
  await inMeterInput.press('Enter')
  await expect(outMeterInput).toBeFocused()
})

// J-PATROL-06c: in_meter ⓘ tap → tooltip 開く / 外側 tap → close / 別 ⓘ tap → 前 close 新 open
test('J-PATROL-06c: tooltip 開閉・排他制御', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inIcon     = page.locator('[data-testid="tooltip-icon-tt-field-in-meter"]')
  const inBalloon  = page.locator('[data-testid="tooltip-balloon-tt-field-in-meter"]')
  const outIcon    = page.locator('[data-testid="tooltip-icon-tt-field-out-meter"]')
  const outBalloon = page.locator('[data-testid="tooltip-balloon-tt-field-out-meter"]')

  // open in_meter tooltip
  await inIcon.click()
  await expect(inBalloon).toBeVisible()

  // click outside (theory row has no interactive elements)
  await page.locator('[data-testid="theory-row"]').click()
  await expect(inBalloon).toBeHidden()

  // open in_meter, then click out_meter icon → in closes, out opens
  await inIcon.click()
  await expect(inBalloon).toBeVisible()
  await outIcon.click()
  await expect(inBalloon).toBeHidden()
  await expect(outBalloon).toBeVisible()
})

// J-PATROL-06d: prev != null 時 in_meter が text-gray-400、入力後 text-text に戻る
test('J-PATROL-06d: 前回値プリフィル時グレー、入力後通常色', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inMeterInput = page.locator('[data-tabindex="1"]')

  // 初期: text-gray-400 (未 touched、前回値プリフィル)
  await expect(inMeterInput).toHaveClass(/text-gray-400/)

  // numpad で入力 → touched = true
  await fillNumpad(page, '[data-tabindex="1"]', '1', false)

  // text-gray-400 が消える
  await expect(inMeterInput).not.toHaveClass(/text-gray-400/)
})

const PREV_READING_E = {
  ...PREV_READING,
  out_meter: 0,
  prize_stock_count: 10,
  prize_restock_count: 0,  // restock=0 なら prefill 後 autofill も stock=10 のまま
}

// J-PATROL-06e: out_meter 入力で stock 自動更新、stock 手入力後は OUT 変更で stock 動かない
test('J-PATROL-06e: 理論在庫自動補完と手入力ロック', async ({ page }) => {
  // prev: out_meter=0, prize_stock_count=10, prize_restock_count=0
  // prefill 後 autofill: 10+0-(0-0)=10 → stock='10' のまま
  await gotoPatrolBooth(page, { prevReading: PREV_READING_E })

  const outMeterInput = page.locator('[data-tabindex="2"]')
  const stockInput    = page.locator('[data-tabindex="5"]')

  // 初期: stock = 10 (prefill と autofill が一致)
  await expect(stockInput).toHaveValue('10')

  // out_meter に 3 を入力 (diff = 3-0 = 3, theoretical = 10+0-3 = 7)
  await fillNumpad(page, '[data-tabindex="2"]', '3')

  // stock が 7 に自動更新される
  await expect(stockInput).toHaveValue('7')

  // stock を手動入力 → touched.stock = true
  await fillNumpad(page, '[data-tabindex="5"]', '5')
  await expect(stockInput).toHaveValue('5')

  // out_meter を変更しても stock は動かない (touched.stock=true でロック)
  await fillNumpad(page, '[data-tabindex="2"]', '8')

  await expect(stockInput).toHaveValue('5')
})

// J-PATROL-06f: out_meter_count=3 の機械で OUT 欄 3 個レンダリング
test('J-PATROL-06f: out_meter_count=3 で OUT1/OUT2/OUT3 表示', async ({ page }) => {
  await gotoPatrolBooth(page, { outMeterCount: 3 })

  // OUT1 (tabindex=2), OUT2 (tabindex=3), OUT3 (tabindex=4) がすべて表示
  await expect(page.locator('[data-tabindex="2"]')).toBeVisible()
  await expect(page.locator('[data-tabindex="3"]')).toBeVisible()
  await expect(page.locator('[data-tabindex="4"]')).toBeVisible()

  // ラベル確認
  await expect(page.getByText('OUT1')).toBeVisible()
  await expect(page.getByText('OUT2')).toBeVisible()
  await expect(page.getByText('OUT3')).toBeVisible()
})

// J-PATROL-06g: in_meter フィールドに focus で全選択 (selectionStart=0, selectionEnd=length)
test('J-PATROL-06g: focus で全選択', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inMeterInput = page.locator('[data-tabindex="1"]')

  // focus (programmatic) → onFocus fires → e.target.select()
  await inMeterInput.focus()

  const sel = await inMeterInput.evaluate(el => ({
    start: el.selectionStart,
    end:   el.selectionEnd,
    len:   el.value.length,
  }))

  expect(sel.start).toBe(0)
  expect(sel.end).toBe(sel.len)
  // prev がある場合 value は '70000' → len=5, start=0, end=5
  expect(sel.len).toBeGreaterThan(0)
})
