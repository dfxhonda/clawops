import { test, expect } from '@playwright/test'
// device分岐: 本specはiPhoneカスタムテンキーUXを検証するため iPhone UA を固定
test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' })
import { setupAuth, injectRouteState } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const PREV_READING = {
  reading_id: 'prev-010',
  booth_code: 'TST-B10',
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
  patrol_date: '2026-05-09',
  read_time: '2026-05-09T10:00:00+09:00',
}

function makeMachine(outMeterCount = 1) {
  return {
    machine_code: 'TST01-M010',
    machine_name: 'テスト機10',
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
  await injectRouteState(page, '/clawsupport/booth/TST-B10', {
    machine: makeMachine(outMeterCount),
    booth: { booth_code: 'TST-B10', booth_number: 10 },
    storeCode: 'TST01',
  })
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B10')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5_000 })
}

// J-PATROL-10a: tap → numpad visible, no spurious close (onFocus select 廃止確認)
test('J-PATROL-10a: tap → numpad stays open (no spurious close, no select)', async ({ page }) => {
  await gotoPatrolBooth(page)

  await page.locator('[data-tabindex="1"]').click()
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()

  // 350ms grace period 後も numpad が開いたままであること
  await page.waitForTimeout(450)
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()
})

// J-PATROL-10b: 既存値ありフィールドを tap → numpad open、値が保持される
test('J-PATROL-10b: field with existing value → tap → numpad open, value preserved', async ({ page }) => {
  await gotoPatrolBooth(page)

  // in_meter は前回値 70000 でプリフィル済み
  const inMeterInput = page.locator('[data-tabindex="1"]')
  await expect(inMeterInput).toHaveValue('70000')

  await inMeterInput.click()
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()

  // tap 後も値は保持 (select→上書きがないことの確認)
  await expect(inMeterInput).toHaveValue('70000')
})

// J-PATROL-10c: in_meter Enter → out_meter_1 focused + numpad visible + value binding 正常
test('J-PATROL-10c: in_meter Enter → out_meter_1 focused + numpad visible + value binding', async ({ page }) => {
  await gotoPatrolBooth(page)

  // フィールド1 を開く
  await page.locator('[data-tabindex="1"]').click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })

  // Enter でフィールド2 へ移動
  await page.locator('[data-tabindex="1"]').press('Enter')
  await page.waitForTimeout(300)

  // フィールド2 (out_meter) にフォーカス + numpad が開いていること
  await expect(page.locator('[data-tabindex="2"]')).toBeFocused()
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()

  // フィールド2 に '5' を入力 → value binding 確認
  await page.locator('[data-testid="numpad-sheet"]').last().locator('[data-numpad-key="5"]').click()
  await expect(page.locator('[data-tabindex="2"]')).toHaveValue('5')
})

// J-PATROL-10d: out_meter_1 Enter → out_meter_2 (outMeterCount>=2) → numpad visible
test('J-PATROL-10d: out_meter_1 Enter → out_meter_2 numpad opens (outMeterCount=2)', async ({ page }) => {
  await gotoPatrolBooth(page, { outMeterCount: 2 })

  // フィールド2 (out_meter_1) を開く
  await page.locator('[data-tabindex="2"]').click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })

  // Enter でフィールド3 (out_meter_2) へ移動
  await page.locator('[data-tabindex="2"]').press('Enter')
  await page.waitForTimeout(300)

  // フィールド3 にフォーカス + numpad が開いていること
  await expect(page.locator('[data-tabindex="3"]')).toBeFocused()
  await expect(page.locator('[data-testid="numpad-sheet"]').last()).toBeVisible()
})

// J-PATROL-10f: programmatic focus() は numpad field を activate しない (keys disabled のまま)
test('J-PATROL-10f: programmatic focus() does NOT activate numpad field', async ({ page }) => {
  await gotoPatrolBooth(page)

  // プログラマチックに focus → numpad footer は表示されるが keys は disabled のまま
  await page.locator('[data-tabindex="1"]').focus()
  await page.waitForTimeout(200)

  const numpadKey5 = page.locator('[data-testid="numpad-sheet"] [data-numpad-key="5"]')
  await expect(numpadKey5).toBeDisabled()
})
