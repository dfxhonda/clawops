// SPEC-PATROL-VIEW-MODE-SWITCH-02: best3/worst3 を「今回」(display index 3) 列のみで計算
import { describe, it, expect } from 'vitest'
import { computeMachineRankMap, rankColor } from '../../clawsupport/components/storeTotalsRanking'

const mk = (code, arrIn) => ({
  machine_code: code,
  booths: [{ booth_code: `${code}-1` }],
})

const mkDiff = (code, todayIn) => ({
  [`${code}-1`]: {
    inDiffs:  [0, 0, 0, todayIn],
    outDiffs: [0, 0, 0, todayIn],
    daily:    [0, 0, 0, todayIn],
    days:     [1, 1, 1, 1],
  },
})

describe('computeMachineRankMap (SPEC-02 newest-column only)', () => {
  it('when_3_machines_should_have_best_only_no_worst', () => {
    const machines = ['A', 'B', 'C'].map(c => mk(c))
    const diffMap = { ...mkDiff('A', 100), ...mkDiff('B', 50), ...mkDiff('C', 25) }
    const ranks = computeMachineRankMap(machines, diffMap, 'IN')
    expect(ranks.A).toBe('best1')
    expect(ranks.B).toBe('best2')
    expect(ranks.C).toBe('best3')
  })

  it('when_6_machines_should_have_3_best_and_3_worst_on_今回', () => {
    const machines = ['A','B','C','D','E','F'].map(c => mk(c))
    const diffMap = {
      ...mkDiff('A', 600), ...mkDiff('B', 500), ...mkDiff('C', 400),
      ...mkDiff('D', 300), ...mkDiff('E', 200), ...mkDiff('F', 100),
    }
    const ranks = computeMachineRankMap(machines, diffMap, 'IN')
    expect(ranks.A).toBe('best1')
    expect(ranks.B).toBe('best2')
    expect(ranks.C).toBe('best3')
    expect(ranks.D).toBe('worst3')
    expect(ranks.E).toBe('worst2')
    expect(ranks.F).toBe('worst1')
  })

  it('machines_with_null_今回_value_are_excluded_from_ranking', () => {
    const machines = ['A', 'B'].map(c => mk(c))
    const diffMap = {
      ...mkDiff('A', 100),
      'B-1': { inDiffs: [null, null, null, null], days: [null, null, null, null] },
    }
    const ranks = computeMachineRankMap(machines, diffMap, 'IN')
    expect(ranks.A).toBe('best1')
    expect(ranks.B).toBeUndefined()
  })

  it('OUT_mode_uses_outDiffs_newest_column', () => {
    const machines = ['A', 'B', 'C'].map(c => mk(c))
    const diffMap = {
      'A-1': { inDiffs: [0,0,0,1], outDiffs: [0,0,0,300], daily: [], days: [] },
      'B-1': { inDiffs: [0,0,0,1], outDiffs: [0,0,0,100], daily: [], days: [] },
      'C-1': { inDiffs: [0,0,0,1], outDiffs: [0,0,0, 50], daily: [], days: [] },
    }
    const ranks = computeMachineRankMap(machines, diffMap, 'OUT')
    expect(ranks.A).toBe('best1')
    expect(ranks.B).toBe('best2')
    expect(ranks.C).toBe('best3')
  })

  it('DAILY_mode_uses_weighted_avg_newest', () => {
    const machines = ['A', 'B'].map(c => mk(c))
    const diffMap = {
      'A-1': { inDiffs: [0,0,0,200], days: [1,1,1, 1] }, // 200/1 = 200
      'B-1': { inDiffs: [0,0,0,100], days: [1,1,1,10] }, // 100/10 = 10
    }
    const ranks = computeMachineRankMap(machines, diffMap, 'DAILY')
    expect(ranks.A).toBe('best1')
    expect(ranks.B).toBe('best2')
  })

  it('sums_multiple_booths_per_machine_before_ranking', () => {
    const machineA = { machine_code: 'A', booths: [{ booth_code: 'A-1' }, { booth_code: 'A-2' }] }
    const machineB = { machine_code: 'B', booths: [{ booth_code: 'B-1' }] }
    const diffMap = {
      'A-1': { inDiffs: [0, 0, 0, 40], days: [1,1,1,1] },
      'A-2': { inDiffs: [0, 0, 0, 30], days: [1,1,1,1] },
      'B-1': { inDiffs: [0, 0, 0, 50], days: [1,1,1,1] },
    }
    const ranks = computeMachineRankMap([machineA, machineB], diffMap, 'IN')
    // SUM A = 70 > B = 50
    expect(ranks.A).toBe('best1')
    expect(ranks.B).toBe('best2')
  })
})

describe('rankColor', () => {
  it('best_worst_class_strings_stable', () => {
    expect(rankColor('best1', false)).toBe('text-yellow-300')
    expect(rankColor('best2', false)).toBe('text-slate-200')
    expect(rankColor('best3', false)).toBe('text-orange-300')
    expect(rankColor('worst1', false)).toBe('text-red-400')
    expect(rankColor(null, false)).toBe('text-text')
    expect(rankColor(null, true)).toBe('text-green-300')
  })
})
