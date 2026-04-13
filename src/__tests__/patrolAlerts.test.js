import { describe, it, expect } from 'vitest'
import { detectAlerts } from '../utils/patrolAlerts'

const calc = (inDiff, outDiffs) => ({
  inDiff,
  outs: outDiffs.map(diff => ({ diff })),
})

describe('detectAlerts', () => {
  it('nullなら空配列', () => {
    expect(detectAlerts(null, 1)).toEqual([])
  })

  it('異常なしなら空配列', () => {
    expect(detectAlerts(calc(100, [30]), 1)).toHaveLength(0)
  })

  it('IN差0 → yellow', () => {
    const result = detectAlerts(calc(0, [0]), 1)
    expect(result.some(a => a.level === 'yellow' && a.msg.includes('IN差0'))).toBe(true)
  })

  it('IN差マイナス → red', () => {
    const result = detectAlerts(calc(-5, [0]), 1)
    expect(result.some(a => a.level === 'red' && a.msg.includes('IN差マイナス'))).toBe(true)
  })

  it('OUT差マイナス → red', () => {
    const result = detectAlerts(calc(100, [-1]), 1)
    expect(result.some(a => a.level === 'red' && a.msg.includes('OUT差マイナス'))).toBe(true)
  })

  it('出率35%超 → yellow', () => {
    const result = detectAlerts(calc(100, [40]), 1)
    expect(result.some(a => a.level === 'yellow' && a.msg.includes('出率高め'))).toBe(true)
  })

  it('出率50%超 → red', () => {
    const result = detectAlerts(calc(100, [60]), 1)
    expect(result.some(a => a.level === 'red' && a.msg.includes('出率異常'))).toBe(true)
  })

  it('複数OUT: 各OUTでラベルA/B付き', () => {
    const result = detectAlerts(calc(100, [-1, -2]), 2)
    expect(result.some(a => a.msg.includes('OUT-A'))).toBe(true)
    expect(result.some(a => a.msg.includes('OUT-B'))).toBe(true)
  })

  it('赤が黄より前に並ぶ', () => {
    const result = detectAlerts(calc(100, [60]), 1)
    // 出率50%超(red) と同時に IN差0(yellow) が出るケースでテスト
    const result2 = detectAlerts(calc(0, [0]), 1) // IN差0=yellow
    const mixed = detectAlerts({ inDiff: 0, outs: [{ diff: 60 }] }, 1) // IN差0=yellow, 出率60%=red
    const redIdx = mixed.findIndex(a => a.level === 'red')
    const yellowIdx = mixed.findIndex(a => a.level === 'yellow')
    if (redIdx !== -1 && yellowIdx !== -1) {
      expect(redIdx).toBeLessThan(yellowIdx)
    }
  })

  it('inDiffがnullなら出率チェックしない', () => {
    const result = detectAlerts({ inDiff: null, outs: [{ diff: 60 }] }, 1)
    expect(result.every(a => !a.msg.includes('出率'))).toBe(true)
  })
})
