// @vitest-environment happy-dom
// SPEC-PWA-VERSION-CHECK-UPDATE-01 + SPEC-SW-UPDATE-TRIGGER-01: swRegistration のテスト
// SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): onNeedRefresh を no-op 廃止 → 更新ありフラグ + バナー経路。
//   自動 reload しない (updateSW(true) はユーザー明示タップ=applyUpdate 時のみ)。
import { describe, it, expect, vi } from 'vitest'

const captured = vi.hoisted(() => ({ opts: {}, updateSpy: null }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => {
    captured.opts = opts || {}
    captured.updateSpy = vi.fn()
    return captured.updateSpy
  }),
}))

import { getNeedRefresh, applyUpdate, subscribeNeedRefresh } from '../../lib/swRegistration'

describe('swRegistration (D-109 prompt 本道)', () => {
  it('should_have_onRegisteredSW_handler_for_periodic_update_setup', () => {
    expect(typeof captured.opts.onRegisteredSW).toBe('function')
  })

  it('should_have_immediate_true', () => {
    expect(captured.opts.immediate).toBe(true)
  })

  it('D-109: onNeedRefresh は自動 reload せず「更新ありフラグ」を立てる (バナー経路)', () => {
    expect(typeof captured.opts.onNeedRefresh).toBe('function')
    expect(getNeedRefresh()).toBe(false)
    expect(captured.updateSpy).not.toHaveBeenCalled() // 自動適用しない
    captured.opts.onNeedRefresh()
    expect(getNeedRefresh()).toBe(true)
    expect(captured.updateSpy).not.toHaveBeenCalled() // フラグを立てるだけ、reload しない
  })

  it('D-109: applyUpdate はタップ時に updateSW(true) を1回だけ呼ぶ', () => {
    applyUpdate()
    expect(captured.updateSpy).toHaveBeenCalledWith(true)
    expect(captured.updateSpy).toHaveBeenCalledTimes(1)
  })

  it('subscribeNeedRefresh は現在値を即通知し unsubscribe を返す', () => {
    const seen = []
    const unsub = subscribeNeedRefresh(v => seen.push(v))
    expect(seen[0]).toBe(getNeedRefresh()) // 現在値 (この時点 true) を即コールバック
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
