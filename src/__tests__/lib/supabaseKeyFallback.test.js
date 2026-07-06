// @vitest-environment node
// SPEC-HOTFIX-APIKEY-FALLBACK-01 AC1: non-JWT env key -> legacy anon JWT + warn;
// JWT env key -> used as-is, no warn.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createClientMock = vi.fn(() => ({ __client: true }))
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a) => createClientMock(...a) }))

const LEGACY_PREFIX = 'eyJhbGciOiJIUzI1Ni'

async function loadSupabase(anonKey) {
  vi.resetModules()
  createClientMock.mockClear()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey)
  await import('../../lib/supabase')
}

let warnSpy
beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { warnSpy.mockRestore(); vi.unstubAllEnvs() })

describe('SPEC-HOTFIX-APIKEY-FALLBACK-01 AC1', () => {
  it('non-JWT env key (sb_publishable_x) falls back to the legacy JWT and warns', async () => {
    await loadSupabase('sb_publishable_IzlPureuUqGFLmiytYHeTw_jSQS2SXF')
    expect(createClientMock).toHaveBeenCalledTimes(1)
    const [url, key] = createClientMock.mock.calls[0]
    expect(url).toBe('https://test.supabase.co')
    expect(key.startsWith(LEGACY_PREFIX)).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith('APIKEY-FALLBACK: non-JWT env key detected, using legacy anon key')
  })

  it('JWT env key (eyJ...) is used as-is with no warn', async () => {
    await loadSupabase('eyJtest.header.payload')
    expect(createClientMock).toHaveBeenCalledTimes(1)
    const [, key] = createClientMock.mock.calls[0]
    expect(key).toBe('eyJtest.header.payload')
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
