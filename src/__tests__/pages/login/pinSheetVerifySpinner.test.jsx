// @vitest-environment happy-dom
// SPEC-LOGIN-PIN-VERIFY-SPINNER-01: PIN照合中進捗オーバーレイ
// AC1: submitting中 pin-verifying-overlay + 認証中… 表示
// AC2: 成功 → onSuccess呼び出し、オーバーレイ消滅
// AC3: 失敗 → オーバーレイ消滅、PINが違うようです表示
// AC4: systemError → オーバーレイ消滅、認証処理でエラー表示
// AC5: submitting中 × ボタンで onClose 発火しない
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../pages/login/pinVerifier', () => ({
  verifyPin: vi.fn(),
}))
import { verifyPin } from '../../../pages/login/pinVerifier'
import PinSheet from '../../../pages/login/PinSheet'

const STAFF = { staff_id: 'S_SPINNER', name: 'スピナーテスト' }

function mkProps(overrides = {}) {
  return { staff: STAFF, onClose: vi.fn(), onSuccess: vi.fn(), ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('SPEC-LOGIN-PIN-VERIFY-SPINNER-01 PIN照合オーバーレイ', () => {
  it('when_submitting_should_show_pin_verifying_overlay_with_spinner_text', async () => {
    // AC1: 4桁入力後 submitting=true → オーバーレイ表示
    let resolve
    verifyPin.mockReturnValue(new Promise(r => { resolve = r }))
    render(<PinSheet {...mkProps()} />)
    for (const n of [1, 2, 3, 4]) fireEvent.pointerDown(screen.getByTestId(`pin-key-${n}`))
    await waitFor(() => expect(screen.getByTestId('pin-verifying-overlay')).toBeTruthy())
    expect(screen.getByText('認証中…')).toBeTruthy()
    resolve({ ok: true, session: {}, sessionPromise: Promise.resolve() })
  })

  it('when_verify_succeeds_should_call_onSuccess_and_overlay_disappears', async () => {
    // AC2: 成功 → onSuccess呼び出し、オーバーレイ消滅
    verifyPin.mockResolvedValue({ ok: true, session: {}, sessionPromise: Promise.resolve() })
    const onSuccess = vi.fn()
    render(<PinSheet {...mkProps({ onSuccess })} />)
    for (const n of [1, 2, 3, 4]) fireEvent.pointerDown(screen.getByTestId(`pin-key-${n}`))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('pin-verifying-overlay')).toBeNull()
  })

  it('when_verify_fails_should_hide_overlay_and_show_wrong_pin_message', async () => {
    // AC3: 失敗 → オーバーレイ消滅、既存shake+PINが違うようです
    verifyPin.mockResolvedValue({ ok: false })
    render(<PinSheet {...mkProps()} />)
    for (const n of [1, 2, 3, 4]) fireEvent.pointerDown(screen.getByTestId(`pin-key-${n}`))
    await waitFor(() => expect(screen.getByText('PINが違うようです、もう一度')).toBeTruthy())
    expect(screen.queryByTestId('pin-verifying-overlay')).toBeNull()
  })

  it('when_verify_throws_should_hide_overlay_and_show_system_error', async () => {
    // AC4: systemError → オーバーレイ消滅、認証処理でエラーが発生しました
    vi.spyOn(console, 'error').mockImplementation(() => {})
    verifyPin.mockRejectedValue(new Error('network error'))
    render(<PinSheet {...mkProps()} />)
    for (const n of [1, 2, 3, 4]) fireEvent.pointerDown(screen.getByTestId(`pin-key-${n}`))
    await waitFor(() => expect(screen.getByText('認証処理でエラーが発生しました')).toBeTruthy())
    expect(screen.queryByTestId('pin-verifying-overlay')).toBeNull()
  })

  it('when_submitting_should_not_call_onClose_on_x_button_click', async () => {
    // AC5: submitting中 × ボタンで閉じが無効
    let resolve
    verifyPin.mockReturnValue(new Promise(r => { resolve = r }))
    const onClose = vi.fn()
    render(<PinSheet {...mkProps({ onClose })} />)
    for (const n of [1, 2, 3, 4]) fireEvent.pointerDown(screen.getByTestId(`pin-key-${n}`))
    await waitFor(() => expect(screen.getByTestId('pin-verifying-overlay')).toBeTruthy())
    fireEvent.click(screen.getByText('×'))
    expect(onClose).not.toHaveBeenCalled()
    resolve({ ok: true, session: {}, sessionPromise: Promise.resolve() })
  })
})
