// @vitest-environment happy-dom
// SPEC-DEBUG-ERUDA-INSCREEN-CONSOLE-01 (D-072) AC1: gate 付き動的 import。
// gate 偽で eruda 未ロード (import 未発火)、gate 真で eruda.init + __NUMPAD_LOG__ 自動 ON。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// eruda を dynamic import する経路を mock (実 eruda を happy-dom で init しない)
const erudaInit = vi.fn()
vi.mock('eruda', () => ({ default: { init: erudaInit } }))

import {
  isDebugConsoleEnabled,
  maybeInitDebugConsole,
  __resetDebugConsoleForTest,
} from '../../lib/debugConsole'

function setSearch(search) {
  window.history.replaceState({}, '', `/${search}`)
}

// happy-dom vitest env の localStorage は methods 未実装のことがあるため、
// Map ベースの決定的スタブを都度インストール (source は global localStorage を参照)
function installStorage() {
  const m = new Map()
  const store = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  }
  vi.stubGlobal('localStorage', store)
  return store
}

beforeEach(() => {
  erudaInit.mockClear()
  __resetDebugConsoleForTest()
  installStorage()
  setSearch('')
  delete window.__DEBUG__
  delete window.__NUMPAD_LOG__
})
afterEach(() => {
  vi.unstubAllGlobals()
  setSearch('')
})

describe('AC1: isDebugConsoleEnabled gate', () => {
  it('flag 一切なし → false', () => {
    expect(isDebugConsoleEnabled()).toBe(false)
  })
  it('?debug=1 → true', () => {
    setSearch('?debug=1')
    expect(isDebugConsoleEnabled()).toBe(true)
  })
  it('window.__DEBUG__=true → true', () => {
    window.__DEBUG__ = true
    expect(isDebugConsoleEnabled()).toBe(true)
  })
  it('localStorage np_debug=1 → true', () => {
    localStorage.setItem('np_debug', '1')
    expect(isDebugConsoleEnabled()).toBe(true)
  })
  it('?debug=0 は localStorage 永続フラグより優先で false', () => {
    localStorage.setItem('np_debug', '1')
    setSearch('?debug=0')
    expect(isDebugConsoleEnabled()).toBe(false)
  })
})

describe('AC1: maybeInitDebugConsole', () => {
  it('gate 偽 → eruda を init しない (import 未発火) + __NUMPAD_LOG__ 未設定', async () => {
    const r = await maybeInitDebugConsole()
    expect(r).toBe(false)
    expect(erudaInit).not.toHaveBeenCalled()
    expect(window.__NUMPAD_LOG__).toBeUndefined()
  })

  it('gate 真 (?debug=1) → eruda.init + __NUMPAD_LOG__=true 自動セット', async () => {
    setSearch('?debug=1')
    const r = await maybeInitDebugConsole()
    expect(r).toBe(true)
    expect(erudaInit).toHaveBeenCalledTimes(1)
    expect(window.__NUMPAD_LOG__).toBe(true)
  })

  it('?debug=1 で localStorage np_debug=1 が永続化される', async () => {
    setSearch('?debug=1')
    await maybeInitDebugConsole()
    expect(localStorage.getItem('np_debug')).toBe('1')
  })

  it('?debug=0 で localStorage 永続フラグが解除される', async () => {
    localStorage.setItem('np_debug', '1')
    setSearch('?debug=0')
    const r = await maybeInitDebugConsole()
    expect(r).toBe(false)
    expect(localStorage.getItem('np_debug')).toBeNull()
  })

  it('多重呼び出しでも eruda.init は 1 回のみ', async () => {
    setSearch('?debug=1')
    await maybeInitDebugConsole()
    await maybeInitDebugConsole()
    expect(erudaInit).toHaveBeenCalledTimes(1)
  })
})
