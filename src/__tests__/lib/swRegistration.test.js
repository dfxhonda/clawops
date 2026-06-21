// @vitest-environment happy-dom
// SPEC-PWA-SW-PERIODIC-UPDATE-01: setupPeriodicUpdate定期updateテスト
// AC1: swUrl no-store fetch → 200 → r.update() 呼出
// AC2: 起動直後にも1回チェック走る
// AC3: r.installing中 / オフライン時はskip
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}))

import { setupPeriodicUpdate } from '../../lib/swRegistration'

function mkReg(overrides = {}) {
  return { installing: null, update: vi.fn(async () => {}), ...overrides }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('setupPeriodicUpdate (SPEC-PWA-SW-PERIODIC-UPDATE-01)', () => {
  // AC1: interval 経過後に swUrl を no-store fetch して 200 なら r.update()
  it('when_interval_fires_and_fetch_200_should_call_r_update', async () => {
    const r = mkReg()
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }))
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 1000, startupDelayMs: 9999999, fetchFn })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchFn).toHaveBeenCalledWith('https://example.com/sw.js', { cache: 'no-store' })
    expect(r.update).toHaveBeenCalled()
  })

  // AC1: fetch 200 以外では r.update() を呼ばない
  it('when_fetch_returns_non_ok_should_not_call_r_update', async () => {
    const r = mkReg()
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 }))
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 1000, startupDelayMs: 9999999, fetchFn })
    await vi.advanceTimersByTimeAsync(1000)
    expect(r.update).not.toHaveBeenCalled()
  })

  // AC2: startupDelay 経過後に起動時チェック走る
  it('when_startup_delay_fires_should_run_check_once', async () => {
    const r = mkReg()
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }))
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 9999999, startupDelayMs: 500, fetchFn })
    await vi.advanceTimersByTimeAsync(500)
    expect(r.update).toHaveBeenCalledTimes(1)
  })

  // AC3: r.installing 中は fetch もしない
  it('when_r_installing_should_skip_fetch_and_update', async () => {
    const r = mkReg({ installing: {} }) // installing = truthy
    const fetchFn = vi.fn()
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 1000, startupDelayMs: 9999999, fetchFn })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchFn).not.toHaveBeenCalled()
    expect(r.update).not.toHaveBeenCalled()
  })

  // AC3: オフライン時も skip
  it('when_offline_should_skip_fetch_and_update', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
    const r = mkReg()
    const fetchFn = vi.fn()
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 1000, startupDelayMs: 9999999, fetchFn })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchFn).not.toHaveBeenCalled()
    expect(r.update).not.toHaveBeenCalled()
  })

  // AC6: fetch が throw しても r.update は呼ばず、例外伝播しない
  it('when_fetch_throws_should_not_throw_and_not_call_r_update', async () => {
    const r = mkReg()
    const fetchFn = vi.fn(async () => { throw new Error('network') })
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 1000, startupDelayMs: 9999999, fetchFn })
    await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow()
    expect(r.update).not.toHaveBeenCalled()
  })

  // AC1: 複数interval経過で複数回チェック走る
  it('when_multiple_intervals_fire_should_check_multiple_times', async () => {
    const r = mkReg()
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }))
    setupPeriodicUpdate('https://example.com/sw.js', r, { intervalMs: 1000, startupDelayMs: 9999999, fetchFn })
    await vi.advanceTimersByTimeAsync(3000)
    expect(r.update).toHaveBeenCalledTimes(3)
  })
})
