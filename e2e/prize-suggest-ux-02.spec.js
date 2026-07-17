import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

/**
 * SPEC-PATROL-PRIZE-SUGGEST-UX-02 AC1: 390px で候補ドロップダウンが full-width で開き、
 * 先頭候補がインプットカードに隠れず完全に見えること + スクショ。
 */
function injectState(page, path, state) {
  return page.addInitScript(
    ({ p, s }) => { window.history.replaceState({ usr: s, key: 'e2e-ux02' }, '', p) },
    { p: path, s: state },
  )
}

test('AC1: full-width dropdown, first candidate fully visible @390', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)
  // 長い名前 + 同名ツインズ (W2 wrap / W5 dedupe を絵で確認)
  await page.route('**/rest/v1/prize_masters**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { prize_id: 'A', prize_name: '●5/10締切 400 アミューズ不可 とても長い景品名の折返し確認テスト', short_name: 'a', original_cost: 400, latest_order_date: '2026-05-10' },
        { prize_id: 'B', prize_name: '●5/10締切 400 アミューズ不可 とても長い景品名の折返し確認テスト', short_name: 'b', original_cost: 400, latest_order_date: '2026-04-01' },
        { prize_id: 'C', prize_name: 'ラブブBOX', short_name: 'c', original_cost: 2500, latest_order_date: '2026-03-01' },
      ]),
    }),
  )

  const machine = {
    machine_code: 'TST01-M001', machine_name: 'テスト機', store_code: 'TST01',
    machine_models: { out_meter_count: 1, meter_unit_price: 100 },
    booths: [{ booth_code: 'TST-M01-B01', booth_number: 1 }],
  }
  const state = {
    machine, booth: machine.booths[0], storeCode: 'TST01',
    boothList: [{ booth: machine.booths[0], machine }], boothIndex: 0,
  }
  await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
  await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

  const input = page.getByTestId('field-prize-name-8')
  await expect(input).toBeVisible({ timeout: 10_000 })
  await input.click()
  await input.fill('アミ')

  const list = page.getByTestId('prize-autocomplete-list')
  await expect(list).toBeVisible({ timeout: 5_000 })

  // W1: full usable width (viewport 390 - 12px inset each side ≈ 366)
  const listBox = await list.boundingBox()
  expect(listBox.width).toBeGreaterThan(340)

  // W3: 先頭候補が input カード下端より下にあり、ビューポート内で完全に見える
  const inputBox = await input.boundingBox()
  const cand0 = page.getByTestId('prize-candidate-0')
  const cand0Box = await cand0.boundingBox()
  expect(cand0Box.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height - 1)
  expect(cand0Box.y + cand0Box.height).toBeLessThanOrEqual(844)

  // W5: ツインズに識別サブ行
  await expect(page.getByTestId('prize-candidate-hint-0')).toContainText('納期 2026-05-10')

  const shot = await page.screenshot()
  await testInfo.attach('prize-suggest-ux02-390', { body: shot, contentType: 'image/png' })
})
