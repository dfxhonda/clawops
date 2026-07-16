import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

// SPEC-DIAG-NUMPAD-NPLOG-PLAYWRIGHT-CAPTURE-01 (D-075):
// D-071 が NumpadFooterSlot に埋めた [nplog] (4 transition events + computed gridTemplateRows) を
// Playwright の page.on('console') で自動採取する。巡回(H1本命)と集金(対照群)の numpad 開閉を
// 各3往復し、生ログを stdout に marker 付きで吐く → status_log に全文転記 → D-071 decision_table へ。
// src 変更ゼロ (計測器は D-071 実装済)。全フロー mock、実 DB 書き込みなし。reduced-motion OFF (実機同条件)。

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })

const COL_BOOTH = 'TST01-M04-B02'

function jsonRoute(body: unknown, status = 200) {
  return async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

// numpad 開閉を n 往復し、その間に飛んだ [nplog] を capture 配列で受ける。
async function cycle(
  page: import('@playwright/test').Page,
  open: () => Promise<void>,
  close: () => Promise<void>,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    await open()
    await page.waitForTimeout(500) // 200ms transition + transitionend + rAF2 を待つ
    await close()
    await page.waitForTimeout(500)
  }
}

function dump(label: string, logs: string[]) {
  // marker で挟んで生ログを吐く (status_log に全文転記する対象)。
  // e2e/ は console.log 禁止 (pre-push) のため process.stdout.write を使う。
  const lines = [`===NPLOG-${label}-BEGIN=== count=${logs.length}`, ...logs, `===NPLOG-${label}-END===`]
  process.stdout.write(`\n${lines.join('\n')}\n\n`)
}

test.describe('D-075 numpad [nplog] auto-capture', () => {
  test('flow A: 巡回 booth-input numpad 開閉3往復の [nplog]', async ({ page }) => {
    const logs: string[] = []
    page.on('console', (m) => {
      const t = m.text()
      if (t.includes('[nplog]')) logs.push(t)
    })

    await page.addInitScript(() => {
      ;(window as unknown as { __NUMPAD_LOG__: boolean }).__NUMPAD_LOG__ = true
    })
    await setupAuth(page, { role: 'patrol' })
    await setupPatrolMocks(page)
    await page.route('**/rest/v1/feature_flags**', jsonRoute([{ flag_key: 'patrol_core', enabled: true }]))

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
    await page.addInitScript(
      ({ p, s }) => {
        window.history.replaceState({ usr: s, key: 'e2e-nplog' }, '', p as string)
      },
      { p: '/clawsupport/booth/TST-M01-B01', s: state },
    )
    await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

    const inField = page.getByTestId('field-in-meter')
    await expect(inField).toBeVisible({ timeout: 10_000 })

    // numpad を開く → 実際に可視化されるフッターが Slot か否かを判定する。
    await inField.dispatchEvent('pointerdown')
    await page.waitForTimeout(400)
    const flag = await page.evaluate(() => (window as unknown as { __NUMPAD_LOG__?: boolean }).__NUMPAD_LOG__)
    const footerVisible = await page.getByTestId('numpad-footer').isVisible().catch(() => false)
    const activeLabel = await page.getByTestId('numpad-active-label').textContent().catch(() => null)
    const slotCount = await page.getByTestId('numpad-slot').count()

    // 3往復 (Slot が居れば [nplog] が飛ぶ。居なければ 0 = それ自体が所見)
    await cycle(
      page,
      async () => { await inField.dispatchEvent('pointerdown') },
      async () => { await page.getByTestId('meter-row').first().dispatchEvent('pointerdown') },
      3,
    )

    const finding = `[finding] patrol booth-input: __NUMPAD_LOG__=${flag} numpad-footer.visible=${footerVisible} active-label="${activeLabel}" numpad-slot(count)=${slotCount} nplog-captured=${logs.length}`
    dump('PATROL', [finding, ...logs])

    // numpad は開く (footer 可視 + 入力中ラベル) が、可視フッターは NumpadFooterSlot ではない (slot count=0)。
    // = D-071 計測器 (Slot のみ instrument) が巡回では発火しない主因。ここが transition 未適用 = 「パッと出る」の正体。
    expect(footerVisible, 'patrol numpad should open (footer visible)').toBe(true)
    expect(activeLabel).toContain('入力中')
    expect(slotCount, 'patrol visible footer is NOT NumpadFooterSlot → 0 (finding)').toBe(0)
  })

  test('flow B: 集金 input numpad 開閉3往復の [nplog] (対照群)', async ({ page }) => {
    const logs: string[] = []
    page.on('console', (m) => {
      const t = m.text()
      if (t.includes('[nplog]')) logs.push(t)
    })

    await page.addInitScript(() => {
      ;(window as unknown as { __NUMPAD_LOG__: boolean }).__NUMPAD_LOG__ = true
    })
    await setupAuth(page, { role: 'manager', staffId: 'staff-test-001', name: 'テスト管理者' })

    await page.route('**/rest/v1/**', jsonRoute([]))
    await page.route('**/rest/v1/stores**', async (route) => {
      const isObj = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
        isObj ? { store_code: 'TST01', store_name: 'テスト店', store_name_official: 'テスト店', is_active: true }
              : [{ store_code: 'TST01', store_name: 'テスト店', locality: 'テスト', locality_kana: 'テスト', is_active: true }]) })
    })
    await page.route('**/rest/v1/staff_pinned_stores**', jsonRoute([{ store_code: 'TST01' }]))
    await page.route('**/rest/v1/booths**', jsonRoute([{ booth_code: COL_BOOTH, machine_code: 'TST01-M04', booth_number: 2, booth_label: null, is_active: true }]))
    await page.route('**/rest/v1/machines**', jsonRoute([{ machine_code: 'TST01-M04', machine_name: '機械A', machine_number: null }]))
    await page.route('**/rest/v1/meter_readings**', jsonRoute([{ booth_code: COL_BOOTH, in_meter: 150, patrol_date: '2026-05-22', created_at: '2026-05-22T10:00:00Z' }]))
    await page.route('**/rest/v1/cash_collections**', async (route) => {
      if (route.request().method() === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/cash_collection_booths**', jsonRoute([]))

    await page.goto('/collection/input')
    await expect(page.getByTestId('collection-input')).toBeVisible()
    await page.getByTestId('store-picker-trigger').click()
    await page.getByTestId('store-picker-item-TST01').click()
    await page.getByTestId('collection-load-button').click()
    await expect(page.getByTestId('collection-table')).toBeVisible()

    // 金種展開 (Collapse open) → 金種フィールドが出る
    await page.getByTestId(`booth-amount-${COL_BOOTH}`).click()
    const denomField = page.getByTestId(`denom-input-bill_10000-${COL_BOOTH}`)
    await expect(denomField).toBeVisible()

    await cycle(
      page,
      async () => { await denomField.dispatchEvent('pointerdown') },
      async () => { await page.getByTestId('collection-table').dispatchEvent('pointerdown') },
      3,
    )

    dump('COLLECTION', logs)
    expect(logs.length, 'no [nplog] captured for collection').toBeGreaterThan(0)
  })
})
