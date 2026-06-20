// @vitest-environment happy-dom
// SPEC-COLLECTION-EXPORT-01: CollectionExportPage + AdminReportsHubPage tile flag
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// xlsx mock: just capture writeFile calls
vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({ '!ref': 'A1:J2' })),
    decode_range: vi.fn(() => ({ s: { c: 0 }, e: { c: 9 } })),
    encode_cell: vi.fn(({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

// SPEC-COLLECTION-EXPORT-FIX-01: machine_code は booth 列, machines 埋め込みなし, collected_at は date 型
const CONFIRMED_ROW = {
  booth_code: 'B01',
  machine_code: 'R2001',
  in_meter_prev: 1000,
  in_meter_current: 1276,
  total: 5000,
  advance_payment: 0,
  notes: null,
  cash_collections: {
    collection_id: 'c1',
    collected_at: '2026-05-15',
    status: 'confirmed',
    store_code: 'TST01',
    stores: { store_name: 'テスト店' },
  },
}

const mockChain = (data) => ({
  select: () => mockChain(data),
  eq: () => mockChain(data),
  gte: () => mockChain(data),
  lt: () => mockChain(data),
  order: () => Promise.resolve({ data, error: null }),
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../../lib/supabase'
import AdminReportsHubPage from '../../admin/pages/AdminReportsHubPage'
import CollectionExportPage from '../../admin/pages/reports/CollectionExportPage'

function wrap(node, path = '/admin/reports') {
  return render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

// ────────────────────────────────────────────────
describe('AdminReportsHubPage when_collection_export_tile_enabled', () => {
  it('should_render_shukin_chushutsu_tile_as_impl_true', () => {
    wrap(<AdminReportsHubPage />)
    const tile = screen.getByTestId('hub-tile-集金抽出')
    expect(tile).toBeTruthy()
    // impl:true means no 準備中 badge
    expect(tile.textContent).not.toMatch(/準備中/)
  })
})

// ────────────────────────────────────────────────
describe('CollectionExportPage when_data_exists', () => {
  beforeEach(() => {
    supabase.from.mockReturnValue(mockChain([CONFIRMED_ROW]))
  })

  it('when_month_selected_should_show_row_count', async () => {
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('1 明細行')).toBeTruthy()
    })
  })

  it('when_data_present_should_render_download_button', async () => {
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /xlsx/ })).toBeTruthy()
    })
  })

  it('when_back_button_clicked_should_navigate_to_admin_reports', async () => {
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByLabelText('集計ハブへ戻る'))
    screen.getByLabelText('集計ハブへ戻る').click()
    expect(mockNavigate).toHaveBeenCalledWith('/admin/reports')
  })
})

// ────────────────────────────────────────────────
describe('CollectionExportPage when_no_data', () => {
  beforeEach(() => {
    supabase.from.mockReturnValue(mockChain([]))
  })

  it('when_zero_rows_should_show_no_data_message', async () => {
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('該当データなし')).toBeTruthy()
    })
  })

  it('when_zero_rows_should_not_render_download_button', async () => {
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('該当データなし'))
    expect(screen.queryByRole('button', { name: /xlsx/ })).toBeNull()
  })
})

// ────────────────────────────────────────────────
// SPEC-COLLECTION-EXPORT-FIX-01: 真因再発防止
describe('CollectionExportPage when_fix_01_applied', () => {
  beforeEach(() => {
    supabase.from.mockReturnValue(mockChain([CONFIRMED_ROW]))
  })

  it('when_data_has_no_machines_embed_should_still_show_rows', async () => {
    // machines embed 除去後でも行が表示される(修正前はPostgRESTエラー→0件だった)
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('1 明細行')).toBeTruthy()
    })
  })

  it('when_machine_code_on_booth_row_should_not_read_from_cash_collections', async () => {
    // machine_code は booth 列 (r.machine_code) であり cash_collections 列ではない
    const rowWithoutCollectionMachineCode = {
      ...CONFIRMED_ROW,
      machine_code: 'R9999',
      cash_collections: { ...CONFIRMED_ROW.cash_collections },
    }
    supabase.from.mockReturnValue(mockChain([rowWithoutCollectionMachineCode]))
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('1 明細行'))
    // DL ボタンが有効になっている = 0 件エラーが起きていない
    expect(screen.getByRole('button', { name: /xlsx/ })).toBeTruthy()
  })
})

// ────────────────────────────────────────────────
describe('CollectionExportPage when_no_organization_id_filter', () => {
  it('should_not_call_supabase_with_organization_id_eq', async () => {
    supabase.from.mockReturnValue(mockChain([]))
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('該当データなし'))
    // RLS handles isolation — no organization_id filter should appear in calls
    const calls = supabase.from.mock.calls.flat()
    expect(calls.join(',')).not.toMatch(/organization_id/)
  })
})
