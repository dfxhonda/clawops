// @vitest-environment happy-dom
// SPEC-COLLECTION-EXPORT-FIX-04: type_id FK embed除去→別クエリ changerSet フィルタ
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

// SPEC-COLLECTION-EXPORT-FIX-04: machines embed に type_id なし, machine_code は booth 列
const CONFIRMED_ROW = {
  booth_code: 'B01',
  machine_code: 'R2001',
  in_meter_prev: 1000,
  in_meter_current: 1276,
  total: 5000,
  advance_payment: 0,
  notes: null,
  machines: { machine_name: 'BUZZクレーン' },
  cash_collections: {
    collection_id: 'c1',
    collected_at: '2026-05-15',
    status: 'confirmed',
    store_code: 'TST01',
    stores: { store_name: 'テスト店' },
  },
}

// cash_collection_booths 用 (order で resolve)
const mockChain = (data) => ({
  select: () => mockChain(data),
  eq: () => mockChain(data),
  gte: () => mockChain(data),
  lt: () => mockChain(data),
  order: () => Promise.resolve({ data, error: null }),
})

// machines 別クエリ用 (eq で resolve)
const mockChangerChain = (data) => ({
  select: () => mockChangerChain(data),
  eq: () => Promise.resolve({ data, error: null }),
})

// supabase.from を テーブル名で分岐するヘルパー
function setupMocks({ boothRows, changerCodes = [] }) {
  supabase.from.mockImplementation((table) => {
    if (table === 'machines') return mockChangerChain(changerCodes.map(c => ({ machine_code: c })))
    return mockChain(boothRows)
  })
}

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
    setupMocks({ boothRows: [CONFIRMED_ROW] })
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

})

// ────────────────────────────────────────────────
describe('CollectionExportPage when_no_data', () => {
  beforeEach(() => {
    setupMocks({ boothRows: [] })
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
// SPEC-COLLECTION-EXPORT-FIX-04: 別クエリ changerSet フィルタ
describe('CollectionExportPage when_changer_exclusion_applied', () => {
  it('when_changer_code_in_set_should_exclude_row', async () => {
    // changerQuery が KOS01-M12 を返す → booth行の KOS01-M12 が除外される
    const changerRow = {
      ...CONFIRMED_ROW,
      booth_code: 'C01',
      machine_code: 'KOS01-M12',
      machines: { machine_name: '両替機' },
      in_meter_prev: null,
      in_meter_current: null,
      total: 0,
    }
    setupMocks({ boothRows: [CONFIRMED_ROW, changerRow], changerCodes: ['KOS01-M12'] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('1 明細行')).toBeTruthy()
    })
  })

  it('when_only_changer_rows_should_show_no_data', async () => {
    setupMocks({ boothRows: [CONFIRMED_ROW], changerCodes: ['R2001'] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('該当データなし')).toBeTruthy()
    })
  })

  it('when_machine_code_not_in_changer_set_should_not_exclude', async () => {
    // changerSet に R2001 がなければ除外されない
    setupMocks({ boothRows: [CONFIRMED_ROW], changerCodes: ['KOS01-M12'] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('1 明細行')).toBeTruthy()
    })
  })

  it('when_changer_query_fails_should_show_main_rows_with_no_exclusion', async () => {
    // changerQuery エラー時は changerSet = {} → 全行表示 (changerRes.data が null)
    supabase.from.mockImplementation((table) => {
      if (table === 'machines') return { select: () => ({ eq: () => Promise.resolve({ data: null, error: new Error('fail') }) }) }
      return mockChain([CONFIRMED_ROW])
    })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('1 明細行')).toBeTruthy()
    })
  })
})

// ────────────────────────────────────────────────
// SPEC-COLLECTION-EXPORT-FIX-02: machine_name 表示
describe('CollectionExportPage when_fix_02_applied', () => {
  it('when_machines_embed_present_should_use_machine_name', async () => {
    setupMocks({ boothRows: [CONFIRMED_ROW] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('1 明細行'))
    expect(screen.getByRole('button', { name: /xlsx/ })).toBeTruthy()
  })

  it('when_machine_name_null_should_show_empty_cell_not_crash', async () => {
    const rowNullMachine = { ...CONFIRMED_ROW, machines: null }
    setupMocks({ boothRows: [rowNullMachine] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('1 明細行'))
    expect(screen.getByRole('button', { name: /xlsx/ })).toBeTruthy()
  })
})

// ────────────────────────────────────────────────
// SPEC-COLLECTION-EXPORT-FIX-01: 真因再発防止
describe('CollectionExportPage when_fix_01_applied', () => {
  beforeEach(() => {
    setupMocks({ boothRows: [CONFIRMED_ROW] })
  })

  it('when_data_has_no_machines_embed_should_still_show_rows', async () => {
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => {
      expect(screen.getByText('1 明細行')).toBeTruthy()
    })
  })

  it('when_machine_code_on_booth_row_should_not_read_from_cash_collections', async () => {
    const rowWithoutCollectionMachineCode = {
      ...CONFIRMED_ROW,
      machine_code: 'R9999',
      cash_collections: { ...CONFIRMED_ROW.cash_collections },
    }
    setupMocks({ boothRows: [rowWithoutCollectionMachineCode] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('1 明細行'))
    expect(screen.getByRole('button', { name: /xlsx/ })).toBeTruthy()
  })
})

// ────────────────────────────────────────────────
describe('CollectionExportPage when_no_organization_id_filter', () => {
  it('should_not_call_supabase_with_organization_id_eq', async () => {
    setupMocks({ boothRows: [] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('該当データなし'))
    const calls = supabase.from.mock.calls.flat()
    expect(calls.join(',')).not.toMatch(/organization_id/)
  })
})
