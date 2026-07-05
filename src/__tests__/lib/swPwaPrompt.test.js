// @vitest-environment happy-dom
// SPEC-PWA-VERSION-CHECK-UPDATE-01: swRegistration autoUpdate化後のテスト
// onNeedRefresh/pwa-need-refresh は撤去済み
// SPEC-SW-UPDATE-TRIGGER-01: onRegisteredSW を定期更新チェック配線のため再導入
// (旧onNeedRefreshのプロンプト用途とは別目的、visibilitychange/interval設定のみ)
import { describe, it, expect, vi } from 'vitest'

const capturedOpts = vi.hoisted(() => ({ value: {} }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => {
    capturedOpts.value = opts || {}
    return vi.fn()
  }),
}))

import '../../lib/swRegistration'

describe('swRegistration (SPEC-PWA-VERSION-CHECK-UPDATE-01 + SPEC-SW-UPDATE-TRIGGER-01)', () => {
  it('should_have_onRegisteredSW_handler_for_periodic_update_setup', () => {
    expect(typeof capturedOpts.value.onRegisteredSW).toBe('function')
  })

  it('should_not_have_onNeedRefresh_handler', () => {
    expect(capturedOpts.value.onNeedRefresh).toBeUndefined()
  })

  it('should_have_immediate_true', () => {
    expect(capturedOpts.value.immediate).toBe(true)
  })
})
