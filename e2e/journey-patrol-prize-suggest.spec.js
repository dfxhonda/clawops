import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

/**
 * 景品名サジェスト復元: 2文字からリストアップ + 候補に単価(@原価)併記。
 * prize_masters 検索をモックして PrizeNameAutocomplete を検証。token0。
 */
function injectState(page, path, state) {
  return page.addInitScript(
    ({ p, s }) => { window.history.replaceState({ usr: s, key: 'e2e-ps' }, '', p) },
    { p: path, s: state },
  )
}

test('景品名2文字でサジェスト表示 + 単価併記', async ({ page }) => {
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)
  // prize_masters 検索 → 候補1件(単価2500)
  await page.route('**/rest/v1/prize_masters**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { prize_id: 'PM1', prize_name: 'ラブブBOX', prize_name_kana: 'ラブブ', aliases: null, short_name: null, original_cost: 2500, latest_order_date: '2026-05-10' },
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
  await input.fill('ラブ') // 2文字でリストアップ

  await expect(page.getByTestId('prize-autocomplete-list')).toBeVisible({ timeout: 5_000 })
  const cand = page.getByTestId('prize-candidate-0')
  await expect(cand).toContainText('ラブブBOX')
  await expect(cand).toContainText('@2500') // 単価併記
})
