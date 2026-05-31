// J-PATROL-IN-DAILY-fix-05 ad-hoc (ヒロ Discord IMG_4234):
// 機械単位で各列 (前IN/今IN/前/日/今/日) の ベスト 3 / ワースト 3 をランク色付け。
// ベスト = 高い順 (gold/silver/bronze)、ワースト = 低い順 (red 濃淡)。
// 機械数 < 6 の場合は ワースト 件数を控えて best/worst の重複を避ける。

const COLS = ['prevIn', 'currIn', 'prevPerDay', 'currPerDay']

function sumBoothsForMachine(booths, diffMap) {
  const t = { prevIn: null, currIn: null, prevPerDay: null, currPerDay: null }
  for (const b of booths ?? []) {
    const d = diffMap[b.booth_code]
    if (!d) continue
    if (d.prevIn != null)     t.prevIn     = (t.prevIn     ?? 0) + d.prevIn
    if (d.currIn != null)     t.currIn     = (t.currIn     ?? 0) + d.currIn
    if (d.prevPerDay != null) t.prevPerDay = (t.prevPerDay ?? 0) + d.prevPerDay
    if (d.currPerDay != null) t.currPerDay = (t.currPerDay ?? 0) + d.currPerDay
  }
  return t
}

export function computeMachineRankMap(machines, diffMap) {
  // ranks[col][machineCode] = 'best1'|'best2'|'best3'|'worst1'|'worst2'|'worst3'
  const ranks = { prevIn: {}, currIn: {}, prevPerDay: {}, currPerDay: {} }
  const totalsByMachine = {}
  for (const m of machines || []) {
    totalsByMachine[m.machine_code] = sumBoothsForMachine(m.booths, diffMap)
  }
  for (const col of COLS) {
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
