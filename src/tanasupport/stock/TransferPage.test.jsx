// @vitest-environment happy-dom
// J-STOCK-TRANSFER-fix-02: 持ち出し/帰庫UI(個数入力・保存・在庫不足エラー)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TransferPage from './TransferPage'

const transfer = vi.fn()
let mockHook

vi.mock('./useTransfer', () => ({
  useTransfer: () => mockHook,
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'STAFF-03', staffName: '本田' }),
}))
// locations(倉庫)取得は thenable チェーンで解決
vi.mock('../../lib/supabase', () => {
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain,
    then: (cb) => Promise.resolve(cb({ data: [{ location_id: 'KRM02', location_name: '久留米' }] })),
  }
  return { supabase: { from: () => chain } }
})

const PRIZES = [
  { prize_id: 'A', prize_name: 'ぬいぐるみA', available: 8 },
  { prize_id: 'B', prize_name: 'ぬいぐるみB', available: 2 },
]

function renderPage() {
  render(<MemoryRouter><TransferPage /></MemoryRouter>)
}

beforeEach(() => {
  transfer.mockReset()
  mockHook = { prizes: PRIZES, loading: false, error: null, movementType: 'transfer_out', transfer }
})

describe('TransferPage', () => {
  it('when_景品タップ_should_個数入力シート表示', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('transfer-prize-A'))
    expect(screen.getByTestId('transfer-sheet')).toBeTruthy()
    cleanup()
  })

  it('when_個数入力して保存_should_transferが呼ばれる', async () => {
    transfer.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(screen.getByTestId('transfer-prize-A'))
    const sheet = screen.getByTestId('transfer-sheet')
    fireEvent.pointerDown(within(sheet).getByText('3'))
    fireEvent.click(screen.getByTestId('transfer-save'))
    expect(transfer).toHaveBeenCalledWith('A', '3', 8)
    cleanup()
  })

  it('when_在庫不足でtransferがERR-STOCK-009_should_エラー表示', async () => {
    transfer.mockRejectedValue({ code: 'ERR-STOCK-009', message: '在庫不足: 現在 2 個' })
    renderPage()
    fireEvent.click(screen.getByTestId('transfer-prize-B'))
    const sheet = screen.getByTestId('transfer-sheet')
    fireEvent.pointerDown(within(sheet).getByText('9'))
    fireEvent.click(screen.getByTestId('transfer-save'))
    await screen.findByTestId('transfer-error')
    expect(screen.getByTestId('transfer-error').textContent).toContain('在庫不足')
    cleanup()
  })

  it('when_帰庫タブ_should_方向ボタンが存在', () => {
    renderPage()
    expect(screen.getByTestId('transfer-dir-in')).toBeTruthy()
    cleanup()
  })
})
