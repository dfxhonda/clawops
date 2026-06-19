import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../msw/server'

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

const { verifyPin } = await import('../../../pages/login/pinVerifier')
import * as bcrypt from 'bcryptjs'
import { supabase } from '../../../lib/supabase'

const VERIFY_PIN_URL = 'http://localhost:54321/functions/v1/verify-pin'

const staffWithPin = { staff_id: 'S1', has_pin: true, pin_hash: '$2a$08$testhash' }
const staffNoPin  = { staff_id: 'S2', has_pin: false, pin_hash: null }
const fakeSession = { access_token: 'tok', refresh_token: 'ref' }

function setupVerifyPinOk() {
  server.use(
    http.post(VERIFY_PIN_URL, () =>
      HttpResponse.json({ session: fakeSession })
    )
  )
}
function setupVerifyPinFail() {
  server.use(
    http.post(VERIFY_PIN_URL, () =>
      HttpResponse.json({ error: '認証失敗' }, { status: 401 })
    )
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // default: no active session → fall through to server
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
})

describe('verifyPin', () => {
  it('when_bcrypt_matches_calls_verify_pin_with_skip_bcrypt_true', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    let capturedBody = null
    server.use(
      http.post(VERIFY_PIN_URL, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ session: fakeSession })
      })
    )

    const result = await verifyPin(staffWithPin, '1234')

    // R3: bcrypt success returns optimistic immediately; server called in background
    expect(bcrypt.compare).toHaveBeenCalledWith('1234', staffWithPin.pin_hash)
    expect(result.ok).toBe(true)
    expect(result.optimistic).toBe(true)
    expect(result.session).toBeUndefined()
    expect(result.sessionPromise).toBeInstanceOf(Promise)

    // Verify skip_bcrypt was sent and session resolves correctly
    const confirmed = await result.sessionPromise
    expect(capturedBody?.skip_bcrypt).toBe(true)
    expect(capturedBody?.pin).toBeUndefined()
    expect(confirmed.ok).toBe(true)
    expect(confirmed.session).toEqual(fakeSession)
  })

  it('when_bcrypt_fails_returns_bcryptFail_without_calling_verify_pin', async () => {
    bcrypt.compare.mockResolvedValueOnce(false)
    let verifyPinCalled = false
    server.use(
      http.post(VERIFY_PIN_URL, () => {
        verifyPinCalled = true
        return HttpResponse.json({ session: fakeSession })
      })
    )

    const result = await verifyPin(staffWithPin, '9999')

    expect(bcrypt.compare).toHaveBeenCalledOnce()
    expect(verifyPinCalled).toBe(false)
    expect(result.ok).toBe(false)
    expect(result.bcryptFail).toBe(true)
  })

  it('when_has_pin_false_calls_verify_pin_without_skip_bcrypt', async () => {
    let capturedBody = null
    server.use(
      http.post(VERIFY_PIN_URL, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ session: fakeSession })
      })
    )

    const result = await verifyPin(staffNoPin, '1234')

    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(capturedBody?.skip_bcrypt).toBeUndefined()
    expect(capturedBody?.pin).toBe('1234')
    expect(result.ok).toBe(true)
  })

  it('when_bcrypt_matches_but_verify_pin_fails_sessionPromise_resolves_not_ok', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    setupVerifyPinFail()

    const result = await verifyPin(staffWithPin, '1234')

    // R3: optimistic immediate return is ok:true; server failure in sessionPromise
    expect(result.ok).toBe(true)
    expect(result.optimistic).toBe(true)

    const confirmed = await result.sessionPromise
    expect(confirmed.ok).toBe(false)
    expect(confirmed.bcryptFail).toBeUndefined()
  })

  it('when_skip_bcrypt_true_server_skips_bcrypt', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    let capturedBody = null
    server.use(
      http.post(VERIFY_PIN_URL, async ({ request }) => {
        capturedBody = await request.json()
        if (!capturedBody.skip_bcrypt) return HttpResponse.json({ error: 'skip_bcrypt expected' }, { status: 500 })
        return HttpResponse.json({ session: fakeSession })
      })
    )
    const result = await verifyPin(staffWithPin, '1234')
    // R3: result is optimistic; verify server received skip_bcrypt via sessionPromise
    const confirmed = await result.sessionPromise
    expect(capturedBody?.skip_bcrypt).toBe(true)
    expect(capturedBody?.pin).toBeUndefined()
    expect(result.ok).toBe(true)
    expect(result.optimistic).toBe(true)
    expect(confirmed.ok).toBe(true)
    expect(confirmed.session).toEqual(fakeSession)
  })

  it('when_has_pin_true_but_no_pin_hash_falls_back_to_normal_flow', async () => {
    const staffNoPinHash = { staff_id: 'S3', has_pin: true, pin_hash: null }
    let capturedBody = null
    server.use(
      http.post(VERIFY_PIN_URL, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ session: fakeSession })
      })
    )

    const result = await verifyPin(staffNoPinHash, '1234')

    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(capturedBody?.skip_bcrypt).toBeUndefined()
    expect(result.ok).toBe(true)
  })

  it('when_bcrypt_matches_and_getSession_returns_matching_staff_skips_server', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    const cachedSession = {
      access_token: 'cached-tok',
      refresh_token: 'cached-ref',
      user: { user_metadata: { staff_id: 'S1' } },
    }
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: cachedSession } })
    let serverCalled = false
    server.use(
      http.post(VERIFY_PIN_URL, () => {
        serverCalled = true
        return HttpResponse.json({ session: fakeSession })
      })
    )

    const result = await verifyPin(staffWithPin, '1234')

    expect(serverCalled).toBe(false)
    expect(result.ok).toBe(true)
    expect(result.reused).toBe(true)
    expect(result.session.access_token).toBe('cached-tok')
  })

  it('when_bcrypt_matches_and_getSession_returns_different_staff_calls_server', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    const otherSession = {
      access_token: 'other-tok',
      user: { user_metadata: { staff_id: 'S99' } },
    }
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: otherSession } })
    setupVerifyPinOk()

    const result = await verifyPin(staffWithPin, '1234')

    // R3: non-matching cached session → optimistic, server called in background
    expect(result.ok).toBe(true)
    expect(result.optimistic).toBe(true)
    expect(result.reused).toBeUndefined()

    const confirmed = await result.sessionPromise
    expect(confirmed.ok).toBe(true)
    expect(confirmed.session).toEqual(fakeSession)
  })

  it('when_bcrypt_matches_no_cached_session_returns_optimistic_promise_immediately', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    server.use(
      http.post(VERIFY_PIN_URL, () => HttpResponse.json({ session: fakeSession }))
    )

    const result = await verifyPin(staffWithPin, '1234')

    expect(result.ok).toBe(true)
    expect(result.optimistic).toBe(true)
    expect(result.sessionPromise).toBeInstanceOf(Promise)
    expect(result.session).toBeUndefined()
  })

  it('when_optimistic_sessionPromise_resolves_with_ok_false_on_network_error', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    server.use(
      http.post(VERIFY_PIN_URL, () => HttpResponse.error())
    )

    const result = await verifyPin(staffWithPin, '1234')
    expect(result.optimistic).toBe(true)

    const confirmed = await result.sessionPromise
    expect(confirmed.ok).toBe(false)
  })

  // AC7: metaChanged両経路 + R4 session.access_token guard
  it('when_server_returns_session_without_access_token_returns_ok_false (R4 guard)', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    server.use(
      http.post(VERIFY_PIN_URL, () =>
        HttpResponse.json({ session: { refresh_token: 'ref' } }) // access_token欠損
      )
    )

    const result = await verifyPin(staffWithPin, '1234')
    expect(result.optimistic).toBe(true)

    const confirmed = await result.sessionPromise
    expect(confirmed.ok).toBe(false)
  })

  it('when_server_returns_null_session_returns_ok_false (R4 guard)', async () => {
    // no-pin path (blocking fetch) — session null
    server.use(
      http.post(VERIFY_PIN_URL, () =>
        HttpResponse.json({ session: null }, { status: 200 })
      )
    )

    const result = await verifyPin(staffNoPin, '1234')
    expect(result.ok).toBe(false)
  })

  it('when_server_returns_session_with_access_token_optimistic_confirms_ok (AC7 metaChanged=true path)', async () => {
    // metaChangedの有無はEdge内部処理。クライアントは常にsession+access_tokenを受け取れば成功
    bcrypt.compare.mockResolvedValueOnce(true)
    const metaChangedSession = { access_token: 'fresh-tok', refresh_token: 'fresh-ref' }
    server.use(
      http.post(VERIFY_PIN_URL, () =>
        HttpResponse.json({ session: metaChangedSession })
      )
    )

    const result = await verifyPin(staffWithPin, '1234')
    expect(result.optimistic).toBe(true)

    const confirmed = await result.sessionPromise
    expect(confirmed.ok).toBe(true)
    expect(confirmed.session.access_token).toBe('fresh-tok')
  })

  it('when_server_returns_session_with_access_token_no_pin_path_ok (AC7 metaChanged=false path)', async () => {
    // no-pin staff → blocking fetch → session with access_token → ok
    const stableSession = { access_token: 'stable-tok', refresh_token: 'stable-ref' }
    server.use(
      http.post(VERIFY_PIN_URL, () =>
        HttpResponse.json({ session: stableSession })
      )
    )

    const result = await verifyPin(staffNoPin, '1234')
    expect(result.ok).toBe(true)
    expect(result.session.access_token).toBe('stable-tok')
  })

  // R3: SPEC-LOGIN-AUTH-HARDEN-A-02 — Edge Function内部3パスの結合仕様テスト
  it('when_no_pin_staff_server_creates_new_salt_user_returns_session (R3 新規)', async () => {
    // no-pin staff → blocking fetch (no skip_bcrypt) → server creates new user with APP_AUTH_SALT → returns session
    const newStaff = { staff_id: 'S_NEW_SALT', has_pin: false, pin_hash: null }
    const freshSession = { access_token: 'new-salt-tok', refresh_token: 'new-salt-ref' }
    let capturedBody = null
    server.use(
      http.post(VERIFY_PIN_URL, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ session: freshSession })
      })
    )
    const result = await verifyPin(newStaff, '5678')
    expect(capturedBody?.skip_bcrypt).toBeUndefined()
    expect(capturedBody?.staff_id).toBe('S_NEW_SALT')
    expect(result.ok).toBe(true)
    expect(result.session.access_token).toBe('new-salt-tok')
  })

  it('when_skip_bcrypt_server_migrates_old_to_new_password_returns_migrated_session (R3 移行)', async () => {
    // bcrypt match → skip_bcrypt=true → server: newPW失敗→oldPW試行→updateUserById→issueSession(newPW) → migrated session
    bcrypt.compare.mockResolvedValueOnce(true)
    const migratedSession = { access_token: 'migrated-tok', refresh_token: 'migrated-ref' }
    let capturedBody = null
    server.use(
      http.post(VERIFY_PIN_URL, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ session: migratedSession })
      })
    )
    const result = await verifyPin(staffWithPin, '1234')
    expect(result.optimistic).toBe(true)
    const confirmed = await result.sessionPromise
    // sessionPromise解決後にcapturedBodyが確定する
    expect(capturedBody?.skip_bcrypt).toBe(true)
    expect(confirmed.ok).toBe(true)
    expect(confirmed.session.access_token).toBe('migrated-tok')
  })

  it('when_skip_bcrypt_stale_cache_forces_server_call_metachanged_fresh_session (R3 metaChanged再signIn)', async () => {
    // cached session exists but staff_id mismatch → server called → server runs metaChanged path → fresh token
    bcrypt.compare.mockResolvedValueOnce(true)
    const staleSession = { access_token: 'stale-tok', user: { user_metadata: { staff_id: 'OTHER_STAFF' } } }
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: staleSession } })
    const refreshedSession = { access_token: 'meta-refreshed-tok', refresh_token: 'meta-refreshed-ref' }
    server.use(
      http.post(VERIFY_PIN_URL, () =>
        HttpResponse.json({ session: refreshedSession })
      )
    )
    const result = await verifyPin(staffWithPin, '1234')
    // stale session staff_id mismatch → optimistic, server called in background
    expect(result.optimistic).toBe(true)
    expect(result.reused).toBeUndefined()
    const confirmed = await result.sessionPromise
    expect(confirmed.ok).toBe(true)
    expect(confirmed.session.access_token).toBe('meta-refreshed-tok')
  })
})
