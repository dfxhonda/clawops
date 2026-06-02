// @vitest-environment happy-dom
// SPEC-STOCK-ANNOUNCEMENTS-01: announcements service の純粋ロジック検証。
// Supabase chain は mock、ネット非依存テスト (CLAUDE.md テスト方針 4)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../lib/supabase'
import {
  fetchNewAnnouncements,
  fetchFavoriteAnnouncements,
  addFavorite,
  removeFavorite,
  _SELECT_COLS,
} from '../../services/announcements'

// chain builder: 各 method はチェイン用に this を返し、終端 (.maybeSingle / await 等) で結果返却。
function makeChain(finalResult) {
  const chain = {
    _calls: [],
    select: vi.fn(function (s) { chain._calls.push(['select', s]); return this }),
    eq:     vi.fn(function (c, v) { chain._calls.push(['eq', c, v]); return this }),
    not:    vi.fn(function (c, op, v) { chain._calls.push(['not', c, op, v]); return this }),
    in:     vi.fn(function (c, vs) { chain._calls.push(['in', c, vs]); return this }),
    order:  vi.fn(function (c, opts) { chain._calls.push(['order', c, opts]); return this }),
    limit:  vi.fn(function (n) { chain._calls.push(['limit', n]); return this }),
    update: vi.fn(function (p) { chain._calls.push(['update', p]); return this }),
    maybeSingle: vi.fn(async () => finalResult),
    then: (onFulfilled) => Promise.resolve(finalResult).then(onFulfilled),
  }
  return chain
}

let fromSpy

beforeEach(() => {
  fromSpy = vi.spyOn(supabase, 'from')
})

afterEach(() => {
  fromSpy?.mockRestore()
  vi.restoreAllMocks()
})

describe('SPEC-STOCK-ANNOUNCEMENTS-01 announcements service', () => {
  it('SELECT_cols_include_favorite_fields', () => {
    expect(_SELECT_COLS).toMatch(/\bfavorited_by\b/)
    expect(_SELECT_COLS).toMatch(/\bfavorite_memo\b/)
    expect(_SELECT_COLS).toMatch(/\bfavorited_at\b/)
    expect(_SELECT_COLS).toMatch(/\bsupplier_id\b/)
    expect(_SELECT_COLS).toMatch(/\bunit_cost\b/)
    expect(_SELECT_COLS).toMatch(/\bcase_quantity\b/)
  })

  it('fetchNewAnnouncements_orders_by_created_at_desc_no_supplier_filter_for_all', async () => {
    const rows = [{ id: 1, prize_name: 'A' }, { id: 2, prize_name: 'B' }]
    const chain = makeChain({ data: rows, error: null })
    fromSpy.mockReturnValue(chain)
    const got = await fetchNewAnnouncements({ supplierId: 'all' })
    expect(got).toEqual(rows)
    expect(chain._calls).toContainEqual(['order', 'created_at', { ascending: false, nullsFirst: false }])
    // supplier=all のとき eq('supplier_id') は呼ばれない
    expect(chain._calls.find(c => c[0] === 'eq' && c[1] === 'supplier_id')).toBeUndefined()
  })

  it('fetchNewAnnouncements_filters_by_supplier_when_specified', async () => {
    const chain = makeChain({ data: [], error: null })
    fromSpy.mockReturnValue(chain)
    await fetchNewAnnouncements({ supplierId: 'SDY' })
    expect(chain._calls).toContainEqual(['eq', 'supplier_id', 'SDY'])
  })

  it('fetchFavoriteAnnouncements_filters_non_empty_array_and_sorts_by_favorited_at', async () => {
    const chain = makeChain({ data: [{ id: 9 }], error: null })
    fromSpy.mockReturnValue(chain)
    const got = await fetchFavoriteAnnouncements()
    expect(got).toEqual([{ id: 9 }])
    expect(chain._calls).toContainEqual(['not', 'favorited_by', 'eq', '{}'])
    expect(chain._calls).toContainEqual(['order', 'favorited_at', { ascending: false, nullsFirst: false }])
  })

  it('addFavorite_appends_staffId_to_array_without_duplication', async () => {
    // 1 回目 select → 既存配列、2 回目 update → 結果返却
    const readChain = makeChain({ data: { favorited_by: ['s1'] }, error: null })
    const writeChain = makeChain({ data: { id: 5, favorited_by: ['s1', 's2'] }, error: null })
    fromSpy.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)
    const r = await addFavorite({ id: 5, staffId: 's2', memo: 'test memo' })
    expect(r).toEqual({ id: 5, favorited_by: ['s1', 's2'] })
    const updateCall = writeChain._calls.find(c => c[0] === 'update')
    expect(updateCall[1].favorited_by).toEqual(['s1', 's2'])
    expect(updateCall[1].favorite_memo).toBe('test memo')
    expect(updateCall[1].favorited_at).toBeTruthy()  // ISO string
  })

  it('addFavorite_does_not_duplicate_when_staffId_already_in_array', async () => {
    const readChain = makeChain({ data: { favorited_by: ['s1', 's2'] }, error: null })
    const writeChain = makeChain({ data: { id: 5, favorited_by: ['s1', 's2'] }, error: null })
    fromSpy.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)
    await addFavorite({ id: 5, staffId: 's2', memo: null })
    const updateCall = writeChain._calls.find(c => c[0] === 'update')
    expect(updateCall[1].favorited_by).toEqual(['s1', 's2'])
  })

  it('removeFavorite_drops_staffId_and_clears_favorited_at_when_zero_left', async () => {
    const readChain = makeChain({ data: { favorited_by: ['s2'], favorite_memo: 'm' }, error: null })
    const writeChain = makeChain({ data: { id: 5, favorited_by: [] }, error: null })
    fromSpy.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)
    await removeFavorite({ id: 5, staffId: 's2' })
    const updateCall = writeChain._calls.find(c => c[0] === 'update')
    expect(updateCall[1].favorited_by).toEqual([])
    expect(updateCall[1].favorited_at).toBeNull()
  })

  it('removeFavorite_keeps_favorited_at_when_others_remain', async () => {
    const readChain = makeChain({ data: { favorited_by: ['s1', 's2'] }, error: null })
    const writeChain = makeChain({ data: { id: 5, favorited_by: ['s1'] }, error: null })
    fromSpy.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)
    await removeFavorite({ id: 5, staffId: 's2' })
    const updateCall = writeChain._calls.find(c => c[0] === 'update')
    expect(updateCall[1].favorited_by).toEqual(['s1'])
    // 残数 > 0 のときは favorited_at を update payload に含めない
    expect('favorited_at' in updateCall[1]).toBe(false)
  })

  it('addFavorite_returns_null_when_id_or_staffId_missing', async () => {
    expect(await addFavorite({ id: null, staffId: 's1' })).toBeNull()
    expect(await addFavorite({ id: 5, staffId: null })).toBeNull()
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('removeFavorite_returns_null_when_id_or_staffId_missing', async () => {
    expect(await removeFavorite({ id: null, staffId: 's1' })).toBeNull()
    expect(await removeFavorite({ id: 5, staffId: null })).toBeNull()
    expect(fromSpy).not.toHaveBeenCalled()
  })
})
