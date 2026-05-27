// ============================================
// J-STOCK-MACHINE-fix-03b: recordMachineLoad / recordMachineUnload
// 巡回補充→machine_load, 入替→machine_unload+machine_load を stock_movements に記録
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase } from '../helpers/supabaseMock'

let mockSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))

const { recordMachineLoad, recordMachineUnload } = await import('../../services/movements')
const { clearCache } = await import('../../services/utils')

beforeEach(() => {
  mockSupabase = createMockSupabase({ stock_movements: [] })
  clearCache()
})

describe('recordMachineLoad (staff → booth)', () => {
  it('補充数>0 で machine_load レコードを INSERT する', async () => {
    await recordMachineLoad({ boothCode: 'KKY01-M01-B01', prizeId: 'P100', quantity: 5, staffId: 'S1', reason: 'patrol_supplement' })
    const rows = mockSupabase._getTable('stock_movements')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      movement_type: 'out_to_booth',
      from_owner_type: 'staff', from_owner_id: 'S1',
      to_owner_type: 'booth',  to_owner_id: 'KKY01-M01-B01',
      prize_id: 'P100', quantity: 5, reason: 'patrol_supplement',
    })
  })

  it('quantity<=0 は INSERT せず null を返す (CHECK制約を叩かない)', async () => {
    const r0 = await recordMachineLoad({ boothCode: 'B1', prizeId: 'P1', quantity: 0, staffId: 'S1' })
    const rNeg = await recordMachineLoad({ boothCode: 'B1', prizeId: 'P1', quantity: -3, staffId: 'S1' })
    expect(r0).toBeNull()
    expect(rNeg).toBeNull()
    expect(mockSupabase._getTable('stock_movements')).toHaveLength(0)
  })

  it('boothCode 欠落時は INSERT しない', async () => {
    const r = await recordMachineLoad({ boothCode: '', prizeId: 'P1', quantity: 2, staffId: 'S1' })
    expect(r).toBeNull()
    expect(mockSupabase._getTable('stock_movements')).toHaveLength(0)
  })
})

describe('recordMachineUnload (booth → staff)', () => {
  it('quantity=1 固定で machine_unload レコードを INSERT する', async () => {
    await recordMachineUnload({ boothCode: 'KKY01-M01-B01', prizeId: 'P_OLD', staffId: 'S1' })
    const rows = mockSupabase._getTable('stock_movements')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      movement_type: 'out_to_staff',
      from_owner_type: 'booth', from_owner_id: 'KKY01-M01-B01',
      to_owner_type: 'staff',   to_owner_id: 'S1',
      prize_id: 'P_OLD', quantity: 1, reason: 'replace_unload',
    })
  })
})

describe('入替フロー (unload + load 2レコード)', () => {
  it('同一booth_code に machine_unload と machine_load が両方記録される', async () => {
    await recordMachineUnload({ boothCode: 'B9', prizeId: 'P_OLD', staffId: 'S2', reason: 'replace_unload' })
    await recordMachineLoad({ boothCode: 'B9', prizeId: 'P_NEW', quantity: 1, staffId: 'S2', reason: 'replace_load' })
    const rows = mockSupabase._getTable('stock_movements').filter(r => r.to_owner_id === 'B9' || r.from_owner_id === 'B9')
    // out_to_booth = 新景品セット (machine_load) / out_to_staff = 前景品回収 (machine_unload)
    const types = rows.map(r => r.movement_type).sort()
    expect(types).toEqual(['out_to_booth', 'out_to_staff'])
    expect(rows.find(r => r.movement_type === 'out_to_booth').prize_id).toBe('P_NEW')
    expect(rows.find(r => r.movement_type === 'out_to_staff').prize_id).toBe('P_OLD')
  })
})
