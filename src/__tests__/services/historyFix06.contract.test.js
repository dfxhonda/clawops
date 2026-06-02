// @vitest-environment happy-dom
// SPEC-LF1-HISTORY-FIX-06: HISTORY_SELECT に store_code + machine_code を含むこと、
// および putBaselineRows → getPatrolRecordsByStore IDB byStoreCode index 経路が
// 動作することを spec-named contract test で固定する。
//
// 背景: DIAG-LF1-HISTORY-RUNTIME-01 で確定した root cause は、HISTORY_SELECT に
// store_code がなく putBaselineRows で IDB に書く時 store_code=undefined に化け、
// byStoreCode index entry が作られず getPatrolRecordsByStore('KOS01') が空配列を
// 返却して全列 '−' になっていた問題。FIX-03 で HISTORY_SELECT に store_code +
// machine_code を追加済 (boothHistory.js:16-20 参照、historyFix02.contract.test.js
// の AC-07 でも assert 済)。本 FIX-06 は spec 指定 test 名で再発防止を二重化する。
//
// 既存 test との関係: historyFix02.contract.test.js の
//   SELECT_string_DOES_contain_store_code_and_machine_code_IDB_index_alignment と
// localStore.test.js の
//   AC_07_putBaselineRows_then_getPatrolRecordsByStore_returns_all_rows_for_store
// が同等内容を assert している。spec C2/C3 で「SPEC_LF1_HISTORY_FIX_06_*」名の
// 専用 test を要求しているため本ファイルで物理化し、いずれの test 名が grep されても
// regression を検出できるよう冗長化する。
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

import { _RAW_HISTORY_SELECT } from '../../services/boothHistory'
import { _resetDb } from '../../lib/localStore/db'
import { putBaselineRows, getPatrolRecordsByStore } from '../../lib/localStore/patrolRecords'

beforeEach(async () => {
  await _resetDb()
})

describe('SPEC-LF1-HISTORY-FIX-06 contract', () => {
  // C2 / AC-03: HISTORY_SELECT に store_code + machine_code が含まれること。
  // この 2 列が落ちると putBaselineRows で IDB に store_code=undefined / machine_code=undefined
  // で書かれ、byStoreCode index entry が作られない → getPatrolRecordsByStore 空配列 →
  // computeLocalStoreView が diffMap={} を返し 4 列全 '−' bug 再発。
  it('SPEC_LF1_HISTORY_FIX_06_store_code_in_projection', () => {
    expect(_RAW_HISTORY_SELECT).toMatch(/\bstore_code\b/)
    expect(_RAW_HISTORY_SELECT).toMatch(/\bmachine_code\b/)
  })

  // C3 / AC-04: putBaselineRows で store_code='KOS01' を含む row を書いた後、
  // getPatrolRecordsByStore('KOS01') が >= 1 行返すこと。
  // IDB byStoreCode index 経路の round-trip 動作 gate。
  it('SPEC_LF1_HISTORY_FIX_06_idb_byStoreCode_lookup_returns_rows', async () => {
    await putBaselineRows([
      {
        reading_id: 'r-fix06-1',
        booth_code: 'KOS01-M01-B01',
        store_code: 'KOS01',
        machine_code: 'KOS01-M01',
        patrol_date: '2026-06-02',
        in_meter: 1500,
        out_meter: 200,
      },
      {
        reading_id: 'r-fix06-2',
        booth_code: 'KOS01-M01-B02',
        store_code: 'KOS01',
        machine_code: 'KOS01-M01',
        patrol_date: '2026-06-02',
        in_meter: 1800,
        out_meter: 300,
      },
    ])
    const got = await getPatrolRecordsByStore('KOS01')
    expect(got.length).toBeGreaterThanOrEqual(1)
    expect(got.every(r => r.store_code === 'KOS01')).toBe(true)
  })
})
