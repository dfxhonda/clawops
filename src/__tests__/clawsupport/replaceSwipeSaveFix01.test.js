// SPEC-PATROL-REPLACE-SWIPE-SAVE-FIX-01
// PatrolBoothInputPage の prev fetch が IDB優先 (synced=false) → Supabase フォールバック になること
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)

describe('PatrolBoothInputPage IDB-first prev fetch (SPEC-PATROL-REPLACE-SWIPE-SAVE-FIX-01)', () => {
  it('when_idb_first_implemented_should_import_getPatrolRecordsByBooth', () => {
    expect(src).toContain('getPatrolRecordsByBooth')
  })

  it('when_idb_first_implemented_should_filter_synced_false_records', () => {
    expect(src).toContain('!r.synced')
  })

  it('when_idb_first_implemented_should_merge_defaultsFromPrev_for_untouched_fields', () => {
    // IDB record の defaultsFromPrev (Supabase prev) を base に merge する
    expect(src).toContain('latestUnsynced.defaultsFromPrev')
  })

  it('when_idb_first_implemented_should_retain_supabase_fallback_call', () => {
    // getLastReadingForBooth は import だけでなく関数呼び出しとして残ること (IDB miss 時のフォールバック)
    expect(src).toContain('await getLastReadingForBooth(boothCode)')
  })
})
