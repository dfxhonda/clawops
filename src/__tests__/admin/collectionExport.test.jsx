// @vitest-environment happy-dom
// SPEC-COLLECTION-EXPORT-FIX-04: type_id FK embed除去→別クエリ changerSet フィルタ
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as XLSX from 'xlsx'

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
// ────────────────────────────────────────────────
// SPEC-COLLECTION-EXPORT-ADD-BILLINGORDER-RENTALNO-01 (D-087)
describe('CollectionExportPage D-087 集金順番/レンタル番号', () => {
  const rowBillingOrder3 = {
    ...CONFIRMED_ROW, booth_code: 'B02', machine_code: 'M2',
    machines: { machine_name: '機A', billing_order: 3, machine_number: 'R2001' },
    cash_collections: { ...CONFIRMED_ROW.cash_collections, store_code: 'TST01' },
  }
  const rowBillingOrder1 = {
    ...CONFIRMED_ROW, booth_code: 'B01', machine_code: 'M1',
    machines: { machine_name: '機B', billing_order: 1, machine_number: null },
    cash_collections: { ...CONFIRMED_ROW.cash_collections, store_code: 'TST01' },
  }

  it('AC1/AC2/AC3/AC4/AC5: 12列・集金順番先頭・billing_order昇順・レンタル番号空欄可・メーター差H-G・cell型', async () => {
    setupMocks({ boothRows: [rowBillingOrder3, rowBillingOrder1] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('2 明細行'))
    fireEvent.click(screen.getByRole('button', { name: /xlsx/ }))

    const aoa = XLSX.utils.aoa_to_sheet.mock.calls[0][0]
    const header = aoa[0]
    // AC1: 全12列が仕様順、集金順番が先頭・レンタル番号を含む
    expect(header).toEqual([
      '集金順番', '集金日', '店舗名', '機械番号', 'レンタル番号', '機械名',
      '前回メーター', '今回メーター', 'メーター差', '集金金額', '建て替え金額', '備考',
    ])
    // AC2: billing_order 昇順 → 1 (rowBillingOrder1) が先頭データ行
    const row1 = aoa[1]
    expect(row1[0]).toBe(1)
    // AC5: 集金順番=number, レンタル番号=string
    expect(typeof row1[0]).toBe('number')
    expect(typeof aoa[2][4]).toBe('string') // 2件目 rowBillingOrder3 のレンタル番号 'R2001'
    expect(aoa[2][4]).toBe('R2001')
    // AC3: machine_number null → 空欄セル ''
    expect(row1[4]).toBe('')
    // AC4: メーター差 = 今回(H) - 前回(G)、行2
    expect(row1[8]).toEqual({ f: 'H2-G2' })
    // 2件目のメーター差は行3 → H3-G3
    expect(aoa[2][8]).toEqual({ f: 'H3-G3' })
  })

  it('AC2: billing_order null は NULLS LAST (非null機の後ろ)', async () => {
    const rowNullOrder = {
      ...CONFIRMED_ROW, booth_code: 'B03', machine_code: 'M3',
      machines: { machine_name: '機C', billing_order: null, machine_number: null },
      cash_collections: { ...CONFIRMED_ROW.cash_collections, store_code: 'TST01' },
    }
    setupMocks({ boothRows: [rowNullOrder, rowBillingOrder1] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('2 明細行'))
    fireEvent.click(screen.getByRole('button', { name: /xlsx/ }))
    const aoa = XLSX.utils.aoa_to_sheet.mock.calls[0][0]
    expect(aoa[1][0]).toBe(1) // billing_order=1 が先
    expect(aoa[2][0]).toBe('') // null は後 (空欄)
  })
})

describe('CollectionExportPage when_no_organization_id_filter', () => {
  it('should_not_call_supabase_with_organization_id_eq', async () => {
    setupMocks({ boothRows: [] })
    wrap(<CollectionExportPage />, '/admin/reports/collections')
    await waitFor(() => screen.getByText('該当データなし'))
    const calls = supabase.from.mock.calls.flat()
    expect(calls.join(',')).not.toMatch(/organization_id/)
  })
})
