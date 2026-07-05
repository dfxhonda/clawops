// @vitest-environment happy-dom
// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01
// AC5: booth table matches detail RPC; AC6: cycle_start_date editable only when no collection;
// AC7: origin-less store shows setup CTA not broken numbers
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../shared/ui/moduleColors', () => ({
  MODULE_COLORS: { admin: '#3b82f6' },
}))

const getForecastStoreDetail = vi.fn()
const saveForecastSettings = vi.fn()
vi.mock('../../services/forecast', () => ({
  getForecastStoreDetail: (...args) => getForecastStoreDetail(...args),
  saveForecastSettings: (...args) => saveForecastSettings(...args),
}))

const getAllStores = vi.fn()
vi.mock('../../services/masters', () => ({
  getAllStores: (...args) => getAllStores(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'staff-1' }),
}))

import ForecastDetail from '../../manesupport/pages/ForecastDetail'

function wrap(storeCode = 'KOS01') {
  return render(
    <MemoryRouter initialEntries={[`/admin/forecast/${storeCode}`]}>
      <Routes>
        <Route path="/admin/forecast/:storeCode" element={<ForecastDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

const COLLECTION_STORE_DETAIL = {
  store: {
    store_code: 'KOS01', cycle_start: '2026-06-16', next_collection: '2026-07-16',
    days_elapsed: 19, days_remaining: 11, ctd_revenue: 284442.86, dma7_daily: 16897.62,
    projected_landing: 504111.9, booth_count: 23, origin_source: 'collection', last_reading_date: '2026-07-03',
  },
  booths: [
    { booth_code: 'KOS01-M01-B01', machine_code: 'KOS01-M01', model_name: 'ガチャコロステーション2', booth_no: 'B01', prize_name: null, ctd_revenue: 24000, dma7_daily: 1904.76, projected_landing: 44952 },
    { booth_code: 'KOS01-M14-B01', machine_code: 'KOS01-M14', model_name: 'BUZZCRE TWINS', booth_no: 'B01', prize_name: '1000円用カプセル景品', ctd_revenue: 29100, dma7_daily: 1857.14, projected_landing: 49528 },
  ],
  daily: [
    { d: '2026-06-16', actual_cum: 0, projected_cum: null },
    { d: '2026-07-03', actual_cum: 284442.86, projected_cum: null },
  ],
}

const NONE_STORE_DETAIL = {
  store: {
    store_code: 'ZZZ01', cycle_start: null, next_collection: null, days_elapsed: null, days_remaining: null,
    ctd_revenue: null, dma7_daily: null, projected_landing: null, booth_count: 0, origin_source: 'none', last_reading_date: null,
  },
  booths: [],
  daily: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  getAllStores.mockResolvedValue([{ store_code: 'KOS01', store_name: '古賀店' }, { store_code: 'ZZZ01', store_name: '未設定店' }])
})

describe('ForecastDetail', () => {
  it('AC5: booth_table_should_show_rows_from_detail_rpc_sorted_by_projected_landing_desc', async () => {
    getForecastStoreDetail.mockResolvedValue(COLLECTION_STORE_DETAIL)
    wrap('KOS01')
    await waitFor(() => expect(screen.getByTestId('forecast-booth-table')).toBeTruthy())
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows[0].textContent).toContain('BUZZCRE TWINS') // 49528 > 44952
    expect(rows[1].textContent).toContain('ガチャコロステーション2')
  })

  // SPEC-ADMIN-FORECAST-CYCLE-S2C-UI-POLISH-01
  it('S2C-AC2: booth rows show model_name + booth_no + prize_name; null prize renders cleanly', async () => {
    getForecastStoreDetail.mockResolvedValue(COLLECTION_STORE_DETAIL)
    wrap('KOS01')
    await waitFor(() => expect(screen.getByTestId('forecast-booth-table')).toBeTruthy())
    const table = screen.getByTestId('forecast-booth-table')
    // model_name + booth_no shown; prize_name shown when present
    expect(table.textContent).toContain('BUZZCRE TWINS')
    expect(table.textContent).toContain('B01')
    expect(table.textContent).toContain('1000円用カプセル景品')
    // null prize renders no literal 'null'; raw booth_code no longer shown
    expect(table.textContent).not.toContain('null')
    expect(table.textContent).not.toContain('KOS01-M01-B01')
  })

  it('S2C-AC1: labels use 現在累計 / Ave/日, not 着地累計 / 日当', async () => {
    getForecastStoreDetail.mockResolvedValue(COLLECTION_STORE_DETAIL)
    wrap('KOS01')
    await waitFor(() => expect(screen.getByTestId('forecast-booth-table')).toBeTruthy())
    expect(screen.getAllByText('現在累計').length).toBeGreaterThan(0)
    expect(screen.getByText('Ave/日')).toBeTruthy()
    expect(screen.queryByText('着地累計')).toBeNull()
    expect(screen.queryByText('日当')).toBeNull()
  })

  it('AC6: when_origin_is_collection_cycle_start_date_input_should_not_render', async () => {
    getForecastStoreDetail.mockResolvedValue(COLLECTION_STORE_DETAIL)
    wrap('KOS01')
    await waitFor(() => expect(screen.getByTestId('forecast-settings-form')).toBeTruthy())
    expect(screen.queryByTestId('forecast-cycle-start-input')).toBeNull()
    expect(screen.getByTestId('forecast-next-collection-input')).toBeTruthy()
  })

  it('AC6: when_origin_is_manual_or_none_cycle_start_date_input_should_be_editable', async () => {
    const manualDetail = {
      ...NONE_STORE_DETAIL,
      store: { ...NONE_STORE_DETAIL.store, origin_source: 'manual', cycle_start: '2026-06-01', next_collection: '2026-07-01' },
    }
    getForecastStoreDetail.mockResolvedValue(manualDetail)
    wrap('ZZZ01')
    await waitFor(() => expect(screen.getByTestId('forecast-settings-form')).toBeTruthy())
    expect(screen.getByTestId('forecast-cycle-start-input')).toBeTruthy()
  })

  it('AC7: origin_less_store_should_show_setup_message_not_broken_numbers', async () => {
    getForecastStoreDetail.mockResolvedValue(NONE_STORE_DETAIL)
    wrap('ZZZ01')
    await waitFor(() => expect(screen.getByText('この店舗は集金記録も開始日設定もありません')).toBeTruthy())
    expect(screen.queryByTestId('forecast-booth-table')).toBeNull()
    expect(document.body.textContent).not.toContain('NaN')
  })
})
