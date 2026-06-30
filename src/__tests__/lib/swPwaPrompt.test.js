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
  it('should_not_have_onRegisteredSW_handler', () => {
    expect(capturedOpts.value.onRegisteredSW).toBeUndefined()
  })

  it('should_not_have_onNeedRefresh_handler', () => {
    expect(capturedOpts.value.onNeedRefresh).toBeUndefined()
  })
})
