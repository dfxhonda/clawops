// @vitest-environment happy-dom
// J-PWA-AUTO-VERSION-RELOAD-01: shared/hooks/useVersionCheck の挙動検証
// match / mismatch / loop guard / fetch fail / dev-mode skip
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// __BUILD_NUMBER__ を vite define を介さず直接 mock。
// buildInfo.js は `typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : '0'` で fallback するため
// 本テストでは buildInfo を vi.mock で固定値に置換。
vi.mock('../../lib/buildInfo', () => ({
  BUILD_NUMBER: '1000',
  BUILD_SHA: 'test-sha',
  BUILD_VERSION: 'test',
  BUILD_TIME: '2026-06-02T00:00:00.000Z',
  buildLabel: () => 'build #1000',
}))

import { useVersionCheck } from '../../shared/hooks/useVersionCheck'

// SPEC-PWA-VERSION-CHECK-FIX-01: storage key + 値の意味が変更された。
// 旧 'reloaded_for_build' (buildNumber 文字列) → 新 'version_check_last_fired' (epoch ms 文字列、5 分以内抑制)
const STORAGE_KEY = 'version_check_last_fired'
const OLD_STORAGE_KEY = 'reloaded_for_build'
const SUPPRESS_WINDOW_MS = 5 * 60 * 1000

function mockFetch(responses) {
  let i = 0
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    if (r === 'throw') throw new Error('network error')
    if (r === 'http500') return { ok: false, status: 500, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => r }
  })
}

let warnSpy

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  sessionStorage.clear()
})

afterEach(() => {
  warnSpy?.mockRestore()
  vi.restoreAllMocks()
})

describe('useVersionCheck (J-PWA-AUTO-VERSION-RELOAD-01)', () => {
  it('when_buildNumber_match_should_not_reload', async () => {
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1000', sha: 'abc' }]))
    const reload = vi.fn()
    const { result } = renderHook(() => useVersionCheck({ reload }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(reload).not.toHaveBeenCalled()
    expect(result.current.reloading).toBe(false)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('when_buildNumber_mismatch_should_set_reloading_and_invoke_reload_after_delay', async () => {
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1001', sha: 'def' }]))
    const reload = vi.fn()
    const fixedNow = 1700000000000
    const { result } = renderHook(() => useVersionCheck({ reload, now: () => fixedNow }))
    await waitFor(() => expect(result.current.reloading).toBe(true))
    // SPEC-PWA-VERSION-CHECK-FIX-01: storage に書く値は timestamp (epoch ms) になった
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(fixedNow))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 1200 })
  })

  // SPEC-PWA-VERSION-CHECK-FIX-01 AC-02: 直近 5 分以内に fire 済なら同 build でも再 fire しない (timestamp 抑制)。
  it('when_within_5min_of_last_fire_should_not_reload_again_timestamp_guard', async () => {
    const fixedNow = 1700000000000
    // 4 分前 fire 済 → 抑制範囲内
    sessionStorage.setItem(STORAGE_KEY, String(fixedNow - 4 * 60 * 1000))
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1001', sha: 'def' }]))
    const reload = vi.fn()
    const { result } = renderHook(() => useVersionCheck({ reload, now: () => fixedNow }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 100))
    expect(reload).not.toHaveBeenCalled()
    expect(result.current.reloading).toBe(false)
  })

  // SPEC-PWA-VERSION-CHECK-FIX-01 AC-03: 5 分超過後は同 build でも再 fire (iOS cache eviction retry)。
  it('when_past_5min_window_should_reload_again_even_same_build', async () => {
    const fixedNow = 1700000000000
    // 6 分前 fire 済 → 抑制範囲外
    sessionStorage.setItem(STORAGE_KEY, String(fixedNow - 6 * 60 * 1000))
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1001', sha: 'def' }]))
    const reload = vi.fn()
    const { result } = renderHook(() => useVersionCheck({ reload, now: () => fixedNow }))
    await waitFor(() => expect(result.current.reloading).toBe(true))
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(fixedNow))
  })

  // SPEC-PWA-VERSION-CHECK-FIX-01 AC-04: 旧 'reloaded_for_build' key は使わなくなった。
  it('does_not_read_or_write_old_reloaded_for_build_key', async () => {
    sessionStorage.setItem(OLD_STORAGE_KEY, '1001')  // 旧 key に値があっても無視
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1001', sha: 'def' }]))
    const reload = vi.fn()
    const { result } = renderHook(() => useVersionCheck({ reload, now: () => 1700000000000 }))
    // 旧 key 無視 → 新規 fire できる
    await waitFor(() => expect(result.current.reloading).toBe(true))
    expect(sessionStorage.getItem(OLD_STORAGE_KEY)).toBe('1001')  // 旧 key 未更新
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('1700000000000')  // 新 key に timestamp 書き込み
  })

  it('when_fetch_throws_should_log_ERR_PWA_VERSION_FETCH_and_not_crash', async () => {
    vi.stubGlobal('fetch', mockFetch(['throw']))
    const reload = vi.fn()
    renderHook(() => useVersionCheck({ reload }))
    await waitFor(() => expect(warnSpy).toHaveBeenCalled())
    const args = warnSpy.mock.calls[0]
    expect(args[0]).toContain('ERR-PWA-VERSION-FETCH')
    expect(reload).not.toHaveBeenCalled()
  })

  it('when_fetch_returns_non_ok_should_log_and_not_reload', async () => {
    vi.stubGlobal('fetch', mockFetch(['http500']))
    const reload = vi.fn()
    renderHook(() => useVersionCheck({ reload }))
    await waitFor(() => expect(warnSpy).toHaveBeenCalled())
    expect(warnSpy.mock.calls[0][0]).toContain('ERR-PWA-VERSION-FETCH')
    expect(reload).not.toHaveBeenCalled()
  })

  it('when_response_missing_buildNumber_should_not_reload', async () => {
    vi.stubGlobal('fetch', mockFetch([{ sha: 'x' }]))
    const reload = vi.fn()
    const { result } = renderHook(() => useVersionCheck({ reload }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(reload).not.toHaveBeenCalled()
    expect(result.current.reloading).toBe(false)
  })

  it('fetch_url_should_have_cache_busting_timestamp_query', async () => {
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1000' }]))
    const now = vi.fn(() => 1700000000000)
    const reload = vi.fn()
    renderHook(() => useVersionCheck({ now, reload }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/version.json?t=1700000000000')
    expect(init).toEqual({ cache: 'no-store' })
  })
})
