// @vitest-environment happy-dom
// SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) Part A: debug_logs 配線の単体検証。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insertSpy = vi.fn(() => Promise.resolve({ error: null }))
const onAuthCb = { current: null }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ insert: insertSpy })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn((cb) => { onAuthCb.current = cb; return { data: { subscription: { unsubscribe: vi.fn() } } } }),
    },
  },
}))
vi.mock('../../lib/auth/session', () => ({ extractMeta: (s) => ({ staffId: s?.staff_id ?? null }) }))

import { isDebugLogsEnabled, logDebug, installGlobalErrorLogging, __resetDebugLogForTest } from '../../lib/debugLog'

function setHost(url) {
  // happy-dom: change origin/hostname
  try { window.happyDOM?.setURL?.(url) } catch { /* noop */ }
}

beforeEach(() => {
  insertSpy.mockClear()
  __resetDebugLogForTest()
  delete window.__DEBUG__
  try { localStorage.clear?.() } catch { /* noop */ }
  setHost('https://clawops-abc.vercel.app/')
})
afterEach(() => { delete window.__DEBUG__ })

describe('AC5: isDebugLogsEnabled (develop preview のみ)', () => {
  it('Vercel preview (*.vercel.app) → true', () => {
    setHost('https://clawops-abc.vercel.app/')
    expect(isDebugLogsEnabled()).toBe(true)
  })
  it('本番ドメイン dfx.round-0.com → false (既定 off)', () => {
    setHost('https://dfx.round-0.com/')
    expect(isDebugLogsEnabled()).toBe(false)
  })
  it('本番ドメインでも window.__DEBUG__=true なら opt-in で true', () => {
    setHost('https://dfx.round-0.com/')
    window.__DEBUG__ = true
    expect(isDebugLogsEnabled()).toBe(true)
  })
})

describe('AC1/AC4: logDebug INSERT', () => {
  it('有効時 → debug_logs に tag/session_id/payload.hints 付きで INSERT', async () => {
    setHost('https://clawops-abc.vercel.app/')
    await logDebug({ level: 'error', tag: 'react-crash', message: 'boom', payload: { stack: 'x' } })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    const row = insertSpy.mock.calls[0][0]
    expect(row.tag).toBe('react-crash')
    expect(row.level).toBe('error')
    expect(row.message).toBe('boom')
    expect(typeof row.session_id).toBe('string')
    expect(row.payload.stack).toBe('x')
    expect(row.payload.hints).toBeTruthy()
  })

  it('無効時 (本番ドメイン) → INSERT しない', async () => {
    setHost('https://dfx.round-0.com/')
    await logDebug({ tag: 'react-crash', message: 'x' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('AC4: INSERT が reject しても throw しない', async () => {
    setHost('https://clawops-abc.vercel.app/')
    insertSpy.mockRejectedValueOnce(new Error('rls denied'))
    await expect(logDebug({ tag: 'react-crash', message: 'x' })).resolves.toBeUndefined()
  })
})

describe('AC2: window グローバルエラー → debug_logs', () => {
  it('window "error" → tag=window-error で INSERT', async () => {
    setHost('https://clawops-abc.vercel.app/')
    installGlobalErrorLogging()
    window.dispatchEvent(new ErrorEvent('error', { message: 'kaboom', filename: 'a.js', lineno: 1 }))
    await Promise.resolve(); await Promise.resolve()
    const tags = insertSpy.mock.calls.map(c => c[0].tag)
    expect(tags).toContain('window-error')
  })

  it('unhandledrejection → tag=unhandled-rejection で INSERT', async () => {
    setHost('https://clawops-abc.vercel.app/')
    installGlobalErrorLogging()
    const ev = new Event('unhandledrejection')
    ev.reason = new Error('promise boom')
    window.dispatchEvent(ev)
    await Promise.resolve(); await Promise.resolve()
    const tags = insertSpy.mock.calls.map(c => c[0].tag)
    expect(tags).toContain('unhandled-rejection')
  })
})
