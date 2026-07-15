// @vitest-environment node
// SPEC-MACHINE-REGISTER-ORG-DEFAULT-CHANGE-01 (D-064): addMachine INSERT の organization_id が
// CHANGE_ORG_ID (DFX でない) であること。stateful supabase mock で insert 引数を検証。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CHANGE_ORG_ID, DFX_ORG_ID } from '../../lib/auth/orgConstants'

vi.mock('../../lib/supabase', async () => {
  const { createMockSupabase } = await vi.importActual('../helpers/supabaseMock')
  return { supabase: createMockSupabase({ machines: [] }) }
})
vi.mock('../../services/audit', () => ({ writeAuditLog: vi.fn(async () => {}) }))

import { addMachine } from '../../services/masters'
import { supabase as mockSb } from '../../lib/supabase'

beforeEach(() => { mockSb._db.machines = []; vi.clearAllMocks() })

describe('addMachine organization_id default (D-064)', () => {
  it('AC1: INSERT payload.organization_id === CHANGE_ORG_ID (not DFX)', async () => {
    await addMachine({
      machine_code: 'TMK02-M01', store_code: 'TMK02', machine_name: 'ポケクレマルチ',
      model_id: null, type_id: null,
    })
    expect(mockSb._db.machines.length).toBe(1)
    const row = mockSb._db.machines[0]
    expect(row.organization_id).toBe(CHANGE_ORG_ID)
    expect(row.organization_id).not.toBe(DFX_ORG_ID)
    expect(row.machine_code).toBe('TMK02-M01')
    expect(row.store_code).toBe('TMK02')
  })
})
