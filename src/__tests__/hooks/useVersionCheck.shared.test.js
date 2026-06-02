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

const STORAGE_KEY = 'reloaded_for_build'

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
    const { result } = renderHook(() => useVersionCheck({ reload }))
    await waitFor(() => expect(result.current.reloading).toBe(true))
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('1001')
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 1200 })
  })

  it('when_same_buildNumber_already_marked_should_not_reload_again_loop_guard', async () => {
    sessionStorage.setItem(STORAGE_KEY, '1001')
    vi.stubGlobal('fetch', mockFetch([{ buildNumber: '1001', sha: 'def' }]))
    const reload = vi.fn()
    const { result } = renderHook(() => useVersionCheck({ reload }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 100))
    expect(reload).not.toHaveBeenCalled()
    expect(result.current.reloading).toBe(false)
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
