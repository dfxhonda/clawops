// @vitest-environment happy-dom
// SPEC-IDLE-LOGOUT-RELOAD-GUARD-FIX-01: logout進行中にversion-reloadを抑制するガードのテスト
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../../lib/buildInfo', () => ({
  BUILD_NUMBER: '1000',
  BUILD_SHA: 'test-sha',
  BUILD_VERSION: 'test',
  BUILD_TIME: '2026-06-02T00:00:00.000Z',
  buildLabel: () => 'build #1000',
}))

import {
  markLogoutStart,
  markLogoutReplaced,
  isLogoutInFlight,
  reportInterrupt,
} from '../../lib/idleLogoutProbe'
import { useVersionCheck } from '../../shared/hooks/useVersionCheck'

function mockFetchMismatch() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ sha: 'new-sha' }),  // BUILD_SHA='test-sha'と不一致
  }))
}

beforeEach(() => {
  markLogoutReplaced()  // reset logoutInFlight=false
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isLogoutInFlight (SPEC-IDLE-LOGOUT-RELOAD-GUARD-FIX-01)', () => {
  it('when_markLogoutStart_isLogoutInFlight_should_be_true', () => {
    markLogoutStart()
    expect(isLogoutInFlight()).toBe(true)
  })

  it('when_markLogoutReplaced_after_start_isLogoutInFlight_should_be_false', () => {
    markLogoutStart()
    markLogoutReplaced()
    expect(isLogoutInFlight()).toBe(false)
  })
})

describe('useVersionCheck reload guard (SPEC-IDLE-LOGOUT-RELOAD-GUARD-FIX-01)', () => {
  it('when_logout_in_flight_should_not_call_reload', async () => {
    vi.stubGlobal('fetch', mockFetchMismatch())
    const reload = vi.fn()
    markLogoutStart()  // logoutInFlight=true
    renderHook(() => useVersionCheck({ reload, now: () => 1700000000000 }))
    // RELOAD_DELAY_MS=700ms + バッファ。reloadが呼ばれないことを確認
    await new Promise(r => setTimeout(r, 1200))
    expect(reload).not.toHaveBeenCalled()
  })

  it('when_no_logout_in_flight_should_call_reload', async () => {
    vi.stubGlobal('fetch', mockFetchMismatch())
    const reload = vi.fn()
    // logoutInFlight=false (beforeEach でリセット済み)
    renderHook(() => useVersionCheck({ reload, now: () => 1700000000000 }))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 1200 })
  })

  it('ordering_guard_captured_before_reportInterrupt_resets_flag', () => {
    // 順序制約の検証: isLogoutInFlight()をreportInterruptより前に取得しないとガードが無効になる
    // reportInterrupt は logoutInFlight を false にする副作用を持つ
    markLogoutStart()
    const snapshotBefore = isLogoutInFlight()  // true
    reportInterrupt('RELOAD')                   // logoutInFlight を false に
    const snapshotAfter = isLogoutInFlight()    // false
    // 取得順序が正しければ: snapshotBefore=true でガード効く、snapshotAfter=false で2回目はスキップなし
    expect(snapshotBefore).toBe(true)
    expect(snapshotAfter).toBe(false)
  })
})
