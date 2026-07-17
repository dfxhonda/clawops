import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

/**
 * SPEC-UI-B-SVH-44PX-FIELD-01 AC3: 390x844 で PatrolStorePage / PatrolBoothInputPage /
 * CollectionInputPage が横スクロール無し・numpad完全表示・console error 0。
 */
function injectState(page, path, state) {
  return page.addInitScript(
    ({ p, s }) => { window.history.replaceState({ usr: s, key: 'e2e-svh' }, '', p) },
    { p: path, s: state },
  )
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement
    return d.scrollWidth <= d.clientWidth + 1
  })
}

// framework/asset ノイズを除外し、アプリ由来の error のみ残す
const BENIGN = [/favicon/i, /manifest/i, /DevTools/i, /ResizeObserver loop/i, /Failed to load resource/i, /net::ERR/i, /the server responded with a status/i]
function trackErrors(page) {
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error' && !BENIGN.some(r => r.test(m.text()))) errs.push(m.text()) })
  page.on('pageerror', (e) => { if (!BENIGN.some(r => r.test(String(e)))) errs.push(String(e)) })
  return errs
}

test.use({ viewport: { width: 390, height: 844 } })

test('AC3 PatrolBoothInputPage @390 — no h-overflow, numpad fully visible, no console errors', async ({ page }) => {
  const errs = trackErrors(page)
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)
  const machine = {
    machine_code: 'TST01-M001', machine_name: 'テスト機', store_code: 'TST01',
    machine_models: { out_meter_count: 1, meter_unit_price: 100 },
    booths: [{ booth_code: 'TST-M01-B01', booth_number: 1 }],
  }
  const state = { machine, booth: machine.booths[0], storeCode: 'TST01', boothList: [{ booth: machine.booths[0], machine }], boothIndex: 0 }
  await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
  await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('field-in-meter')).toBeVisible({ timeout: 10_000 })
  expect(await noHorizontalOverflow(page)).toBe(true)

  // numpad が開き、ビューポート内に完全に収まる (svh root で下端 cutoff しない)
  await page.getByTestId('field-in-meter').click()
  const sheet = page.getByTestId('numpad-sheet')
  await expect(sheet).toBeVisible({ timeout: 5_000 })
  const box = await sheet.boundingBox()
  expect(box.y + box.height).toBeLessThanOrEqual(845)
  expect(await noHorizontalOverflow(page)).toBe(true)
  expect(errs).toEqual([])
})

test('AC3 PatrolStorePage @390 — no h-overflow, no console errors', async ({ page }) => {
  const errs = trackErrors(page)
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)
  await page.goto('/clawsupport/store/TST01', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  expect(await noHorizontalOverflow(page)).toBe(true)
  expect(errs).toEqual([])
})

test('AC3 CollectionInputPage @390 — no h-overflow, no console errors', async ({ page }) => {
  const errs = trackErrors(page)
  await setupAuth(page, { role: 'admin', staffId: 'staff-test-001', name: 'テスト担当' })
  await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto('/collection/input', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('collection-input')).toBeVisible({ timeout: 10_000 })
  expect(await noHorizontalOverflow(page)).toBe(true)
  expect(errs).toEqual([])
})
