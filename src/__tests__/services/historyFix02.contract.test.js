// SPEC-LF1-HISTORY-FIX-02 AC-07: 'display reads raw meters only, no in_diff column dependency'
// 本テストは history 表示 path が DB の in_diff / out_diff 列に依存しないことを契約として固定する。
// FIX-01 の implementation は既に raw-meter compute path だったが、FIX-02 で formal 化。

import { describe, it, expect } from 'vitest'
import { computeBoothDiffSummary, _RAW_HISTORY_SELECT } from '../../services/boothHistory'
import { computeLocalStoreView } from '../../clawsupport/state/localStoreView'

describe('HISTORY_SELECT contract (AC-07)', () => {
  it('SELECT_string_does_NOT_contain_in_diff_or_out_diff_columns', () => {
    // どのキーワード変形も含まないことを保証 (deprecation 後 DB から in_diff を消しても壊れない)
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
  // DIAG-LF1-HISTORY-RUNTIME-01 で確定した regression を test で固定する。
  it('SELECT_string_DOES_contain_store_code_and_machine_code_IDB_index_alignment', () => {
    // store_code が SELECT に無いと putBaselineRows で IDB に書く時 store_code field が
    // undefined になり、byStoreCode index entry が作られず getPatrolRecordsByStore が
    // 0 件返却する → 全列 '−' bug の根本原因。本 test で再発防止。
    expect(_RAW_HISTORY_SELECT).toMatch(/\bstore_code\b/)
    expect(_RAW_HISTORY_SELECT).toMatch(/\bmachine_code\b/)
  })
})

describe('computeBoothDiffSummary raw-meter compute (AC-01/02/04/07)', () => {
  it('works_when_in_diff_column_is_null_or_missing_on_all_rows', () => {
    // KOS01 のように DB の in_diff が NULL の状況を再現。computeBoothDiffSummary は
    // row.in_diff / row.out_diff を一切読まないので、raw in_meter から正しく計算する。
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 1500, in_diff: null, out_meter: 200, out_diff: null },
      { patrol_date: '2026-05-25', in_meter: 1000, in_diff: null, out_meter: 100, out_diff: null },
      { patrol_date: '2026-05-20', in_meter:  500, in_diff: null, out_meter:  50, out_diff: null },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs).toEqual([null, null, 500, 500])
    expect(s.outDiffs).toEqual([null, null, 50, 100])
  })

  it('works_when_in_diff_column_is_absent_from_row_object', () => {
    // 列自体が無い場合 (LF1-FIX-02 後の DB で in_diff drop された世界) でも壊れない。
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs[3]).toBe(500)
    expect(s.outDiffs[3]).toBe(100)
  })

  it('returned_summary_does_not_propagate_input_in_diff_field', () => {
    // 入力 row に in_diff=999 (誤値) があっても、出力 inDiffs[3] は raw meter 計算結果が勝つ。
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 1500, in_diff: 999 },
      { patrol_date: '2026-05-25', in_meter: 1000, in_diff: 999 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs[3]).toBe(500) // 1500-1000、999 ではない
  })
})

describe('computeLocalStoreView raw-meter compute (AC-08 dedupe + AC-07)', () => {
  it('today_local_supersedes_server_same_date_using_raw_meter', () => {
    // server row 同日 in_meter=1500、local edit 同日 in_meter=1800 (更新後)、
    // 前日 server in_meter=1000。今回 diff = 1800-1000 = 800 が期待値 (local が勝つ)。
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 1500, synced: true,  reading_id: 's' },
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 1800, synced: false, localId: 'l' },
      { booth_code: 'A-1', patrol_date: '2026-05-25', in_meter: 1000, synced: true,  reading_id: 's2' },
    ]
    const { diffMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    expect(diffMap['A-1'].inDiffs[3]).toBe(800)
  })

  it('computes_correctly_when_records_lack_in_diff_field_entirely', () => {
    // DB から in_diff 廃止された世界。raw meter のみで OK。
    const records = [
      { booth_code: 'A-1', patrol_date: '2026-06-02', in_meter: 100, synced: true,  reading_id: 'r1' },
      { booth_code: 'A-1', patrol_date: '2026-05-25', in_meter:  50, synced: true,  reading_id: 'r2' },
      { booth_code: 'A-1', patrol_date: '2026-05-20', in_meter:  20, synced: true,  reading_id: 'r3' },
    ]
    const { diffMap } = computeLocalStoreView(records, { today: '2026-06-02' })
    expect(diffMap['A-1'].inDiffs[3]).toBe(50)
    expect(diffMap['A-1'].inDiffs[2]).toBe(30)
  })
})
