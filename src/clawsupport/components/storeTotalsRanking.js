// J-PATROL-IN-DAILY-fix-05 ad-hoc (ヒロ Discord IMG_4234):
// 機械単位で各列 (前IN/今IN/前/日/今/日) の ベスト 3 / ワースト 3 をランク色付け。
// ベスト = 高い順 (gold/silver/bronze)、ワースト = 低い順 (red 濃淡)。
// 機械数 < 6 の場合は ワースト 件数を控えて best/worst の重複を避ける。
// SPEC-PATROL-VIEW-MODE-SWITCH-01: mode (IN/OUT/STOCK) ごとに対象列が変わるため、
// VIEW_MODES の cols から動的にランク対象 key を引く。OUT mode の出率 (percent) は
// 機械単位で SUM(out)/SUM(in) で集計してからランク (重み付き平均、aggregateSummaries 経由)。

import { VIEW_MODES, aggregateSummaries, machineBoothSummaries } from './patrolViewModes'

export function computeMachineRankMap(machines, diffMap, mode = 'IN') {
  const cols = (VIEW_MODES[mode] ?? VIEW_MODES.IN).cols
  const keys = cols.map(c => c.key)
  // ranks[colKey][machineCode] = 'best1'|...|'worst3'
  const ranks = Object.fromEntries(keys.map(k => [k, {}]))
  const totalsByMachine = {}
  for (const m of machines || []) {
    const summaries = machineBoothSummaries(m, diffMap)
    totalsByMachine[m.machine_code] = aggregateSummaries(summaries, mode)
  }
  for (const col of keys) {
    const entries = Object.entries(totalsByMachine)
      .filter(([, t]) => t[col] != null)
      .sort((a, b) => b[1][col] - a[1][col])
    const N = entries.length
    for (let i = 0; i < Math.min(3, N); i++) {
      ranks[col][entries[i][0]] = ['best1', 'best2', 'best3'][i]
    }
    const worstCount = Math.max(0, Math.min(3, N - 3))
    for (let i = 0; i < worstCount; i++) {
      const idx = N - 1 - i
      ranks[col][entries[idx][0]] = ['worst1', 'worst2', 'worst3'][i]
    }
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
