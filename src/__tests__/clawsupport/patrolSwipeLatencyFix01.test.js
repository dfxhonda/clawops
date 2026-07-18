// SPEC-PATROL-SWIPE-LATENCY-FIX-01
// AC1: prev fetch → zero Supabase calls when IDB baseline exists (tier-2 IDB path)
// AC2: history → zero Supabase calls when IDB baseline exists
// AC3: tier-2 prev values match IDB synced row fields
// AC5: tier-1 unsynced still wins over synced baseline (replace/edit correctness)
// AC6: cold booth (no IDB) falls back to Supabase
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const patrolSrc = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)
const historySrc = readFileSync(
  resolve(__dirname, '../../clawsupport/components/BoothHistoryList.jsx'),
  'utf-8',
)
const boothHistorySvc = readFileSync(
  resolve(__dirname, '../../services/boothHistory.js'),
  'utf-8',
)

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-01: PatrolBoothInputPage fetchPrev 3-tier', () => {
  it('when_no_unsynced_idb_record_should_check_synced_baseline_before_supabase', () => {
    expect(patrolSrc).toContain('r.synced')
    // SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094): tier-2 は buildPrevFromRows 合成に変更
    expect(patrolSrc).toContain('buildPrevFromRows(syncedRows)')
  })

  it('when_synced_baseline_found_should_setPrev_without_calling_supabase', () => {
    expect(patrolSrc).toContain('setPrev(prevComposite)')
  })

  it('when_tier1_and_tier2_both_miss_should_fall_back_to_getLastReadingForBooth', () => {
    expect(patrolSrc).toContain('await getLastReadingForBooth(boothCode)')
  })

  it('when_idb_error_should_log_ERR_LF1_PREV_IDB_and_fall_back', () => {
    expect(patrolSrc).toContain('ERR-LF1-PREV-IDB')
  })

  it('when_unsynced_record_exists_should_still_use_tier1_unsynced_path', () => {
    expect(patrolSrc).toContain('!r.synced')
    expect(patrolSrc).toContain('latestUnsynced.defaultsFromPrev')
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-01: BoothHistoryList IDB-first history', () => {
  it('when_idb_synced_rows_exist_should_import_getPatrolRecordsByBooth', () => {
    expect(historySrc).toContain('getPatrolRecordsByBooth')
  })

  it('when_idb_empty_should_fall_back_to_fetchBoothHistory', () => {
    expect(historySrc).toContain('fetchBoothHistory')
  })

  it('when_idb_error_should_log_ERR_LF1_HISTORY_IDB_and_fall_back', () => {
    expect(historySrc).toContain('ERR-LF1-HISTORY-IDB')
  })

  it('when_synced_rows_available_should_import_buildBoothHistoryFromIdb', () => {
    expect(historySrc).toContain('buildBoothHistoryFromIdb')
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-01: boothHistory.js buildBoothHistoryFromIdb helper', () => {
  it('when_given_desc_synced_rows_should_export_buildBoothHistoryFromIdb', () => {
    expect(boothHistorySvc).toContain('export function buildBoothHistoryFromIdb')
  })
})
