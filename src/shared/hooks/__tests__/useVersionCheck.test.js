// @vitest-environment happy-dom
// SPEC-PWA-VERSION-CHECK-UPDATE-01: SHA照合 + 起動時/15分アイドル復帰/作業中非発火
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const buildInfoMocks = vi.hoisted(() => ({ BUILD_SHA: 'abc123sha', BUILD_NUMBER: '42' }))
vi.mock('../../../lib/buildInfo', () => ({
  BUILD_SHA: buildInfoMocks.BUILD_SHA,
  BUILD_NUMBER: buildInfoMocks.BUILD_NUMBER,
}))

import { useVersionCheck } from '../useVersionCheck'

const IDLE_MS = 15 * 60 * 1000

function makeStorage() {
  const store = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
  }
}

describe('useVersionCheck (SPEC-PWA-VERSION-CHECK-UPDATE-01)', () => {
  let mockReload
  let mockStorage
  let nowMs

  beforeEach(() => {
    vi.useFakeTimers()
    mockReload = vi.fn()
    mockStorage = makeStorage()
    nowMs = 1_000_000
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function setup(sha = 'abc123sha') {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sha, buildNumber: '99', version: '1.0.0' }),
    }))
    return renderHook(() => useVersionCheck({
      now: () => nowMs,
      reload: mockReload,
      getStorage: () => mockStorage,
    }))
  }

  // SHA比較テスト
  it('AC4: when_sha_matches_BUILD_SHA_should_not_reload', async () => {
    setup('abc123sha')
    await act(async () => {})
    await act(async () => vi.runAllTimersAsync())
    expect(mockReload).not.toHaveBeenCalled()
  })

  it('AC4: when_sha_differs_from_BUILD_SHA_should_reload', async () => {
    setup('newsha9999')
    await act(async () => {})
    await act(async () => vi.runAllTimersAsync())
    expect(mockReload).toHaveBeenCalledOnce()
  })

  it('AC4: when_sha_absent_in_response_should_not_reload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ buildNumber: '99' }) }))
    renderHook(() => useVersionCheck({ now: () => nowMs, reload: mockReload, getStorage: () => mockStorage }))
    await act(async () => {})
    await act(async () => vi.runAllTimersAsync())
    expect(mockReload).not.toHaveBeenCalled()
  })

  // 起動時チェック
  it('AC5: when_mounted_should_fetch_once_at_startup', async () => {
    setup('abc123sha')
    await act(async () => {})
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('AC5: when_30min_elapsed_without_hide_should_not_refetch', async () => {
    setup('abc123sha')
    await act(async () => {})
    const startCount = global.fetch.mock.calls.length
    await act(async () => vi.advanceTimersByTime(30 * 60 * 1000))
    expect(global.fetch.mock.calls.length).toBe(startCount) // no setInterval
  })

  // 15分アイドル復帰 → check発火 (AC7)
  it('AC7: when_visible_after_15min_hidden_should_check', async () => {
    setup('abc123sha')
    await act(async () => {})
    global.fetch.mockClear()

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    nowMs += IDLE_MS + 1000  // 15分超

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {})
    expect(global.fetch).toHaveBeenCalled()
  })

  // 15分未満復帰 → check不発火 (AC6)
  it('AC6: when_visible_before_15min_hidden_should_not_check', async () => {
    setup('abc123sha')
    await act(async () => {})
    global.fetch.mockClear()

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    nowMs += IDLE_MS - 1000  // 15分未満

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {})
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // visibilitychangeなしの状態でvisible復帰ハンドラが呼ばれても安全
  it('when_visible_return_without_prior_hide_should_not_check', async () => {
    setup('abc123sha')
    await act(async () => {})
    global.fetch.mockClear()

    // visible→visible (hiddenAt=null のまま)
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {})
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
