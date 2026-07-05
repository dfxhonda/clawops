// @vitest-environment happy-dom
// SPEC-SW-UPDATE-TRIGGER-01: AC1-AC3 定期SW更新トリガーのguardロジック
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createUpdateChecker,
  setupPeriodicUpdateCheck,
  UPDATE_INTERVAL_MS,
  MIN_CHECK_GAP_MS,
} from '../../lib/swRegistration'

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('createUpdateChecker (60秒共有ガード)', () => {
  it('when_called_first_time_should_call_registration_update', () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    const check = createUpdateChecker(registration, () => 1000)
    expect(check()).toBe(true)
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('when_called_again_within_60s_should_be_suppressed', () => {
    let now = 1000
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    const check = createUpdateChecker(registration, () => now)
    check()
    now += MIN_CHECK_GAP_MS - 1000 // 59秒後
    expect(check()).toBe(false)
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('when_called_after_60s_gap_should_fire_again', () => {
    let now = 1000
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    const check = createUpdateChecker(registration, () => now)
    check()
    now += MIN_CHECK_GAP_MS // ちょうど60秒後
    expect(check()).toBe(true)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('AC3: when_update_rejects_should_swallow_silently_no_console_error', async () => {
    const registration = { update: vi.fn().mockRejectedValue(new Error('offline')) }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const check = createUpdateChecker(registration, () => 1000)

    expect(check()).toBe(true)
    await new Promise(r => setTimeout(r, 0)) // catch()のmicrotaskを流す

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ERR-SW-UPDATE-001'))
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})

describe('setupPeriodicUpdateCheck (AC1, AC2)', () => {
  let cleanup

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (cleanup) cleanup()
    cleanup = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AC1: visibilitychange_to_visible_should_trigger_exactly_one_update', () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    cleanup = setupPeriodicUpdateCheck(registration)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('when_visibilitychange_to_hidden_should_not_trigger_update', () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    cleanup = setupPeriodicUpdateCheck(registration)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
  })

  it('AC2: interval_should_trigger_update_every_15_minutes', () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    cleanup = setupPeriodicUpdateCheck(registration)
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(registration.update).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('AC2: guard_should_suppress_visibilitychange_immediately_after_interval_tick', () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    cleanup = setupPeriodicUpdateCheck(registration)
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(registration.update).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange')) // 60秒以内 -> 抑制されるはず
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('AC2: guard_should_allow_visibilitychange_after_60s_gap_from_interval_tick', () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    cleanup = setupPeriodicUpdateCheck(registration)
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(registration.update).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(MIN_CHECK_GAP_MS + 1000)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('when_registration_is_null_should_not_throw', () => {
    expect(() => setupPeriodicUpdateCheck(null)).not.toThrow()
  })
})
