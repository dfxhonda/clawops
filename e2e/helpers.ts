import { type Page } from '@playwright/test'

// ── Auth bypass ──────────────────────────────────────────────────────────

const FAKE_USER = {
  id: 'test-user-001',
  email: 'patrol@test.com',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: {
    staff_id: 'staff-test-001',
    name: 'テスト巡回員',
    role: 'patrol',
  },
  app_metadata: { provider: 'email' },
}

// Supabase JS v2 が localStorage に保存するセッション形式（v1 の currentSession ラッパーなし）
const FAKE_SESSION = {
  access_token: 'test-access-token-xxxxxxxx',
  token_type: 'bearer',
  expires_in: 7200,
  expires_at: Math.floor(Date.now() / 1000) + 7200,
  refresh_token: 'test-refresh-token-xxxxxxxx',
  user: FAKE_USER,
}

/**
 * Supabase auth を迂回する。
 * localStorage injection（v2 形式）+ /auth/v1/** ネットワークモックを組み合わせる。
 * page.goto() より前に呼ぶこと。
 */
export async function setupAuth(page: Page) {
  // Supabase JS v2 SDK はキー末尾が "-auth-token" の localStorage を読む。
  // addInitScript は React より先に実行されるため SDK 初期化前に差し込める。
  await page.addInitScript((session: typeof FAKE_SESSION) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key: string) {
      if (key && key.endsWith('-auth-token')) return JSON.stringify(session)
      return orig.call(this, key)
    }
  }, FAKE_SESSION)

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/signout')) {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      })
    }
  })
}

// ── Supabase REST helper ─────────────────────────────────────────────────

/**
 * Supabase JS v2 の .single() は Accept: application/vnd.pgrst.object+json を送る。
 * このフラグに応じてモックの返却形式を切り替える必要がある。
 * - isSingle = true  → 単一オブジェクト { ... }
 * - isSingle = false → 配列 [ ... ] または []
 */
function isSingleRequest(route: Parameters<Parameters<Page['route']>[1]>[0]): boolean {
  const accept = route.request().headers()['accept'] ?? ''
  return accept.includes('vnd.pgrst.object')
}

// ── Patrol API mocks ─────────────────────────────────────────────────────

const MOCK_TYPE = { type_id: 1, type_name: 'クレーン', category: 'crane', locker_slots: 0 }
const MOCK_MODEL = {
  model_id: 'model-001',
  model_name: 'テストモデル',
  type_id: 1,
  out_meter_count: 1,
  meter_unit_price: 100,
}
const MOCK_MACHINE = {
  machine_code: 'TST01-M001',
  machine_name: 'テスト機1',
  store_code: 'TST01',
  type_id: 1,
  model_id: 'model-001',
}
const MOCK_STORE = { store_code: 'TST01', store_name: 'テスト店舗', organization_id: 'test-org' }

/** 前日の巡回記録（today ではない → new_patrol モード + prevIn が設定される）*/
const PREV_READING = {
  reading_id: 'test-reading-prev-001',
  full_booth_code: 'TST-M01-B01',
  in_meter: 50000,
  out_meter: 45000,
  out_meter_2: null,
  out_meter_3: null,
  read_time: '2026-05-03T10:00:00.000Z',
  created_at: '2026-05-03T10:00:00.000Z',
  updated_at: '2026-05-03T10:00:00.000Z',
  patrol_date: '2026-05-03',
  prize_name: 'テスト景品A',
  prize_id: null,
  prize_name_2: null,
  prize_name_3: null,
  prize_cost: null,
  prize_cost_2: null,
  prize_cost_3: null,
  prize_stock_count: 20,
  stock_2: null,
  stock_3: null,
  prize_restock_count: 0,
  restock_2: null,
  restock_3: null,
  set_a: null,
  set_c: null,
  set_l: null,
  set_r: null,
  set_o: null,
  play_price: 100,
  revenue: 500,
  entry_type: 'patrol',
}

/**
 * 巡回入力 API を全てモックする。
 *
 * 注意: Supabase JS v2 の .single()/.maybeSingle() は
 * Accept: application/vnd.pgrst.object+json を送る。
 * このヘッダーを検出してオブジェクト / 配列を切り替える。
 */
export async function setupPatrolMocks(page: Page) {
  // machines: getMachineInfo が .single() で取得
  await page.route('**/rest/v1/machines**', async (route) => {
    const body = isSingleRequest(route) ? MOCK_MACHINE : [MOCK_MACHINE]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.route('**/rest/v1/machine_types**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_TYPE]) })
  })

  await page.route('**/rest/v1/machine_models**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_MODEL]) })
  })

  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_STORE]) })
  })

  // meter_readings:
  // - .single()/.maybeSingle() の GET → 単一オブジェクト（PREV_READING）
  // - 通常 GET → 配列
  // - POST → 保存成功
  await page.route('**/rest/v1/meter_readings**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      const body = isSingleRequest(route) ? PREV_READING : [PREV_READING]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    } else if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ reading_id: 'new-reading-001' }]),
      })
    } else if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ reading_id: PREV_READING.reading_id }]),
      })
    } else {
      await route.continue()
    }
  })

  await page.route('**/rest/v1/audit_logs**', async (route) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })

  await page.route('**/rest/v1/locker_slots**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    }
  })

  await page.route('**/rest/v1/booths**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route('**/rest/v1/glossary_terms**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route('**/rest/v1/prize_masters**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

// ── Route state injection ────────────────────────────────────────────────

export interface TestBooth {
  booth_code: string
  booth_number: number
  machine_id: string
  /** usePatrolForm が getMachineInfo(booth.machine_code) に必要 */
  machine_code: string
}

export interface TestMachine {
  machine_id: string
  machine_code: string
  machine_name: string
  store_code: string
  booths: TestBooth[]
  out_count: number
  category: string
  play_price: number
  machine_lockers: unknown[]
}

export interface PatrolRouteState {
  machines: TestMachine[]
  machine: TestMachine
  booth: TestBooth
  storeCode: string
}

/**
 * 2ブース構成のテスト用巡回データを返す。
 * booth に machine_code を含む点が重要（usePatrolForm 必須）。
 */
export function makePatrolState(): PatrolRouteState {
  const booths: TestBooth[] = [
    { booth_code: 'TST-M01-B01', booth_number: 1, machine_id: 'M-001', machine_code: 'TST01-M001' },
    { booth_code: 'TST-M01-B02', booth_number: 2, machine_id: 'M-001', machine_code: 'TST01-M001' },
  ]
  const machine: TestMachine = {
    machine_id: 'M-001',
    machine_code: 'TST01-M001',
    machine_name: 'テスト機1',
    store_code: 'TST01',
    booths,
    out_count: 1,
    category: 'crane',
    play_price: 100,
    machine_lockers: [],
  }
  return {
    machines: [machine],
    machine,
    booth: booths[0],
    storeCode: 'TST01',
  }
}

/**
 * React Router v7 の state 付きでページをロードする。
 *
 * addInitScript で history.state を先に書き換えることで、
 * React Router が初期化時に正しい state を読み取れるようにする。
 * page.goto() より前に呼ぶこと。
 *
 * idx を省略するのがポイント:
 *   React Router は idx==null の場合に replaceState({ ...state, idx: 0 }) を呼ぶため
 *   usr フィールドが保持される。
 */
export function injectRouteState(
  page: Page,
  path: string,
  state: Record<string, unknown>,
): Promise<void> {
  return page.addInitScript(
    ({ p, s }: { p: string; s: Record<string, unknown> }) => {
      // React Router v7 は history.state.usr にユーザーデータを格納する
      window.history.replaceState({ usr: s, key: 'e2e-test-key' }, '', p)
    },
    { p: path, s: state },
  )
}
