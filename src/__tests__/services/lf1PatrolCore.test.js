// @vitest-environment node
// SPEC-LF1-IDEMPOTENT-SYNC-01: savePatrolReading D1 (carry patrol_date) / D2 (idempotency)
// / D3 (stale guard)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertSpy = vi.fn()
const updateSpy = vi.fn()
let existingResult = { data: null }
let insertResult = { data: { reading_id: 'new-id' }, error: null }
let updateResult = { error: null }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => existingResult }) }) }),
      }),
      insert: (payload) => {
        insertSpy(payload)
        return { select: () => ({ single: async () => insertResult }) }
      },
      update: (payload) => {
        updateSpy(payload)
        return { eq: async () => updateResult }
      },
    }),
  },
}))
vi.mock('../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { savePatrolReading } = await import('../../services/patrolCore')

const base = { boothCode: 'TST01-M01-B01', storeCode: 'TST01', machineCode: 'TST01-M01', inMeter: 100, outMeter: 50 }

beforeEach(() => {
  vi.clearAllMocks()
  existingResult = { data: null }
  insertResult = { data: { reading_id: 'new-id' }, error: null }
  updateResult = { error: null }
})

describe('D1: carry patrol_date (AC1)', () => {
  it('replayed record with patrolDate=D inserts a row with patrol_date=D (not today)', async () => {
    const res = await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-03' })
    expect(res.ok).toBe(true)
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy.mock.calls[0][0].patrol_date).toBe('2026-07-03')
  })
})

describe('D2: idempotency key + 23505 (AC2)', () => {
  it('uses readingId as reading_id on insert', async () => {
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-08', readingId: 'uuid-1' })
    expect(insertSpy.mock.calls[0][0].reading_id).toBe('uuid-1')
  })

  it('treats a 23505 insert error as ok:true skipped:duplicate', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'duplicate key' } }
    const res = await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-08', readingId: 'uuid-1' })
    expect(res).toMatchObject({ ok: true, skipped: 'duplicate' })
  })

  it('a non-23505 insert error stays ok:false', async () => {
    insertResult = { data: null, error: { code: '23502', message: 'not null' } }
    const res = await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-08' })
    expect(res.ok).toBe(false)
  })
})

describe('D3: stale guard (server-newer wins)', () => {
  it('skips the update when existing.updated_at >= clientTimestamp', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T10:00:00Z' } }
    const res = await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', clientTimestamp: '2026-07-06T09:00:00Z' })
    expect(res).toMatchObject({ ok: true, skipped: 'stale' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('performs the update when the client record is newer than the server row', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T08:00:00Z' } }
    const res = await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', clientTimestamp: '2026-07-06T09:00:00Z' })
    expect(res.ok).toBe(true)
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })
})

// SPEC-LF1-REPLAY-CONSTRAINT-NORMALIZE-01: stock_N defaulted to 0 when out_meter_N present (AC1)
describe('slot stock normalize (chk_stock2/3_present_when_out2/3)', () => {
  it('patrol insert: out_meter_2 without stock_2 gets stock_2=0', async () => {
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-03', optionalPatch: { out_meter_2: 123 } })
    const payload = insertSpy.mock.calls[0][0]
    expect(payload.out_meter_2).toBe(123)
    expect(payload.stock_2).toBe(0)
  })

  it('does NOT overwrite an explicit stock_2', async () => {
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-03', optionalPatch: { out_meter_2: 123, stock_2: 5 } })
    expect(insertSpy.mock.calls[0][0].stock_2).toBe(5)
  })

  it('no out_meter_2 -> no stock_2 injected', async () => {
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-03', optionalPatch: {} })
    expect(insertSpy.mock.calls[0][0].stock_2).toBeUndefined()
  })

  it('slot 3: out_meter_3 without stock_3 gets stock_3=0', async () => {
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-03', optionalPatch: { out_meter_3: 45 } })
    expect(insertSpy.mock.calls[0][0].stock_3).toBe(0)
  })

  it('replace/collection insert path also normalizes', async () => {
    await savePatrolReading({ ...base, entryType: 'replace', optionalPatch: { out_meter_2: 7 } })
    expect(insertSpy.mock.calls[0][0].stock_2).toBe(0)
  })

  it('update path: out_meter_2 in patch, existing stock_2 also null -> stock_2=0', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T08:00:00Z', stock_2: null, stock_3: null } }
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', optionalPatch: { out_meter_2: 99 }, clientTimestamp: '2026-07-06T09:00:00Z' })
    const payload = updateSpy.mock.calls[0][0]
    expect(payload.out_meter_2).toBe(99)
    expect(payload.stock_2).toBe(0)
  })
})

// SPEC-LF1-REPLAY-CONSTRAINT-NORMALIZE-02: UPDATE injection must not destroy an existing stock
describe('update path conditional stock injection (NORMALIZE-02)', () => {
  it('AC1: existing stock_2=5 + patch out_meter_2 only -> NO stock_2 key (5 preserved)', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T08:00:00Z', stock_2: 5, stock_3: null } }
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', optionalPatch: { out_meter_2: 900 }, clientTimestamp: '2026-07-06T09:00:00Z' })
    const payload = updateSpy.mock.calls[0][0]
    expect(payload.out_meter_2).toBe(900)
    expect('stock_2' in payload).toBe(false)
  })

  it('AC2: existing stock_2 null + patch out_meter_2 -> stock_2=0 injected', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T08:00:00Z', stock_2: null, stock_3: null } }
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', optionalPatch: { out_meter_2: 900 }, clientTimestamp: '2026-07-06T09:00:00Z' })
    expect(updateSpy.mock.calls[0][0].stock_2).toBe(0)
  })

  it('AC2: explicit patch stock_2 always wins (no injection)', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T08:00:00Z', stock_2: null } }
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', optionalPatch: { out_meter_2: 900, stock_2: 7 }, clientTimestamp: '2026-07-06T09:00:00Z' })
    expect(updateSpy.mock.calls[0][0].stock_2).toBe(7)
  })

  it('slot 3 mirror: existing stock_3=9 preserved on out_meter_3-only patch', async () => {
    existingResult = { data: { reading_id: 'r1', in_meter: 1, out_meter: 1, prize_stock_count: 0, prize_restock_count: 0, updated_at: '2026-07-06T08:00:00Z', stock_3: 9 } }
    await savePatrolReading({ ...base, entryType: 'patrol', patrolDate: '2026-07-06', optionalPatch: { out_meter_3: 300 }, clientTimestamp: '2026-07-06T09:00:00Z' })
    expect('stock_3' in updateSpy.mock.calls[0][0]).toBe(false)
  })
})
