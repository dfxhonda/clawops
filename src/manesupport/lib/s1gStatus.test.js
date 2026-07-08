// SPEC-S1G-DONKI-DEADLINE-ALERT-01: donki 締日アラート status 導出 + badge マッピング
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { deriveS1gStatus, s1gBadge } from './s1gStatus'

// deriveS1gStatus は本番 SQL (fn_forecast_store_list.s1g_status) のミラー。
// 日付はすべて JST 'YYYY-MM-DD' 文字列で辞書順比較 (ISO date は文字列比較で正しく順序化)。
// 当月20日 = today.slice(0,7)+'-20'。
describe('deriveS1gStatus (derivation matrix, simulated dates)', () => {
  const base = {
    storeType: 'donki_tenant',
    lastReadingDate: '2026-07-07',
    nextCollectionDate: '2026-07-14',
    doneThisMonth: false,
    today: '2026-07-08',
  }

  it('when_store_type_not_donki_tenant_should_be_null', () => {
    expect(deriveS1gStatus({ ...base, storeType: 'external' })).toBeNull()
  })

  it('when_last_reading_date_missing_should_be_null_dormant', () => {
    expect(deriveS1gStatus({ ...base, lastReadingDate: null })).toBeNull()
  })

  it('when_collection_done_this_month_should_be_done', () => {
    expect(deriveS1gStatus({ ...base, doneThisMonth: true })).toBe('done')
  })

  it('when_not_done_and_past_the_20th_should_be_overdue', () => {
    expect(deriveS1gStatus({ ...base, today: '2026-07-21' })).toBe('overdue')
  })

  it('when_not_done_before_20th_and_plan_on_or_before_20th_should_be_planned', () => {
    expect(deriveS1gStatus({ ...base, nextCollectionDate: '2026-07-14' })).toBe('planned')
  })

  it('when_not_done_before_20th_and_no_plan_should_be_unplanned', () => {
    expect(deriveS1gStatus({ ...base, nextCollectionDate: null })).toBe('unplanned')
  })

  it('when_not_done_before_20th_and_plan_after_20th_should_be_unplanned', () => {
    expect(deriveS1gStatus({ ...base, nextCollectionDate: '2026-07-25' })).toBe('unplanned')
  })

  it('when_plan_exactly_on_20th_should_be_planned_boundary', () => {
    expect(deriveS1gStatus({ ...base, nextCollectionDate: '2026-07-20' })).toBe('planned')
  })

  it('when_today_exactly_20th_and_no_plan_should_be_unplanned_not_overdue', () => {
    // today == 20th は超過ではない (today > 20th のみ overdue)
    expect(deriveS1gStatus({ ...base, today: '2026-07-20', nextCollectionDate: null })).toBe('unplanned')
  })

  it('when_done_takes_precedence_over_overdue', () => {
    expect(deriveS1gStatus({ ...base, today: '2026-07-25', doneThisMonth: true })).toBe('done')
  })
})

describe('s1gBadge (UI mapping)', () => {
  it('when_unplanned_should_return_yellow_yoteinashi_badge', () => {
    const b = s1gBadge('unplanned')
    expect(b.text).toBe('予定なし')
    expect(b.cls).toContain('warning')
  })

  it('when_overdue_should_return_red_shimebi_chouka_badge', () => {
    const b = s1gBadge('overdue')
    expect(b.text).toBe('締日超過')
    expect(b.cls).toContain('danger')
  })

  it('when_done_should_be_silent_null', () => {
    expect(s1gBadge('done')).toBeNull()
  })

  it('when_planned_should_be_silent_null', () => {
    expect(s1gBadge('planned')).toBeNull()
  })

  it('when_null_should_be_silent_null', () => {
    expect(s1gBadge(null)).toBeNull()
  })
})
