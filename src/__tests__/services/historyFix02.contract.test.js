// SPEC-LF1-HISTORY-FIX-02 AC-07: 'display reads raw meters only, no in_diff column dependency'
// 本テストは history 表示 path が DB の in_diff / out_diff 列に依存しないことを契約として固定する。
// SPEC-PATROL-HISTORY-HEATMAP-01: 4→10列拡張に伴い index 3→9、LIMIT 9→11 へ更新。

import { describe, it, expect, vi } from 'vitest'
import {
  computeBoothDiffSummary,
  _RAW_HISTORY_SELECT,
  STORE_BASELINE_LIMIT_PER_BOOTH,
  fetchStoreBaselineRows,
} from '../../services/boothHistory'
import { computeLocalStoreView } from '../../clawsupport/state/localStoreView'
import { supabase } from '../../lib/supabase'

describe('HISTORY_SELECT contract (AC-07)', () => {
  it('SELECT_string_does_NOT_contain_in_diff_or_out_diff_columns', () => {
    expect(_RAW_HISTORY_SELECT).not.toMatch(/\bin_diff\b/)
    expect(_RAW_HISTORY_SELECT).not.toMatch(/\bout_diff\b/)
    expect(_RAW_HISTORY_SELECT).not.toMatch(/\bout_diff_1\b/)
    expect(_RAW_HISTORY_SELECT).not.toMatch(/\bout_diff_2\b/)
    expect(_RAW_HISTORY_SELECT).not.toMatch(/\bout_diff_3\b/)
    expect(_RAW_HISTORY_SELECT).not.toMatch(/\brevenue\b/)
  })

  it('SELECT_string_DOES_contain_raw_meter_columns', () => {
    expect(_RAW_HISTORY_SELECT).toMatch(/\bin_meter\b/)
    expect(_RAW_HISTORY_SELECT).toMatch(/\bout_meter\b/)
    expect(_RAW_HISTORY_SELECT).toMatch(/\bpatrol_date\b/)
    expect(_RAW_HISTORY_SELECT).toMatch(/\bcreated_at\b/)
  })

  // SPEC-LF1-HISTORY-FIX-03 AC-07: 'store_code+machine_code PRESENT'
  it('SELECT_string_DOES_contain_store_code_and_machine_code_IDB_index_alignment', () => {
    expect(_RAW_HISTORY_SELECT).toMatch(/\bstore_code\b/)
    expect(_RAW_HISTORY_SELECT).toMatch(/\bmachine_code\b/)
  })

  // SPEC-PATROL-HISTORY-HEATMAP-01: LIMIT 11 = today + prev1..prev10 (10 隣接対 diff)
  it('SPEC_PATROL_HISTORY_HEATMAP_01_STORE_BASELINE_LIMIT_PER_BOOTH_equals_11', () => {
    expect(STORE_BASELINE_LIMIT_PER_BOOTH).toBe(11)
  })

  // SPEC-LF1-HISTORY-FIX-05 AC-03: fetchStoreBaselineRows は entry_type='patrol' のみを返す。
  it('SPEC_LF1_HISTORY_FIX_05_entry_type_patrol_only', async () => {
    const eqCalls = []
    const fakeChain = {
      select: vi.fn().mockReturnThis(),
      in:     vi.fn().mockReturnThis(),
      eq:     vi.fn(function (col, val) { eqCalls.push([col, val]); return this }),
      order:  vi.fn().mockReturnThis(),
      then:   undefined,
    }
    fakeChain.order.mockReturnValueOnce(fakeChain)
    fakeChain.order.mockResolvedValueOnce({
      data: [
        { reading_id: 'p1', booth_code: 'A-1', entry_type: 'patrol',  patrol_date: '2026-06-02', in_meter: 1500 },
        { reading_id: 'p2', booth_code: 'A-1', entry_type: 'patrol',  patrol_date: '2026-05-25', in_meter: 1000 },
      ],
      error: null,
    })
    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue(fakeChain)
    try {
      const result = await fetchStoreBaselineRows(['A-1'])
      expect(eqCalls).toContainEqual(['entry_type', 'patrol'])
      expect(result.length).toBeGreaterThan(0)
      expect(result.every(r => r.entry_type === 'patrol')).toBe(true)
    } finally {
      fromSpy.mockRestore()
    }
  })
})

describe('computeBoothDiffSummary raw-meter compute (AC-01/02/04/07)', () => {
  it('works_when_in_diff_column_is_null_or_missing_on_all_rows', () => {
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 1500, in_diff: null, out_meter: 200, out_diff: null },
      { patrol_date: '2026-05-25', in_meter: 1000, in_diff: null, out_meter: 100, out_diff: null },
      { patrol_date: '2026-05-20', in_meter:  500, in_diff: null, out_meter:  50, out_diff: null },
    ]
    const s = computeBoothDiffSummary(rows)
    // 3 rows → 2 diffs at indices 8 and 9
    expect(s.inDiffs[9]).toBe(500)
    expect(s.inDiffs[8]).toBe(500)
    expect(s.outDiffs[9]).toBe(100)
    expect(s.outDiffs[8]).toBe(50)
  })

  it('works_when_in_diff_column_is_absent_from_row_object', () => {
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100 },
    ]
    const s = computeBoothDiffSummary(rows)
    // 2 rows → 1 diff at index 9 (newest)
    expect(s.inDiffs[9]).toBe(500)
    expect(s.outDiffs[9]).toBe(100)
  })

  it('returned_summary_does_not_propagate_input_in_diff_field', () => {
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 1500, in_diff: 999 },
      { patrol_date: '2026-05-25', in_meter: 1000, in_diff: 999 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs[9]).toBe(500) // 1500-1000、999 ではない
  })
})

describe('computeLocalStoreView raw-meter compute (AC-08 dedupe + AC-07)', () => {
  it('today_local_supersedes_server_same_date_using_raw_meter', () => {
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 1500, synced: true,  reading_id: 's' },
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 1800, synced: false, localId: 'l' },
      { booth_code: 'A-1', patrol_date: '2026-05-25', in_meter: 1000, synced: true,  reading_id: 's2' },
    ]
    const { diffMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    // newest diff at index 9
    expect(diffMap['A-1'].inDiffs[9]).toBe(800)
  })

  it('computes_correctly_when_records_lack_in_diff_field_entirely', () => {
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 100, synced: true,  reading_id: 'r1' },
      { booth_code: 'A-1', patrol_date: '2026-05-25', in_meter:  50, synced: true,  reading_id: 'r2' },
      { booth_code: 'A-1', patrol_date: '2026-05-20', in_meter:  20, synced: true,  reading_id: 'r3' },
    ]
    const { diffMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    // 3 rows → 2 diffs: index 9=50, index 8=30
    expect(diffMap['A-1'].inDiffs[9]).toBe(50)
    expect(diffMap['A-1'].inDiffs[8]).toBe(30)
  })
})
