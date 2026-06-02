// SPEC-LF1-STORE-LOCAL-CACHE-01: IDB raw records → diffMap/todayMap 派生のピュア関数検証
import { describe, it, expect } from 'vitest'
import { computeLocalStoreView } from '../../clawsupport/state/localStoreView'

describe('computeLocalStoreView', () => {
  it('groups_by_booth_and_sorts_newest_first_for_summary', () => {
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-01', in_meter: 1000, created_at: 't1' },
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 1500, created_at: 't2' },
      { booth_code: 'A-1', patrol_date: '2026-05-25', in_meter:  500, created_at: 't0' },
    ]
    const { diffMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    // 5 days と 7 days の交互間隔。今回 = 500 (06-02 - 06-01)、前回 = 500 (06-01 - 05-25)
    expect(diffMap['A-1'].inDiffs[3]).toBe(500)
    expect(diffMap['A-1'].inDiffs[2]).toBe(500)
  })

  it('todayMap_includes_booth_with_record_on_today_jst', () => {
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 100, reading_id: 'r1', read_time: 't1' },
      { booth_code: 'A-2', patrol_date: '2026-06-01', in_meter: 100, reading_id: 'r2', read_time: 't2' },
    ]
    const { todayMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    expect(todayMap['A-1']).toBeTruthy()
    expect(todayMap['A-1'].readingId).toBe('r1')
    expect(todayMap['A-2']).toBeUndefined()
  })

  it('null_records_returns_empty_maps', () => {
    expect(computeLocalStoreView(null)).toEqual({ diffMap: {}, todayMap: {} })
    expect(computeLocalStoreView([])).toEqual({ diffMap: {}, todayMap: {} })
  })

  it('booth_with_only_one_record_returns_no_summary_but_today_entry_if_applicable', () => {
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 100, reading_id: 'r1', read_time: 't1' },
    ]
    const { diffMap, todayMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    expect(diffMap['A-1']).toBeUndefined() // 1 件では summary 計算不可
    expect(todayMap['A-1']).toBeTruthy()
  })
})
