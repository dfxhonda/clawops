// J-PATROL-IN-DAILY-fix-05 ad-hoc: ベスト3/ワースト3 ランクユーティリティ
import { describe, it, expect } from 'vitest'
import { computeMachineRankMap, rankColor } from '../../clawsupport/components/storeTotalsRanking'

const mkBooth = (code, summary) => ({ booth_code: code, summary })

describe('computeMachineRankMap', () => {
  it('when_machines_count_lt_4_should_only_have_best_no_worst', () => {
    const machines = [
      { machine_code: 'A', booths: [{ booth_code: 'A-1' }] },
      { machine_code: 'B', booths: [{ booth_code: 'B-1' }] },
      { machine_code: 'C', booths: [{ booth_code: 'C-1' }] },
    ]
    const diffMap = {
      'A-1': { prevIn: 10, currIn: 100, prevPerDay: 1, currPerDay: 10 },
      'B-1': { prevIn: 20, currIn: 50,  prevPerDay: 2, currPerDay: 5 },
      'C-1': { prevIn: 30, currIn: 25,  prevPerDay: 3, currPerDay: 2.5 },
    }
    const ranks = computeMachineRankMap(machines, diffMap)
    // prevIn descending: C(30)/B(20)/A(10) → best1/best2/best3
    expect(ranks.prevIn.C).toBe('best1')
    expect(ranks.prevIn.B).toBe('best2')
    expect(ranks.prevIn.A).toBe('best3')
    // N=3 → no worst slots (would overlap best)
    expect(Object.values(ranks.prevIn).filter(r => r?.startsWith('worst')).length).toBe(0)
  })

  it('when_6_machines_should_have_3_best_and_3_worst', () => {
    const machines = ['A','B','C','D','E','F'].map(c => ({
      machine_code: c, booths: [{ booth_code: `${c}-1` }],
    }))
    const diffMap = {
      'A-1': { currIn: 600 },
      'B-1': { currIn: 500 },
      'C-1': { currIn: 400 },
      'D-1': { currIn: 300 },
      'E-1': { currIn: 200 },
      'F-1': { currIn: 100 },
    }
    const ranks = computeMachineRankMap(machines, diffMap)
    expect(ranks.currIn.A).toBe('best1')
    expect(ranks.currIn.B).toBe('best2')
    expect(ranks.currIn.C).toBe('best3')
    expect(ranks.currIn.D).toBe('worst3')
    expect(ranks.currIn.E).toBe('worst2')
    expect(ranks.currIn.F).toBe('worst1')
  })

  it('when_machine_has_null_value_should_skip_ranking', () => {
    const machines = [
      { machine_code: 'A', booths: [{ booth_code: 'A-1' }] },
      { machine_code: 'B', booths: [{ booth_code: 'B-1' }] },
    ]
    const diffMap = {
      'A-1': { prevIn: 100 },
      'B-1': { /* no prevIn */ },
    }
    const ranks = computeMachineRankMap(machines, diffMap)
    expect(ranks.prevIn.A).toBe('best1')
    expect(ranks.prevIn.B).toBeUndefined()
  })

  it('sums_multiple_booths_per_machine_before_ranking', () => {
    const machines = [
      { machine_code: 'A', booths: [{ booth_code: 'A-1' }, { booth_code: 'A-2' }] },
      { machine_code: 'B', booths: [{ booth_code: 'B-1' }] },
    ]
    const diffMap = {
      'A-1': { currIn: 40 },
      'A-2': { currIn: 30 },
      'B-1': { currIn: 50 },
    }
    const ranks = computeMachineRankMap(machines, diffMap)
    // A合計=70 > B=50 → A is best1
    expect(ranks.currIn.A).toBe('best1')
    expect(ranks.currIn.B).toBe('best2')
  })
})

describe('rankColor', () => {
  it('best/worst class strings stable', () => {
    expect(rankColor('best1', false)).toBe('text-yellow-300')
    expect(rankColor('best2', false)).toBe('text-slate-200')
    expect(rankColor('best3', false)).toBe('text-orange-300')
    expect(rankColor('worst1', false)).toBe('text-red-400')
    expect(rankColor(null, false)).toBe('text-text')
    expect(rankColor(null, true)).toBe('text-green-300')
  })
})
