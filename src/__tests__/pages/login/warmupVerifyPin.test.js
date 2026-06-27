// @vitest-environment happy-dom
// SPEC-LOGIN-VERIFYPIN-WARMUP-IMPL-01: warmupVerifyPin AC1 - fire-and-forget POST, cooldown, offline skip
// SPEC-LOGIN-UPDATE-PREFETCH-01: warmup GET→POST変更。同一コードパスで cold start を確実に温める。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../lib/supabase', () => ({}))
vi.mock('../../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))

const SUPABASE_URL = 'https://test.supabase.co'

vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL)

// Import after env stub
let warmupVerifyPin
beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../../../pages/login/pinVerifier')
  warmupVerifyPin = mod.warmupVerifyPin
})

afterEach(() => {
  vi.unstubAllEnvs()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
})

describe('SPEC-LOGIN-UPDATE-PREFETCH-01: warmupVerifyPin fire-and-forget POST', () => {
  it('when_online_should_fire_POST_to_verify_pin_with_warmup_body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    warmupVerifyPin()

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/verify-pin'),
      expect.objectContaining({ method: 'POST' })
    )
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.staff_id).toBe('__warmup__')
  })

  it('when_fetch_throws_should_not_propagate_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    // Should not throw
    expect(() => warmupVerifyPin()).not.toThrow()
  })
})

describe('SPEC-LOGIN-VERIFYPIN-WARMUP-IMPL-01 AC1: cooldown guard', () => {
  it('when_called_twice_within_10s_should_fire_only_once', () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    warmupVerifyPin()
    warmupVerifyPin() // within cooldown

    expect(mockFetch).toHaveBeenCalledOnce()
  })
})

describe('SPEC-LOGIN-VERIFYPIN-WARMUP-IMPL-01 AC1: offline skip', () => {
  it('when_offline_should_not_fire_GET', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    warmupVerifyPin()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
