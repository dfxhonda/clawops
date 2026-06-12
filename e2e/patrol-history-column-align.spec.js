// SPEC-PATROL-HISTORY-COLUMN-ALIGN-01: AC1/AC2
// 390x844 で StoreTotalsHeader ヘッダ/合計列と MachineRow 列の右端 x 座標が ±1px 以内
import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

const MOCK_STORE = { store_code: 'TST01', store_name: 'テスト店', is_collection_day: false }
const MOCK_MACHINE = {
  machine_code: 'TST01-M001',
  machine_name: 'テスト機1',
  store_code: 'TST01',
  type_id: 1,
  model_id: 'model-001',
  billing_order: 1,
  machine_types: { category: 'crane', locker_slots: 0 },
  machine_models: { out_meter_count: 1, meter_unit_price: 100 },
  booths: [
    { booth_code: 'TST-B01', booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'TST01-M001' },
  ],
  machine_lockers: [],
}

async function setupMocks(page) {
  // Playwright matches routes LIFO (last registered = first checked).
  // Register catch-all first so specific mocks (registered after) win.
  await page.route('**/rest/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await page.route('**/rest/v1/meter_readings**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await page.route('**/rest/v1/machines**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_MACHINE]) })
  )
  await page.route('**/rest/v1/stores**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_STORE]) })
  )
}

async function rightEdge(page, testid) {
  return page.evaluate(id => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    return el ? el.getBoundingClientRect().right : null
  }, testid)
}

test.use({ viewport: { width: 390, height: 844 } })

const MODES = ['IN', 'DAILY', 'OUT']

for (const mode of MODES) {
  test(`when_mode_${mode}_header_and_machine_column_right_edges_align_within_1px`, async ({ page }) => {
    await setupAuth(page, { role: 'patrol' })
    await setupMocks(page)
    await page.goto('/clawsupport/store/TST01')
    await page.waitForSelector('[data-testid^="machine-totals-"]', { timeout: 8000 })

    if (mode !== 'IN') {
      // force: true needed at 390px — OUT tab right-edge is adjacent to the column grid
      await page.click(`[data-testid="patrol-view-mode-btn-${mode}"]`, { force: true })
      await page.waitForTimeout(80)
    }

    // Check all 4 columns (index 0-3)
    for (let col = 0; col < 4; col++) {
      const labelRight   = await rightEdge(page, `store-label-${col}`)
      const valueRight   = await rightEdge(page, `store-value-${col}`)
      const machineRight = await rightEdge(page, `machine-cell-TST01-M001-${col}`)

      expect(labelRight,   `mode=${mode} col=${col} label right`).not.toBeNull()
      expect(valueRight,   `mode=${mode} col=${col} value right`).not.toBeNull()
      expect(machineRight, `mode=${mode} col=${col} machine right`).not.toBeNull()

      expect(
        Math.abs(labelRight - machineRight),
        `mode=${mode} col=${col}: label(${labelRight}) vs machine(${machineRight})`
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(valueRight - machineRight),
        `mode=${mode} col=${col}: value(${valueRight}) vs machine(${machineRight})`
      ).toBeLessThanOrEqual(1)
    }
  })
}
