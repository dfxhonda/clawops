import { test, expect } from '@playwright/test'
// device分岐: 本specはiPhoneカスタムテンキーUXを検証するため iPhone UA を固定
test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' })
import { setupAuth } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// J-PATROL-05: テキスト対比・レイアウト・景品名オートコンプリート
const PREV_READING = {
  reading_id: 'prev-005',
  booth_code: 'TST-B05',
  in_meter: 60000,
  out_meter: 54000,
  out_meter_2: null,
  out_meter_3: null,
  prize_stock_count: 15,
  prize_restock_count: 2,
  prize_id: 'prize-old',
  prize_name: '前回景品',
  prize_name_2: null,
  prize_name_3: null,
  set_a: '8',
  set_c: '2',
  set_l: '1',
  set_r: '1',
  set_o: null,
  stock_2: null,
  stock_3: null,
  restock_2: null,
  restock_3: null,
  theoretical_stock: 14,
  payout_rate: 0.32,
  prize_cost: 250,
  prize_cost_1: null,
  prize_cost_2: null,
  prize_cost_3: null,
  patrol_date: '2026-05-05',
  read_time: '2026-05-05T10:00:00+09:00',
}

const PRIZE_CANDIDATES = [
  {
    prize_id: 'PM-A01',
    prize_name: 'ラブブBOX',
    prize_name_kana: 'ラブブボックス',
    aliases: null,
    short_name: 'ラブブ',
    original_cost: 2500,
  },
  {
    prize_id: 'PM-A02',
    prize_name: 'ラブブリング',
    prize_name_kana: null,
    aliases: null,
    short_name: null,
    original_cost: 1200,
  },
]

async function injectBoothState(page) {
  await page.addInitScript(() => {
    window.history.replaceState({
      usr: {
        machine: { machine_code: 'TST01-M005', machine_name: 'テスト機5', store_code: 'TST01', machine_lockers: [], booths: [] },
        booth:   { booth_code: 'TST-B05', booth_number: 5 },
        storeCode: 'TST01',
      },
      key: 'e2e-patrol-05',
    }, '', '/clawsupport/booth/TST-B05')
  })
}

async function mockCommon(page, { prevReading = PREV_READING, prizeMasters = [] } = {}) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = { store_code: 'TST01', store_name: 'テスト店舗', is_collection_day: false }
    const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const body = prevReading ? JSON.stringify([prevReading]) : '[]'
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.route('**/rest/v1/feature_flags**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
    })
  })
  await page.route('**/rest/v1/prize_masters**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prizeMasters) })
  })
  await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function gotoPatrolBooth(page) {
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B05')
  await done
  await page.waitForSelector('[data-testid="booth-input-upper"]', { timeout: 5000 })
}

async function fillNumpadField(page, fieldId, digits) {
  await page.locator(fieldId).click()
  await page.waitForSelector('[data-testid="numpad-sheet"]', { timeout: 3000 })
  const sheet = page.locator('[data-testid="numpad-sheet"]')
  for (const d of String(digits)) {
    await sheet.locator(`[data-numpad-key="${d}"]`).click()
  }
  await sheet.locator('[data-numpad-key="→"]').click()
  await page.waitForSelector('[data-testid="numpad-portal"]', { state: 'detached', timeout: 1500 }).catch(() => {})
}

// ─── sub a: テキスト対比 ──────────────────────────────────────────────────
test.describe('J-PATROL-05a: placeholder コントラスト', () => {
  test('景品名フィールドが text-gray-500 プレースホルダーで描画される', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page, { prevReading: null })
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-prize-name')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', '前回値から補完（変更時のみ差分送信）')

    // placeholder:text-muted/40 が消えていることを確認（className に text-muted が単体で残ってはいけない）
    const cls = await page.getByTestId('field-prize-name').evaluate(el => el.className)
    expect(cls).not.toContain('placeholder:text-muted/40')
  })

  test('設定Aフィールドのプレースホルダーが可視', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page, { prevReading: null })
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-set-a')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', 'A')
  })
})

// ─── sub b: レイアウト ──────────────────────────────────────────────────
test.describe('J-PATROL-05b: booth-input-upper レイアウト', () => {
  test('booth-input-upper コンテナが存在する', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page)
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    await expect(page.getByTestId('booth-input-upper')).toBeVisible()
  })

  test('保存ボタンが booth-input-upper 内に収まる', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page)
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const upper = page.getByTestId('booth-input-upper')
    const saveBtn = page.getByTestId('save-button')
    await expect(upper).toBeVisible()
    await expect(saveBtn).toBeVisible()

    const upperBox = await upper.boundingBox()
    const btnBox   = await saveBtn.boundingBox()
    expect(upperBox).toBeTruthy()
    expect(btnBox).toBeTruthy()
    expect(btnBox.y).toBeGreaterThanOrEqual(upperBox.y)
  })
})

// ─── sub c: 景品名オートコンプリート ────────────────────────────────────
test.describe('J-PATROL-05c: 景品名オートコンプリート', () => {
  test('3文字以上の入力で候補ドロップダウンが表示される', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page, { prizeMasters: PRIZE_CANDIDATES })
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-prize-name')
    await input.fill('ラブブ')

    await expect(page.getByTestId('prize-autocomplete-list')).toBeVisible({ timeout: 2000 })
    await expect(page.getByTestId('prize-candidate-0')).toContainText('ラブブBOX')
    await expect(page.getByTestId('prize-candidate-1')).toContainText('ラブブリング')
  })

  test('2文字以下ではドロップダウンが表示されない', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page, { prizeMasters: PRIZE_CANDIDATES })
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-prize-name')
    await input.fill('ラブ')

    await expect(page.getByTestId('prize-autocomplete-list')).not.toBeVisible()
  })

  test('候補を選択すると景品名と原価が自動入力される', async ({ page }) => {
    await setupAuth(page)
    await mockCommon(page, { prizeMasters: PRIZE_CANDIDATES })
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-prize-name')
    await input.fill('ラブブ')
    await expect(page.getByTestId('prize-autocomplete-list')).toBeVisible({ timeout: 2000 })

    await page.getByTestId('prize-candidate-0').click()

    await expect(input).toHaveValue('ラブブBOX')
    await expect(page.getByTestId('field-prize-cost')).toHaveValue('2500')
    await expect(page.getByTestId('prize-autocomplete-list')).not.toBeVisible()
  })

  test('候補選択後の保存で prize_id が送信される', async ({ page }) => {
    await setupAuth(page)

    const today = todayJST()

    await page.route('**/rest/v1/stores**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const row = { store_code: 'TST01', store_name: 'テスト店舗', is_collection_day: false }
      const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
      await route.fulfill({ status: 200, contentType: 'application/json', body })
    })

    await page.route('**/rest/v1/meter_readings**', async (route) => {
      const method = route.request().method()
      const url = route.request().url()
      if (method === 'GET') {
        const isTodayRow =
          url.includes('entry_type=eq.patrol') && url.includes(`patrol_date=eq.${today}`)
        if (isTodayRow) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
          return
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PREV_READING]) })
        return
      }
      if (method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ reading_id: 'ins-005' }]) })
        return
      }
      await route.continue()
    })

    await page.route('**/rest/v1/feature_flags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
      })
    })
    await page.route('**/rest/v1/prize_masters**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRIZE_CANDIDATES) })
    })
    await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-prize-name')
    await input.fill('ラブブ')
    await expect(page.getByTestId('prize-autocomplete-list')).toBeVisible({ timeout: 2000 })
    await page.getByTestId('prize-candidate-0').click()
    await expect(input).toHaveValue('ラブブBOX')

    await fillNumpadField(page, '#field-in-meter', '60001')
    await fillNumpadField(page, '#field-out-meter', '54000')
    await fillNumpadField(page, '#field-stock', '15')
    await fillNumpadField(page, '#field-restock', '2')

    const postWait = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 10_000 },
    )
    await page.getByTestId('save-button').click()
    const postReq = await postWait
    const body = postReq.postDataJSON()

    expect(body.prize_id).toBe('PM-A01')
    expect(body.prize_name).toBe('ラブブBOX')
    expect(body.prize_cost).toBe(2500)
  })

  test('手動入力（選択なし）では prize_id が送信されない', async ({ page }) => {
    await setupAuth(page)

    const today = todayJST()
    const TODAY_PATROL = {
      ...PREV_READING,
      reading_id: 'today-p05',
      patrol_date: today,
      entry_type: 'patrol',
    }

    await page.route('**/rest/v1/stores**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const row = { store_code: 'TST01', store_name: 'テスト店舗', is_collection_day: false }
      const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
      await route.fulfill({ status: 200, contentType: 'application/json', body })
    })

    await page.route('**/rest/v1/meter_readings**', async (route) => {
      const method = route.request().method()
      const url = route.request().url()
      if (method === 'GET') {
        const isTodayRow =
          url.includes('entry_type=eq.patrol') && url.includes(`patrol_date=eq.${today}`)
        if (isTodayRow) {
          const body = isSingleObjectRequest(route) ? JSON.stringify(TODAY_PATROL) : JSON.stringify([TODAY_PATROL])
          await route.fulfill({ status: 200, contentType: 'application/json', body })
          return
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([TODAY_PATROL]) })
        return
      }
      if (method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ reading_id: TODAY_PATROL.reading_id }]) })
        return
      }
      if (method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ reading_id: 'x' }]) })
        return
      }
      await route.continue()
    })

    await page.route('**/rest/v1/feature_flags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
      })
    })
    await page.route('**/rest/v1/prize_masters**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await injectBoothState(page)
    await gotoPatrolBooth(page)

    const input = page.getByTestId('field-prize-name')
    await input.fill('手動入力景品名')

    await fillNumpadField(page, '#field-in-meter', '60002')
    await fillNumpadField(page, '#field-out-meter', '54001')
    await fillNumpadField(page, '#field-stock', '14')
    await fillNumpadField(page, '#field-restock', '1')

    const patchWait = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'PATCH',
      { timeout: 10_000 },
    )
    await page.getByTestId('save-button').click()
    const patchReq = await patchWait
    const body = patchReq.postDataJSON()

    expect(body.prize_id).toBeUndefined()
    expect(body.prize_name).toBe('手動入力景品名')
  })
})
