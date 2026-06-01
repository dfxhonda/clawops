// @vitest-environment happy-dom
// J-STOCK-NAVIGATION-REDESIGN-01: 場所ハブ (入荷/棚卸/発注 3 カード) のテスト
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LocationHubPage from '../../tanasupport/pages/LocationHubPage'

const mockNavigate = vi.fn()
const mockSearch = { value: '' }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(mockSearch.value)],
  }
})

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

const supabaseSelectHandler = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const builder = {
        _table: table, _filters: {},
        select() { return builder },
        eq(col, val) { builder._filters[col] = val; return builder },
        maybeSingle() { return Promise.resolve(supabaseSelectHandler(table, builder._filters)) },
      }
      return builder
    },
  },
}))

vi.mock('../../shared/ui/PageHeader', () => ({
  PageHeader: ({ title, onBack }) => (
    <div data-testid="page-header">
      <button data-testid="page-header-back" onClick={onBack}>back</button>
      <h1 data-testid="page-header-title">{title}</h1>
    </div>
  ),
}))

function renderPage(qs) {
  mockSearch.value = qs
  return render(<MemoryRouter><LocationHubPage /></MemoryRouter>)
}

beforeEach(() => {
  mockNavigate.mockReset()
  supabaseSelectHandler.mockReset()
})

describe('LocationHubPage', () => {
  it('when_warehouse_owner_should_render_name_and_3_cards', async () => {
    supabaseSelectHandler.mockImplementation((table) => {
      if (table === 'locations') return { data: { location_id: 'WH-001', location_name: '久留米倉庫' } }
      return { data: null }
    })
    mockUseAuth.mockReturnValue({ staffId: 'S001' })

    renderPage('owner_type=warehouse&owner_id=WH-001')
    await waitFor(() => expect(screen.getByTestId('location-hub')).toBeTruthy())

    expect(screen.getByTestId('page-header-title').textContent).toBe('久留米倉庫')
    expect(screen.getByTestId('location-hub-card-arrival')).toBeTruthy()
    expect(screen.getByTestId('location-hub-card-stocktake')).toBeTruthy()
    expect(screen.getByTestId('location-hub-card-orders')).toBeTruthy()
  })

  it('when_arrival_card_clicked_should_navigate_with_owner_query', async () => {
    supabaseSelectHandler.mockReturnValue({ data: { location_id: 'WH-001', location_name: '久留米倉庫' } })
    mockUseAuth.mockReturnValue({ staffId: 'S001' })
    renderPage('owner_type=warehouse&owner_id=WH-001')
    await waitFor(() => expect(screen.getByTestId('location-hub')).toBeTruthy())

    fireEvent.click(screen.getByTestId('location-hub-card-arrival'))
    expect(mockNavigate).toHaveBeenCalledWith('/stock/arrival?owner_type=warehouse&owner_id=WH-001')
  })

  it('when_stocktake_card_clicked_should_navigate_to_session', async () => {
    supabaseSelectHandler.mockReturnValue({ data: { location_id: 'WH-001', location_name: '久留米倉庫' } })
    mockUseAuth.mockReturnValue({ staffId: 'S001' })
    renderPage('owner_type=warehouse&owner_id=WH-001')
    await waitFor(() => expect(screen.getByTestId('location-hub')).toBeTruthy())

    fireEvent.click(screen.getByTestId('location-hub-card-stocktake'))
    expect(mockNavigate).toHaveBeenCalledWith('/stock/stocktake/session?owner_type=warehouse&owner_id=WH-001')
  })

  it('when_orders_card_clicked_should_navigate_to_orders', async () => {
    supabaseSelectHandler.mockReturnValue({ data: { location_id: 'WH-001', location_name: '久留米倉庫' } })
    mockUseAuth.mockReturnValue({ staffId: 'S001' })
    renderPage('owner_type=warehouse&owner_id=WH-001')
    await waitFor(() => expect(screen.getByTestId('location-hub')).toBeTruthy())

    fireEvent.click(screen.getByTestId('location-hub-card-orders'))
    expect(mockNavigate).toHaveBeenCalledWith('/stock/orders?owner_type=warehouse&owner_id=WH-001')
  })

  it('when_staff_owner_is_self_should_show_self_badge', async () => {
    supabaseSelectHandler.mockImplementation((table) => {
      if (table === 'staff') return { data: { staff_id: 'S999', name: '本人 太郎' } }
      return { data: null }
    })
    mockUseAuth.mockReturnValue({ staffId: 'S999' })

    renderPage('owner_type=staff&owner_id=S999')
    await waitFor(() => expect(screen.getByTestId('location-hub')).toBeTruthy())

    expect(screen.getByTestId('page-header-title').textContent).toBe('本人 太郎')
    expect(screen.getByTestId('location-hub-self-badge')).toBeTruthy()
  })

  it('when_back_button_should_navigate_to_stock', async () => {
    supabaseSelectHandler.mockReturnValue({ data: { location_id: 'WH-001', location_name: '久留米倉庫' } })
    mockUseAuth.mockReturnValue({ staffId: 'S001' })
    renderPage('owner_type=warehouse&owner_id=WH-001')
    await waitFor(() => expect(screen.getByTestId('location-hub')).toBeTruthy())

    fireEvent.click(screen.getByTestId('page-header-back'))
    expect(mockNavigate).toHaveBeenCalledWith('/stock')
  })

  it('when_missing_query_params_should_show_error_with_back_buttons', async () => {
    supabaseSelectHandler.mockReturnValue({ data: null })
    mockUseAuth.mockReturnValue({ staffId: 'S001' })
    renderPage('')
    await waitFor(() => expect(screen.getByTestId('location-hub-error')).toBeTruthy())

    expect(screen.getByTestId('location-hub-error-back-target')).toBeTruthy()
    expect(screen.getByTestId('location-hub-error-back-launcher')).toBeTruthy()
  })
})
