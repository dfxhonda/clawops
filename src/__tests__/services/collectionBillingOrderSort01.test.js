// SPEC-ORDER-DUAL-MODE-MANESUPPORT-01 R3: getActiveBoothsForStore 機械順 = billing_order ASC
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSupabase

vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))
vi.mock('../../lib/auth/orgConstants', () => ({
  DFX_ORG_ID: 'test-org',
  CHANGE_ORG_ID: 'change-org',
}))

// M02 billing_order=1, M01 billing_order=2 → M02 先
const BOOTHS_RAW = [
  { booth_code: 'KOS01-M01-B01', machine_code: 'KOS01-M01', booth_number: 1, booth_label: null, is_active: true },
  { booth_code: 'KOS01-M02-B01', machine_code: 'KOS01-M02', booth_number: 1, booth_label: null, is_active: true },
  { booth_code: 'KOS01-M02-B02', machine_code: 'KOS01-M02', booth_number: 2, booth_label: null, is_active: true },
]
const MACHINES_RAW = [
  { machine_code: 'KOS01-M01', machine_name: 'クレーン1', machine_number: 'R1001', type_id: 'crane',  billing_order: 2 },
  { machine_code: 'KOS01-M02', machine_name: 'クレーン2', machine_number: 'R1002', type_id: 'crane',  billing_order: 1 },
]

function makeChain(data) {
  const chain = {
    select: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    in:     vi.fn(() => chain),
    order:  vi.fn(() => chain),
    lte:    vi.fn(() => chain),
    limit:  vi.fn(() => chain),
    gte:    vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
    then:   (cb) => Promise.resolve({ data, error: null }).then(cb),
  }
  return Object.assign(Promise.resolve({ data, error: null }), chain)
}

beforeEach(() => {
  mockSupabase = {
    from: vi.fn(table => {
      if (table === 'booths')    return makeChain(BOOTHS_RAW)
      if (table === 'machines')  return makeChain(MACHINES_RAW)
      if (table === 'meter_readings') return makeChain([])
      if (table === 'cash_collections') return makeChain([])
      if (table === 'cash_collection_booths') return makeChain([])
      return makeChain([])
    }),
  }
})

const { getActiveBoothsForStore } = await import('../../services/collections')

describe('SPEC-ORDER-DUAL-MODE-MANESUPPORT-01 R3', () => {
  it('when_billing_order_set_should_sort_by_billing_order_asc_not_machine_code', async () => {
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-17', null)
    const machineCodes = (data ?? []).map(r => r.machine_code)
    expect(machineCodes[0]).toBe('KOS01-M02')
    expect(machineCodes[machineCodes.length - 1]).toBe('KOS01-M01')
  })

  it('when_same_machine_booths_should_keep_booth_code_order_within_machine', async () => {
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-17', null)
    const m2rows = (data ?? []).filter(r => r.machine_code === 'KOS01-M02')
    expect(m2rows[0].booth_code).toBe('KOS01-M02-B01')
    expect(m2rows[1].booth_code).toBe('KOS01-M02-B02')
  })

  it('when_billing_order_null_should_sort_last', async () => {
    mockSupabase.from = vi.fn(table => {
      if (table === 'booths') return makeChain([
        { booth_code: 'KOS01-M03-B01', machine_code: 'KOS01-M03', booth_number: 1, booth_label: null, is_active: true },
        ...BOOTHS_RAW,
      ])
      if (table === 'machines') return makeChain([
        { machine_code: 'KOS01-M03', machine_name: 'ガチャ1', machine_number: null, type_id: null, billing_order: null },
        ...MACHINES_RAW,
      ])
      return makeChain([])
    })
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-17', null)
    const last = (data ?? []).at(-1)
    expect(last.machine_code).toBe('KOS01-M03')
  })
})
