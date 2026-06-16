// COLLECTION-EXCLUDE-CHANGER-01: changer機械のブースを集金リストから除外する
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSupabase

vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))
vi.mock('../../lib/auth/orgConstants', () => ({
  DFX_ORG_ID: 'test-org',
  CHANGE_ORG_ID: 'change-org',
}))

// テスト用ブースデータ (KOS01-M12=changer, KOS01-M01=crane, KOS01-M02=null type)
const BOOTHS_RAW = [
  { booth_code: 'KOS01-M01-B01', machine_code: 'KOS01-M01', booth_number: 1, booth_label: null, is_active: true },
  { booth_code: 'KOS01-M12-B01', machine_code: 'KOS01-M12', booth_number: 1, booth_label: null, is_active: true },
  { booth_code: 'KOS01-M02-B01', machine_code: 'KOS01-M02', booth_number: 1, booth_label: null, is_active: true },
]
const MACHINES_RAW = [
  { machine_code: 'KOS01-M01', machine_name: 'クレーン1', machine_number: 'R1001', type_id: 'crane' },
  { machine_code: 'KOS01-M12', machine_name: '両替機',    machine_number: 'C0012', type_id: 'changer' },
  { machine_code: 'KOS01-M02', machine_name: 'ガチャ1',   machine_number: 'G2001', type_id: null },
]

function makeChain(data) {
  const chain = {
    select: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    in:     vi.fn(() => chain),
    order:  vi.fn(() => chain),
    lte:    vi.fn(() => chain),
    limit:  vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
    then:   (cb) => Promise.resolve({ data, error: null }).then(cb),
    [Symbol.asyncIterator]: undefined,
  }
  // make it awaitable
  chain[Symbol.for('nodejs.rejection')] = undefined
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

describe('COLLECTION-EXCLUDE-CHANGER-01', () => {
  it('when_changer_machine_exists_should_exclude_its_booths', async () => {
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-16', null)
    const codes = (data ?? []).map(b => b.booth_code)
    expect(codes).not.toContain('KOS01-M12-B01')
  })

  it('when_crane_machine_exists_should_remain_in_list', async () => {
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-16', null)
    const codes = (data ?? []).map(b => b.booth_code)
    expect(codes).toContain('KOS01-M01-B01')
  })

  it('when_machine_type_id_is_null_should_remain_in_list', async () => {
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-16', null)
    const codes = (data ?? []).map(b => b.booth_code)
    expect(codes).toContain('KOS01-M02-B01')
  })

  it('when_only_changer_filtered_should_not_widen_exclusion', async () => {
    const { data } = await getActiveBoothsForStore('KOS01', '2026-06-16', null)
    // crane + null type_id が残る (2件)
    expect((data ?? []).length).toBe(2)
  })
})
