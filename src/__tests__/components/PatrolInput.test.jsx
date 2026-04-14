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
    useLocation: () => ({
      state: {
        booth: {
          booth_code: 'KOS01-M01-B01', booth_number: 1,
          machine_code: 'KOS01-M01', play_price: '100',
        },
      },
    }),
  }
})

vi.mock('../../hooks/usePatrolInput', () => ({ usePatrolInput: vi.fn(), STATUS_OPTIONS: [] }))
vi.mock('../../components/LogoutButton', () => ({ default: () => null }))
vi.mock('../../components/ErrorDisplay', () => ({ default: ({ error }) => error ? <div>{error}</div> : null }))

import { usePatrolInput } from '../../hooks/usePatrolInput'
import PatrolInput from '../../patrol/pages/PatrolInput'

const BOOTH = {
  booth_code: 'KOS01-M01-B01', booth_number: 1,
  machine_code: 'KOS01-M01', play_price: '100',
}

function makeHookReturn(overrides = {}) {
  return {
    loading: false,
    machineName: 'テスト機',
    storeName: 'テスト店',
    booths: [BOOTH],
    currentIndex: 0,
    currentBooth: BOOTH,
    inputs: {},
    monthlyStatsMap: {},
    prevDayDate: '2026-04-08',
    setPrevDayDate: vi.fn(),
    todayDate: '2026-04-09',
    currentInp: {},
    price: 100,
    latest: { in_meter: '5000', out_meter: '3000', prize_name: 'テスト景品', read_time: '2026-04-05' },
    last: { in_meter: '5000', out_meter: '3000', read_time: '2026-04-04' },
    latestIn: 5000, latestOut: 3000,
    lastIn: 5000, lastOut: 3000,
    inDiff: null, outDiff: null,
    inAbnormal: false, outAbnormal: false,
    inZero: false, inTriple: false,
    payoutRate: null, payoutHigh: false, payoutLow: false,
    setInp: vi.fn(),
    setInpChange: vi.fn(),
    toggleChange: vi.fn(),
    switchBooth: vi.fn(),
    handleSave: vi.fn().mockResolvedValue({ ok: true }),
    savedSet: new Set(),
    savedCount: 0,
    draftCount: 0,
    ...overrides,
  }
}

function renderPatrolInput() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/patrol/input', state: { booth: BOOTH } }]}>
      <PatrolInput />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('PatrolInput — 異常値アラートバナー', () => {
  it('inZero=true のとき INゼロ バナーが表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5000' }, inDiff: 0, inZero: true,
    }))
    renderPatrolInput()
    expect(screen.getByText(/INゼロ/)).toBeTruthy()
    expect(screen.getByText(/異常値を検出/)).toBeTruthy()
  })

  it('inTriple=true のとき IN差分3倍 バナーが表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5400' }, inDiff: 400, inTriple: true,
    }))
    renderPatrolInput()
    expect(screen.getByText(/IN差分3倍/)).toBeTruthy()
  })

  it('payoutHigh=true のとき 出率高 バナーが表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100', out_meter: '3100' },
      inDiff: 100, outDiff: 40,
      payoutRate: 40, payoutHigh: true, payoutLow: false,
    }))
    renderPatrolInput()
    expect(screen.getByText(/出率高/)).toBeTruthy()
  })

  it('payoutLow=true のとき 出率低 バナーが表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100', out_meter: '3002' },
      inDiff: 100, outDiff: 2,
      payoutRate: 2, payoutHigh: false, payoutLow: true,
    }))
    renderPatrolInput()
    expect(screen.getByText(/出率低/)).toBeTruthy()
  })

  it('異常値なしのときバナーが表示されない', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100' }, inDiff: 100,
    }))
    renderPatrolInput()
    expect(screen.queryByText(/異常値を検出/)).toBeNull()
  })
})

describe('PatrolInput — 保存確認モーダル', () => {
  it('保存ボタン押下で確認モーダルが表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100' }, inDiff: 100,
    }))
    renderPatrolInput()
    fireEvent.click(screen.getByRole('button', { name: /B01 を保存/ }))
    expect(screen.getByText('保存確認')).toBeTruthy()
    expect(screen.getAllByText('B01').length).toBeGreaterThanOrEqual(1)
  })

  it('モーダルの「戻る」で閉じ handleSave が呼ばれない', () => {
    const handleSave = vi.fn()
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100' }, inDiff: 100, handleSave,
    }))
    renderPatrolInput()
    fireEvent.click(screen.getByRole('button', { name: /B01 を保存/ }))
    expect(screen.getByText('保存確認')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))
    expect(screen.queryByText('保存確認')).toBeNull()
    expect(handleSave).not.toHaveBeenCalled()
  })

  it('モーダルの「保存する」で handleSave が呼ばれる', async () => {
    const handleSave = vi.fn().mockResolvedValue({ ok: true })
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100' }, inDiff: 100, handleSave,
    }))
    renderPatrolInput()
    fireEvent.click(screen.getByRole('button', { name: /B01 を保存/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() => expect(handleSave).toHaveBeenCalledOnce())
  })

  it('異常値ありのときモーダルに警告が表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      currentInp: { in_meter: '5100' }, inDiff: 100, inTriple: true,
    }))
    renderPatrolInput()
    fireEvent.click(screen.getByRole('button', { name: /B01 を保存/ }))
    expect(screen.getByText(/異常値あり/)).toBeTruthy()
  })
})

describe('PatrolInput — 月次統計', () => {
  it('monthlyStats あり → 今月/前月売上が表示される', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({
      monthlyStatsMap: {
        'KOS01-M01-B01': {
          curr: { plays: 500, revenue: 50000, outTotal: 150, payoutRate: 30 },
          prev: { plays: 400, revenue: 40000, outTotal: 100, payoutRate: 25 },
        },
      },
    }))
    renderPatrolInput()
    expect(screen.getByText('¥50,000')).toBeTruthy()
    expect(screen.getByText('¥40,000')).toBeTruthy()
  })

  it('monthlyStats なし → 統計行が表示されない', () => {
    usePatrolInput.mockReturnValue(makeHookReturn({ monthlyStatsMap: {} }))
    renderPatrolInput()
    expect(screen.queryByText('今月')).toBeNull()
  })
})
