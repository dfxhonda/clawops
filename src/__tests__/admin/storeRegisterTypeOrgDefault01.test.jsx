// @vitest-environment happy-dom
// SPEC-STORE-REGISTER-TYPE-DROPDOWN-AND-ORG-DEFAULT-01 (D-063):
// F1 店舗種別 select 化 / F2 新規登録 organization_id = CHANGE_ORG_ID (DFX でない)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CHANGE_ORG_ID, DFX_ORG_ID } from '../../lib/auth/orgConstants'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('../../lib/supabase', async () => {
  const { createMockSupabase } = await vi.importActual('../helpers/supabaseMock')
  return { supabase: createMockSupabase({ stores: [] }) }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'STAFF01', staffName: '本田' }) }))
vi.mock('../../services/audit', () => ({ writeAuditLog: vi.fn(async () => {}) }))
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('../../admin/components/StoreCrudDrawer', () => ({ default: () => null }))

import AdminStoreListPage from '../../admin/pages/AdminStoreListPage'
import { supabase as mockSb } from '../../lib/supabase'

async function openNewModal() {
  render(<MemoryRouter><AdminStoreListPage /></MemoryRouter>)
  fireEvent.click(await screen.findByTestId('store-list-new-button'))
  await screen.findByTestId('store-edit-type')
}

beforeEach(() => { mockSb._db.stores = []; cleanup(); vi.clearAllMocks() })

describe('SPEC-STORE-REGISTER-TYPE-DROPDOWN-AND-ORG-DEFAULT-01 (D-063)', () => {
  it('AC1d: 種別 select renders the 5 normalized options', async () => {
    await openNewModal()
    const sel = screen.getByTestId('store-edit-type')
    const values = Array.from(sel.querySelectorAll('option')).map(o => o.value)
    expect(values).toEqual(['', 'donki', 'tenant', 'external', 'other'])
  })

  it('AC1a+b: new store saves with CHANGE_ORG_ID and selected store_type', async () => {
    await openNewModal()
    fireEvent.change(screen.getByTestId('store-edit-name'), { target: { value: '日商天文館' } })
    fireEvent.change(screen.getByTestId('store-edit-code'), { target: { value: 'TMK02' } })
    fireEvent.change(screen.getByTestId('store-edit-type'), { target: { value: 'donki' } })
    fireEvent.click(screen.getByTestId('store-list-save-button'))

    await waitFor(() => expect(mockSb._db.stores.length).toBe(1))
    const row = mockSb._db.stores[0]
    expect(row.organization_id).toBe(CHANGE_ORG_ID)
    expect(row.organization_id).not.toBe(DFX_ORG_ID)
    expect(row.store_type).toBe('donki')
  })

  it('AC1c: 未設定 (empty) saves store_type as null', async () => {
    await openNewModal()
    fireEvent.change(screen.getByTestId('store-edit-name'), { target: { value: '外部倉庫' } })
    fireEvent.change(screen.getByTestId('store-edit-code'), { target: { value: 'EXT99' } })
    // 種別は未設定のまま
    fireEvent.click(screen.getByTestId('store-list-save-button'))

    await waitFor(() => expect(mockSb._db.stores.length).toBe(1))
    expect(mockSb._db.stores[0].store_type).toBeNull()
    expect(mockSb._db.stores[0].organization_id).toBe(CHANGE_ORG_ID)
  })
})
