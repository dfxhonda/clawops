// @vitest-environment happy-dom
// SPEC-STORE-OFFICIAL-NAME-EDIT-01 (D-057): 正式名称 (store_name_official) を店舗編集フォームで
// 表示・入力・保存できること。空保存は null (帳票は store_name フォールバック)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../../lib/supabase', async () => {
  const { createMockSupabase } = await vi.importActual('../helpers/supabaseMock')
  return { supabase: createMockSupabase({ stores: [] }) }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'STAFF01', staffName: '本田' }),
}))

vi.mock('../../services/audit', () => ({ writeAuditLog: vi.fn(async () => {}) }))

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../../admin/components/StoreCrudDrawer', () => ({ default: () => null }))

import AdminStoreListPage from '../../admin/pages/AdminStoreListPage'
import { supabase as mockSb } from '../../lib/supabase'

async function openNewModal() {
  render(<MemoryRouter><AdminStoreListPage /></MemoryRouter>)
  fireEvent.click(await screen.findByTestId('store-list-new-button'))
  await screen.findByTestId('store-edit-name-official')
}

beforeEach(() => {
  mockSb._db.stores = []
  cleanup()
  vi.clearAllMocks()
})

describe('SPEC-STORE-OFFICIAL-NAME-EDIT-01 正式名称 edit field', () => {
  it('AC1: field renders with helper text + store_name placeholder, input saves into payload', async () => {
    await openNewModal()

    // 表示: 補助テキスト + フィールド
    expect(screen.getByText('集金帳票の宛名に使用。空の場合は店舗名を使用')).toBeTruthy()
    const official = screen.getByTestId('store-edit-name-official')

    // placeholder = 現在の store_name (フォールバック可視化)
    fireEvent.change(screen.getByTestId('store-edit-name'), { target: { value: 'ドンキ鹿児島' } })
    expect(official.getAttribute('placeholder')).toBe('ドンキ鹿児島')

    // 入力 + 保存 payload 反映
    fireEvent.change(screen.getByTestId('store-edit-code'), { target: { value: 'KGS01' } })
    fireEvent.change(official, { target: { value: '株式会社ナイスランド鹿児島店' } })
    fireEvent.click(screen.getByTestId('store-list-save-button'))

    await waitFor(() => expect(mockSb._db.stores.length).toBe(1))
    expect(mockSb._db.stores[0].store_name_official).toBe('株式会社ナイスランド鹿児島店')
    expect(mockSb._db.stores[0].store_name).toBe('ドンキ鹿児島')
  })

  it('AC1: empty 正式名称 saves as null (store_name fallback preserved)', async () => {
    await openNewModal()

    fireEvent.change(screen.getByTestId('store-edit-name'), { target: { value: 'ドンキ天文館' } })
    fireEvent.change(screen.getByTestId('store-edit-code'), { target: { value: 'TMK02' } })
    // 正式名称 は空のまま
    fireEvent.click(screen.getByTestId('store-list-save-button'))

    await waitFor(() => expect(mockSb._db.stores.length).toBe(1))
    expect(mockSb._db.stores[0].store_name_official).toBeNull()
  })
})
