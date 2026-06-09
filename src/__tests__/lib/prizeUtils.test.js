import { describe, it, expect } from 'vitest'
import { isInternalNote, statusLabel } from '../../lib/prizeUtils'

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

describe('statusLabel', () => {
  it('when_ordered_should_return_発注済', () => {
    expect(statusLabel('ordered')).toBe('発注済')
  })
  it('when_shipped_should_return_発送済', () => {
    expect(statusLabel('shipped')).toBe('発送済')
  })
  it('when_arrived_should_return_入荷済', () => {
    expect(statusLabel('arrived')).toBe('入荷済')
  })
  it('when_cancelled_should_return_キャンセル', () => {
    expect(statusLabel('cancelled')).toBe('キャンセル')
  })
  it('when_unknown_value_should_return_as_is', () => {
    expect(statusLabel('partial')).toBe('partial')
  })
  it('when_null_should_return_null', () => {
    expect(statusLabel(null)).toBe(null)
  })
  it('when_undefined_should_return_undefined', () => {
    expect(statusLabel(undefined)).toBe(undefined)
  })
})
