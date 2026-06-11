// @vitest-environment happy-dom
// J-STOCKTAKE-TARGET-SELECT-01: 棚卸し対象選択 (倉庫 / 担当持ち回り) 2 タブ画面のテスト
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StocktakeTargetPage from '../../tanasupport/pages/StocktakeTargetPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

const supabaseSelectHandler = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const builder = {
        _table: table,
        _filters: {},
        _order: null,
        select() { return builder },
        eq(col, val) { builder._filters[col] = val; return builder },
        order(col, opts) { builder._order = { col, opts }; return builder },
        then(resolve) {
          return Promise.resolve(supabaseSelectHandler(table, builder._filters, builder._order)).then(resolve)
        },
      }
      return builder
    },
  },
}))

vi.mock('../../shared/ui/PageHeader', () => ({
  PageHeader: ({ title, onBack }) => (
    <div data-testid="page-header">
      <button data-testid="page-header-back" onClick={onBack}>back</button>
      <h1>{title}</h1>
    </div>
  ),
}))

function renderPage() {
  return render(<MemoryRouter><StocktakeTargetPage /></MemoryRouter>)
}

beforeEach(() => {
  mockNavigate.mockReset()
  supabaseSelectHandler.mockReset()
})

describe('StocktakeTargetPage', () => {
  it('when_warehouses_loaded_should_render_cards_and_navigate_with_owner_type_warehouse', async () => {
    supabaseSelectHandler.mockImplementation((table) => {
      if (table === 'locations') return { data: [
        { location_id: 'WH-001', location_name: '久留米倉庫', location_type: 'warehouse', is_active: true },
        { location_id: 'WH-002', location_name: '鹿児島倉庫', location_type: 'warehouse', is_active: true },
      ] }
      if (table === 'staff') return { data: [] }
      return { data: [] }
    })
    mockUseAuth.mockReturnValue({ staffId: 'S001', staffRole: 'admin' })

    renderPage()
    await waitFor(() => expect(screen.getByTestId('stocktake-target')).toBeTruthy())

    expect(screen.getByTestId('stocktake-target-warehouse-WH-001')).toBeTruthy()
    expect(screen.getByText('久留米倉庫')).toBeTruthy()

    fireEvent.click(screen.getByTestId('stocktake-target-warehouse-WH-001'))
    expect(mockNavigate).toHaveBeenCalledWith('/stock/hub?owner_type=warehouse&owner_id=WH-001')
  })

  it('when_staff_role_should_query_self_only', async () => {
    let recordedFilters = null
    supabaseSelectHandler.mockImplementation((table, filters) => {
      if (table === 'staff') {
        recordedFilters = { ...filters }
        return { data: [{ staff_id: 'S999', name: 'テスト 太郎', name_kana: 'テスト タロウ', role: 'staff', is_active: true }] }
      }
      if (table === 'locations') return { data: [] }
      return { data: [] }
    })
    mockUseAuth.mockReturnValue({ staffId: 'S999', staffRole: 'staff' })

    renderPage()
    await waitFor(() => expect(screen.getByTestId('stocktake-target')).toBeTruthy())
    expect(recordedFilters?.staff_id).toBe('S999')
    expect(recordedFilters?.is_active).toBeUndefined() // staff role はログイン本人で絞る、is_active 不要
  })

  it('when_admin_role_should_query_all_active_staff', async () => {
    let recordedFilters = null
    supabaseSelectHandler.mockImplementation((table, filters) => {
      if (table === 'staff') {
        recordedFilters = { ...filters }
        return { data: [
          { staff_id: 'S001', name: '佐藤', name_kana: 'サトウ', role: 'manager', is_active: true },
          { staff_id: 'S002', name: '田中', name_kana: 'タナカ', role: 'staff', is_active: true },
        ] }
      }
      if (table === 'locations') return { data: [] }
      return { data: [] }
    })
    mockUseAuth.mockReturnValue({ staffId: 'S001', staffRole: 'admin' })

    renderPage()
    await waitFor(() => expect(screen.getByTestId('stocktake-target')).toBeTruthy())
    expect(recordedFilters?.is_active).toBe(true)
    expect(recordedFilters?.staff_id).toBeUndefined()
  })

  it('when_staff_tab_clicked_should_render_staff_and_self_badge', async () => {
    supabaseSelectHandler.mockImplementation((table) => {
      if (table === 'staff') return { data: [
        { staff_id: 'S001', name: '佐藤', name_kana: 'サトウ', role: 'manager', is_active: true },
        { staff_id: 'S002', name: '田中', name_kana: 'タナカ', role: 'staff', is_active: true },
      ] }
      if (table === 'locations') return { data: [] }
      return { data: [] }
    })
    mockUseAuth.mockReturnValue({ staffId: 'S001', staffRole: 'admin' })

    renderPage()
    await waitFor(() => expect(screen.getByTestId('stocktake-target')).toBeTruthy())

    fireEvent.click(screen.getByTestId('stocktake-target-tab-staff'))
    expect(screen.getByTestId('stocktake-target-staff-S001')).toBeTruthy()
    expect(screen.getByTestId('stocktake-target-self-badge')).toBeTruthy()

    fireEvent.click(screen.getByTestId('stocktake-target-staff-S002'))
    expect(mockNavigate).toHaveBeenCalledWith('/stock/hub?owner_type=staff&owner_id=S002')
  })

  it('when_back_button_clicked_should_navigate_to_launcher', async () => {
    supabaseSelectHandler.mockReturnValue({ data: [] })
    mockUseAuth.mockReturnValue({ staffId: 'S001', staffRole: 'admin' })

    renderPage()
    await waitFor(() => expect(screen.getByTestId('stocktake-target')).toBeTruthy())

    fireEvent.click(screen.getByTestId('page-header-back'))
    expect(mockNavigate).toHaveBeenCalledWith('/launcher')
  })

  it('when_no_warehouses_should_show_empty_state', async () => {
    supabaseSelectHandler.mockReturnValue({ data: [] })
    mockUseAuth.mockReturnValue({ staffId: 'S001', staffRole: 'admin' })

    renderPage()
    await waitFor(() => expect(screen.getByTestId('stocktake-target-empty-warehouse')).toBeTruthy())
  })
})
