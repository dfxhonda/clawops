// @vitest-environment happy-dom
// SPEC-LOGIN-PIN-CLEAN-OPEN-01: PINシート初開時の赤エラー表示を抑制
// AC1: 初開 → エラー出ず「PINを入力してください」グレー
// AC2: 今回PIN間違え → 「PINが違うようです」赤
// AC3: 過去failあり → 初開では赤エラー非表示
// AC4/AC5 UPDATED by SPEC-AUTH-TIMELOCK-TUNE-AND-SPINNER-01 B: the frontend 30s lock +
//   admin-contact message were removed (server-side throttle only) -> assert their ABSENCE.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// verifyPin をモック
vi.mock('../../../pages/login/pinVerifier', () => ({
  verifyPin: vi.fn(),
}))
import { verifyPin } from '../../../pages/login/pinVerifier'
import PinSheet from '../../../pages/login/PinSheet'

const STAFF = { staff_id: 'S1', name: 'テスト太郎' }

function mkProps(overrides = {}) {
  return {
    staff: STAFF,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('SPEC-LOGIN-PIN-CLEAN-OPEN-01 PINシート初開クリーン表示', () => {
  it('when_sheet_opened_fresh_should_show_neutral_prompt_not_error', () => {
    // AC1: 過去fail なし → 「PINを入力してください」グレー
    render(<PinSheet {...mkProps()} />)
    expect(screen.getByText('PINを入力してください')).toBeTruthy()
    expect(screen.queryByText(/PINが違う/)).toBeNull()
  })

  it('when_wrong_pin_entered_should_show_error_message', async () => {
    // AC2: 今回PIN間違え → エラー表示
    verifyPin.mockResolvedValue({ ok: false })
    render(<PinSheet {...mkProps()} />)

    // 4桁入力 (wrong PIN)
    for (const n of [1, 2, 3, 4]) {
      fireEvent.pointerDown(screen.getByTestId(`pin-key-${n}`))
    }
    await waitFor(() => expect(screen.getByText('PINが違うようです、もう一度')).toBeTruthy())
  })

  it('when_sheet_opened_with_past_fail_should_not_show_error_before_attempt', () => {
    // AC3: 過去fail.count=2 がある → 初開時はエラー非表示
    sessionStorage.setItem(`fail_${STAFF.staff_id}`, JSON.stringify({ count: 2, lockedUntil: 0 }))
    render(<PinSheet {...mkProps()} />)
    expect(screen.getByText('PINを入力してください')).toBeTruthy()
    expect(screen.queryByText(/PINが違う/)).toBeNull()
  })

  it('no_frontend_lockout_countdown_even_with_stale_lock_data (D-028 B)', () => {
    // Front 30s lock removed -> stale sessionStorage is ignored, keypad never locks.
    sessionStorage.setItem(`fail_${STAFF.staff_id}`, JSON.stringify({ count: 3, lockedUntil: Date.now() + 25000 }))
    render(<PinSheet {...mkProps()} />)
    expect(screen.getByText('PINを入力してください')).toBeTruthy()
    expect(screen.queryByText(/秒後に再試行/)).toBeNull()
    expect(screen.getByTestId('pin-key-1').disabled).toBe(false)
  })

  it('no_admin_contact_lockout_message (D-028 B removed it)', () => {
    // lock-state must not be surfaced; throttle is a delay, not a lockout.
    sessionStorage.setItem(`fail_${STAFF.staff_id}`, JSON.stringify({ count: 5, lockedUntil: 0 }))
    render(<PinSheet {...mkProps()} />)
    expect(screen.queryByText('管理者に連絡してください')).toBeNull()
    expect(screen.getByText('PINを入力してください')).toBeTruthy()
  })
})
