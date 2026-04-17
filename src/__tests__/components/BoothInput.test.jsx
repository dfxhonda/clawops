// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'staff-1' }) }))
vi.mock('../../services/patrol', () => ({
  getLastReading: vi.fn().mockResolvedValue(null),
  saveBoothReading: vi.fn().mockResolvedValue({}),
  saveLockerRestocks: vi.fn().mockResolvedValue({}),
}))
vi.mock('../../patrol/components/PrizeSearchModal', () => ({ default: ({ onSelect, onClose }) => (
  <div data-testid="prize-modal">
    <button onClick={() => onSelect({ prize_name: '選択景品' })}>select</button>
    <button onClick={onClose}>close</button>
  </div>
)}))
vi.mock('../../patrol/components/LockerInput', () => ({ default: ({ onDone }) => (
  <div data-testid="locker-input">
    <button onClick={onDone}>locker-done</button>
  </div>
)}))

import { getLastReading, saveBoothReading } from '../../services/patrol'
import BoothInput from '../../patrol/pages/BoothInput'

const BOOTH = {
  booth_code: 'KOS01-M01-B01',
  booth_number: 1,
  play_price: '100',
  meter_out_number: 1,
}

const MACHINE = {
  machine_code: 'KOS01-M01',
  machine_name: 'テスト機',
}

function renderWithState(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/patrol/booth', state }]}>
      <BoothInput />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getLastReading.mockResolvedValue(null)
  saveBoothReading.mockResolvedValue({})
})

describe('BoothInput — ガード', () => {
  it('location.state が null のとき /patrol/overview に遷移する', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/patrol/booth', state: null }]}>
        <BoothInput />
      </MemoryRouter>
    )
    expect(mockNavigate).toHaveBeenCalledWith('/patrol/overview', { replace: true })
  })
})

describe('BoothInput — レンダリング', () => {
  it('機械名・ブースコード・クレーンバッジが表示される', () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    expect(screen.getByText('テスト機')).toBeTruthy()
    expect(screen.getByText('KOS01-M01-B01')).toBeTruthy()
    expect(screen.getByText('クレーン')).toBeTruthy()
  })

  it('isGacha=true のときガチャバッジが表示される', () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店', isGacha: true })
    expect(screen.getByText('ガチャ')).toBeTruthy()
  })

  it('前回データがあるとき前回セクションが表示される', async () => {
    getLastReading.mockResolvedValue({
      in_meter: 5000, out_meter: 3000, read_date: '2026-04-09',
    })
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    await waitFor(() => {
      expect(screen.getByText(/5,000/)).toBeTruthy()
      expect(screen.getByText(/3,000/)).toBeTruthy()
    })
  })
})

describe('BoothInput — バリデーション', () => {
  it('INメーター未入力で保存ボタンを押すとエラーメッセージが表示される', () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('INメーターを入力してください')).toBeTruthy()
    expect(saveBoothReading).not.toHaveBeenCalled()
  })
})

describe('BoothInput — 保存', () => {
  it('INメーター入力後に保存すると saveBoothReading が呼ばれる', async () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '5500' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(saveBoothReading).toHaveBeenCalledWith(
        expect.objectContaining({ boothCode: 'KOS01-M01-B01', inMeter: '5500' })
      )
    })
  })

  it('保存成功後に「保存しました」バナーが表示される', async () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '5500' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(screen.getByText('保存しました')).toBeTruthy()
    })
  })

  it('保存失敗時にエラーメッセージが表示される', async () => {
    saveBoothReading.mockRejectedValue(new Error('DB接続エラー'))
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '5500' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(screen.getByText('DB接続エラー')).toBeTruthy()
    })
  })

  it('ガチャ保存後 lockers があるとき LockerInput が表示される', async () => {
    const lockers = [{ locker_id: 'L1', locker_number: 1, slot_count: 5, lock_type: 'key' }]
    renderWithState({
      booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店',
      isGacha: true, lockers,
    })
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '5500' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(screen.getByTestId('locker-input')).toBeTruthy()
    })
  })

  it('ガチャ保存後 lockers がないとき navigate(-1) が呼ばれる', async () => {
    renderWithState({
      booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店',
      isGacha: true, lockers: [],
    })
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '5500' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(saveBoothReading).toHaveBeenCalled())
    // setTimeout 500ms → navigate(-1)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(-1), { timeout: 1500 })
  })
})

describe('BoothInput — 景品検索', () => {
  it('🔍 ボタンで PrizeSearchModal が開く', () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    fireEvent.click(screen.getByRole('button', { name: '🔍' }))
    expect(screen.getByTestId('prize-modal')).toBeTruthy()
  })

  it('景品選択で prizeName が更新されモーダルが閉じる', () => {
    renderWithState({ booth: BOOTH, machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店' })
    fireEvent.click(screen.getByRole('button', { name: '🔍' }))
    fireEvent.click(screen.getByRole('button', { name: 'select' }))
    expect(screen.queryByTestId('prize-modal')).toBeNull()
    expect(screen.getByDisplayValue('選択景品')).toBeTruthy()
  })
})

describe('BoothInput — 複数OUTメーター', () => {
  it('meter_out_number=3 のとき OUT①②③が表示される', () => {
    renderWithState({
      booth: { ...BOOTH, meter_out_number: 3 },
      machine: MACHINE, storeCode: 'KOS01', storeName: 'テスト店',
    })
    expect(screen.getByText(/OUTメーター①/)).toBeTruthy()
    expect(screen.getByText(/OUTメーター②/)).toBeTruthy()
    expect(screen.getByText(/OUTメーター③/)).toBeTruthy()
  })
})
