import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { isPastMonthEndJst } from './stocktakeMonth.js'

describe('isPastMonthEndJst', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('末日23:59 JST 直後は true', () => {
    vi.setSystemTime(new Date('2026-05-31T15:00:00.000Z')) // 2026-06-01 00:00 JST 相当
    expect(isPastMonthEndJst('2026-05-01')).toBe(true)
  })

  it('月中は false', () => {
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    expect(isPastMonthEndJst('2026-05-01')).toBe(false)
  })
})
