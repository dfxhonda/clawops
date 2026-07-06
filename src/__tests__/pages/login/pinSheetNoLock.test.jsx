// @vitest-environment happy-dom
// SPEC-AUTH-TIMELOCK-TUNE-AND-SPINNER-01 B / AC4: PinSheet has no frontend 30s lock;
// throttling is server-side only, so the keypad never locks and no lockout copy appears.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const mockVerifyPin = vi.fn()
vi.mock('../../../pages/login/pinVerifier', () => ({ verifyPin: (...a) => mockVerifyPin(...a) }))

import PinSheet from '../../../pages/login/PinSheet'

const staff = { staff_id: 'S1', name: 'テスト' }

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyPin.mockResolvedValue({ ok: false })
})

async function wrongAttempt(getByTestId) {
  for (const d of [1, 2, 3, 4]) fireEvent.pointerDown(getByTestId(`pin-key-${d}`))
  // submit runs; wait until it resolves and the keypad is interactive again
  await waitFor(() => expect(getByTestId('pin-key-1').disabled).toBe(false))
}

describe('SPEC-AUTH-TIMELOCK-TUNE-AND-SPINNER-01 B: PinSheet frontend lock removed', () => {
  it('keypad stays enabled after 4 wrong PINs (crosses old 3-fail lock) and shows retry, not lockout', async () => {
    const { getByTestId, queryByText } = render(
      <PinSheet staff={staff} onClose={() => {}} onSuccess={() => {}} />
    )
    for (let i = 0; i < 4; i++) await wrongAttempt(getByTestId)

    // never locks (old code disabled the keypad at 3 fails for 30s)
    expect(getByTestId('pin-key-1').disabled).toBe(false)
    expect(getByTestId('pin-key-0').disabled).toBe(false)
    expect(getByTestId('pin-backspace').disabled).toBe(false)

    // no lockout / countdown copy (lock-state must not be surfaced)
    expect(queryByText('管理者に連絡してください')).toBeNull()
    expect(queryByText(/秒後に再試行できます/)).toBeNull()

    // shows the generic retry hint
    expect(queryByText('PINが違うようです、もう一度')).toBeTruthy()
    expect(mockVerifyPin).toHaveBeenCalledTimes(4)
  })
})
