// @vitest-environment node
// SPEC-COLLECTION-PDF-MACHINE-NAME-GROUP-01: machine name grouping in detail table
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTextCalls = []
const mockDoc = {
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setDrawColor: vi.fn(),
  text: vi.fn((...args) => { mockTextCalls.push(args); return mockDoc }),
  line: vi.fn(),
  rect: vi.fn(),
  addPage: vi.fn(),
  addFileToVFS: vi.fn(),
  addFont: vi.fn(),
  addImage: vi.fn(),
  getImageProperties: vi.fn(() => ({ width: 100, height: 100 })),
}

vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() { return mockDoc }
  },
}))

vi.mock('./fonts/NotoSansJP-Regular.ttf?url', () => ({ default: 'mock-font-url' }))
vi.mock('../assets/naceland_seal.png?url', () => ({ default: 'mock-seal-url' }))
vi.mock('./imageUtil', () => ({
  fetchAsDataURL: vi.fn(async () => 'data:image/png;base64,mock'),
}))

import { buildCollectionSlip } from './collectionPdf'

const BASE_ARGS = {
  collection: { collection_id: 'TST-001', collected_at: '2026-06-20' },
  store: { store_name: 'テスト店', store_name_official: 'テスト店舗' },
  total: 10000,
  advanceTotal: 0,
  collectedByName: '担当者',
  issuer: null,
}

function booth(overrides) {
  return { machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B01', in_meter_prev: 1000, in_meter_current: 1200, total: 5000, advance_payment: 0, notes: '', ...overrides }
}

beforeEach(() => {
  mockTextCalls.length = 0
  vi.clearAllMocks()
  mockDoc.text.mockImplementation((...args) => { mockTextCalls.push(args); return mockDoc })
})

// machine name column is rendered at x=30; skip the header row ('機械名')
function nameColCalls() {
  return mockTextCalls.filter(args => args[1] === 30 && args[0] !== '機械名')
}

describe('buildCollectionSlip machine_name_grouping SPEC-COLLECTION-PDF-MACHINE-NAME-GROUP-01', () => {
  it('when_two_booths_same_machine_code_should_blank_name_on_second_row', async () => {
    await buildCollectionSlip({ ...BASE_ARGS, booths: [
      booth({ machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B01' }),
      booth({ machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B02' }),
    ] })
    const calls = nameColCalls()
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe('BUZZクレーン') // AC1: first row shows name
    expect(calls[1][0]).toBe('')              // AC1: second row blank
  })

  it('when_two_booths_different_machine_code_should_show_both_names', async () => {
    await buildCollectionSlip({ ...BASE_ARGS, booths: [
      booth({ machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B01' }),
      booth({ machine_code: 'R2002', machine_name: 'UFOキャッチャー', booth_code: 'B01' }),
    ] })
    const calls = nameColCalls()
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe('BUZZクレーン')   // AC2: single-booth machines show name
    expect(calls[1][0]).toBe('UFOキャッチャー') // AC2
  })

  it('when_single_booth_machine_should_show_name_normally', async () => {
    await buildCollectionSlip({ ...BASE_ARGS, booths: [
      booth({ machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B01' }),
    ] })
    const calls = nameColCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('BUZZクレーン') // AC2
  })

  it('when_machine_code_is_null_should_always_show_name', async () => {
    await buildCollectionSlip({ ...BASE_ARGS, booths: [
      booth({ machine_code: null, machine_name: '不明機', booth_code: 'B01' }),
      booth({ machine_code: null, machine_name: '不明機', booth_code: 'B02' }),
    ] })
    const calls = nameColCalls()
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).not.toBe('') // AC4: null-safe, never grouped
    expect(calls[1][0]).not.toBe('') // AC4
  })

  it('when_three_booths_same_machine_should_blank_2nd_and_3rd_rows', async () => {
    await buildCollectionSlip({ ...BASE_ARGS, booths: [
      booth({ machine_code: 'R3001', machine_name: 'トリプル', booth_code: 'B01' }),
      booth({ machine_code: 'R3001', machine_name: 'トリプル', booth_code: 'B02' }),
      booth({ machine_code: 'R3001', machine_name: 'トリプル', booth_code: 'B03' }),
    ] })
    const calls = nameColCalls()
    expect(calls).toHaveLength(3)
    expect(calls[0][0]).toBe('トリプル') // AC1: first
    expect(calls[1][0]).toBe('')          // AC1: 2nd blank
    expect(calls[2][0]).toBe('')          // AC1: 3rd blank
  })

  it('when_non_name_columns_should_render_on_every_row', async () => {
    await buildCollectionSlip({ ...BASE_ARGS, booths: [
      booth({ machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B01', total: 5000 }),
      booth({ machine_code: 'R2001', machine_name: 'BUZZクレーン', booth_code: 'B02', total: 6000 }),
    ] })
    // booth_code column is at x=63; skip header 'ブース'
    const boothColCalls = mockTextCalls.filter(args => args[1] === 63 && args[0] !== 'ブース')
    expect(boothColCalls).toHaveLength(2) // AC3: all booth columns render
    expect(boothColCalls[0][0]).toBe('B01')
    expect(boothColCalls[1][0]).toBe('B02')
  })
})
