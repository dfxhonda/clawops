// SPEC-PATROL-VIEW-MODE-SWITCH-02: 巡回機械リスト 3-mode column switch (4-visit history)。
// IN / 日売 (daily avg) / OUT の 3 モード。各モードで 4 列固定ラベル「4前 / 3前 / 前回 / 今回」。
// (SPEC-01 の 出率% / 在庫 / 補充 mode は廃止)
//
// 各 booth の summary は inDiffs[4] / outDiffs[4] / daily[4] / days[4] 配列を持ち、
// display index 0=4前 … 3=今回 (oldest left → newest right)。

export const COLUMN_HEADERS = ['4前', '3前', '前回', '今回']
export const COLUMN_COUNT   = 4

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

// 4 要素配列を booth summary から取り出す。null safe。
export function sourceArrayFor(summary, mode) {
  const def = VIEW_MODES[mode] ?? VIEW_MODES.IN
  return summary?.[def.sourceKey] ?? [null, null, null, null]
}

// 機械単位 (booths の SUM) / 店舗単位 (全 booth の SUM) 共用集計。
// summaries は対象 booth の computeBoothDiffSummary 出力配列。
// IN/OUT: 各列 SUM。DAILY: 各列の重み付き平均 SUM(inDiffs[i])/SUM(days[i])。
// 戻り値: 長さ 4 の数値/null 配列 (display index 0=4前 … 3=今回)。
export function aggregateSummaries(summaries, mode) {
  const list = (summaries ?? []).filter(Boolean)
  if (!list.length) return [null, null, null, null]

  if (mode === 'DAILY') {
    const result = [null, null, null, null]
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
  const result = [null, null, null, null]
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
