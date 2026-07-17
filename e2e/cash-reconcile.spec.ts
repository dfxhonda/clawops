import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// SPEC-CASH-RECONCILE-PAGE-01 (D-067) gate_4 (AC5):
// 390x844 金種入力 -> 集金ピック -> 差額 -> 保存 -> 履歴 -> 戻る の end-to-end。
// 計算/権限/payload は vitest。ここはフロー + 視覚証跡。

function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test.describe('D-067 cash reconcile gate_4', () => {
  test('mobile 390x844: 金種->ピック->差額->保存->履歴->戻る', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'manager', staffId: 'staff-test-001', name: 'テスト管理者' })

    const recons: any[] = []

    await page.route('**/rest/v1/**', jsonRoute([]))
    await page.route('**/rest/v1/stores**', jsonRoute([
      { store_code: 'TST01', store_name: 'テスト店', locality: 'テスト', locality_kana: 'テスト', is_active: true },
    ]))
    await page.route('**/rest/v1/staff_pinned_stores**', jsonRoute([{ store_code: 'TST01' }]))
    await page.route('**/rest/v1/staff_public**', jsonRoute([{ staff_id: 'staff-test-001', name: 'テスト管理者' }]))
    await page.route('**/rest/v1/cash_collections**', jsonRoute([
      { collection_id: 'C1', store_code: 'TST01', collected_at: '2026-07-15T02:00:00Z', status: 'confirmed' },
    ]))
    await page.route('**/rest/v1/cash_collection_booths**', jsonRoute([{ collection_id: 'C1', total: 12000 }]))
    await page.route('**/rest/v1/cash_reconciliations**', async route => {
      const m = route.request().method()
      if (m === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        const row = { ...body, reconciliation_id: 'R1', created_at: '2026-07-15T10:30:00Z' }
        recons.push(row)
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) })
        return
      }
      if (m === 'DELETE') { const i = recons.findIndex(r => true); if (i >= 0) recons.splice(i, 1); await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recons) })
    })

    await page.goto('/collection/reconciliation')
    await expect(page.getByTestId('cash-reconcile')).toBeVisible()

    // 金種入力: 一万円 x2 (custom numpad path、iPhone UA)
    await page.getByTestId('recon-denom-10000').dispatchEvent('pointerdown')
    await expect(page.getByTestId('numpad-active-label')).toContainText('入力中')
    await page.locator('[data-numpad-key="2"]').dispatchEvent('pointerdown')
    await expect(page.getByTestId('recon-cash-total')).toContainText('20,000')

    // 集金ピック: ドロップダウンから C1 を追加
    await page.getByTestId('recon-pick-select').selectOption('C1')
    await expect(page.getByTestId('recon-pick-item-C1')).toBeVisible()
    await expect(page.getByTestId('recon-collections-total')).toContainText('12,000')

    // 差額 = 20000 - 12000 = +8,000 (赤)
    await expect(page.getByTestId('recon-difference')).toContainText('8,000')

    await page.screenshot({ path: 'test-results/d067-reconcile-390x844.png', fullPage: false })

    // 保存 -> 履歴に出る
    await page.getByTestId('recon-save').click()
    await expect(page.getByTestId('recon-history-row-R1')).toBeVisible({ timeout: 8000 })
    // 保存でクリア (手持ち合計 0 に戻る)
    await expect(page.getByTestId('recon-cash-total')).toContainText('0 円')

    // 履歴展開
    await page.getByTestId('recon-history-row-R1').click()
    await expect(page.getByTestId('recon-history-detail-R1')).toBeVisible()
    await page.screenshot({ path: 'test-results/d067-reconcile-history-390x844.png', fullPage: false })

    // 戻るボタン
    await expect(page.getByTestId('header-back')).toBeVisible()
  })
})
