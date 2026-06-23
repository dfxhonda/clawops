// SPEC-PATROL-HISTORY-HEATMAP-01: 10列横スクロール対応。
// 巡回機械リスト 3-mode column switch。
// IN / 日売 (daily avg) / OUT の 3 モード。
// 10 列 (9前/8前/7前/6前/5前/4前/3前/2前/前回/今回)。
// display index 0=9前 (oldest) … 9=今回 (newest)。

export const COLUMN_COUNT   = 10
export const NEWEST         = COLUMN_COUNT - 1  // = 9
export const COLUMN_HEADERS = ['9前', '8前', '7前', '6前', '5前', '4前', '3前', '2前', '前回', '今回']

export const VIEW_MODES = {
  IN: {
    label:     'IN',
    sourceKey: 'inDiffs',
    type:      'count',
  },
  DAILY: {
    label:     'Ave',
    sourceKey: 'daily',
    type:      'perDay',
  },
  OUT: {
    label:     'OUT',
    sourceKey: 'outDiffs',
    type:      'count',
  },
}

export const VIEW_MODE_ORDER = ['IN', 'DAILY', 'OUT']

function round1(n) {
  if (n == null || !isFinite(n)) return null
  return Math.round(n * 10) / 10
}

export function formatCell(value, type) {
  if (value == null) return '−'
  switch (type) {
    case 'perDay': return value.toFixed(1)
    case 'count':
    default:       return value.toLocaleString()
  }
}

// 10 要素配列を booth summary から取り出す。null safe。
export function sourceArrayFor(summary, mode) {
  const def = VIEW_MODES[mode] ?? VIEW_MODES.IN
  return summary?.[def.sourceKey] ?? Array(COLUMN_COUNT).fill(null)
}

// 機械単位 (booths の SUM) / 店舗単位 (全 booth の SUM) 共用集計。
// summaries は対象 booth の computeBoothDiffSummary 出力配列。
// IN/OUT: 各列 SUM。DAILY: 各列の重み付き平均 SUM(inDiffs[i])/SUM(days[i])。
// 戻り値: 長さ 10 の数値/null 配列 (display index 0=9前 … 9=今回)。
export function aggregateSummaries(summaries, mode) {
  const list = (summaries ?? []).filter(Boolean)
  if (!list.length) return Array(COLUMN_COUNT).fill(null)

  if (mode === 'DAILY') {
    const result = Array(COLUMN_COUNT).fill(null)
    for (let i = 0; i < COLUMN_COUNT; i++) {
      let inSum = null
      let dSum  = null
      for (const s of list) {
        const inV = s.inDiffs?.[i]
        const dV  = s.days?.[i]
        if (inV != null) inSum = (inSum ?? 0) + inV
        if (dV  != null) dSum  = (dSum  ?? 0) + dV
      }
      result[i] = inSum != null && dSum != null && dSum > 0
        ? round1(inSum / dSum)
        : null
    }
    return result
  }

  // IN / OUT: 各列 SUM
  const sourceKey = (VIEW_MODES[mode] ?? VIEW_MODES.IN).sourceKey
  const result = Array(COLUMN_COUNT).fill(null)
  for (let i = 0; i < COLUMN_COUNT; i++) {
    let acc = null
    for (const s of list) {
      const v = s?.[sourceKey]?.[i]
      if (v != null) acc = (acc ?? 0) + v
    }
    result[i] = acc
  }
  return result
}

// 機械 → booths の summaries 配列
export function machineBoothSummaries(machine, diffMap) {
  return (machine?.booths ?? []).map(b => diffMap[b.booth_code] ?? null)
}

// F3: diffMap から各列の日付ラベルを取得。最初の有効 summary の dates[] を使用。
export function computeColumnDates(diffMap) {
  for (const summary of Object.values(diffMap || {})) {
    if (summary?.dates?.some(d => d != null)) return summary.dates
  }
  return Array(COLUMN_COUNT).fill(null)
}

// F4: 全 booth の diffMap から列ごとにワースト3件のブースコード→色クラスを返す。
// 戻り値: { boothCode: string[] (COLUMN_COUNT 長、色クラスまたは null) }
// ワースト = 各列で値が最小の3件 (低い方が悪い = 集客力弱)。
export function computeWorstBoothMap(allDiffMap, mode) {
  const result = {}
  const colors = ['text-red-500', 'text-red-400', 'text-red-300']
  for (let col = 0; col < COLUMN_COUNT; col++) {
    const entries = []
    for (const [bc, s] of Object.entries(allDiffMap || {})) {
      const arr = sourceArrayFor(s, mode)
      const v = arr[col]
      if (v != null) entries.push({ bc, v })
    }
    entries.sort((a, b) => a.v - b.v)
    entries.slice(0, 3).forEach(({ bc }, rank) => {
      if (!result[bc]) result[bc] = Array(COLUMN_COUNT).fill(null)
      result[bc][col] = colors[rank]
    })
  }
  return result
}
