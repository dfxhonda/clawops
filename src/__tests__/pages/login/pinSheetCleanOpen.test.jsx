// @vitest-environment happy-dom
// SPEC-LOGIN-PIN-CLEAN-OPEN-01: PINシート初開時の赤エラー表示を抑制
// AC1: 初開 → エラー出ず「PINを入力してください」グレー
// AC2: 今回PIN間違え → 「PINが違うようです」赤
// AC3: 過去failあり → 初開では赤エラー非表示
// AC4: 3回ロック中 → 「×秒後に再試行」表示
// AC5: 5回以上 → 「管理者に連絡」表示
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

  it('when_lockout_active_should_show_countdown_not_pin_error', () => {
    // AC4: 3回失敗ロック中 → 「×秒後に再試行」表示
    const lockedUntil = Date.now() + 25000
    sessionStorage.setItem(`fail_${STAFF.staff_id}`, JSON.stringify({ count: 3, lockedUntil }))
    render(<PinSheet {...mkProps()} />)
    expect(screen.getByText(/秒後に再試行/)).toBeTruthy()
    expect(screen.queryByText(/PINが違う/)).toBeNull()
  })

  it('when_fail_count_5_or_more_should_show_admin_contact_message', () => {
    // AC5: fail.count >= 5 → 「管理者に連絡」表示
    sessionStorage.setItem(`fail_${STAFF.staff_id}`, JSON.stringify({ count: 5, lockedUntil: 0 }))
    render(<PinSheet {...mkProps()} />)
    expect(screen.getByText('管理者に連絡してください')).toBeTruthy()
  })
})
