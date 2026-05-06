import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

function isSingleObjectRequest(route) {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// J-PATROL-04: 前回読み SELECT 欠落・NULL 上書り回収 — フォーム初期化・差分 PATCH・INSERT 補完
const PREV_READING = {
  reading_id: 'prev-004',
  booth_code: 'TST-B01',
  in_meter: 50000,
  out_meter: 45000,
  out_meter_2: null,
  out_meter_3: null,
  prize_stock_count: 20,
  prize_restock_count: 0,
  prize_id: 'prize-xyz',
  prize_name: 'フィギュアA',
  prize_name_2: null,
  prize_name_3: null,
  set_a: '12',
  set_c: '3',
  set_l: '1',
  set_r: '2',
  set_o: '0',
  stock_2: null,
  stock_3: null,
  restock_2: null,
  restock_3: null,
  theoretical_stock: 18,
  payout_rate: 0.355,
  prize_cost: 300,
  prize_cost_1: null,
  prize_cost_2: null,
  prize_cost_3: null,
  patrol_date: '2026-05-05',
  read_time: '2026-05-05T10:00:00+09:00',
}

async function injectBoothState(page) {
  await page.addInitScript(() => {
    window.history.replaceState({
      usr: {
        machine: { machine_code: 'TST01-M001', machine_name: 'テスト機1', store_code: 'TST01', machine_lockers: [], booths: [] },
        booth:   { booth_code: 'TST-B01', booth_number: 1 },
        storeCode: 'TST01',
      },
      key: 'e2e-patrol-04',
    }, '', '/clawsupport/booth/TST-B01')
  })
}

async function gotoPatrolBooth(page) {
  const done = page.waitForResponse(
    r => r.url().includes('/rest/v1/stores') && r.request().method() === 'GET',
    { timeout: 10_000 },
  )
  await page.goto('/clawsupport/booth/TST-B01')
  await done
  await expect(page.getByText('INメーター')).toBeVisible({ timeout: 5000 })
}

async function mockStore(page) {
  await page.route('**/rest/v1/stores**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const row = {
      store_code: 'TST01',
      store_name: 'テスト店舗',
      is_collection_day: false,
    }
    const body = isSingleObjectRequest(route) ? JSON.stringify(row) : JSON.stringify([row])
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
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

test.describe('J-PATROL-04: 前回値プリフィル・差分保存', () => {
  test('フォームが前回読みで初期化される', async ({ page }) => {
    await setupAuth(page)
    await mockStore(page)
    await page.route('**/rest/v1/meter_readings**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([PREV_READING]),
      })
    })
    await page.route('**/rest/v1/feature_flags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
      })
    })
    await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await injectBoothState(page)
    await gotoPatrolBooth(page)

    await expect(page.locator('#field-in-meter')).toHaveText('50000')
    await expect(page.locator('#field-out-meter')).toHaveText('45000')
    await expect(page.locator('#field-stock')).toHaveText('20')
    await expect(page.locator('#field-restock')).toHaveText('0')
    await expect(page.getByTestId('field-prize-name')).toHaveValue('フィギュアA')
    await expect(page.getByTestId('field-prize-cost')).toHaveValue('300')
    await expect(page.getByTestId('field-set-a')).toHaveValue('12')
    await expect(page.getByTestId('field-set-c')).toHaveValue('3')
    await expect(page.getByTestId('field-set-l')).toHaveValue('1')
    await expect(page.getByTestId('field-set-r')).toHaveValue('2')
    await expect(page.getByTestId('field-set-o')).toHaveValue('0')
  })

  test('景品名・設定値・理論行が表示される', async ({ page }) => {
    await setupAuth(page)
    await mockStore(page)
    await page.route('**/rest/v1/meter_readings**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([PREV_READING]),
      })
    })
    await page.route('**/rest/v1/feature_flags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]),
      })
    })
    await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await injectBoothState(page)
    await gotoPatrolBooth(page)

    await expect(page.getByTestId('field-prize-name')).toBeVisible()
    await expect(page.getByTestId('theory-row')).toBeVisible()
    await expect(page.getByTestId('theoretical-stock-label')).toContainText('18')
  })

  test('未編集の景品名は INSERT で prev から補完され本文に含まれる', async ({ page }) => {
    await setupAuth(page)
    await mockStore(page)

    const today = todayJST()

    await page.route('**/rest/v1/meter_readings**', async (route) => {
      const method = route.request().method()
      const url = route.request().url()

      if (method === 'GET') {
        const isTodayPatrolRow =
          url.includes('entry_type=eq.patrol') && url.includes(`patrol_date=eq.${today}`)
        if (isTodayPatrolRow) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([PREV_READING]),
        })
        return
      }

      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{ reading_id: 'ins-004' }]),
        })
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
    await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await injectBoothState(page)
    await gotoPatrolBooth(page)

    await page.evaluate(() => {
      try { window.history.scrollRestoration = 'manual' } catch (_) {}
    })

    await fillNumpadField(page, '#field-in-meter', '50001')
    await fillNumpadField(page, '#field-out-meter', '45000')
    await fillNumpadField(page, '#field-stock', '20')
    await fillNumpadField(page, '#field-restock', '0')

    const postWait = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'POST',
      { timeout: 10_000 },
    )
    await page.getByTestId('save-button').click()
    const postReq = await postWait
    const postBody = postReq.postDataJSON()

    expect(postBody).toBeTruthy()
    expect(postBody.prize_name).toBe('フィギュアA')
    expect(postBody.set_a).toBe('12')
    expect(postBody.prize_cost).toBe(300)
  })

  test('景品名を触らなければ PATCH 本文に prize_name が含まれない', async ({ page }) => {
    await setupAuth(page)
    await mockStore(page)

    const today = todayJST()

    const TODAY_PATROL = {
      reading_id: 'today-p04',
      booth_code: 'TST-B01',
      in_meter: 50001,
      out_meter: 45000,
      prize_stock_count: 20,
      prize_restock_count: 0,
      prize_name: '保持景品',
      prize_id: 'p-keep',
      set_a: '9',
      set_c: null,
      set_l: null,
      set_r: null,
      set_o: null,
      prize_cost: 100,
      patrol_date: today,
      entry_type: 'patrol',
    }

    await page.route('**/rest/v1/meter_readings**', async (route) => {
      const method = route.request().method()
      const url = route.request().url()

      if (method === 'GET') {
        const isTodayPatrolRow =
          url.includes('entry_type=eq.patrol') && url.includes(`patrol_date=eq.${today}`)
        if (isTodayPatrolRow) {
          const body = isSingleObjectRequest(route)
            ? JSON.stringify(TODAY_PATROL)
            : JSON.stringify([TODAY_PATROL])
          await route.fulfill({ status: 200, contentType: 'application/json', body })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([TODAY_PATROL]),
        })
        return
      }

      if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ reading_id: TODAY_PATROL.reading_id }]),
        })
        return
      }

      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{ reading_id: 'x' }]),
        })
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
    await page.route('**/rest/v1/staff**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await injectBoothState(page)
    await gotoPatrolBooth(page)

    await fillNumpadField(page, '#field-in-meter', '50002')
    await fillNumpadField(page, '#field-out-meter', '45000')
    await fillNumpadField(page, '#field-stock', '20')
    await fillNumpadField(page, '#field-restock', '0')

    const patchWait = page.waitForRequest(
      req => req.url().includes('/rest/v1/meter_readings') && req.method() === 'PATCH',
      { timeout: 10_000 },
    )
    await page.getByTestId('save-button').click()
    const patchReq = await patchWait
    const patchBody = patchReq.postDataJSON()

    expect(patchBody).toBeTruthy()
    expect(patchBody.prize_name).toBeUndefined()
    expect(patchBody.set_a).toBeUndefined()
    expect(patchBody.prize_cost).toBeUndefined()
  })
})
