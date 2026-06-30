// DIAG-NUMPAD-OVERFLOW-MEASURE-01: NO-FIX 計測スクリプト
// AdminBoothEditPage の numpad 要素 & 親要素の実測値を取得しはみ出し原因を特定する。
// src/ は一切変更しない。

import { test } from '@playwright/test'
import { setupAuth, injectRouteState } from './helpers'
import * as fs from 'fs'
import * as path from 'path'

const STORE_CODE = 'ADM01'
const BOOTH_CODE = 'ADM01-B01'

const MOCK_STORES = [{ store_code: STORE_CODE, store_name: 'テスト店舗ADM01', is_active: true }]

const MOCK_MACHINES = [{
  machine_code: 'ADM01-M001',
  machine_name: 'テスト機ADM01',
  store_code: STORE_CODE,
  type_id: 1,
  model_id: 'model-adm',
  billing_order: 1,
  machine_types: { category: 'crane', locker_slots: 0 },
  machine_models: { out_meter_count: 1, meter_unit_price: 100 },
  machine_lockers: [],
  booths: [{ booth_code: BOOTH_CODE, booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'ADM01-M001' }],
}]

const MOCK_READING = {
  reading_id: 'adm-r-001', booth_code: BOOTH_CODE,
  patrol_date: '2026-05-09', read_time: '2026-05-09T10:00:00+09:00',
  created_at: '2026-05-09T01:00:00.000Z', updated_at: '2026-05-09T01:00:00.000Z',
  entry_type: 'patrol', in_meter: 71000, out_meter: 5,
  out_meter_2: null, out_meter_3: null,
  prize_name: 'テスト景品', prize_cost: 300, prize_stock_count: 10, prize_restock_count: 0,
  set_a: '5', set_c: '3', set_l: '2', set_r: '2', set_o: null,
  note: null, created_by: 'staff-test', updated_by: null,
  organization_id: '14e907a7-65a3-4891-9a3c-20ea0a7c14fd',
}

function isSingle(route: import('@playwright/test').Route): boolean {
  return (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
}

test.describe('DIAG-NUMPAD-OVERFLOW-MEASURE-01', () => {
  test('measure: iPhone 390x844 numpad & parent rects after IN field tap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin' })

    // Supabase API mocks
    await page.route('**/rest/v1/feature_flags**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) }))
    await page.route('**/rest/v1/glossary_terms**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/stores**', async r => {
      if (r.request().method() !== 'GET') return r.continue()
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isSingle(r) ? MOCK_STORES[0] : MOCK_STORES) })
    })
    await page.route('**/rest/v1/machines**', async r => {
      if (r.request().method() !== 'GET') return r.continue()
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isSingle(r) ? MOCK_MACHINES[0] : MOCK_MACHINES) })
    })
    await page.route('**/rest/v1/meter_readings**', async r => {
      if (r.request().method() !== 'GET') return r.continue()
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isSingle(r) ? MOCK_READING : [MOCK_READING]) })
    })
    await page.route('**/rest/v1/staff**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/audit_logs**', r => r.fulfill({ status: 201, contentType: 'application/json', body: '{}' }))
    await page.route('**/rest/v1/prize_masters**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/booths**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/locker_slots**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/machine_types**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ type_id: 1, type_name: 'クレーン', category: 'crane', locker_slots: 0 }]) }))

    await injectRouteState(page, `/admin/booth-edit/${BOOTH_CODE}`, {
      machine: MOCK_MACHINES[0],
      booth: MOCK_MACHINES[0].booths[0],
      storeCode: STORE_CODE,
    })

    await page.goto(`/admin/booth-edit/${BOOTH_CODE}`)
    await page.waitForSelector('[data-testid="booth-history-list"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="history-row"]', { timeout: 10_000 })

    // 履歴行をクリックしてeditモードに入る
    await page.locator('[data-testid="history-row"]').first().click()

    // IN欄が表示されるまで待つ
    await page.waitForSelector('[data-testid="field-in-meter"]', { timeout: 8_000 })

    // IN欄をクリックしてnumpadを有効化
    await page.locator('[data-testid="field-in-meter"]').click()

    // numpad-anchorが表示されるまで待つ（hidden→flex-none）
    // NOTE: className.includes('hidden') は overflow-hidden も拾うため classList.contains を使用
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="numpad-anchor"]')
      return el && !el.classList.contains('hidden')
    }, { timeout: 5_000 })

    // スクリーンショット取得（numpad表示状態）
    const screenshotDir = 'e2e/screenshots'
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.join(screenshotDir, 'diag-numpad-measure-before.png'), fullPage: false })

    // ── M1: 全測定値取得 ──────────────────────────────────────────────
    const measurements = await page.evaluate(() => {
      function r(el: Element | null) {
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return { height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width }
      }
      function cs(el: Element | null) {
        if (!el) return null
        return window.getComputedStyle(el)
      }

      const pageRoot = document.querySelector('[data-testid="page-root"]')
      const numpadAnchor = document.querySelector('[data-testid="numpad-anchor"]')
      const historyList = document.querySelector('[data-testid="booth-history-list"]')
      const numpadFooter = document.querySelector('[data-testid="numpad-footer"]')

      // form部: page-rootの最初のshrink-0子
      const formSection = pageRoot ? Array.from(pageRoot.children).find(c =>
        c.className.includes('shrink-0') || c.className.includes('max-h-')
      ) : null

      const win = {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        visualViewportHeight: window.visualViewport?.height ?? null,
        visualViewportWidth: window.visualViewport?.width ?? null,
        visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
        documentClientHeight: document.documentElement.clientHeight,
        documentClientWidth: document.documentElement.clientWidth,
        devicePixelRatio: window.devicePixelRatio,
      }

      const pageRootRect = r(pageRoot)
      const pageRootCS = cs(pageRoot)
      const pageRootComputed = pageRootCS ? {
        height: pageRootCS.height,
        display: pageRootCS.display,
        flexDirection: pageRootCS.flexDirection,
        overflow: pageRootCS.overflow,
        position: pageRootCS.position,
      } : null

      const formRect = r(formSection ?? null)
      const formCS = cs(formSection ?? null)
      const formComputed = formCS ? {
        height: formCS.height,
        maxHeight: formCS.maxHeight,
        flexShrink: formCS.flexShrink,
        overflow: formCS.overflow,
      } : null

      const histRect = r(historyList)
      const histCS = cs(historyList)
      const histComputed = histCS ? {
        height: histCS.height,
        flexGrow: histCS.flexGrow,
        minHeight: histCS.minHeight,
        overflow: histCS.overflow,
        overflowY: histCS.overflowY,
      } : null

      const numpadRect = r(numpadAnchor)
      const numpadCS = cs(numpadAnchor)
      const numpadComputed = numpadCS ? {
        height: numpadCS.height,
        flex: numpadCS.flex,
        flexShrink: numpadCS.flexShrink,
        display: numpadCS.display,
        overflow: numpadCS.overflow,
        className: numpadAnchor?.className ?? '',
        isHiddenClass: numpadAnchor?.classList.contains('hidden') ?? null,
      } : null

      const footerRect = r(numpadFooter)
      const footerCS = cs(numpadFooter)
      const footerComputed = footerCS ? {
        height: footerCS.height,
        overflow: footerCS.overflow,
      } : null

      // 判定
      const numpadBottom = numpadRect?.bottom ?? null
      const isNumpadInView = numpadBottom !== null ? numpadBottom <= win.innerHeight : null

      // dvh換算比較
      const numpadComputedHeightPx = numpadRect?.height ?? null
      const expected30dvhPx = win.innerHeight * 0.30
      const dvhDiff = numpadComputedHeightPx !== null ? numpadComputedHeightPx - expected30dvhPx : null

      // page-root高さ vs innerHeight
      const pageRootHeightPx = pageRootRect?.height ?? null
      const pageRootVsInnerHeight = pageRootHeightPx !== null ? pageRootHeightPx - win.innerHeight : null

      return {
        window: win,
        pageRoot: { rect: pageRootRect, computed: pageRootComputed },
        formSection: { rect: formRect, computed: formComputed },
        historyList: { rect: histRect, computed: histComputed },
        numpadAnchor: { rect: numpadRect, computed: numpadComputed },
        numpadFooter: { rect: footerRect, computed: footerComputed },
        judgment: {
          isNumpadInView,
          numpadBottom,
          numpadComputedHeightPx,
          expected30dvhPx: Math.round(expected30dvhPx * 100) / 100,
          dvhDiff: dvhDiff !== null ? Math.round(dvhDiff * 100) / 100 : null,
          pageRootHeightPx,
          pageRootVsInnerHeight: pageRootVsInnerHeight !== null ? Math.round(pageRootVsInnerHeight * 100) / 100 : null,
        },
      }
    })

    await page.screenshot({ path: path.join(screenshotDir, 'diag-numpad-measure-after.png'), fullPage: false })

    // ── M2: 仮説判定 ──────────────────────────────────────────────────
    const win = measurements.window
    const pageRootH = measurements.pageRoot.rect?.height ?? 0
    const formH = measurements.formSection.rect?.height ?? 0
    const histH = measurements.historyList.rect?.height ?? 0
    const numpadH = measurements.numpadAnchor.rect?.height ?? 0
    const numpadBottom = measurements.numpadAnchor.rect?.bottom ?? 0
    const expected30dvh = win.innerHeight * 0.30
    const dvhDiff = measurements.judgment.dvhDiff ?? 0
    const pageRootDiff = measurements.judgment.pageRootVsInnerHeight ?? 0

    const H1_dvh_overshoot = pageRootDiff > 1  // page-root.height > innerHeight by >1px
    const H2_form_maxh_too_tall = formH > win.innerHeight * 0.60  // form consumes >60% of screen
    const H3_minh0_not_effective = histH > win.innerHeight * 0.30  // history doesn't shrink enough
    const H4_numpad_height_wrong = Math.abs(dvhDiff) > 5  // numpad computed height != 30dvh by >5px
    const H5_safe_area = numpadH > expected30dvh + 10  // numpad taller than expected by >10px (safe-area)

    const hypotheses = {
      H1_dvh_overshoot: { triggered: H1_dvh_overshoot, desc: 'page-rootがinnerHeightより大きい(dvh>innerHeight)', diff_px: pageRootDiff },
      H2_form_maxh_too_tall: { triggered: H2_form_maxh_too_tall, desc: 'form部がinnerHeight*0.60超(max-h使い切り)', formH_px: formH },
      H3_minh0_not_effective: { triggered: H3_minh0_not_effective, desc: '履歴flex-1がinnerHeight*0.30超(min-h-0未効)', histH_px: histH },
      H4_numpad_height_wrong: { triggered: H4_numpad_height_wrong, desc: 'numpad computed height と 30dvh が5px超乖離', dvhDiff_px: dvhDiff },
      H5_safe_area: { triggered: H5_safe_area, desc: 'numpadが30dvh+10px超(safe-area加算疑い)', surplus_px: numpadH - expected30dvh },
    }

    const triggered = Object.entries(hypotheses).filter(([, v]) => v.triggered).map(([k]) => k)
    const conclusion = triggered.length > 0
      ? `裏付け仮説: ${triggered.join(', ')}`
      : '全仮説で数値条件を満たさず — Playwright環境では再現不可能か追加調査必要'

    // ── 結果出力 ──────────────────────────────────────────────────────
    const report = {
      spec: 'DIAG-NUMPAD-OVERFLOW-MEASURE-01',
      viewport: '390x844',
      measurements,
      hypotheses,
      conclusion,
      summary: {
        '1_window': `innerHeight=${win.innerHeight} visualViewport=${win.visualViewportHeight} clientHeight=${win.documentClientHeight}`,
        '2_pageRoot': `h=${pageRootH}px top=${measurements.pageRoot.rect?.top} bottom=${measurements.pageRoot.rect?.bottom} flexDir=${measurements.pageRoot.computed?.flexDirection}`,
        '3_form': `h=${formH}px bottom=${measurements.formSection.rect?.bottom} maxH=${measurements.formSection.computed?.maxHeight} shrink=${measurements.formSection.computed?.flexShrink}`,
        '4_history': `h=${histH}px bottom=${measurements.historyList.rect?.bottom} grow=${measurements.historyList.computed?.flexGrow} minH=${measurements.historyList.computed?.minHeight}`,
        '5_numpadAnchor': `h=${numpadH}px top=${measurements.numpadAnchor.rect?.top} bottom=${numpadBottom} flex=${measurements.numpadAnchor.computed?.flex}`,
        '6_numpadFooter': `h=${measurements.numpadFooter.rect?.height ?? 'N/A'}px computedH=${measurements.numpadFooter.computed?.height}`,
        '7_isNumpadInView': `${measurements.judgment.isNumpadInView} (bottom=${numpadBottom} <= innerHeight=${win.innerHeight})`,
        '8_dvhCheck': `numpadH=${numpadH}px expected(30dvh)=${measurements.judgment.expected30dvhPx}px diff=${dvhDiff}px`,
        '9_pageRootVsInner': `pageRootH=${pageRootH}px innerH=${win.innerHeight}px diff=${pageRootDiff}px`,
      },
    }

    // JSONファイルに出力（status_log用）
    const outPath = path.join(screenshotDir, 'diag-numpad-measure-result.json')
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

    // テスト自体は測定成功で常にpass（数値収集が目的）
    // AC1: 数値が揃っていること
    const m = measurements
    if (!m.window.innerHeight) throw new Error('AC1 FAIL: innerHeight not measured')
    if (!m.pageRoot.rect) throw new Error('AC1 FAIL: pageRoot rect not measured')
    if (!m.numpadAnchor.rect) throw new Error('AC1 FAIL: numpadAnchor rect not measured')
    // AC2: isNumpadInView が記録されていること
    if (m.judgment.isNumpadInView === undefined) throw new Error('AC2 FAIL: isNumpadInView not recorded')
    // AC3: 仮説結論が記録されていること
    if (!conclusion) throw new Error('AC3 FAIL: conclusion not recorded')

    // Result JSON at: outPath (see diag-numpad-measure-result.json in e2e/screenshots/)
  })
})
