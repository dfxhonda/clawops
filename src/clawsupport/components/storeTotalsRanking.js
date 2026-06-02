// SPEC-PATROL-VIEW-MODE-SWITCH-02: best3/worst3 coloring を mode の「今回 (newest) 列」のみで再計算。
// 機械数 < 6 の場合は worst 件数を控えて best/worst の重複を避ける。
// 戻り値: ranks[machineCode] = 'best1'|'best2'|'best3'|'worst1'|'worst2'|'worst3'|undefined
// MachineRow は今回 (display index 3) 列のみ rankColor を適用、4 前 / 3 前 / 前回 は plain。

import { aggregateSummaries, machineBoothSummaries } from './patrolViewModes'

const NEWEST_INDEX = 3 // 今回

export function computeMachineRankMap(machines, diffMap, mode = 'IN') {
  const totalsByMachine = {}
  for (const m of machines || []) {
    const summaries = machineBoothSummaries(m, diffMap)
    const arr = aggregateSummaries(summaries, mode)
    totalsByMachine[m.machine_code] = arr[NEWEST_INDEX]
  }
  const entries = Object.entries(totalsByMachine)
    .filter(([, v]) => v != null)
    .sort((a, b) => b[1] - a[1])
  const N = entries.length
  const ranks = {}
  for (let i = 0; i < Math.min(3, N); i++) {
    ranks[entries[i][0]] = ['best1', 'best2', 'best3'][i]
  }
  const worstCount = Math.max(0, Math.min(3, N - 3))
  for (let i = 0; i < worstCount; i++) {
    const idx = N - 1 - i
    ranks[entries[idx][0]] = ['worst1', 'worst2', 'worst3'][i]
  }
  return ranks
}

// rank → Tailwind text color class。未ランクは fallback (前 = text-text / 今 = text-green-300)。
export function rankColor(rank, isToday) {
  switch (rank) {
    case 'best1':  return 'text-yellow-300'
    case 'best2':  return 'text-slate-200'
    case 'best3':  return 'text-orange-300'
    case 'worst1': return 'text-red-400'
    case 'worst2': return 'text-red-400/80'
    case 'worst3': return 'text-red-400/60'
    default:       return isToday ? 'text-green-300' : 'text-text'
  }
}
