// SPEC-PATROL-SAVE-DERIVE-REVENUE-01
// 派生値(out_diff/in_diff/revenue)の計算とprize_id整合の単体テスト

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSupabase
let _orgId = 'test-org-id'

vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))
vi.mock('../../lib/auth/orgConstants', () => ({
  get DFX_ORG_ID() { return _orgId },
}))
vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))
vi.mock('../../lib/errorCodes', () => ({
  ERR: { METER_001: 'ERR-METER-001', METER_002: 'ERR-METER-002', AUTH_001: 'ERR-AUTH-001' },
}))

const { savePatrolReading } = await import('../../services/patrolCore')

function makeMockSupabase(existingPatrol = null) {
  const inserted = []
  const updated  = []
  function makeChain() {
    const chain = {
      select:      vi.fn(() => chain),
      eq:          vi.fn(() => chain),
      order:       vi.fn(() => chain),
      limit:       vi.fn(() => chain),
      in:          vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: existingPatrol })),
      insert: vi.fn((payload) => {
        inserted.push({ ...payload })
        const sub = {
          select: vi.fn(() => sub),
          single: vi.fn(() =>
            Promise.resolve({ data: { reading_id: payload.reading_id ?? 'mock-id' }, error: null })
          ),
        }
        return sub
      }),
      update: vi.fn((patch) => {
        updated.push({ ...patch })
        return { eq: vi.fn(() => Promise.resolve({ error: null })) }
      }),
    }
    return chain
  }
  return { from: vi.fn(() => makeChain()), _inserted: inserted, _updated: updated }
}

beforeEach(() => {
  _orgId = 'test-org-id'
  mockSupabase = makeMockSupabase()
})

const BASE = {
  boothCode:    'KKY01-B01',
  storeCode:    'KKY01',
  machineCode:  'M01',
  inMeter:      '2000',
  outMeter:     '1500',
  prizeStock:   '100',
  prizeRestock: '0',
  staffId:      'STAFF01',
}

const PREV = {
  in_meter:   1800,
  out_meter:  1300,
  out_meter_2: null,
  out_meter_3: null,
}

// ─── out_diff / in_diff 計算 ─────────────────────────────────

describe('SPEC-PATROL-SAVE-DERIVE-REVENUE-01 out_diff / in_diff', () => {
  it('when_prev_exists_should_compute_out_diff_and_in_diff', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: PREV })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff).toBe(200)    // 1500 - 1300
    expect(row.out_diff_1).toBe(200)
    expect(row.in_diff).toBe(200)     // 2000 - 1800
  })

  it('when_prev_is_null_should_return_null_diffs', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: null })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff).toBeNull()
    expect(row.in_diff).toBeNull()
    expect(row.revenue).toBeNull()
  })

  it('when_negative_diff_meter_rollover_should_save_negative_value', async () => {
    // メーター巻き戻し(入替)→負値はそのまま保存
    await savePatrolReading({
      ...BASE,
      outMeter: '100',
      defaultsFromPrev: { ...PREV, out_meter: 1300 },
    })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff).toBe(-1200)  // 100 - 1300
  })

  it('when_prev_out_meter_is_null_should_return_null_out_diff', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: { in_meter: 1800, out_meter: null } })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff).toBeNull()
  })
})

// ─── revenue 計算 ───────────────────────────────────────────

describe('SPEC-PATROL-SAVE-DERIVE-REVENUE-01 revenue', () => {
  it('when_play_price_set_should_compute_revenue', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: PREV, playPrice: 100 })
    const row = mockSupabase._inserted[0]
    expect(row.revenue).toBe(20000)   // 200 * 100
  })

  it('when_play_price_is_null_should_return_null_revenue', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: PREV, playPrice: null })
    const row = mockSupabase._inserted[0]
    expect(row.revenue).toBeNull()
  })

  it('when_out_diff_is_null_should_return_null_revenue_even_with_price', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: null, playPrice: 200 })
    const row = mockSupabase._inserted[0]
    expect(row.revenue).toBeNull()
  })

  it('when_out_diff_negative_revenue_should_also_be_negative', async () => {
    await savePatrolReading({
      ...BASE,
      outMeter: '100',
      defaultsFromPrev: { ...PREV, out_meter: 1300 },
      playPrice: 100,
    })
    const row = mockSupabase._inserted[0]
    expect(row.revenue).toBe(-120000) // -1200 * 100
  })
})

// ─── 2メータ機 out_diff_2 ───────────────────────────────────

describe('SPEC-PATROL-SAVE-DERIVE-REVENUE-01 2メータ機 out_diff_2', () => {
  it('when_out_meter_2_touched_and_prev_exists_should_compute_out_diff_2', async () => {
    const prev2 = { ...PREV, out_meter_2: 500 }
    await savePatrolReading({
      ...BASE,
      defaultsFromPrev: prev2,
      optionalPatch: { out_meter_2: 620 },
    })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff_2).toBe(120)  // 620 - 500
  })

  it('when_out_meter_2_not_touched_should_return_null_out_diff_2', async () => {
    await savePatrolReading({ ...BASE, defaultsFromPrev: PREV, optionalPatch: {} })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff_2).toBeNull()
  })

  it('when_prev_out_meter_2_is_null_should_return_null_out_diff_2', async () => {
    await savePatrolReading({
      ...BASE,
      defaultsFromPrev: { ...PREV, out_meter_2: null },
      optionalPatch: { out_meter_2: 100 },
    })
    const row = mockSupabase._inserted[0]
    expect(row.out_diff_2).toBeNull()
  })
})

// ─── prize_id / prize_name 整合 ─────────────────────────────

describe('SPEC-PATROL-SAVE-DERIVE-REVENUE-01 prize_id継承', () => {
  it('when_prize_name_not_touched_should_inherit_prev_prize_id', async () => {
    await savePatrolReading({
      ...BASE,
      optionalPatch:    {},
      defaultsFromPrev: { ...PREV, prize_id: 'prev-p1', prize_name: '旧景品' },
    })
    const row = mockSupabase._inserted[0]
    expect(row.prize_id).toBe('prev-p1')
    expect(row.prize_name).toBe('旧景品')
  })

  it('when_prize_name_touched_with_prize_id_should_use_new_prize_id', async () => {
    await savePatrolReading({
      ...BASE,
      optionalPatch:    { prize_name: '新景品', prize_id: 'new-p2' },
      defaultsFromPrev: { ...PREV, prize_id: 'prev-p1', prize_name: '旧景品' },
    })
    const row = mockSupabase._inserted[0]
    expect(row.prize_id).toBe('new-p2')
    expect(row.prize_name).toBe('新景品')
  })

  it('when_prize_name_changed_but_no_prize_id_should_not_inherit_stale_prize_id', async () => {
    // 手打ち入力(autocomplete未選択)→名称変更 prize_id未指定 → stale prize_id引き継がない
    await savePatrolReading({
      ...BASE,
      optionalPatch:    { prize_name: '手打ち景品名' },
      defaultsFromPrev: { ...PREV, prize_id: 'prev-p1', prize_name: '旧景品' },
    })
    const row = mockSupabase._inserted[0]
    expect(row.prize_name).toBe('手打ち景品名')
    expect(row.prize_id).toBeUndefined()  // deleted from defaults → not in INSERT payload
  })
})

// ─── UPDATE経路でも派生値が保存されること ──────────────────

describe('SPEC-PATROL-SAVE-DERIVE-REVENUE-01 UPDATE経路', () => {
  it('when_existing_patrol_and_values_changed_should_include_diff_in_update', async () => {
    const existing = {
      reading_id: 'exist-id', in_meter: 1800, out_meter: 1300,
      prize_stock_count: 100, prize_restock_count: 0,
    }
    mockSupabase = makeMockSupabase(existing)
    await savePatrolReading({
      ...BASE,
      inMeter: '2100',
      defaultsFromPrev: PREV,
      playPrice: 100,
    })
    const upd = mockSupabase._updated[0]
    expect(upd.out_diff).toBe(200)    // 1500 - 1300
    expect(upd.in_diff).toBe(300)     // 2100 - 1800
    expect(upd.revenue).toBe(20000)   // 200 * 100
  })

  it('when_update_prize_name_changed_no_id_should_clear_prize_id', async () => {
    const existing = {
      reading_id: 'exist-id', in_meter: 1800, out_meter: 1300,
      prize_stock_count: 100, prize_restock_count: 0, prize_id: 'old-p1',
    }
    mockSupabase = makeMockSupabase(existing)
    await savePatrolReading({
      ...BASE,
      inMeter: '2100',
      optionalPatch: { prize_name: '新景品' },
      defaultsFromPrev: PREV,
    })
    const upd = mockSupabase._updated[0]
    expect(upd.prize_name).toBe('新景品')
    expect(upd.prize_id).toBeNull()
  })
})
