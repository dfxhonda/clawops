// SPEC-STORECARD-PROGRESS-1000ROW-FIX-01: RPC store_patrol_progress metaMap construction
import { describe, it, expect } from 'vitest'

// Mirrors ClawsupportHub load(): build metaMap from store_patrol_progress RPC rows
function buildMetaFromRpc(rpcRows) {
  const metaMap = {}
  for (const row of (rpcRows ?? [])) {
    metaMap[row.store_code] = {
      lastDate: row.last_patrol_date ?? null,
      done: row.done_booths ?? 0,
      total: row.total_booths ?? 0,
    }
  }
  return metaMap
}

describe('SPEC-STORECARD-PROGRESS-1000ROW-FIX-01: RPC metaMap construction', () => {
  it('when_rpc_returns_rows_metaMap_has_correct_values', () => {
    const rpc = [
      { store_code: 'KKY', last_patrol_date: '2026-06-23', done_booths: 7, total_booths: 7 },
      { store_code: 'KSI', last_patrol_date: '2026-06-23', done_booths: 23, total_booths: 23 },
    ]
    const meta = buildMetaFromRpc(rpc)
    expect(meta['KKY']).toEqual({ lastDate: '2026-06-23', done: 7, total: 7 })
    expect(meta['KSI']).toEqual({ lastDate: '2026-06-23', done: 23, total: 23 })
  })

  it('when_rpc_row_last_patrol_date_is_null_meta_lastDate_is_null', () => {
    const rpc = [{ store_code: 'NEW', last_patrol_date: null, done_booths: 0, total_booths: 5 }]
    const meta = buildMetaFromRpc(rpc)
    expect(meta['NEW'].lastDate).toBeNull()
    expect(meta['NEW'].done).toBe(0)
    expect(meta['NEW'].total).toBe(5)
  })

  it('when_rpc_returns_null_metaMap_is_empty', () => {
    expect(buildMetaFromRpc(null)).toEqual({})
  })

  it('when_rpc_returns_empty_array_metaMap_is_empty', () => {
    expect(buildMetaFromRpc([])).toEqual({})
  })

  it('when_store_has_full_patrol_done_equals_total', () => {
    const rpc = [{ store_code: 'KKY', last_patrol_date: '2026-06-23', done_booths: 7, total_booths: 7 }]
    const meta = buildMetaFromRpc(rpc)
    expect(meta['KKY'].done).toBe(meta['KKY'].total)
  })
})
