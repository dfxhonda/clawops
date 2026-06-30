// @vitest-environment happy-dom
// SPEC-PWA-VERSION-CHECK-UPDATE-01: swRegistration autoUpdate化後のテスト
// onNeedRefresh/pwa-need-refresh は撤去済み → onRegisteredSW のみ検証
import { describe, it, expect, vi } from 'vitest'

const capturedOpts = vi.hoisted(() => ({ value: {} }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => {
    capturedOpts.value = opts || {}
    return vi.fn()
  }),
}))

import '../../lib/swRegistration'

describe('swRegistration (SPEC-PWA-VERSION-CHECK-UPDATE-01)', () => {
  it('when_onRegisteredSW_called_should_not_throw', () => {
    const r = { installing: null, update: vi.fn() }
    expect(() => capturedOpts.value.onRegisteredSW?.('/sw.js', r)).not.toThrow()
  })

  it('should_not_have_onNeedRefresh_handler', () => {
    expect(capturedOpts.value.onNeedRefresh).toBeUndefined()
  })

  it('when_onRegisteredSW_called_with_r_should_call_r_update', () => {
    const r = { installing: null, update: vi.fn() }
    capturedOpts.value.onRegisteredSW?.('/sw.js', r)
    expect(r.update).toHaveBeenCalledTimes(1)
  })
})
