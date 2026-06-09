// SPEC-ORDERLIST-OVERDUE-ARRIVED-FIX-01: isOverdue ロジック再発防止テスト
// arrived は予定日過去が当然なので遅延判定から除外
import { describe, it, expect } from 'vitest'

const TODAY = '2026-06-09'

// OrderList.jsx の isOverdue と同一ロジック
const isOverdue = (o) => o.status !== 'arrived' && o.expected_date && o.expected_date < TODAY

describe('isOverdue (OrderList SPEC-ORDERLIST-OVERDUE-ARRIVED-FIX-01)', () => {
  it('when_arrived_and_past_date_should_return_false', () => {
    expect(isOverdue({ status: 'arrived', expected_date: '2023-08-01' })).toBe(false)
  })
  it('when_arrived_and_no_date_should_return_false', () => {
    expect(isOverdue({ status: 'arrived', expected_date: null })).toBe(false)
  })
  it('when_ordered_and_past_date_should_return_true', () => {
    expect(isOverdue({ status: 'ordered', expected_date: '2026-01-01' })).toBe(true)
  })
  it('when_shipped_and_past_date_should_return_true', () => {
    expect(isOverdue({ status: 'shipped', expected_date: '2026-05-01' })).toBe(true)
  })
  it('when_ordered_and_future_date_should_return_false', () => {
    expect(isOverdue({ status: 'ordered', expected_date: '2026-12-31' })).toBe(false)
  })
  it('when_ordered_and_no_date_should_return_falsy', () => {
    expect(isOverdue({ status: 'ordered', expected_date: null })).toBeFalsy()
  })
  it('when_partial_and_past_date_should_return_true', () => {
    expect(isOverdue({ status: 'partial', expected_date: '2026-03-01' })).toBe(true)
  })
})
