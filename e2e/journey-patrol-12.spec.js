import { test, expect } from '@playwright/test'
// device分岐: 本specはiPhoneカスタムテンキーUXを検証するため iPhone UA を固定
test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' })
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-012',
  booth_code: 'TST-B12',
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
  patrol_date: '2026-05-08',
  read_time: '2026-05-08T10:00:00+09:00',
}

function makeMachine(outMeterCount = 1) {
  return {
    machine_code: 'TST01-M012',
    machine_name: 'テスト機12',
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
  await injectRouteState(page, '/clawsupport/booth/TST-B12', {
    machine: makeMachine(outMeterCount),
    booth: { booth_code: 'TST-B12', booth_number: 12 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B12')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

// J-PATROL-12a: load時 numpad footer panel は常時表示
test('J-PATROL-12a: load時 numpad footer panel は常時表示', async ({ page }) => {
  await gotoPatrolBooth(page)

  const footer = page.locator('[data-testid="numpad-footer"]')
  await expect(footer).toBeVisible()

  const sheet = page.locator('[data-testid="numpad-sheet"]')
  await expect(sheet).toBeVisible()
})

// J-PATROL-12b: tap → close されない、active キー有効
test('J-PATROL-12b: フィールド tap → numpad close なし、active キー有効', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await page.waitForTimeout(200)

  // Footer still visible
  await expect(page.locator('[data-testid="numpad-footer"]')).toBeVisible()

  // Keys become enabled after field activation
  const numpadKey5 = page.locator('[data-testid="numpad-sheet"] [data-numpad-key="5"]')
  await expect(numpadKey5).not.toBeDisabled()
})

// J-PATROL-12c: Enter→次フィールド focus → numpad同位置維持、active切替
test('J-PATROL-12c: Enter → 次フィールド focus、numpad 同位置・active切替', async ({ page }) => {
  await gotoPatrolBooth(page)

  const footerBefore = await page.locator('[data-testid="numpad-footer"]').boundingBox()

  await page.locator('[data-tabindex="1"]').click()
  await page.locator('[data-tabindex="1"]').press('Enter')
  await page.waitForTimeout(200)

  // Field 2 is focused
  await expect(page.locator('[data-tabindex="2"]')).toBeFocused()

  // Footer is still visible and has not moved
  await expect(page.locator('[data-testid="numpad-footer"]')).toBeVisible()
  const footerAfter = await page.locator('[data-testid="numpad-footer"]').boundingBox()
  expect(footerAfter.y).toBeCloseTo(footerBefore.y, 0)

  // Active field 2 — key press updates field 2 value
  await page.locator('[data-testid="numpad-sheet"] [data-numpad-key="5"]').click()
  await expect(page.locator('[data-tabindex="2"]')).toHaveValue('5')
})

// J-PATROL-12d: 画面外click → close されない (機構廃止)
test('J-PATROL-12d: 画面外 click → numpad close されない', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()

  // Click outside the footer
  await page.mouse.click(10, 10)
  await page.waitForTimeout(200)

  await expect(page.locator('[data-testid="numpad-footer"]')).toBeVisible()
})

// J-PATROL-12e: 未focus キー押下 → 何も起きない (keys disabled)
test('J-PATROL-12e: 未focus 状態でキー押下 → keys disabled', async ({ page }) => {
  await gotoPatrolBooth(page)

  // No field activated — all keys should be disabled
  const numpadKey5 = page.locator('[data-testid="numpad-sheet"] [data-numpad-key="5"]')
  await expect(numpadKey5).toBeDisabled()

  // Value of any field should remain unchanged
  const inMeterInput = page.locator('[data-tabindex="1"]')
  const valueBefore = await inMeterInput.inputValue()

  await page.waitForTimeout(100)
  await expect(inMeterInput).toHaveValue(valueBefore)
})

// J-PATROL-12f: 入力area scroll → numpad 不動
test('J-PATROL-12f: 入力area scroll → numpad footer 不動', async ({ page }) => {
  await gotoPatrolBooth(page)

  const footerBefore = await page.locator('[data-testid="numpad-footer"]').boundingBox()

  await page.locator('[data-testid="booth-input-upper"]').evaluate(el => { el.scrollTop = 200 })
  await page.waitForTimeout(100)

  const footerAfter = await page.locator('[data-testid="numpad-footer"]').boundingBox()
  expect(footerAfter.y).toBeCloseTo(footerBefore.y, 0)
})

// J-PATROL-12g: numpad-portal 廃止確認、numpad-footer 常時表示 (10e 撤回確認)
test('J-PATROL-12g: numpad-portal 廃止、close 機構なし確認', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await page.waitForTimeout(450)

  // 画面外クリック — 旧 10e が期待した動作はもう起きない
  await page.mouse.click(10, 10)
  await page.waitForTimeout(300)

  // numpad-portal は存在しない (close機構廃止)
  await expect(page.locator('[data-testid="numpad-portal"]')).toHaveCount(0)

  // numpad-footer は常時表示
  await expect(page.locator('[data-testid="numpad-footer"]')).toBeVisible()
})

// J-PATROL-12h: iOS safe-area padding で home indicator と重ならない
test('J-PATROL-12h: iOS safe-area padding — numpad footer に env(safe-area-inset-bottom) 適用', async ({ page }) => {
  await gotoPatrolBooth(page)

  const footer = page.locator('[data-testid="numpad-footer"]')
  await expect(footer).toBeVisible()

  const styleAttr = await footer.getAttribute('style')
  expect(styleAttr).toContain('env(safe-area-inset-bottom)')
})
