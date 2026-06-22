// @vitest-environment happy-dom
// SPEC-PWA-SW-ACTIVE-UPDATE-S2-01: triggerUpdate + visibilitychange
// AC1: triggerUpdate calls r.update() after no-store fetch 200
// AC2: visibilitychange(visible) fires triggerUpdate
// AC6: cooldown guard prevents double-fire within 5s
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => vi.fn()),
}))

import { triggerUpdate } from '../../lib/swRegistration'
import { registerSW } from 'virtual:pwa-register'

const SW_URL = '/sw.js'

// Retrieve the onRegisteredSW callback captured when swRegistration.js was loaded
function getOnRegisteredSW() {
  return vi.mocked(registerSW).mock.calls[0]?.[0]?.onRegisteredSW
}

// Simulate SW registration (sets _r and _swUrl in the module)
function simulateSWRegistered(r) {
  getOnRegisteredSW()?.call(null, SW_URL, r)
}

function mkReg(overrides = {}) {
  return { installing: null, update: vi.fn(async () => {}), ...overrides }
}

// Counter-based time: each test starts 60s apart, well beyond 5s cooldown
let _testTimeBase = new Date('2026-01-01T00:00:00Z').getTime()

beforeEach(() => {
  _testTimeBase += 60_000
  vi.useFakeTimers()
  vi.setSystemTime(_testTimeBase)
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('triggerUpdate (SPEC-PWA-SW-ACTIVE-UPDATE-S2-01 AC1)', () => {
  it('when_r_registered_and_fetch_ok_should_call_r_update', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    await triggerUpdate()

    expect(fetch).toHaveBeenCalledWith(SW_URL, { cache: 'no-store' })
    expect(r.update).toHaveBeenCalledOnce()
  })

  it('when_fetch_returns_not_ok_should_not_call_r_update', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))

    await triggerUpdate()

    expect(r.update).not.toHaveBeenCalled()
  })

  it('when_r_installing_should_skip_fetch_and_update', async () => {
    const r = mkReg({ installing: {} })
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    await triggerUpdate()

    expect(fetch).not.toHaveBeenCalled()
    expect(r.update).not.toHaveBeenCalled()
  })

  it('when_offline_should_skip_fetch_and_update', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    await triggerUpdate()

    expect(fetch).not.toHaveBeenCalled()
    expect(r.update).not.toHaveBeenCalled()
  })

  it('when_fetch_throws_should_not_throw_and_not_call_r_update', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network error') }))

    await expect(triggerUpdate()).resolves.not.toThrow()
    expect(r.update).not.toHaveBeenCalled()
  })
})

describe('triggerUpdate cooldown guard (SPEC-PWA-SW-ACTIVE-UPDATE-S2-01 AC6)', () => {
  it('when_called_twice_within_5s_should_fire_only_once', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    await triggerUpdate()
    await triggerUpdate() // still within cooldown

    expect(r.update).toHaveBeenCalledTimes(1)
  })

  it('when_called_again_after_5s_cooldown_should_fire_again', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    await triggerUpdate()
    vi.advanceTimersByTime(5001) // past 5s cooldown
    await triggerUpdate()

    expect(r.update).toHaveBeenCalledTimes(2)
  })
})

describe('visibilitychange (SPEC-PWA-SW-ACTIVE-UPDATE-S2-01 AC2)', () => {
  it('when_page_becomes_visible_should_trigger_sw_update', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    await Promise.resolve()

    expect(r.update).toHaveBeenCalledOnce()
  })

  it('when_page_becomes_hidden_should_not_trigger_sw_update', async () => {
    const r = mkReg()
    simulateSWRegistered(r)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    await Promise.resolve()

    expect(r.update).not.toHaveBeenCalled()
  })
})
