import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:54321'

// ── 共有モックデータ ──────────────────────────────────────────────────────────

export const MOCK_PREV_READING = {
  reading_id: 'reading-test-001',
  full_booth_code: 'TEST01-M01-B01',
  read_time: '2026-05-04T12:00:00+09:00',
  in_meter: 50000,
  out_meter: 45000,
  out_meter_2: null,
  out_meter_3: null,
  prize_name: 'テスト景品A',
  prize_id: 'prize-001',
  prize_name_2: null,
  prize_name_3: null,
  prize_cost: 120,
  prize_cost_2: null,
  prize_cost_3: null,
  prize_stock_count: null,
  stock_2: null,
  stock_3: null,
}

export const MOCK_MACHINE = {
  machine_code: 'TEST01-M01',
  machine_name: 'テスト機1',
  store_code: 'TEST01',
  type_id: 'type-crane',
  model_id: 'model-crane-std',
}

export const MOCK_MACHINE_TYPES = [
  {
    type_id: 'type-crane',
    type_name: 'クレーン',
    category: 'crane',
    locker_slots: 0,
    manufacturer: null,
    booth_count: 2,
    meter_count: 2,
    meter_unit_price: null,
    notes: null,
  },
  {
    type_id: 'type-gacha',
    type_name: 'ガチャ',
    category: 'gacha',
    locker_slots: 0,
    manufacturer: null,
    booth_count: 1,
    meter_count: 3,
    meter_unit_price: null,
    notes: null,
  },
]

export const MOCK_MACHINE_MODELS = [
  {
    model_id: 'model-crane-std',
    model_name: 'スタンダードクレーン',
    type_id: 'type-crane',
    manufacturer: null,
    booth_count: 2,
    in_meter_count: 1,
    out_meter_count: 1,
    meter_unit_price: 100,
    size_info: null,
    weight_kg: null,
    power_w: null,
    image_url: null,
    notes: null,
  },
]

export const MOCK_STORES = [
  {
    store_code: 'TEST01',
    store_name: 'テスト店舗',
    is_active: true,
  },
]

export const MOCK_PRIZES = [
  { prize_id: 'prize-001', prize_name: 'テスト景品A', original_cost: 120, category: 'figure' },
  { prize_id: 'prize-002', prize_name: 'テスト景品B', original_cost: 200, category: 'plush' },
]

// ── MSW ハンドラー ─────────────────────────────────────────────────────────────
// Supabase REST API は Accept: application/vnd.pgrst.object+json のときに
// .single() / .maybeSingle() が使われる（単一オブジェクト返却が期待される）

function isSingle(req) {
  return (req.headers.get('Accept') ?? '').includes('pgrst.object')
}

export const handlers = [
  // meter_readings — getLastReadingV2 (.single())
  http.get(`${BASE}/rest/v1/meter_readings`, ({ request }) => {
    if (isSingle(request)) return HttpResponse.json(MOCK_PREV_READING)
    return HttpResponse.json([MOCK_PREV_READING])
  }),

  // machines — getMachineInfo (.single())
  http.get(`${BASE}/rest/v1/machines`, ({ request }) => {
    if (isSingle(request)) return HttpResponse.json(MOCK_MACHINE)
    return HttpResponse.json([MOCK_MACHINE])
  }),

  // machine_types — getMachineTypes (array)
  http.get(`${BASE}/rest/v1/machine_types`, () => {
    return HttpResponse.json(MOCK_MACHINE_TYPES)
  }),

  // machine_models — getMachineModels (array)
  http.get(`${BASE}/rest/v1/machine_models`, () => {
    return HttpResponse.json(MOCK_MACHINE_MODELS)
  }),

  // stores — getStores (array)
  http.get(`${BASE}/rest/v1/stores`, () => {
    return HttpResponse.json(MOCK_STORES)
  }),

  // prize_masters — getPrizeMasters (array)
  http.get(`${BASE}/rest/v1/prize_masters`, () => {
    return HttpResponse.json(MOCK_PRIZES)
  }),

  // Edge Function: OCR
  http.post(`${BASE}/functions/v1/ocr-meter`, () => {
    return HttpResponse.json({
      left_in: 50000,
      left_out: 45000,
      right_in: null,
      right_out: null,
    })
  }),
]
