import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

/**
 * 巡回ブース入力(PatrolBoothInputPage /clawsupport/booth/:boothCode)の新機能 回帰E2E:
 *  - 「読み取り」ボタン (OCR=純正カメラ/ギャラリー入力)
 *  - 保存ボタン2種 (保存してリストへ / 保存して次へ)
 *  - 理論在庫デフォルト = 前回在庫 + 前回補充 − OUT差 (PREV_READING: stock20/restock0/out45000)
 *  全てモック(setupAuth=patrol, setupPatrolMocks)で token0 実行。
 */
function injectState(page, path, state) {
  return page.addInitScript(
    ({ p, s }) => { window.history.replaceState({ usr: s, key: 'e2e-bi' }, '', p) },
    { p: path, s: state },
  )
}

test.describe('J-PATROL booth-input 新機能', () => {
  test('読み取り + 2保存ボタン + 理論在庫デフォ', async ({ page }) => {
    await setupAuth(page, { role: 'patrol' })
    await setupPatrolMocks(page)
    await page.route('**/rest/v1/feature_flags**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
      }),
    )

    const machine = {
      machine_code: 'TST01-M001',
      machine_name: 'テスト機',
      store_code: 'TST01',
      machine_models: { out_meter_count: 1, meter_unit_price: 100 },
      booths: [
        { booth_code: 'TST-M01-B01', booth_number: 1 },
        { booth_code: 'TST-M01-B02', booth_number: 2 },
      ],
    }
    const boothList = machine.booths.map((b) => ({ booth: b, machine }))
    const state = { machine, booth: machine.booths[0], storeCode: 'TST01', boothList, boothIndex: 0 }

    await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
    await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

    // 読み取りボタン (OCR入口)
    await expect(page.getByText('読み取り')).toBeVisible({ timeout: 10_000 })

    // 保存ボタン2種
    await expect(page.getByTestId('save-list-button')).toBeVisible()
    await expect(page.getByTestId('save-next-button')).toBeVisible()

    // 理論在庫デフォルト: 前回在庫20 + 前回補充0 − OUT差0 = 20 (グレー初期値)
    await expect(page.getByTestId('field-stock')).toHaveValue('20')
    // 補充欄は0デフォ (空)
    await expect(page.getByTestId('field-restock')).toHaveValue('')
  })

  test('保存して次へ → 次ブースB02へ遷移し、クリーンな2ボタンに復活(skipped残り回帰)', async ({ page }) => {
    await setupAuth(page, { role: 'patrol' })
    await setupPatrolMocks(page)

    const machine = {
      machine_code: 'TST01-M001',
      machine_name: 'テスト機',
      store_code: 'TST01',
      machine_models: { out_meter_count: 1, meter_unit_price: 100 },
      booths: [
        { booth_code: 'TST-M01-B01', booth_number: 1 },
        { booth_code: 'TST-M01-B02', booth_number: 2 },
      ],
    }
    const boothList = machine.booths.map((b) => ({ booth: b, machine }))
    const state = { machine, booth: machine.booths[0], storeCode: 'TST01', boothList, boothIndex: 0 }

    await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
    await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

    // B01 表示
    await expect(page.getByText(/ブース\s*1/)).toBeVisible({ timeout: 10_000 })

    // 変更なしで「保存して次へ」→ skipped → 次ブースB02へ自動遷移
    await page.getByTestId('save-next-button').click()
    await expect(page.getByText(/ブース\s*2/)).toBeVisible({ timeout: 6_000 })

    // 次ブースはクリーンな2ボタン (前ブースのskipped/savedが残らない)
    await expect(page.getByTestId('save-next-button')).toBeVisible()
    await expect(page.getByTestId('save-list-button')).toBeVisible()
  })
})
