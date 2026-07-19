// SPEC-PATROL-ACCUM-COL-S2-SUPPLY-01 (D-097): fetchCollectionBaseline RPC ラッパーの単体検証。
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a) => rpcMock(...a) } }))
const warnMock = vi.fn()
vi.mock('../../lib/logger', () => ({ logger: { warn: (...a) => warnMock(...a) } }))

import { fetchCollectionBaseline } from '../../services/collectionBaseline'

beforeEach(() => { rpcMock.mockReset(); warnMock.mockReset() })

describe('AC1: fetchCollectionBaseline booth_code キー map', () => {
  it('RPC rows → { [booth_code]: { accum, baselineIn, baselineSource } }', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { booth_code: 'B01', machine_code: 'M1', latest_in: 5000, baseline_in: 3000, accum: 2000, baseline_source: 'collection' },
        { booth_code: 'B02', latest_in: 100, baseline_in: null, accum: 0, baseline_source: 'first_patrol' },
      ],
      error: null,
    })
    const m = await fetchCollectionBaseline('TST01')
    expect(rpcMock).toHaveBeenCalledWith('fn_booth_collection_baseline', { p_store_code: 'TST01' })
    expect(m.B01).toEqual({ accum: 2000, baselineIn: 3000, baselineSource: 'collection' })
    expect(m.B02).toEqual({ accum: 0, baselineIn: null, baselineSource: 'first_patrol' })
  })

  it('booth_code 欠落行はスキップ', async () => {
    rpcMock.mockResolvedValue({ data: [{ accum: 5 }, { booth_code: 'B01', accum: 1, baseline_in: 2, baseline_source: 'collection' }], error: null })
    const m = await fetchCollectionBaseline('TST01')
    expect(Object.keys(m)).toEqual(['B01'])
  })
})

describe('AC5: 失敗時は {} 返し巡回本体をブロックしない', () => {
  it('RPC error → {} + logger.warn (throw しない)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc fail') })
    const m = await fetchCollectionBaseline('TST01')
    expect(m).toEqual({})
    expect(warnMock).toHaveBeenCalledWith('ERR-ACCUM-BASELINE-FETCH', expect.objectContaining({ storeCode: 'TST01' }))
  })

  it('RPC reject(throw) → {} + warn', async () => {
    rpcMock.mockRejectedValue(new Error('network'))
    await expect(fetchCollectionBaseline('TST01')).resolves.toEqual({})
    expect(warnMock).toHaveBeenCalled()
  })

  it('storeCode 空 → {} (RPC 呼ばない)', async () => {
    expect(await fetchCollectionBaseline('')).toEqual({})
    expect(await fetchCollectionBaseline(null)).toEqual({})
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
