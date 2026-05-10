import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

const STORE_CODE = 'TST15'
const MACHINE_SINGLE = 'TST15-M001'
const MACHINE_MULTI  = 'TST15-M002'
const BOOTH_S1 = 'TST15-B01'
const BOOTH_M1 = 'TST15-B02'
const BOOTH_M2 = 'TST15-B03'

const MOCK_MACHINES = [
  {
    machine_code: MACHINE_SINGLE,
    machine_name: '1ブース機',
    store_code: STORE_CODE,
    type_id: 1,
    model_id: 'model-s',
    billing_order: 1,
    machine_types: { category: 'crane', locker_slots: 0 },
    machine_models: { out_meter_count: 1, meter_unit_price: 100 },
    machine_lockers: [],
    booths: [
      { booth_code: BOOTH_S1, booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: MACHINE_SINGLE },
    ],
  },
  {
    machine_code: MACHINE_MULTI,
    machine_name: 'ロッカー型機',
    store_code: STORE_CODE,
    type_id: 1,
    model_id: 'model-m',
    billing_order: 2,
    machine_types: { category: 'crane', locker_slots: 2 },
    machine_models: { out_meter_count: 1, meter_unit_price: 100 },
    machine_lockers: [],
    booths: [
      { booth_code: BOOTH_M1, booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: MACHINE_MULTI },
      { booth_code: BOOTH_M2, booth_number: 2, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: MACHINE_MULTI },
    ],
  },
]

// 2 readings per booth for diffs (newest first)
const MOCK_READINGS = [
  { reading_id: 'r-s1-2', booth_code: BOOTH_S1, in_meter: 71000, out_meter: 5, out_meter_2: null, out_meter_3: null, created_at: '2026-05-10T02:00:00.000Z', entry_type: 'patrol', prize_cost: 300 },
  { reading_id: 'r-s1-1', booth_code: BOOTH_S1, in_meter: 70000, out_meter: 3, out_meter_2: null, out_meter_3: null, created_at: '2026-05-09T02:00:00.000Z', entry_type: 'patrol', prize_cost: 300 },
  { reading_id: 'r-m1-2', booth_code: BOOTH_M1, in_meter: 71000, out_meter: 5, out_meter_2: null, out_meter_3: null, created_at: '2026-05-10T02:00:00.000Z', entry_type: 'patrol', prize_cost: 300 },
  { reading_id: 'r-m1-1', booth_code: BOOTH_M1, in_meter: 70000, out_meter: 3, out_meter_2: null, out_meter_3: null, created_at: '2026-05-09T02:00:00.000Z', entry_type: 'patrol', prize_cost: 300 },
  { reading_id: 'r-m2-2', booth_code: BOOTH_M2, in_meter: 71500, out_meter: 4, out_meter_2: null, out_meter_3: null, created_at: '2026-05-10T02:00:00.000Z', entry_type: 'patrol', prize_cost: 300 },
  { reading_id: 'r-m2-1', booth_code: BOOTH_M2, in_meter: 70000, out_meter: 2, out_meter_2: null, out_meter_3: null, created_at: '2026-05-09T02:00:00.000Z', entry_type: 'patrol', prize_cost: 300 },
]

async function mockCommon(page) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = { store_code: STORE_CODE, store_name: 'テスト店舗15', is_collection_day: false }
    const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/machines**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MACHINES) })
  })
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_READINGS) })
  })
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) })
  })
  await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function gotoStorePage(page) {
  await setupAuth(page)
  await mockCommon(page)
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto(`/clawsupport/store/${STORE_CODE}`)
  await done
  await page.waitForSelector('[data-testid="store-inline-total"]', { timeout: 5_000 })
}

// J-PATROL-15a: 機械単位グルーピング、多ブース機械のブース行はデフォルト非表示
test('J-PATROL-15a: 機械単位グルーピング、多ブース機械はデフォルト折り畳み', async ({ page }) => {
  await gotoStorePage(page)
  await expect(page.locator(`[data-testid="machine-row-${MACHINE_SINGLE}"]`)).toBeVisible()
  await expect(page.locator(`[data-testid="machine-row-${MACHINE_MULTI}"]`)).toBeVisible()
  // Multi-booth booths are hidden by default
  await expect(page.locator(`[data-testid="booth-row-${BOOTH_M1}"]`)).not.toBeVisible()
  await expect(page.locator(`[data-testid="booth-row-${BOOTH_M2}"]`)).not.toBeVisible()
})

// J-PATROL-15b: 1ブース機械行タップ → PatrolBoothInputPage に直行
test('J-PATROL-15b: 1ブース機械行タップ → PatrolBoothInputPage 直行', async ({ page }) => {
  await gotoStorePage(page)
  await page.locator(`[data-testid="machine-row-btn-${MACHINE_SINGLE}"]`).click()
  await page.waitForURL(`**/clawsupport/booth/${BOOTH_S1}`, { timeout: 5_000 })
})

// J-PATROL-15c: 多ブース機械 → ChevronRight 表示 + 折り畳みデフォルト
test('J-PATROL-15c: 多ブース機械 → ChevronRight 表示 + 折り畳みデフォルト', async ({ page }) => {
  await gotoStorePage(page)
  const chevron = page.locator(`[data-testid="chevron-${MACHINE_MULTI}"]`)
  await expect(chevron).toBeVisible()
  await expect(page.locator(`[data-testid="booth-row-${BOOTH_M1}"]`)).not.toBeVisible()
  // Single booth machine has no chevron
  await expect(page.locator(`[data-testid="chevron-${MACHINE_SINGLE}"]`)).toHaveCount(0)
})

// J-PATROL-15d: クリック展開 → chevron rotate + ブース行表示
test('J-PATROL-15d: クリック展開 → chevron rotate + ブース行表示', async ({ page }) => {
  await gotoStorePage(page)
  await page.locator(`[data-testid="machine-row-btn-${MACHINE_MULTI}"]`).click()
  await expect(page.locator(`[data-testid="booth-row-${BOOTH_M1}"]`)).toBeVisible({ timeout: 3_000 })
  await expect(page.locator(`[data-testid="booth-row-${BOOTH_M2}"]`)).toBeVisible()
  await expect(page.locator(`[data-testid="chevron-${MACHINE_MULTI}"]`)).toHaveClass(/rotate-90/)
})

// J-PATROL-15e: 折り畳み時 機械合計 chip IN差/OUT差 のみ (売上/粗利なし)
test('J-PATROL-15e: 折り畳み時 機械合計 chip IN差/OUT差 のみ', async ({ page }) => {
  await gotoStorePage(page)
  const machineRow = page.locator(`[data-testid="machine-row-${MACHINE_MULTI}"]`)
  await expect(machineRow.locator('[data-testid="diff-chip-IN"]')).toBeVisible()
  await expect(machineRow.locator('[data-testid="diff-chip-OUT"]')).toBeVisible()
  await expect(machineRow.locator('[data-testid="diff-chip-売上"]')).toHaveCount(0)
  await expect(machineRow.locator('[data-testid="diff-chip-粗利"]')).toHaveCount(0)
})

// J-PATROL-15f: 展開時 各ブース行 diff chip 2個 (IN/OUT のみ)
test('J-PATROL-15f: 展開時 各ブース行 diff chip 2個 (IN/OUT)', async ({ page }) => {
  await gotoStorePage(page)
  await page.locator(`[data-testid="machine-row-btn-${MACHINE_MULTI}"]`).click()
  await expect(page.locator(`[data-testid="booth-row-${BOOTH_M1}"]`)).toBeVisible({ timeout: 3_000 })
  const b1 = page.locator(`[data-testid="booth-row-${BOOTH_M1}"]`)
  await expect(b1.locator('[data-testid="diff-chip-IN"]')).toBeVisible()
  await expect(b1.locator('[data-testid="diff-chip-OUT"]')).toBeVisible()
  await expect(b1.locator('[data-testid="diff-chip-売上"]')).toHaveCount(0)
  await expect(b1.locator('[data-testid="diff-chip-粗利"]')).toHaveCount(0)
})

// J-PATROL-15g: store-inline-total に IN差/OUT差 chip 2個
test('J-PATROL-15g: store-inline-total に IN差/OUT差 chip 2個', async ({ page }) => {
  await gotoStorePage(page)
  const inlineTotal = page.locator('[data-testid="store-inline-total"]')
  await expect(inlineTotal).toBeVisible()
  await expect(inlineTotal.locator('[data-testid="diff-chip-IN"]')).toBeVisible()
  await expect(inlineTotal.locator('[data-testid="diff-chip-OUT"]')).toBeVisible()
})

// J-PATROL-15h: 展開アニメーション 200ms transition (chevron rotate)
test('J-PATROL-15h: 展開アニメーション 200ms transition', async ({ page }) => {
  await gotoStorePage(page)
  const chevron = page.locator(`[data-testid="chevron-${MACHINE_MULTI}"]`)
  const beforeClass = await chevron.getAttribute('class')
  expect(beforeClass).not.toMatch(/rotate-90/)
  await page.locator(`[data-testid="machine-row-btn-${MACHINE_MULTI}"]`).click()
  await expect(chevron).toHaveClass(/rotate-90/)
})

// J-PATROL-15i: 売上/粗利 chip が画面に 0件
test('J-PATROL-15i: 売上/粗利 chip が画面に 0件', async ({ page }) => {
  await gotoStorePage(page)
  await expect(page.locator('[data-testid="diff-chip-売上"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="diff-chip-粗利"]')).toHaveCount(0)
})

// J-PATROL-15j: store-summary-bar は存在しない (sticky bar 廃止)
test('J-PATROL-15j: store-summary-bar は存在しない', async ({ page }) => {
  await gotoStorePage(page)
  await expect(page.locator('[data-testid="store-summary-bar"]')).toHaveCount(0)
})
