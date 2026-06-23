// @vitest-environment happy-dom
// SPEC-PWA-SW-CONTROLLERCHANGE-RELOAD-01: onNeedRefresh → pwa-need-refresh CustomEvent
import { describe, it, expect, vi } from 'vitest'

const capturedOpts = vi.hoisted(() => ({ value: {} }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => {
    capturedOpts.value = opts || {}
    return vi.fn()
  }),
}))

import '../../lib/swRegistration'

describe('swRegistration onNeedRefresh (SPEC-PWA-SW-CONTROLLERCHANGE-RELOAD-01)', () => {
  it('when_onNeedRefresh_called_should_dispatch_pwa_need_refresh_event', () => {
    const dispatched = []
    window.addEventListener('pwa-need-refresh', (e) => dispatched.push(e))
    capturedOpts.value.onNeedRefresh?.()
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].type).toBe('pwa-need-refresh')
  })

  it('AC6: when_onRegisteredSW_called_should_not_throw', () => {
    const r = { installing: null, update: vi.fn() }
    expect(() => capturedOpts.value.onRegisteredSW?.('/sw.js', r)).not.toThrow()
  })
})
