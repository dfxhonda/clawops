// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { mapMetersToColumns, theoreticalStock } from './patrolStockCalc'

describe('theoreticalStock (理論在庫 = 前回在庫 + 前回補充 − OUT差)', () => {
  it('前回在庫がnullならnull', () => {
    expect(theoreticalStock(null, 5, 100, 110)).toBeNull()
    expect(theoreticalStock(undefined, 5, 100, 110)).toBeNull()
  })

  it('OUT差0(今回OUT=前回OUT)なら 前回在庫+前回補充', () => {
    expect(theoreticalStock(10, 5, 100, 100)).toBe(15)
  })

  it('今回OUTが進んだ分(OUT差)だけ引く', () => {
    expect(theoreticalStock(10, 5, 100, 107)).toBe(8) // 15 - 7
  })

  it('今回OUT未入力(空/null)はOUT差0扱い', () => {
    expect(theoreticalStock(10, 5, 100, '')).toBe(15)
    expect(theoreticalStock(10, 5, 100, null)).toBe(15)
  })

  it('前回補充がnull/undefinedは0扱い', () => {
    expect(theoreticalStock(10, null, 100, 100)).toBe(10)
    expect(theoreticalStock(10, undefined, 100, 103)).toBe(7)
  })

  it('前回OUTがnullならOUT差0(=前回在庫+前回補充)', () => {
    expect(theoreticalStock(10, 5, null, 107)).toBe(15)
  })

  it('文字列入力も数値として計算', () => {
    expect(theoreticalStock('10', '5', '100', '108')).toBe(7)
  })

  it('在庫切れ(マイナス)もそのまま返す(警告は呼び出し側)', () => {
    expect(theoreticalStock(2, 0, 100, 110)).toBe(-8)
  })
})

describe('mapMetersToColumns (メーター配列→in/out列)', () => {
  it('空/非配列は両方null', () => {
    expect(mapMetersToColumns([])).toEqual({ in_meter: null, out_meter: null })
    expect(mapMetersToColumns(null)).toEqual({ in_meter: null, out_meter: null })
    expect(mapMetersToColumns(undefined)).toEqual({ in_meter: null, out_meter: null })
  })

  it('IN単体を拾う(parseInt)', () => {
    expect(mapMetersToColumns([{ type: 'in', value: '12345' }]))
      .toEqual({ in_meter: 12345, out_meter: null })
  })

  it('OUTは outOrder 優先 (out_a が out より優先)', () => {
    const r = mapMetersToColumns([
      { type: 'out', value: '200' },
      { type: 'out_a', value: '100' },
    ])
    expect(r.out_meter).toBe(100)
  })

  it('INは inTypes 優先 (in が yen1000_in より優先)', () => {
    const r = mapMetersToColumns([
      { type: 'yen1000_in', value: '999' },
      { type: 'in', value: '500' },
    ])
    expect(r.in_meter).toBe(500)
  })

  it('value=null は無視', () => {
    const r = mapMetersToColumns([
      { type: 'in', value: null },
      { type: 'yen500_in', value: '777' },
    ])
    expect(r.in_meter).toBe(777)
  })

  it('ガチャ capsule_out を OUT として拾う', () => {
    expect(mapMetersToColumns([{ type: 'capsule_out', value: '50' }]).out_meter).toBe(50)
  })

  it('IN/OUT 両方ある通常クレーン', () => {
    expect(mapMetersToColumns([
      { type: 'in', value: '10000' },
      { type: 'out', value: '3000' },
    ])).toEqual({ in_meter: 10000, out_meter: 3000 })
  })
})
