// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// ── サービスモック ──────────────────────────────────────────────────────────────
vi.mock('../../services/patrolV2', () => ({
  getLastReadingV2: vi.fn(),
  getMachineInfo: vi.fn(),
  saveReadingV2: vi.fn(),
  getYesterdayPatrol: vi.fn(),
  updatePatrolReading: vi.fn(),
  saveReplaceReadingV2: vi.fn(),
  getReadingBefore: vi.fn(),
}))
vi.mock('../../utils/format', () => ({
  getDateOptions: vi.fn(() => [
    { label: '昨日 5/4(月)', value: '2026-05-04' },
    { label: '今日 5/5(火)', value: '2026-05-05' },
  ]),
}))

import { usePatrolForm } from '../../hooks/usePatrolForm'
import { getLastReadingV2, getMachineInfo } from '../../services/patrolV2'

const MOCK_BOOTH = {
  booth_code: 'TEST01-M01-B01',
  machine_code: 'TEST01-M01',
  play_price: '100',
}

const MOCK_MACHINE_INFO = {
  machineName: 'テスト機1',
  storeName: 'テスト店舗',
  storeCode: 'TEST01',
  category: 'crane',
  outCount: 1,
  hasLocker: false,
  playPrice: 100,
}

describe('usePatrolForm — inMeter 初期化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMachineInfo.mockResolvedValue(MOCK_MACHINE_INFO)
  })

  it('前回 inMeter=50000 のとき patrol.inMeter が "50000" になる', async () => {
    getLastReadingV2.mockResolvedValue({
      _raw: { reading_id: 'r-001', in_meter: 50000, out_meter: 45000 },
      readTime: '2026-05-04T12:00:00+09:00',
      inMeter: 50000,
      outMeter: 45000,
      outMeter2: null,
      outMeter3: null,
      prizeName: 'テスト景品',
      prizeId: 'prize-001',
      prizeCost1: 120,
    })

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.patrol).not.toBeNull()
    expect(result.current.patrol.inMeter).toBe('50000')
  })

  it('前回 inMeter=0 のとき patrol.inMeter が "0" になる', async () => {
    getLastReadingV2.mockResolvedValue({
      _raw: { reading_id: 'r-002', in_meter: 0 },
      inMeter: 0,
      outMeter: 0,
      outMeter2: null,
      outMeter3: null,
      prizeName: null,
      prizeId: null,
      prizeCost1: null,
    })

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // inMeter=0 は null でないので "0" が入る
    expect(result.current.patrol.inMeter).toBe('0')
  })

  it('前回レコードが null のとき patrol.inMeter が空文字になる（初回ブース）', async () => {
    getLastReadingV2.mockResolvedValue(null)

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.patrol.inMeter).toBe('')
  })

  it('前回レコードの inMeter が null のとき patrol.inMeter が空文字になる', async () => {
    getLastReadingV2.mockResolvedValue({
      _raw: { reading_id: 'r-003', in_meter: null },
      inMeter: null,
      outMeter: null,
      outMeter2: null,
      outMeter3: null,
      prizeName: null,
      prizeId: null,
      prizeCost1: null,
    })

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.patrol.inMeter).toBe('')
  })

  it('booth.play_price が机の play_price より優先される', async () => {
    getLastReadingV2.mockResolvedValue(null)

    const boothWithPrice = { ...MOCK_BOOTH, play_price: '200' }
    const { result } = renderHook(() => usePatrolForm(boothWithPrice, null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // machineInfo.playPrice=100 より booth.play_price=200 が優先
    // play_price はブースのDB値をそのまま保持するため文字列で来る場合もある
    expect(result.current.machineInfo.playPrice).toBe('200')
  })
})

// ── Plan B: machine 引数による getMachineInfo スキップ最適化 ─────────────────────
describe('usePatrolForm — machine 引数による getMachineInfo スキップ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLastReadingV2.mockResolvedValue(null)
  })

  it('machine が null のとき getMachineInfo が呼ばれる', async () => {
    getMachineInfo.mockResolvedValue(MOCK_MACHINE_INFO)

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, null))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(getMachineInfo).toHaveBeenCalledWith(MOCK_BOOTH.machine_code)
  })

  it('machine に machine_types が埋め込まれているとき getMachineInfo を呼ばない', async () => {
    // getPatrolMachines が返す形式（machine_types / machine_models 埋め込み済み）
    const machineWithEmbedded = {
      machine_code: 'TEST01-M01',
      machine_name: 'テスト機1',
      store_code: 'TEST01',
      machine_types: [{ category: 'crane', locker_slots: 0 }],
      machine_models: [{ out_meter_count: 1, meter_unit_price: 150 }],
    }

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, machineWithEmbedded))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // DB クエリをスキップ
    expect(getMachineInfo).not.toHaveBeenCalled()
  })

  it('machine 埋め込みから正しく machineInfo が導出される', async () => {
    const machineWithEmbedded = {
      machine_code: 'TEST01-M01',
      machine_name: 'テスト機1',
      store_code: 'TEST01',
      machine_types: [{ category: 'gacha', locker_slots: 0 }],
      machine_models: [{ out_meter_count: 2, meter_unit_price: 200 }],
    }

    const { result } = renderHook(() => usePatrolForm(MOCK_BOOTH, machineWithEmbedded))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.machineInfo.category).toBe('gacha')
    expect(result.current.machineInfo.outCount).toBe(2)
    // booth.play_price='100' が優先
    expect(result.current.machineInfo.playPrice).toBe('100')
  })
})
