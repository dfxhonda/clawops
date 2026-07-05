// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01: forecast service
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
const upsertMock = vi.fn()
const selectMock = vi.fn()
const singleMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpcMock(...args),
    from: () => ({
      upsert: (...args) => {
        upsertMock(...args)
        return { select: () => ({ single: () => singleMock() }) }
      },
    }),
  },
}))

const { getForecastStoreList, getForecastStoreDetail, saveForecastSettings } = await import('./forecast')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getForecastStoreList', () => {
  it('when_rpc_succeeds_should_return_rows', async () => {
    rpcMock.mockResolvedValue({ data: [{ store_code: 'KOS01' }], error: null })
    const rows = await getForecastStoreList()
    expect(rpcMock).toHaveBeenCalledWith('fn_forecast_store_list')
    expect(rows).toEqual([{ store_code: 'KOS01' }])
  })

  it('when_data_is_null_should_return_empty_array', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const rows = await getForecastStoreList()
    expect(rows).toEqual([])
  })

  it('when_rpc_errors_should_throw', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(getForecastStoreList()).rejects.toThrow('boom')
  })
})

describe('getForecastStoreDetail', () => {
  it('when_rpc_succeeds_should_pass_store_code_param_and_return_jsonb', async () => {
    const payload = { store: { store_code: 'KOS01' }, booths: [], daily: [] }
    rpcMock.mockResolvedValue({ data: payload, error: null })
    const result = await getForecastStoreDetail('KOS01')
    expect(rpcMock).toHaveBeenCalledWith('fn_forecast_store_detail', { p_store_code: 'KOS01' })
    expect(result).toEqual(payload)
  })

  it('when_rpc_errors_should_throw', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc failed') })
    await expect(getForecastStoreDetail('KOS01')).rejects.toThrow('rpc failed')
  })
})

describe('saveForecastSettings', () => {
  it('when_cycle_start_date_provided_should_include_it_in_upsert', async () => {
    singleMock.mockResolvedValue({ data: { store_code: 'TST01' }, error: null })
    await saveForecastSettings('TST01', { cycleStartDate: '2026-06-01', nextCollectionDate: '2026-07-01' }, 'staff1')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        store_code: 'TST01',
        cycle_start_date: '2026-06-01',
        next_collection_date: '2026-07-01',
        updated_by: 'staff1',
      }),
      { onConflict: 'store_code' }
    )
  })

  it('when_cycle_start_date_omitted_should_not_include_it_in_upsert', async () => {
    singleMock.mockResolvedValue({ data: { store_code: 'KOS01' }, error: null })
    await saveForecastSettings('KOS01', { nextCollectionDate: '2026-08-01' }, 'staff1')
    const patch = upsertMock.mock.calls[0][0]
    expect(patch).not.toHaveProperty('cycle_start_date')
    expect(patch.next_collection_date).toBe('2026-08-01')
  })

  it('when_upsert_errors_should_throw', async () => {
    singleMock.mockResolvedValue({ data: null, error: new Error('write failed') })
    await expect(
      saveForecastSettings('KOS01', { nextCollectionDate: '2026-08-01' }, 'staff1')
    ).rejects.toThrow('write failed')
  })
})
