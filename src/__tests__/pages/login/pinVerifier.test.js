import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../msw/server'

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}))

vi.mock('../../../lib/sessionStore', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn().mockResolvedValue(undefined),
}))

const { verifyPin } = await import('../../../pages/login/pinVerifier')
import bcrypt from 'bcryptjs'
import { loadSession, saveSession } from '../../../lib/sessionStore'

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
  // default: no cached session → fall through to server
  loadSession.mockResolvedValue(null)
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

    expect(bcrypt.compare).toHaveBeenCalledWith('1234', staffWithPin.pin_hash)
    expect(capturedBody?.skip_bcrypt).toBe(true)
    expect(capturedBody?.pin).toBeUndefined()
    expect(result.ok).toBe(true)
    expect(result.session).toEqual(fakeSession)
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

  it('when_bcrypt_matches_but_verify_pin_fails_returns_not_ok', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    setupVerifyPinFail()

    const result = await verifyPin(staffWithPin, '1234')

    expect(result.ok).toBe(false)
    expect(result.bcryptFail).toBeUndefined()
  })

  it('when_skip_bcrypt_true_admin_session_issued_server_bcrypt_bypassed', async () => {
    // SPEC-LOGIN-ADMIN-SESSION-01: skip_bcrypt=true path uses admin.createSession server-side
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
    expect(capturedBody?.skip_bcrypt).toBe(true)
    expect(capturedBody?.pin).toBeUndefined()
    expect(result.ok).toBe(true)
    expect(result.session).toEqual(fakeSession)
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

  it('when_bcrypt_matches_and_cached_session_valid_skips_server', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    const cachedSession = { access_token: 'cached-tok', refresh_token: 'cached-ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    loadSession.mockResolvedValueOnce(cachedSession)
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
    expect(result.session.access_token).toBe('cached-tok')
  })

  it('when_bcrypt_matches_and_server_succeeds_saves_session', async () => {
    bcrypt.compare.mockResolvedValueOnce(true)
    setupVerifyPinOk()

    await verifyPin(staffWithPin, '1234')

    expect(saveSession).toHaveBeenCalledWith('S1', fakeSession)
  })
})
