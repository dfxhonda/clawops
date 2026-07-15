// @vitest-environment node
// SPEC-METER-READINGS-ORG-AND-DENORM-FIX-01 (D-065): meter_readings insert 経路の
// organization_id = CHANGE_ORG_ID (非DFX) かつ machine_code/store_code が booth_code から
// 常に非null供給されること (AC1 org / AC2 denorm)。
import { describe, it, expect, vi, beforeEach } from 'vitest'

const inserts = [] // { table, payload }

function makeChain(table) {
  const chain = {
    insert(payload) { inserts.push({ table, payload }); return chain },
    select() { return chain },
    eq() { return chain },
    order() { return chain },
    limit() { return chain },
    single: async () => ({ data: { reading_id: 'new-id' }, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    // `await supabase.from().insert().select()` / `await supabase.from().insert()` 用
    then(resolve) { resolve({ data: [{ reading_id: 'new-id' }], error: null }) },
  }
  return chain
}

vi.mock('../../lib/supabase', () => ({ supabase: { from: (t) => makeChain(t) } }))
vi.mock('../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'DFX-org', CHANGE_ORG_ID: 'CHANGE-org' }))
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { savePatrolReading } = await import('../../services/patrolCore')
const { insertPastDateReading } = await import('../../services/adminMeterEdit')
const { bulkInsertMeterReadings } = await import('../../admin/lib/bulkInsertMeterReadings')

const meterInserts = () => inserts.filter(i => i.table === 'meter_readings').map(i => i.payload)

beforeEach(() => { inserts.length = 0; vi.clearAllMocks() })

describe('D-065 meter_readings org + denorm', () => {
  it('AC1/AC2: patrolCore savePatrolReading (store/machine 未供給) derives denorm + CHANGE org', async () => {
    const res = await savePatrolReading({
      boothCode: 'TMK02-M01-B02', inMeter: 100, outMeter: 50,
      entryType: 'patrol', patrolDate: '2026-07-15', staffId: 'S1',
      // storeCode / machineCode を敢えて渡さない
    })
    expect(res.ok).toBe(true)
    const p = meterInserts()[0]
    expect(p.machine_code).toBe('TMK02-M01')
    expect(p.store_code).toBe('TMK02')
    expect(p.organization_id).toBe('CHANGE-org')
  })

  it('AC1/AC2: adminMeterEdit insertPastDateReading derives denorm + CHANGE org', async () => {
    await insertPastDateReading({ boothCode: 'KRH01-M19-B01', patrolDate: '2026-07-15', staffId: 'S1' })
    const p = meterInserts()[0]
    expect(p.machine_code).toBe('KRH01-M19')
    expect(p.store_code).toBe('KRH01')
    expect(p.organization_id).toBe('CHANGE-org')
    expect(p.machine_code).not.toBeNull()
    expect(p.store_code).not.toBeNull()
  })

  it('AC1/AC2: bulkInsertMeterReadings derives denorm + CHANGE org per row', async () => {
    const r = await bulkInsertMeterReadings({
      validatedRows: [
        { boothCode: 'SMD01-M03-B04', patrolDate: '2026-07-15', inMeter: 10, outMeter: 5 },
        { boothCode: 'KRM01-M01-B01', patrolDate: '2026-07-15', inMeter: 20, outMeter: 8 },
      ],
      staffId: 'S1',
    })
    expect(r.ok).toBe(true)
    const rows = meterInserts()[0] // bulk は1回の insert に配列 payload
    expect(rows[0].machine_code).toBe('SMD01-M03')
    expect(rows[0].store_code).toBe('SMD01')
    expect(rows[0].organization_id).toBe('CHANGE-org')
    expect(rows[1].machine_code).toBe('KRM01-M01')
    expect(rows[1].store_code).toBe('KRM01')
    expect(rows[1].organization_id).toBe('CHANGE-org')
  })
})
