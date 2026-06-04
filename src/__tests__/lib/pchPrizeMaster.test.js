// SPEC-PCH-PRIZE-MASTER-LINK-01: ensurePrizeMaster / lookupExistingPrizeMasterIds /
// parsePrizeIdSeq / formatPrizeId の純粋 + 統合ロジック検証。
// supabase は per-test chain mock で差し替える。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => {
  // 各 from() 呼び出しを per-test で差し替えられるよう、ファクトリ参照を保持する。
  return {
    supabase: {
      from: (...args) => globalThis.__pchPmSupabaseFrom(...args),
    },
  }
})

const {
  ensurePrizeMaster,
  lookupExistingPrizeMasterIds,
  parsePrizeIdSeq,
  formatPrizeId,
  SUPPLIER_ID,
  SUPPLIER_NAME,
  PRIZE_MASTER_ORG_ID,
  PRIZE_MASTER_NEW_PHASE,
  PRIZE_MASTER_REG_BY,
} = await import('../../admin/lib/pchImport')

beforeEach(() => {
  globalThis.__pchPmSupabaseFrom = () => { throw new Error('supabase.from not mocked for this test') }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parsePrizeIdSeq / formatPrizeId', () => {
  it('parsePrizeIdSeq_extracts_numeric_part', () => {
    expect(parsePrizeIdSeq('PZ-00001')).toBe(1)
    expect(parsePrizeIdSeq('PZ-02355')).toBe(2355)
    expect(parsePrizeIdSeq('PZ-99999')).toBe(99999)
  })
  it('parsePrizeIdSeq_returns_null_for_invalid_format', () => {
    expect(parsePrizeIdSeq('FOO-001')).toBeNull()
    expect(parsePrizeIdSeq('PZ-')).toBeNull()
    expect(parsePrizeIdSeq('')).toBeNull()
    expect(parsePrizeIdSeq(null)).toBeNull()
    expect(parsePrizeIdSeq(undefined)).toBeNull()
  })
  it('formatPrizeId_pads_to_5_digits', () => {
    expect(formatPrizeId(1)).toBe('PZ-00001')
    expect(formatPrizeId(2355)).toBe('PZ-02355')
    expect(formatPrizeId(99999)).toBe('PZ-99999')
  })
  it('roundtrip_parse_format_identity', () => {
    for (const n of [1, 42, 2355, 9999]) {
      expect(parsePrizeIdSeq(formatPrizeId(n))).toBe(n)
    }
  })
})

describe('ensurePrizeMaster (キャッシュ + DB lookup + INSERT)', () => {
  it('cache_hit_returns_prize_id_and_triggers_original_cost_update', async () => {
    // SPEC-PCH-ORIGINAL-COST-SYNC-01: cache hit でも unitCost!=null なら UPDATE 発火。
    const updates = []
    globalThis.__pchPmSupabaseFrom = (table) => ({
      update: (payload) => ({
        eq: async (col, val) => { updates.push({ table, payload, col, val }); return { error: null } },
      }),
    })
    const ctx = { cache: new Map([['ピカチュウぬいぐるみ', 'PZ-00100']]), nextSeq: { value: 999 } }
    const r = await ensurePrizeMaster('ピカチュウぬいぐるみ', 500, ctx)
    expect(r).toEqual({ prizeId: 'PZ-00100', isNew: false })
    expect(ctx.nextSeq.value).toBe(999)
    expect(updates).toEqual([
      { table: 'prize_masters', payload: { original_cost: 500 }, col: 'prize_id', val: 'PZ-00100' },
    ])
  })

  it('cache_hit_with_null_unit_cost_skips_update', async () => {
    // SPEC-PCH-ORIGINAL-COST-SYNC-01 AC-02: unit_cost=null は UPDATE しない。
    const fromSpy = vi.fn()
    globalThis.__pchPmSupabaseFrom = fromSpy
    const ctx = { cache: new Map([['名前', 'PZ-00500']]), nextSeq: { value: 0 } }
    const r = await ensurePrizeMaster('名前', null, ctx)
    expect(r).toEqual({ prizeId: 'PZ-00500', isNew: false })
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('cache_miss_db_hit_returns_existing_caches_and_updates_original_cost', async () => {
    // SPEC-PCH-ORIGINAL-COST-SYNC-01 AC-01: DB hit 分岐でも UPDATE 発火。
    const calls = []
    const updates = []
    globalThis.__pchPmSupabaseFrom = (table) => {
      calls.push(table)
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { prize_id: 'PZ-01234' }, error: null }),
          }),
        }),
        update: (payload) => ({
          eq: async (col, val) => { updates.push({ payload, col, val }); return { error: null } },
        }),
      }
    }
    const ctx = { cache: new Map(), nextSeq: { value: 2355 } }
    const r = await ensurePrizeMaster('ドラえもんフィギュア', 800, ctx)
    expect(r).toEqual({ prizeId: 'PZ-01234', isNew: false })
    expect(ctx.cache.get('ドラえもんフィギュア')).toBe('PZ-01234')
    expect(ctx.nextSeq.value).toBe(2355)  // 未インクリメント
    expect(calls).toEqual(['prize_masters', 'prize_masters'])  // select + update
    expect(updates).toEqual([
      { payload: { original_cost: 800 }, col: 'prize_id', val: 'PZ-01234' },
    ])
  })

  it('cache_miss_db_hit_with_null_unit_cost_skips_update', async () => {
    // SPEC-PCH-ORIGINAL-COST-SYNC-01 AC-02: DB hit + unit_cost=null も UPDATE skip。
    const calls = []
    globalThis.__pchPmSupabaseFrom = (table) => {
      calls.push(table)
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { prize_id: 'PZ-09999' }, error: null }),
          }),
        }),
      }
    }
    const ctx = { cache: new Map(), nextSeq: { value: 0 } }
    const r = await ensurePrizeMaster('既存', null, ctx)
    expect(r).toEqual({ prizeId: 'PZ-09999', isNew: false })
    expect(calls).toEqual(['prize_masters'])  // select のみ
  })

  it('cache_miss_db_hit_update_error_is_warned_not_thrown', async () => {
    // SPEC-PCH-ORIGINAL-COST-SYNC-01 spec note: UPDATE エラーは throw せず console.warn で続行。
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.__pchPmSupabaseFrom = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { prize_id: 'PZ-04567' }, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: { message: 'simulated RLS violation' } }),
      }),
    })
    const ctx = { cache: new Map(), nextSeq: { value: 0 } }
    const r = await ensurePrizeMaster('エラー景品', 1500, ctx)
    expect(r).toEqual({ prizeId: 'PZ-04567', isNew: false })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('PZ-04567')
    expect(warnSpy.mock.calls[0][0]).toContain('simulated RLS violation')
  })

  it('cache_miss_db_miss_inserts_new_with_correct_payload_and_increments_seq', async () => {
    const inserted = []
    globalThis.__pchPmSupabaseFrom = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: async (payload) => { inserted.push(payload); return { error: null } },
    })
    const ctx = { cache: new Map(), nextSeq: { value: 2355 } }
    const r = await ensurePrizeMaster('NEWアイテム', 1200, ctx)
    expect(r).toEqual({ prizeId: 'PZ-02356', isNew: true })
    expect(ctx.cache.get('NEWアイテム')).toBe('PZ-02356')
    expect(ctx.nextSeq.value).toBe(2356)
    expect(inserted.length).toBe(1)
    expect(inserted[0]).toMatchObject({
      prize_id: 'PZ-02356',
      prize_name: 'NEWアイテム',
      supplier_id: SUPPLIER_ID,
      supplier_name: SUPPLIER_NAME,
      original_cost: 1200,
      phase: PRIZE_MASTER_NEW_PHASE,
      organization_id: PRIZE_MASTER_ORG_ID,
      registered_by: PRIZE_MASTER_REG_BY,
    })
  })

  it('same_name_called_twice_in_session_uses_cache_for_second_call', async () => {
    // SPEC-PCH-ORIGINAL-COST-SYNC-01: 2 回目は cache hit、DB lookup は増えないが
    // UPDATE は発火する (unitCost!=null のため)。
    let dbCalls = 0
    globalThis.__pchPmSupabaseFrom = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => { dbCalls++; return { data: null, error: null } },
        }),
      }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    })
    const ctx = { cache: new Map(), nextSeq: { value: 2355 } }
    await ensurePrizeMaster('重複アイテム', 100, ctx)
    expect(ctx.nextSeq.value).toBe(2356)
    const r2 = await ensurePrizeMaster('重複アイテム', 100, ctx)
    // 2 回目は cache hit、DB call 増えない、seq インクリメントなし
    expect(r2).toEqual({ prizeId: 'PZ-02356', isNew: false })
    expect(dbCalls).toBe(1)
    expect(ctx.nextSeq.value).toBe(2356)
  })

  it('null_name_returns_null_without_db_call', async () => {
    const fromSpy = vi.fn()
    globalThis.__pchPmSupabaseFrom = fromSpy
    const ctx = { cache: new Map(), nextSeq: { value: 0 } }
    const r = await ensurePrizeMaster(null, 0, ctx)
    expect(r).toEqual({ prizeId: null, isNew: false })
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('lookupExistingPrizeMasterIds (bulk preview lookup)', () => {
  it('returns_map_of_name_to_prize_id_for_existing', async () => {
    globalThis.__pchPmSupabaseFrom = () => ({
      select: () => ({
        in: async () => ({
          data: [
            { prize_name: 'A', prize_id: 'PZ-00001' },
            { prize_name: 'B', prize_id: 'PZ-00002' },
          ],
          error: null,
        }),
      }),
    })
    const map = await lookupExistingPrizeMasterIds(['A', 'B', 'C'])
    expect(map.get('A')).toBe('PZ-00001')
    expect(map.get('B')).toBe('PZ-00002')
    expect(map.has('C')).toBe(false)  // 未登録は不在
  })

  it('returns_empty_map_for_empty_input_without_db_call', async () => {
    const fromSpy = vi.fn()
    globalThis.__pchPmSupabaseFrom = fromSpy
    const map = await lookupExistingPrizeMasterIds([])
    expect(map.size).toBe(0)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('deduplicates_input_before_db_call', async () => {
    let received = null
    globalThis.__pchPmSupabaseFrom = () => ({
      select: () => ({
        in: async (...args) => {
          received = args
          return { data: [], error: null }
        },
      }),
    })
    await lookupExistingPrizeMasterIds(['A', 'A', 'B', 'A'])
    // .in('prize_name', dedupedNames) で重複排除済 input
    expect(received[1].sort()).toEqual(['A', 'B'])
  })
})
