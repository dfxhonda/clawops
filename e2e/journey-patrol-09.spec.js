import { test, expect } from '@playwright/test'
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-009',
  booth_code: 'TST-B09',
  in_meter: 70000,
  out_meter: 0,
  out_meter_2: null,
  out_meter_3: null,
  prize_stock_count: 10,
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
    machine_code: 'TST01-M009',
    machine_name: 'テスト機9',
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

async function gotoPatrolBooth(page) {
  await setupAuth(page)
  await mockCommon(page)
  await injectRouteState(page, '/clawsupport/booth/TST-B09', {
    machine: makeMachine(1),
    booth: { booth_code: 'TST-B09', booth_number: 9 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B09')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

// J-PATROL-09a: tap → select → numpad visible のまま (spurious close バグの修正確認)
test('J-PATROL-09a: tap → numpad stays open after select (no spurious close)', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()

  // 350ms 経過後も numpad が開いたままであること
  await page.waitForTimeout(450)
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()
})

// J-PATROL-09b: keyboard Enter → 次フィールドの numpad が開く + value binding 正常
test('J-PATROL-09b: keyboard Enter → next NumpadField opens and value binding works', async ({ page }) => {
  await gotoPatrolBooth(page)

  // フィールド1 を開く
  await page.locator('[data-tabindex="1"]').click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })

  // キーボード Enter でフィールド2 へ移動 (numpad が自動 open される)
  await page.locator('[data-tabindex="1"]').press('Enter')
  await page.waitForTimeout(300)

  // フィールド2 (out_meter) の numpad が開いていること
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()
  await expect(page.locator('[data-tabindex="2"]')).toBeFocused()

  // フィールド2 に '5' を入力 → value binding 確認
  await page.locator('[data-testid="numpad-sheet"]').last().locator('[data-numpad-key="5"]').click()
  await expect(page.locator('[data-tabindex="2"]')).toHaveValue('5')
})

// J-PATROL-09c: 本物の外側タップ (grace period 後) → numpad が閉じる
test('J-PATROL-09c: genuine outside tap after grace period → numpad closes', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()

  // grace period (350ms) が明けるのを待つ
  await page.waitForTimeout(450)

  // backdrop (numpad-portal の第1子 div) を直接クリック
  const backdrop = page.locator('[data-testid="numpad-portal"] > div').first()
  await backdrop.click({ position: { x: 100, y: 20 } })

  await expect(page.locator('[data-testid="numpad-portal"]')).toBeHidden({ timeout: 1500 })
})

// J-PATROL-09d: J-PATROL-06b リグレッション — Enter: in_meter → out_meter フォーカス
test('J-PATROL-09d: regression J-PATROL-06b — Enter: in_meter → out_meter focused', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inMeterInput  = page.locator('[data-tabindex="1"]')
  const outMeterInput = page.locator('[data-tabindex="2"]')

  await inMeterInput.focus()
  await inMeterInput.press('Enter')
  await expect(outMeterInput).toBeFocused()
})

// J-PATROL-09e: J-PATROL-06g リグレッション — focus → 全選択
test('J-PATROL-09e: regression J-PATROL-06g — focus → full select', async ({ page }) => {
  await gotoPatrolBooth(page)

  const inMeterInput = page.locator('[data-tabindex="1"]')
  await inMeterInput.focus()

  const sel = await inMeterInput.evaluate(el => ({
    start: el.selectionStart,
    end:   el.selectionEnd,
    len:   el.value.length,
  }))

  expect(sel.start).toBe(0)
  expect(sel.end).toBe(sel.len)
  expect(sel.len).toBeGreaterThan(0)
})
