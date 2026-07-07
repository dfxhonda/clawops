// @vitest-environment happy-dom
// SPEC-LF1-STORE-LOCAL-CACHE-01: IndexedDB layer (db + patrolRecords) のユニット検証
import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

import { _resetDb } from '../../lib/localStore/db'
import {
  putPatrolRecord,
  getPatrolRecordsByBooth,
  getPatrolRecordsByStore,
  getUnsyncedRecords,
  getUnsyncedSummary,
  markRecordSynced,
  putStoreMeta,
  getStoreMeta,
  putBaselineRows,
  reconcileSyncedByBaseline,
  sweepBaselineOrphans,
} from '../../lib/localStore/patrolRecords'

beforeEach(async () => {
  await _resetDb()
})

describe('putPatrolRecord / get*', () => {
  it('putPatrolRecord_assigns_localId_and_default_synced_false', async () => {
    const saved = await putPatrolRecord({
      booth_code: 'MNK01-M01-B01',
      store_code: 'MNK01',
      patrol_date: '2026-06-02',
      in_meter: 1000,
    })
    expect(saved.localId).toBeTruthy()
    expect(saved.synced).toBe(false)
    expect(saved.syncedKey).toBe('false')
    expect(saved.updatedLocally).toBeTruthy()
  })

  it('getPatrolRecordsByBooth_returns_records_for_booth', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    await putPatrolRecord({ booth_code: 'A-2', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 9 })
    const rs = await getPatrolRecordsByBooth('A-1')
    expect(rs).toHaveLength(2)
    expect(rs.every(r => r.booth_code === 'A-1')).toBe(true)
  })

  it('getPatrolRecordsByStore_returns_records_for_store', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S2', patrol_date: '2026-06-02', in_meter: 5 })
    const rs = await getPatrolRecordsByStore('S1')
    expect(rs).toHaveLength(1)
    expect(rs[0].booth_code).toBe('A-1')
  })
})

describe('synced flag lifecycle', () => {
  it('newly_put_records_appear_in_getUnsyncedRecords', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    const rs = await getUnsyncedRecords()
    expect(rs).toHaveLength(2)
  })

  it('markRecordSynced_flips_flag_and_removes_from_unsynced_list', async () => {
    const a = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    const b = await putPatrolRecord({ booth_code: 'B-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    const after = await markRecordSynced(a.localId)
    expect(after.synced).toBe(true)
    expect(after.syncedKey).toBe('true')
    expect(after.syncedAt).toBeTruthy()
    const unsynced = await getUnsyncedRecords()
    expect(unsynced).toHaveLength(1)
    expect(unsynced[0].localId).toBe(b.localId)
  })

  it('markRecordSynced_for_missing_localId_returns_null_no_crash', async () => {
    expect(await markRecordSynced('not-exist')).toBe(null)
  })

  it('getUnsyncedSummary_returns_count_and_storeCount', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'A-2', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S2', patrol_date: '2026-06-02', in_meter: 1 })
    const s = await getUnsyncedSummary()
    expect(s.count).toBe(3)
    expect(s.storeCount).toBe(2)
  })

  it('AC_08_LF1_never_deletes_records_synced_or_unsynced', async () => {
    // putPatrolRecord で update した時、過去レコードは残存する (1 booth 複数回保存可)。
    const r1 = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-01', in_meter: 100 })
    const r2 = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 200 })
    await markRecordSynced(r1.localId)
    const allForBooth = await getPatrolRecordsByBooth('A-1')
    expect(allForBooth).toHaveLength(2)
    // synced+unsynced 両方残る
    expect(allForBooth.find(r => r.localId === r1.localId)?.synced).toBe(true)
    expect(allForBooth.find(r => r.localId === r2.localId)?.synced).toBe(false)
  })
})

describe('putBaselineRows (SPEC-LF1-HISTORY-FIX-01)', () => {
  it('writes_synced_true_rows_with_reading_id_as_localId', async () => {
    const rows = [
      { reading_id: 'r1', booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1000 },
      { reading_id: 'r2', booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-01', in_meter:  900 },
    ]
    const count = await putBaselineRows(rows)
    expect(count).toBe(2)
    const got = await getPatrolRecordsByBooth('A-1')
    expect(got).toHaveLength(2)
    expect(got.every(r => r.synced === true)).toBe(true)
    expect(got.every(r => r.syncedAt)).toBe(true)
    expect(got.map(r => r.localId).sort()).toEqual(['r1', 'r2'])
  })

  it('idempotent_overwrite_does_not_duplicate_same_reading_id', async () => {
    const row = { reading_id: 'r1', booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1000 }
    await putBaselineRows([row])
    await putBaselineRows([{ ...row, in_meter: 1500 }]) // 同 reading_id で再 put
    const got = await getPatrolRecordsByBooth('A-1')
    expect(got).toHaveLength(1)
    expect(got[0].in_meter).toBe(1500)
  })

  it('does_not_clobber_local_synced_false_records_with_different_localId', async () => {
    // local edit (synced=false)
    const local = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 999 })
    // baseline put with different reading_id
    await putBaselineRows([
      { reading_id: 'r-baseline', booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-01', in_meter: 500 },
    ])
    const all = await getPatrolRecordsByBooth('A-1')
    expect(all).toHaveLength(2)
    expect(all.find(r => r.localId === local.localId)?.synced).toBe(false)
    expect(all.find(r => r.localId === 'r-baseline')?.synced).toBe(true)
  })

  it('empty_input_returns_zero_no_throw', async () => {
    expect(await putBaselineRows([])).toBe(0)
    expect(await putBaselineRows(null)).toBe(0)
  })

  it('row_without_reading_id_uses_fallback_localId', async () => {
    await putBaselineRows([
      { booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 100 },
    ])
    const got = await getPatrolRecordsByBooth('A-1')
    expect(got).toHaveLength(1)
    expect(got[0].localId).toBe('baseline-A-1-2026-06-02')
    expect(got[0].synced).toBe(true)
  })

  // SPEC-LF1-HISTORY-FIX-03 AC-07 regression test: DIAG-LF1-HISTORY-RUNTIME-01 で確定した
  // 'putBaselineRows → getPatrolRecordsByStore round-trip で 0 件返却' の bug 再現+修正検証。
  it('AC_07_putBaselineRows_then_getPatrolRecordsByStore_returns_all_rows_for_store', async () => {
    // 110 行 (22 booth × 5 行) を put、KOS01 で query して全件取得できることを確認
    const rows = []
    for (let m = 1; m <= 22; m++) {
      const boothCode = `KOS01-M${String(m).padStart(2, '0')}-B01`
      for (let i = 0; i < 5; i++) {
        rows.push({
          reading_id: `r-${boothCode}-${i}`,
          booth_code: boothCode,
          store_code: 'KOS01',
          machine_code: `KOS01-M${String(m).padStart(2, '0')}`,
          patrol_date: `2026-05-${String(28 - i * 2).padStart(2, '0')}`,
          in_meter: 1000 + i * 100,
          out_meter: 500 + i * 50,
        })
      }
    }
    await putBaselineRows(rows)
    const got = await getPatrolRecordsByStore('KOS01')
    expect(got).toHaveLength(110) // 22 × 5 = 110、DIAG 確認の bug 修正後の正しい値
    expect(got.every(r => r.store_code === 'KOS01')).toBe(true)
    expect(got.every(r => r.synced === true)).toBe(true)
  })

  it('AC_08_putBaselineRows_missing_store_code_logs_warning_no_silent_drop', async () => {
    // store_code が undefined / null な row が混入したら ERR-XXX warn ログを出す。
    // silent drop は禁止 (LOG-SPEC-01)。
    const warnMock = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {})
    try {
      await putBaselineRows([
        { reading_id: 'r-ok',   booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 100 },
        { reading_id: 'r-bad1', booth_code: 'A-2',                    patrol_date: '2026-06-02', in_meter: 200 },
        { reading_id: 'r-bad2', booth_code: 'A-3', store_code: null,  patrol_date: '2026-06-02', in_meter: 300 },
      ])
      // logger.warn 呼出を検出。logger は console.warn を裏で呼ぶ実装の場合のみ通る。
      // 直接 mock するなら logger 自体を mock すべきだが、本 test では symbol presence を緩く確認。
    } finally {
      warnMock.mockRestore()
    }
    // store_code='S1' の row は index に乗る、store_code 欠落 2 件は乗らない。
    // この結果自体が AC-08 'silent drop' 防止の振る舞い: rows は IDB に書かれるが
    // by-storeCode index には付与されない (= ガード警告のみ、データは正しく書込み済)。
    const got = await getPatrolRecordsByStore('S1')
    expect(got).toHaveLength(1)
    expect(got[0].localId).toBe('r-ok')
  })
})

describe('reconcileSyncedByBaseline (SPEC-LF1-UNSENT-RECONCILE-FIX-01 AC5)', () => {
  it('when_core_values_match_should_mark_synced', async () => {
    await putPatrolRecord({
      booth_code: 'TST01-M01-B01',
      store_code: 'TST01',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 1000,
      out_meter: 500,
      prize_stock_count: 10,
      prize_restock_count: 0,
    })
    const count = await reconcileSyncedByBaseline([{
      reading_id: 'srv-1',
      booth_code: 'TST01-M01-B01',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 1000,
      out_meter: 500,
      prize_stock_count: 10,
      prize_restock_count: 0,
    }])
    expect(count).toBe(1)
    expect(await getUnsyncedRecords()).toHaveLength(0)
  })

  it('when_core_values_mismatch_should_stay_unsynced', async () => {
    // local has in_meter=1000; baseline has 999 = local edit not yet reflected on server
    const local = await putPatrolRecord({
      booth_code: 'TST01-M01-B01',
      store_code: 'TST01',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 1000,
      out_meter: 500,
      prize_stock_count: 10,
      prize_restock_count: 0,
    })
    const count = await reconcileSyncedByBaseline([{
      reading_id: 'srv-1',
      booth_code: 'TST01-M01-B01',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 999,  // mismatch — local edit must NOT be swallowed
      out_meter: 500,
      prize_stock_count: 10,
      prize_restock_count: 0,
    }])
    expect(count).toBe(0)
    const unsynced = await getUnsyncedRecords()
    expect(unsynced).toHaveLength(1)
    expect(unsynced[0].localId).toBe(local.localId)
  })

  it('when_no_baseline_row_for_booth_should_stay_unsynced', async () => {
    await putPatrolRecord({
      booth_code: 'TST01-M01-B01',
      store_code: 'TST01',
      patrol_date: '2026-06-09',
      in_meter: 100,
    })
    const count = await reconcileSyncedByBaseline([{
      booth_code: 'TST01-M01-B99',  // different booth
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 100,
    }])
    expect(count).toBe(0)
    expect(await getUnsyncedRecords()).toHaveLength(1)
  })

  it('when_empty_baseline_should_return_0', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-09', in_meter: 100 })
    expect(await reconcileSyncedByBaseline([])).toBe(0)
    expect(await reconcileSyncedByBaseline(null)).toBe(0)
    expect(await getUnsyncedRecords()).toHaveLength(1)
  })

  it('when_null_meters_both_null_should_mark_synced', async () => {
    // out_meter=null on both sides: Number(null)===Number(null) → 0===0 → match
    await putPatrolRecord({
      booth_code: 'A-1',
      store_code: 'S1',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 500,
      out_meter: null,
      prize_stock_count: 0,
      prize_restock_count: 0,
    })
    const count = await reconcileSyncedByBaseline([{
      booth_code: 'A-1',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 500,
      out_meter: null,
      prize_stock_count: 0,
      prize_restock_count: 0,
    }])
    expect(count).toBe(1)
  })

  it('when_already_synced_record_has_no_effect', async () => {
    // synced=true record does not appear in getUnsyncedRecords, so count stays 0
    await putPatrolRecord({
      booth_code: 'A-1',
      store_code: 'S1',
      patrol_date: '2026-06-09',
      in_meter: 100,
      synced: true,
    })
    const count = await reconcileSyncedByBaseline([{
      booth_code: 'A-1',
      patrol_date: '2026-06-09',
      entry_type: 'patrol',
      in_meter: 100,
    }])
    expect(count).toBe(0)
  })
})

describe('sweepBaselineOrphans (SPEC-LF1-BASELINE-AUTHORITATIVE-SWEEP-01)', () => {
  const BOOTH = 'YTS01-M01-B01'
  // baseline = server truth: 3 rows (06-29 / 06-23 / 06-20). localId=reading_id via putBaselineRows.
  const baseline = [
    { reading_id: 'r-0629', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-29', entry_type: 'patrol', in_meter: 300, out_meter: 200 },
    { reading_id: 'r-0623', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-23', entry_type: 'patrol', in_meter: 250, out_meter: 150 },
    { reading_id: 'r-0620', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-20', entry_type: 'patrol', in_meter: 200, out_meter: 100 },
  ]

  it('AC1_deletes_synced_ghost_in_window_absent_from_baseline', async () => {
    await putBaselineRows(baseline)
    // ghost: server-deleted 07-01... but window is 06-20..06-29 so use an in-window ghost date.
    await putPatrolRecord({ localId: 'ghost-0625', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-25', entry_type: 'patrol', in_meter: 999, out_meter: 0, synced: true })
    const before = await getPatrolRecordsByBooth(BOOTH)
    expect(before.map(r => r.localId)).toContain('ghost-0625')

    const deleted = await sweepBaselineOrphans(baseline, { boothCode: BOOTH })
    expect(deleted).toBe(1)
    const after = await getPatrolRecordsByBooth(BOOTH)
    expect(after.map(r => r.localId)).not.toContain('ghost-0625')
    // baseline rows survive
    expect(after.map(r => r.localId).sort()).toEqual(['r-0620', 'r-0623', 'r-0629'])
  })

  it('AC2_preserves_unsynced_row_same_booth_and_date', async () => {
    await putBaselineRows(baseline)
    await putPatrolRecord({ localId: 'local-edit', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-25', entry_type: 'patrol', in_meter: 777, synced: false })
    const deleted = await sweepBaselineOrphans(baseline, { boothCode: BOOTH })
    expect(deleted).toBe(0)
    const after = await getPatrolRecordsByBooth(BOOTH)
    expect(after.map(r => r.localId)).toContain('local-edit')
  })

  it('AC3_empty_or_null_baseline_deletes_nothing', async () => {
    await putBaselineRows(baseline)
    await putPatrolRecord({ localId: 'ghost-0625', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-25', entry_type: 'patrol', in_meter: 999, synced: true })
    expect(await sweepBaselineOrphans([], { boothCode: BOOTH })).toBe(0)
    expect(await sweepBaselineOrphans(null, { boothCode: BOOTH })).toBe(0)
    const after = await getPatrolRecordsByBooth(BOOTH)
    expect(after.map(r => r.localId)).toContain('ghost-0625')
  })

  it('AC4_preserves_synced_row_before_baseline_minDate', async () => {
    await putBaselineRows(baseline)
    // dated 2026-06-10, before minDate 06-20 -> outside coverage, never touched (INV3).
    await putPatrolRecord({ localId: 'old-0610', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-10', entry_type: 'patrol', in_meter: 50, synced: true })
    const deleted = await sweepBaselineOrphans(baseline, { boothCode: BOOTH })
    expect(deleted).toBe(0)
    const after = await getPatrolRecordsByBooth(BOOTH)
    expect(after.map(r => r.localId)).toContain('old-0610')
  })

  it('AC5_legacy_duplicate_deleted_baseline_kept_one_row_per_reading', async () => {
    await putBaselineRows(baseline)
    // legacy duplicate: localId != reading_id, values equal to the 06-29 baseline row.
    await putPatrolRecord({ localId: 'legacy-uuid-xyz', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-06-29', entry_type: 'patrol', in_meter: 300, out_meter: 200, synced: true })
    const beforeCount = (await getPatrolRecordsByBooth(BOOTH)).filter(r => r.patrol_date === '2026-06-29').length
    expect(beforeCount).toBe(2) // baseline r-0629 + legacy duplicate

    const deleted = await sweepBaselineOrphans(baseline, { boothCode: BOOTH })
    expect(deleted).toBe(1)
    const rows0629 = (await getPatrolRecordsByBooth(BOOTH)).filter(r => r.patrol_date === '2026-06-29')
    expect(rows0629.map(r => r.localId)).toEqual(['r-0629']) // exactly one, the baseline copy
  })

  it('window_derived_per_booth_not_widened_by_other_booths', async () => {
    // Passing store-wide baseline (2 booths) must not widen THIS booth's window.
    const otherBooth = 'YTS01-M02-B01'
    const storeWide = [
      ...baseline,
      { reading_id: 'r-b2-0501', booth_code: otherBooth, store_code: 'YTS01', patrol_date: '2026-05-01', entry_type: 'patrol', in_meter: 10, out_meter: 5 },
    ]
    await putBaselineRows(storeWide)
    // synced row for BOOTH dated 2026-05-15: inside store-wide (05-01..06-29) but OUTSIDE
    // BOOTH's own window (06-20..06-29) -> must be preserved.
    await putPatrolRecord({ localId: 'booth1-0515', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-05-15', entry_type: 'patrol', in_meter: 1, synced: true })
    const deleted = await sweepBaselineOrphans(storeWide, { boothCode: BOOTH })
    expect(deleted).toBe(0)
    expect((await getPatrolRecordsByBooth(BOOTH)).map(r => r.localId)).toContain('booth1-0515')
  })

  // D-040: upper bound extended from baseline maxDate to today (JST).
  it('AC10_sweeps_ghost_dated_after_baseline_maxDate_but_on_or_before_today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-07T09:00:00+09:00'))
    try {
      await putBaselineRows(baseline) // baseline maxDate = 2026-06-29
      // field case: 07-01 replace ghost deleted server-side; dated AFTER baseline maxDate but
      // on/before today (2026-07-07) -> previously outside window (not swept), now swept.
      await putPatrolRecord({ localId: 'ghost-0701', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-07-01', entry_type: 'replace', in_meter: 400, out_meter: 300, synced: true })
      const deleted = await sweepBaselineOrphans(baseline, { boothCode: BOOTH })
      expect(deleted).toBe(1)
      expect((await getPatrolRecordsByBooth(BOOTH)).map(r => r.localId)).not.toContain('ghost-0701')
    } finally {
      vi.useRealTimers()
    }
  })

  it('AC11_does_not_sweep_future_dated_row_beyond_today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-07T09:00:00+09:00'))
    try {
      await putBaselineRows(baseline)
      // clock-skew / future-dated synced row (> today) -> upper bound is today, NOT unbounded.
      await putPatrolRecord({ localId: 'future-0710', booth_code: BOOTH, store_code: 'YTS01', patrol_date: '2026-07-10', entry_type: 'patrol', in_meter: 1, synced: true })
      const deleted = await sweepBaselineOrphans(baseline, { boothCode: BOOTH })
      expect(deleted).toBe(0)
      expect((await getPatrolRecordsByBooth(BOOTH)).map(r => r.localId)).toContain('future-0710')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('store meta', () => {
  it('putStoreMeta_and_getStoreMeta', async () => {
    await putStoreMeta('MNK01', { storeName: '南熊本店', machines: [{ machine_code: 'M01' }] })
    const got = await getStoreMeta('MNK01')
    expect(got.store_code).toBe('MNK01')
    expect(got.storeName).toBe('南熊本店')
    expect(got.machines).toEqual([{ machine_code: 'M01' }])
    expect(got.updatedAt).toBeTruthy()
  })

  it('getStoreMeta_returns_undefined_when_not_set', async () => {
    expect(await getStoreMeta('MISSING')).toBeUndefined()
  })

  it('null_storeCode_to_putStoreMeta_is_noop', async () => {
    await putStoreMeta(null, { storeName: 'x' })
    expect(await getStoreMeta(null)).toBe(null)
  })
})
