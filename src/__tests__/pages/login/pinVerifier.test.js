// SPEC-LOGIN-FRONT-BCRYPT-REMOVE-01: bcryptjs廃止後の新仕様テスト
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../msw/server'

const { verifyPin } = await import('../../../pages/login/pinVerifier')

const VERIFY_PIN_URL = 'http://localhost:54321/functions/v1/verify-pin'

const staffWithPin = { staff_id: 'S1', has_pin: true, pin_hash: '$2b$04$somehash' }
const staffNoPin   = { staff_id: 'S2', has_pin: false, pin_hash: null }
const fakeSession  = { access_token: 'tok', refresh_token: 'ref' }

describe('verifyPin', () => {
  it('when_has_pin_true_sends_staff_id_and_pin_without_skip_bcrypt', async () => {
    let capturedBody = null
    server.use(http.post(VERIFY_PIN_URL, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ session: fakeSession })
    }))

    const result = await verifyPin(staffWithPin, '1234')

    expect(capturedBody?.staff_id).toBe('S1')
    expect(capturedBody?.pin).toBe('1234')
    expect(capturedBody?.skip_bcrypt).toBeUndefined()
    expect(result.ok).toBe(true)
    expect(result.session).toEqual(fakeSession)
    expect(result.optimistic).toBeUndefined()
    expect(result.sessionPromise).toBeUndefined()
  })

  it('when_has_pin_false_sends_same_request_as_has_pin_true', async () => {
    let capturedBody = null
    server.use(http.post(VERIFY_PIN_URL, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ session: fakeSession })
    }))

    const result = await verifyPin(staffNoPin, '5678')

    expect(capturedBody?.staff_id).toBe('S2')
    expect(capturedBody?.pin).toBe('5678')
    expect(capturedBody?.skip_bcrypt).toBeUndefined()
    expect(result.ok).toBe(true)
    expect(result.session).toEqual(fakeSession)
  })

  it('when_server_returns_401_returns_ok_false', async () => {
    server.use(http.post(VERIFY_PIN_URL, () =>
      HttpResponse.json({ error: 'PIN不一致' }, { status: 401 })
    ))

    const result = await verifyPin(staffWithPin, '9999')

    expect(result.ok).toBe(false)
    expect(result.session).toBeUndefined()
    expect(result.optimistic).toBeUndefined()
    expect(result.bcryptFail).toBeUndefined()
  })

  it('when_server_returns_session_without_access_token_returns_ok_false', async () => {
    server.use(http.post(VERIFY_PIN_URL, () =>
      HttpResponse.json({ session: { refresh_token: 'ref' } })
    ))

    const result = await verifyPin(staffWithPin, '1234')
    expect(result.ok).toBe(false)
  })

  it('when_server_returns_null_session_returns_ok_false', async () => {
    server.use(http.post(VERIFY_PIN_URL, () =>
      HttpResponse.json({ session: null })
    ))

    const result = await verifyPin(staffNoPin, '1234')
    expect(result.ok).toBe(false)
  })

  it('when_network_error_throws_propagates_to_pinsheet_catch', async () => {
    server.use(http.post(VERIFY_PIN_URL, () => HttpResponse.error()))

    await expect(verifyPin(staffWithPin, '1234')).rejects.toThrow()
  })
})
