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
