// @vitest-environment node
// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068) AC2: タイル利用ソート。
import { describe, it, expect } from 'vitest'
import { usageScore, sortTilesByUsage } from '../../lib/pageUsageSort'

const T = (key, impl = true) => ({ key, label: key, impl })

describe('AC2: usageScore', () => {
  it('view_count + total_seconds/60', () => {
    expect(usageScore({ view_count: 3, total_seconds: 120 })).toBe(5) // 3 + 2
    expect(usageScore({ view_count: 0, total_seconds: 30 })).toBe(0.5)
    expect(usageScore(undefined)).toBe(0)
    expect(usageScore({})).toBe(0)
  })
})

describe('AC2: sortTilesByUsage', () => {
  const tiles = [T('a'), T('b'), T('c'), T('soon1', false), T('soon2', false)]

  it('score 降順、準備中は下部固定', () => {
    const stats = { a: { view_count: 1 }, b: { view_count: 10 }, c: { view_count: 5 } }
    const out = sortTilesByUsage(tiles, stats).map(t => t.key)
    expect(out).toEqual(['b', 'c', 'a', 'soon1', 'soon2'])
  })

  it('滞在秒も score に寄与 (view少でも累積で上位)', () => {
    const stats = { a: { view_count: 1, total_seconds: 600 }, b: { view_count: 5 }, c: {} }
    // a=1+10=11, b=5, c=0
    expect(sortTilesByUsage(tiles, stats).map(t => t.key)).toEqual(['a', 'b', 'c', 'soon1', 'soon2'])
  })

  it('stats 空/未指定 → 既定順 (impl 順 + 準備中下部)', () => {
    expect(sortTilesByUsage(tiles, {}).map(t => t.key)).toEqual(['a', 'b', 'c', 'soon1', 'soon2'])
    expect(sortTilesByUsage(tiles, null).map(t => t.key)).toEqual(['a', 'b', 'c', 'soon1', 'soon2'])
    expect(sortTilesByUsage(tiles).map(t => t.key)).toEqual(['a', 'b', 'c', 'soon1', 'soon2'])
  })

  it('同点は既定順を維持 (stable)', () => {
    const stats = { a: { view_count: 2 }, b: { view_count: 2 }, c: { view_count: 2 } }
    expect(sortTilesByUsage(tiles, stats).map(t => t.key)).toEqual(['a', 'b', 'c', 'soon1', 'soon2'])
  })
})
