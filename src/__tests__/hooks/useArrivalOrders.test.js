// @vitest-environment happy-dom
// J-STOCK-OWNER-FILTER-01: useArrivalOrders の locationId eq + textFilter ilike 併用検証
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useArrivalOrders } from '../../hooks/useArrivalOrders'

// 各クエリチェーン呼び出しを記録する mock。同じインスタンスから select/in/gte/lt/eq/ilike/order が連鎖。
const calls = []
function makeBuilder(label) {
  const builder = {
    _label: label,
    _eqCalls: [],
    _ilikeCalls: [],
    _orCalls: [],
    select() { return builder },
    in() { return builder },
    gte() { return builder },
    lt() { return builder },
    or(cond) { builder._orCalls.push(cond); return builder },
    eq(col, val) { builder._eqCalls.push([col, val]); return builder },
    ilike(col, val) { builder._ilikeCalls.push([col, val]); return builder },
    order() { return builder },
    then(resolve) {
      calls.push({ label, eq: [...builder._eqCalls], ilike: [...builder._ilikeCalls], or: [...builder._orCalls] })
      return Promise.resolve({ data: [] }).then(resolve)
    },
  }
  return builder
}

let nextLabel = 0
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => makeBuilder(`q${++nextLabel}`),
  },
}))

beforeEach(() => {
  calls.length = 0
  nextLabel = 0
})

describe('useArrivalOrders', () => {
  it('when_locationId_provided_should_apply_eq_to_all_3_lanes', async () => {
    const { result } = renderHook(() => useArrivalOrders('WH-001'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toHaveLength(3)
    for (const c of calls) {
      expect(c.eq).toEqual([['location_id', 'WH-001']])
      expect(c.ilike).toEqual([])
    }
  })

  it('when_textFilter_provided_should_apply_ilike_destination_to_all_3_lanes', async () => {
    const { result } = renderHook(() => useArrivalOrders(null, 'ガチャ'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toHaveLength(3)
    for (const c of calls) {
      expect(c.eq).toEqual([])
      expect(c.ilike).toEqual([['destination', '%ガチャ%']])
    }
  })

  it('when_both_locationId_and_textFilter_should_apply_eq_and_ilike_together', async () => {
    const { result } = renderHook(() => useArrivalOrders('WH-002', 'カプセル'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toHaveLength(3)
    for (const c of calls) {
      expect(c.eq).toEqual([['location_id', 'WH-002']])
      expect(c.ilike).toEqual([['destination', '%カプセル%']])
    }
  })

  it('when_no_filters_should_apply_neither_eq_nor_ilike', async () => {
    const { result } = renderHook(() => useArrivalOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toHaveLength(3)
    for (const c of calls) {
      expect(c.eq).toEqual([])
      expect(c.ilike).toEqual([])
    }
  })

  it('when_locationId_empty_string_should_treat_as_no_filter', async () => {
    const { result } = renderHook(() => useArrivalOrders(''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    for (const c of calls) {
      expect(c.eq).toEqual([])
    }
  })

  it('returns_lanes_with_3_keys_after_load', async () => {
    const { result } = renderHook(() => useArrivalOrders('WH-001'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lanes).toEqual({ upcoming: [], youkakunin: [], recent: [] })
  })

  it('when_youkakunin_query_should_use_or_condition_for_null_and_past_dates', async () => {
    const { result } = renderHook(() => useArrivalOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    // q2 = youkakunin (2nd query)
    const q2 = calls[1]
    expect(q2.or).toHaveLength(1)
    expect(q2.or[0]).toMatch(/expected_date\.lt\./)
    expect(q2.or[0]).toContain('expected_date.is.null')
  })

  it('when_youkakunin_query_should_not_have_overdue_key_in_lanes', async () => {
    const { result } = renderHook(() => useArrivalOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lanes).not.toHaveProperty('overdue')
    expect(result.current.lanes).toHaveProperty('youkakunin')
  })
})
