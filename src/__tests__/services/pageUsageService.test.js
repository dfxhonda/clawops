// @vitest-environment node
// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068) AC1: 計測 silent fail + 本人 stats fetch。
import { describe, it, expect, vi, beforeEach } from 'vitest'

let rpcResult, selectResult
const rpcSpy = vi.fn(async () => rpcResult)
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...a) => rpcSpy(...a),
    from: () => ({ select: () => ({ eq: async () => selectResult }) }),
  },
}))

import { trackPageUsage, fetchMyPageUsage } from '../../services/pageUsage'

beforeEach(() => { rpcResult = { error: null }; selectResult = { data: [], error: null }; vi.clearAllMocks() })

describe('AC1: trackPageUsage', () => {
  it('fn_track_page_usage を p_ 引数で呼ぶ', async () => {
    await trackPageUsage({ staffId: 'S1', pageKey: 'forecast', addViews: 1, addSeconds: 0 })
    expect(rpcSpy).toHaveBeenCalledWith('fn_track_page_usage', { p_staff_id: 'S1', p_page_key: 'forecast', p_add_views: 1, p_add_seconds: 0 })
  })
  it('RPC エラーは silent (throw しない)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rpcResult = { error: { message: 'boom' } }
    await expect(trackPageUsage({ staffId: 'S1', pageKey: 'forecast', addViews: 1 })).resolves.toBeUndefined()
    warn.mockRestore()
  })
  it('staffId/pageKey 欠落は no-op', async () => {
    await trackPageUsage({ staffId: null, pageKey: 'forecast' })
    await trackPageUsage({ staffId: 'S1', pageKey: null })
    expect(rpcSpy).not.toHaveBeenCalled()
  })
})

describe('AC1: fetchMyPageUsage', () => {
  it('page_key キーの map を返す', async () => {
    selectResult = { data: [{ page_key: 'forecast', view_count: 3, total_seconds: 60 }, { page_key: 'dma7', view_count: 1, total_seconds: 0 }], error: null }
    const m = await fetchMyPageUsage('S1')
    expect(m.forecast.view_count).toBe(3)
    expect(m.dma7.view_count).toBe(1)
  })
  it('エラー時は {} (既定順にフォールバック)', async () => {
    selectResult = { data: null, error: { message: 'x' } }
    expect(await fetchMyPageUsage('S1')).toEqual({})
    expect(await fetchMyPageUsage(null)).toEqual({})
  })
})
