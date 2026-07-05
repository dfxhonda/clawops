// @vitest-environment happy-dom
// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01
// AC2: list renders RPC rows; AC3: totals header sums; AC7: origin-less CTA
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../shared/ui/moduleColors', () => ({
  MODULE_COLORS: { admin: '#3b82f6' },
}))

const getForecastStoreList = vi.fn()
vi.mock('../../services/forecast', () => ({
  getForecastStoreList: (...args) => getForecastStoreList(...args),
}))

const getAllStores = vi.fn()
vi.mock('../../services/masters', () => ({
  getAllStores: (...args) => getAllStores(...args),
}))

import ForecastList from '../../manesupport/pages/ForecastList'

function wrap() {
  return render(<MemoryRouter><ForecastList /></MemoryRouter>)
}

const ROWS = [
  { store_code: 'KOS01', cycle_start: '2026-06-16', next_collection: '2026-07-16', days_remaining: 11, ctd_revenue: 100000, dma7_daily: 5000, projected_landing: 200000, booth_count: 20, origin_source: 'collection', last_reading_date: '2026-07-03' },
  { store_code: 'MNK01', cycle_start: '2026-06-16', next_collection: '2026-07-16', days_remaining: 11, ctd_revenue: 50000, dma7_daily: 2000, projected_landing: 90000, booth_count: 10, origin_source: 'collection', last_reading_date: '2026-07-03' },
  { store_code: 'ZZZ01', cycle_start: null, next_collection: null, days_remaining: null, ctd_revenue: null, dma7_daily: null, projected_landing: null, booth_count: 0, origin_source: 'none', last_reading_date: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  getForecastStoreList.mockResolvedValue(ROWS)
  getAllStores.mockResolvedValue([
    { store_code: 'KOS01', store_name: '古賀店' },
    { store_code: 'MNK01', store_name: '南店' },
    { store_code: 'ZZZ01', store_name: '未設定店' },
  ])
})

describe('ForecastList', () => {
  it('AC2: should_render_a_row_per_store_from_rpc', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-KOS01')).toBeTruthy())
    expect(screen.getByTestId('forecast-store-row-MNK01')).toBeTruthy()
    expect(screen.getByTestId('forecast-store-row-ZZZ01')).toBeTruthy()
  })

  it('AC2: should_sort_by_projected_landing_desc', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-KOS01')).toBeTruthy())
    const rows = screen.getAllByRole('button').filter(b => b.dataset.testid?.startsWith('forecast-store-row-'))
    expect(rows[0].dataset.testid).toBe('forecast-store-row-KOS01')
    expect(rows[1].dataset.testid).toBe('forecast-store-row-MNK01')
  })

  it('AC3: totals_header_should_sum_only_origin_bearing_stores', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-totals-header')).toBeTruthy())
    const header = screen.getByTestId('forecast-totals-header')
    expect(header.textContent).toContain('¥150,000') // 100000+50000
    expect(header.textContent).toContain('¥290,000') // 200000+90000
    expect(header.textContent).toContain('2店舗')
  })

  it('AC7: origin_less_store_should_show_setup_cta_not_null_numbers', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-ZZZ01')).toBeTruthy())
    const row = screen.getByTestId('forecast-store-row-ZZZ01')
    expect(row.textContent).toContain('未設定')
    expect(row.textContent).not.toContain('null')
    expect(row.textContent).not.toContain('NaN')
  })

  it('AC1: clicking_a_store_row_should_navigate_to_its_detail_page', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-KOS01')).toBeTruthy())
    fireEvent.click(screen.getByTestId('forecast-store-row-KOS01'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/forecast/KOS01')
  })

  // SPEC-ADMIN-FORECAST-CYCLE-S2C-UI-POLISH-01
  it('S2C-AC1: uses 現在累計 label, no 着地累計', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-KOS01')).toBeTruthy())
    expect(screen.getAllByText('現在累計').length).toBeGreaterThan(0)
    expect(screen.queryByText('着地累計')).toBeNull()
  })

  it('S2C-AC3: origin-bearing card shows period + days + both figures (values match RPC)', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-KOS01')).toBeTruthy())
    const card = screen.getByTestId('forecast-store-row-KOS01')
    expect(card.textContent).toContain('残り11日')
    expect(card.textContent).toContain('¥100,000') // ctd
    expect(card.textContent).toContain('¥200,000') // projected
  })

  // SPEC-ADMIN-FORECAST-CYCLE-S2C2-CARD-STACK-01
  // 現在累計 は 着地予測 の「上」に縦積み (DOM 上で先に出現する)
  const isBefore = (a, b) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

  it('S2C2-AC1: store card stacks 現在累計 above 着地予測 (現在累計 precedes in DOM)', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-store-row-KOS01')).toBeTruthy())
    const card = screen.getByTestId('forecast-store-row-KOS01')
    const ctd = [...card.querySelectorAll('span')].find(s => s.textContent === '現在累計')
    const proj = [...card.querySelectorAll('span')].find(s => s.textContent === '着地予測')
    expect(ctd).toBeTruthy()
    expect(proj).toBeTruthy()
    expect(isBefore(ctd, proj)).toBe(true)
  })

  it('S2C2-AC2: totals header stacks 現在累計 above 着地予測 (same pairing)', async () => {
    wrap()
    await waitFor(() => expect(screen.getByTestId('forecast-totals-header')).toBeTruthy())
    const header = screen.getByTestId('forecast-totals-header')
    const ctd = [...header.querySelectorAll('span')].find(s => s.textContent === '現在累計')
    const proj = [...header.querySelectorAll('span')].find(s => s.textContent === '着地予測')
    expect(ctd).toBeTruthy()
    expect(proj).toBeTruthy()
    expect(isBefore(ctd, proj)).toBe(true)
  })
})
