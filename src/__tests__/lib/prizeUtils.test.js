import { describe, it, expect } from 'vitest'
import { isInternalNote } from '../../lib/prizeUtils'

describe('isInternalNote', () => {
  it('when_backfilled_prefix_should_return_true', () => {
    expect(isInternalNote('backfilled rev2 from order_source 2026-06-09')).toBe(true)
  })
  it('when_backfilled_rev3_prefix_should_return_true', () => {
    expect(isInternalNote('backfilled rev3 from order_source 2026-06-09')).toBe(true)
  })
  it('when_from_order_source_without_backfilled_prefix_should_return_true', () => {
    expect(isInternalNote('debug info from order_source elsewhere')).toBe(true)
  })
  it('when_normal_japanese_memo_should_return_false', () => {
    expect(isInternalNote('通常のメモです')).toBe(false)
  })
  it('when_null_should_return_false', () => {
    expect(isInternalNote(null)).toBe(false)
  })
  it('when_empty_string_should_return_false', () => {
    expect(isInternalNote('')).toBe(false)
  })
  it('when_undefined_should_return_false', () => {
    expect(isInternalNote(undefined)).toBe(false)
  })
  it('when_partial_word_backfill_without_d_should_return_false', () => {
    expect(isInternalNote('this was backfill work')).toBe(false)
  })
})
