// @vitest-environment happy-dom
// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068) AC1: 計測フック。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const hoisted = vi.hoisted(() => ({ staffId: 'S1' }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: hoisted.staffId }) }))
vi.mock('../../services/pageUsage', () => ({ trackPageUsage: vi.fn() }))

import { useTrackPageUsage, clampDwellSeconds } from '../../hooks/useTrackPageUsage'
import { trackPageUsage } from '../../services/pageUsage'

beforeEach(() => { hoisted.staffId = 'S1'; vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

describe('AC1: clampDwellSeconds (600s クリップ)', () => {
  it('丸め / クリップ / 負値', () => {
    expect(clampDwellSeconds(700)).toBe(600)
    expect(clampDwellSeconds(5.9)).toBe(5)
    expect(clampDwellSeconds(-3)).toBe(0)
    expect(clampDwellSeconds('')).toBe(0)
    expect(clampDwellSeconds(599)).toBe(599)
  })
})

describe('AC1: useTrackPageUsage', () => {
  it('mount で views=1 を送る', () => {
    renderHook(() => useTrackPageUsage('forecast'))
    expect(trackPageUsage).toHaveBeenCalledWith({ staffId: 'S1', pageKey: 'forecast', addViews: 1, addSeconds: 0 })
  })

  it('離脱(unmount)で滞在秒を送る', () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useTrackPageUsage('forecast'))
    vi.advanceTimersByTime(5000)
    unmount()
    expect(trackPageUsage).toHaveBeenCalledWith({ staffId: 'S1', pageKey: 'forecast', addViews: 0, addSeconds: 5 })
  })

  it('未ログイン(staffId なし)は送信しない', () => {
    hoisted.staffId = null
    const { unmount } = renderHook(() => useTrackPageUsage('forecast'))
    unmount()
    expect(trackPageUsage).not.toHaveBeenCalled()
  })
})
