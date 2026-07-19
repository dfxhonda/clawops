// @vitest-environment happy-dom
// SPEC-PWA-VERSION-CHECK-UPDATE-01: swRegistration のテスト
// SPEC-SW-UPDATE-TRIGGER-01: onRegisteredSW を定期更新チェック配線のため導入 (visibilitychange/interval のみ)
// SPEC-PWA-SW-AUTOUPDATE-KILL-RELOAD-LOOP-01 (D-095): registerType='prompt' 化に伴い onNeedRefresh を no-op で明示
// (自動 reload を絶対に撃たない = 更新適用は /login の versionReload に一本化)。
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

  it('should_have_noop_onNeedRefresh_that_does_not_auto_reload', () => {
    // D-095: onNeedRefresh は存在するが no-op (自動 reload/updateSW(true) を撃たない)。
    expect(typeof capturedOpts.value.onNeedRefresh).toBe('function')
    expect(capturedOpts.value.onNeedRefresh()).toBeUndefined()
  })

  it('should_have_immediate_true', () => {
    expect(capturedOpts.value.immediate).toBe(true)
  })
})
