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
    useParams: () => ({ machineId: 'M01' }),
    useLocation: () => ({ state: { storeName: 'テスト店', storeId: 'S01' } }),
  }
})

vi.mock('../../hooks/useBoothInput', () => ({ useBoothInput: vi.fn() }))
vi.mock('../../components/LogoutButton', () => ({ default: () => null }))
vi.mock('../../components/ErrorDisplay', () => ({ default: ({ error }) => error ? <div>{error}</div> : null }))
vi.mock('../../components/PrizeSearchModal', () => ({ default: () => null }))
vi.mock('../../services/prizes', () => ({ getPrizes: vi.fn().mockResolvedValue([]) }))
vi.mock('../../lib/auth/AuthProvider', () => ({ useAuth: () => ({ staffId: null }) }))

import { useBoothInput } from '../../hooks/useBoothInput'
import BoothInput from '../../pages/BoothInput'

const BOOTH = {
  booth_code: 'KOS01-M01-B01', booth_number: 1, play_price: '100',
}

function makeHookReturn(overrides = {}) {
  const mockGetRef = vi.fn(() => () => {})
  return {
    booths: [BOOTH],
    machineName: 'テスト機',
    readingsMap: {},
    inputs: {},
    vehicleStocks: [],
    monthlyStatsMap: {},
    readDate: '2026-04-06',
    setReadDate: vi.fn(),
    filter: 'all',
    setFilter: vi.fn(),
    filteredBooths: [BOOTH],
    inputCount: 0,
    anomalyCount: 0,
    loading: false,
    showVehiclePanel: false,
    setShowVehiclePanel: vi.fn(),
    staffId: null,
    setInp: vi.fn(),
    handleKeyDown: vi.fn(),
    handleSaveAll: vi.fn().mockResolvedValue({ ok: true, count: 1, failedItems: [] }),
    getRef: mockGetRef,
    setStaffId: vi.fn(),
    clearStaff: vi.fn(),
    scrollToBooth: vi.fn(),
    ...overrides,
  }
}

function renderBoothInput() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/booth/M01', state: { storeName: 'テスト店', storeId: 'S01' } }]}>
      <BoothInput />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('BoothInput — 保存確認モーダル', () => {
  it('inputCount=0 のとき保存ボタンを押してもモーダルが開かない', () => {
    useBoothInput.mockReturnValue(makeHookReturn({ inputCount: 0 }))
    renderBoothInput()
    fireEvent.click(screen.getByRole('button', { name: /入力してください/ }))
    expect(screen.queryByText('保存確認')).toBeNull()
  })

  it('inputCount>0 のとき保存ボタン押下で確認モーダルが表示される', () => {
    useBoothInput.mockReturnValue(makeHookReturn({ inputCount: 1, inputs: { 'KOS01-M01-B01': { in_meter: '5100' } } }))
    renderBoothInput()
    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))
    expect(screen.getByText('保存確認')).toBeTruthy()
    expect(screen.getByText('1 / 1 件')).toBeTruthy()
  })

  it('モーダルの「戻る」押下でモーダルが閉じ handleSaveAll は呼ばれない', () => {
    const handleSaveAll = vi.fn()
    useBoothInput.mockReturnValue(makeHookReturn({
      inputCount: 1, inputs: { 'KOS01-M01-B01': { in_meter: '5100' } },
      handleSaveAll,
    }))
    renderBoothInput()
    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))
    expect(screen.getByText('保存確認')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))
    expect(screen.queryByText('保存確認')).toBeNull()
    expect(handleSaveAll).not.toHaveBeenCalled()
  })

  it('モーダルの「保存する」押下で handleSaveAll が呼ばれ /drafts に遷移', async () => {
    const handleSaveAll = vi.fn().mockResolvedValue({ ok: true, count: 1, failedItems: [] })
    useBoothInput.mockReturnValue(makeHookReturn({
      inputCount: 1, inputs: { 'KOS01-M01-B01': { in_meter: '5100' } },
      handleSaveAll,
    }))
    renderBoothInput()
    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() => {
      expect(handleSaveAll).toHaveBeenCalledOnce()
      expect(mockNavigate).toHaveBeenCalledWith('/drafts', expect.any(Object))
    })
  })

  it('anomalyCount>0 のときモーダルに異常値台数が表示される', () => {
    useBoothInput.mockReturnValue(makeHookReturn({
      inputCount: 1, anomalyCount: 2, inputs: { 'KOS01-M01-B01': { in_meter: '5100' } },
    }))
    renderBoothInput()
    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))
    expect(screen.getByText(/⚠️.*2.*台/)).toBeTruthy()
  })
})

describe('BoothInput — 異常値アラートバナー', () => {
  it('inDiff=0 のとき INゼロ バナーが表示される', () => {
    useBoothInput.mockReturnValue(makeHookReturn({
      inputCount: 1,
      inputs: { 'KOS01-M01-B01': { in_meter: '5000' } },
      readingsMap: {
        'KOS01-M01-B01': {
          latest: { in_meter: '5000', out_meter: '3000' },
          last:   { in_meter: '5000', out_meter: '3000' },
        },
      },
    }))
    renderBoothInput()
    expect(screen.getByText(/INゼロ/)).toBeTruthy()
  })

  it('inDiff > prevInDiff × 3（かつ prevInDiff>50）のとき IN差分3倍 バナーが表示される', () => {
    // prevInDiff = 1100 - 1000 = 100 (>50), inDiff = 1400 - 1000 = 400 > 100*3
    useBoothInput.mockReturnValue(makeHookReturn({
      inputCount: 1,
      inputs: { 'KOS01-M01-B01': { in_meter: '1400' } },
      readingsMap: {
        'KOS01-M01-B01': {
          latest: { in_meter: '1100', out_meter: '600' },
          last:   { in_meter: '1000', out_meter: '500' },
        },
      },
    }))
    renderBoothInput()
    expect(screen.getByText(/IN差分3倍/)).toBeTruthy()
  })
})
