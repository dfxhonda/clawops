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

// SPEC-DIAG-NUMPAD-NPLOG-WEBKIT-01 (D-077): engine 別に reduced-motion 判定と Slot の computed transition を採取。
async function engineInfo(page: import('@playwright/test').Page): Promise<string> {
  const info = await page.evaluate(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const slot = document.querySelector('[data-testid="numpad-slot"]')
    const cs = slot ? getComputedStyle(slot as Element) : null
    return {
      rm,
      tr: cs ? `${cs.transitionProperty}/${cs.transitionDuration}/${cs.transitionTimingFunction}` : 'no-slot',
      rows: cs ? cs.gridTemplateRows : 'no-slot',
    }
  })
  return `[engine] reduced-motion.matches=${info.rm} slot.computed.transition=${info.tr} slot.gridTemplateRows=${info.rows}`
}

function dump(label: string, logs: string[]) {
  // marker で挟んで生ログを吐く (status_log に全文転記する対象)。
  // e2e/ は console.log 禁止 (pre-push) のため process.stdout.write を使う。
  const lines = [`===NPLOG-${label}-BEGIN=== count=${logs.length}`, ...logs, `===NPLOG-${label}-END===`]
  process.stdout.write(`\n${lines.join('\n')}\n\n`)
}

test.describe('D-075 numpad [nplog] auto-capture', () => {
  test('flow A: 巡回 booth-input numpad 開閉3往復の [nplog]', async ({ page, browserName }) => {
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

    const engine = await engineInfo(page)
    const finding = `[finding] patrol booth-input engine=${browserName}: __NUMPAD_LOG__=${flag} numpad-footer.visible=${footerVisible} active-label="${activeLabel}" numpad-slot(count)=${slotCount} nplog-captured=${logs.length}`
    dump(`PATROL-${browserName}`, [engine, finding, ...logs])

    // 構造 (footer 可視 + Slot 存在) は全 engine で成立想定。transition 発火の有無こそが engine 差の観測点。
    expect(footerVisible, 'patrol numpad should open (footer visible)').toBe(true)
    expect(activeLabel).toContain('入力中')
    expect(slotCount, 'patrol main-form footer should be NumpadFooterSlot (>=1)').toBeGreaterThanOrEqual(1)
    // [nplog] transition 発火の断定は chromium のみ (webkit は採取優先、fail させず所見にする)
    if (browserName === 'chromium') {
      const types = logs.join('\n')
      expect(logs.length, 'patrol should emit [nplog] via Slot').toBeGreaterThan(0)
      expect(types, 'transitionrun should fire on patrol slot').toContain('[nplog] transitionrun')
      expect(types, 'transitionend should fire on patrol slot').toContain('[nplog] transitionend')
    }
  })

  test('flow B: 集金 input numpad 開閉3往復の [nplog] (対照群)', async ({ page, browserName }) => {
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
    await denomField.dispatchEvent('pointerdown')
    await page.waitForTimeout(300)
    const engine = await engineInfo(page)

    await cycle(
      page,
      async () => { await denomField.dispatchEvent('pointerdown') },
      async () => { await page.getByTestId('collection-table').dispatchEvent('pointerdown') },
      3,
    )

    dump(`COLLECTION-${browserName}`, [engine, ...logs])
    // 集金は対照群。chromium では [nplog] 発火必須、webkit は採取優先 (所見化)。
    if (browserName === 'chromium') {
      expect(logs.length, 'no [nplog] captured for collection').toBeGreaterThan(0)
    }
  })
})
