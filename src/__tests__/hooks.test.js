// ============================================
// hooks テスト: useDrafts, useMeterCalc, useToast
// React hooks 自体は jsdom + renderHook が必要だが
// ここでは純粋関数・ユーティリティのテストに集中
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- useDrafts テスト ---
describe('useDrafts', () => {
  let drafts
  beforeEach(() => {
    // sessionStorage mock
    const store = {}
    vi.stubGlobal('sessionStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v },
      removeItem: (k) => { delete store[k] },
    })
  })

  it('getDrafts は空オブジェクトを返す（初回）', async () => {
    const { getDrafts } = await import('../hooks/useDrafts')
    expect(getDrafts()).toEqual({})
  })

  it('saveDraftBooth / getDraftBooth で保存・取得できる', async () => {
    const { saveDraftBooth, getDraftBooth } = await import('../hooks/useDrafts')
    saveDraftBooth('B01', { in_meter: '1000' })
    expect(getDraftBooth('B01')).toEqual({ in_meter: '1000' })
    expect(getDraftBooth('B99')).toBeNull()
  })

  it('clearDraftBooth で個別削除できる', async () => {
    const { saveDraftBooth, clearDraftBooth, getDraftBooth } = await import('../hooks/useDrafts')
    saveDraftBooth('B01', { in_meter: '1000' })
    saveDraftBooth('B02', { in_meter: '2000' })
    clearDraftBooth('B01')
    expect(getDraftBooth('B01')).toBeNull()
    expect(getDraftBooth('B02')).toEqual({ in_meter: '2000' })
  })

  it('clearDraftBooths で一括削除できる', async () => {
    const { saveDraftBooth, clearDraftBooths, getDrafts } = await import('../hooks/useDrafts')
    saveDraftBooth('B01', { in_meter: '1000' })
    saveDraftBooth('B02', { in_meter: '2000' })
    saveDraftBooth('B03', { in_meter: '3000' })
    clearDraftBooths(['B01', 'B03'])
    const all = getDrafts()
    expect(all['B01']).toBeUndefined()
    expect(all['B02']).toEqual({ in_meter: '2000' })
    expect(all['B03']).toBeUndefined()
  })
})

// --- useMeterCalc テスト ---
// calcMeterStats は services/utils の parseNum を使用
describe('calcMeterStats', () => {
  it('正常なメーター差分を計算する', async () => {
    const { calcMeterStats } = await import('../hooks/useMeterCalc')

    const result = calcMeterStats({
      prevIn: 1000, prevOut: 100,
      inVal: 1500, outVal: 130,
      price: 100,
    })
    expect(result.inDiff).toBe(500)
    expect(result.outDiff).toBe(30)
    expect(result.sales).toBe(50000)
    expect(result.payoutRate).toBe('6.0')
    expect(result.inAbnormal).toBe(false)
    expect(result.outAbnormal).toBe(false)
  })

  it('異常値（負のIN差分）を検出する', async () => {
    const { calcMeterStats } = await import('../hooks/useMeterCalc')
    const result = calcMeterStats({
      prevIn: 2000, prevOut: 100,
      inVal: 1000, outVal: 130,
      price: 100,
    })
    expect(result.inDiff).toBe(-1000)
    expect(result.inAbnormal).toBe(true)
    expect(result.sales).toBeNull() // 負のIN差分ではsales=null
  })

  it('異常値（50000超）を検出する', async () => {
    const { calcMeterStats } = await import('../hooks/useMeterCalc')
    const result = calcMeterStats({
      prevIn: 1000, prevOut: 100,
      inVal: 60000, outVal: 130,
      price: 100,
    })
    expect(result.inDiff).toBe(59000)
    expect(result.inAbnormal).toBe(true)
  })

  it('null値の場合はnullを返す', async () => {
    const { calcMeterStats } = await import('../hooks/useMeterCalc')
    const result = calcMeterStats({
      prevIn: null, prevOut: null,
      inVal: 1000, outVal: null,
      price: 100,
    })
    expect(result.inDiff).toBeNull()
    expect(result.outDiff).toBeNull()
    expect(result.sales).toBeNull()
    expect(result.payoutRate).toBeNull()
  })

  it('IN差分0のとき出率はnull', async () => {
    const { calcMeterStats } = await import('../hooks/useMeterCalc')
    const result = calcMeterStats({
      prevIn: 1000, prevOut: 100,
      inVal: 1000, outVal: 130,
      price: 100,
    })
    expect(result.inDiff).toBe(0)
    expect(result.payoutRate).toBeNull()
  })
})
