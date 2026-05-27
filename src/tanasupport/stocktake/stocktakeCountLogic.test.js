import { describe, it, expect } from 'vitest'
import {
  addBatch,
  sortUnenteredFirst,
  nextUnenteredIndex,
  isAllEntered,
} from './stocktakeCountLogic'

describe('addBatch', () => {
  it('数字バッチを打つと合計に加算される', () => {
    expect(addBatch(50, '25')).toBe(75)
  })
  it('合計0に最初のバッチを足すとそのバッチ値になる', () => {
    expect(addBatch(0, '50')).toBe(50)
  })
  it('空文字バッチは合計を変えない', () => {
    expect(addBatch(75, '')).toBe(75)
  })
  it('非数バッチは合計を変えない', () => {
    expect(addBatch(75, 'abc')).toBe(75)
  })
})

describe('sortUnenteredFirst', () => {
  const prizes = [
    { prize_id: 'A', prize_name: 'あ' },
    { prize_id: 'B', prize_name: 'い' },
    { prize_id: 'C', prize_name: 'う' },
  ]
  it('入力済みSKUはリスト下部へ回る', () => {
    const sorted = sortUnenteredFirst(prizes, { B: { actual_count: 3 } })
    expect(sorted.map(p => p.prize_id)).toEqual(['A', 'C', 'B'])
  })
  it('全未入力なら元の順序を保つ', () => {
    const sorted = sortUnenteredFirst(prizes, {})
    expect(sorted.map(p => p.prize_id)).toEqual(['A', 'B', 'C'])
  })
})

describe('nextUnenteredIndex', () => {
  const prizes = [{ prize_id: 'A' }, { prize_id: 'B' }, { prize_id: 'C' }]
  it('現在位置の次にある未入力SKUの位置を返す', () => {
    expect(nextUnenteredIndex(prizes, { A: {} }, 0)).toBe(1)
  })
  it('入力済みを飛ばして次の未入力を返す', () => {
    expect(nextUnenteredIndex(prizes, { A: {}, B: {} }, 0)).toBe(2)
  })
  it('後続に未入力が無ければ-1を返す', () => {
    expect(nextUnenteredIndex(prizes, { A: {}, B: {}, C: {} }, 0)).toBe(-1)
  })
})

describe('isAllEntered', () => {
  it('全SKU入力済みならtrue', () => {
    expect(isAllEntered([{ prize_id: 'A' }], { A: { actual_count: 0 } })).toBe(true)
  })
  it('未入力SKUが残るならfalse', () => {
    expect(isAllEntered([{ prize_id: 'A' }, { prize_id: 'B' }], { A: {} })).toBe(false)
  })
  it('景品リストが空ならfalse(締め対象なし)', () => {
    expect(isAllEntered([], {})).toBe(false)
  })
})
