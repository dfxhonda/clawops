// SPEC-PATROL-HISTORY-HEATMAP-01: 10列横スクロール対応。
// SPEC-PATROL-HISTORY-HEATMAP-02: computeColumnDates 50%閾値日付軸、mapSummaryToDateAxis、
//   aggregateSummaries/computeWorstBoothMap dateAxis対応。
// SPEC-PATROL-HISTORY-HEATMAP-03: computeColumnDates を全ブース日付和集合の新しい順10日に変更(閾値廃止)。
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

// SPEC-PATROL-HISTORY-HEATMAP-02 F1: booth summary の各配列を store-wide 日付軸にリマップ。
// axis[i] は display column i の patrol_date (YYYY-MM-DD) または null。
// booth の dates[] に対応する日付がある列は値を採用、ない列は null (歯抜け)。
// JST 遵守: patrol_date は DB の date 型をそのまま使用。toISOString 系禁止。
export function mapSummaryToDateAxis(summary, axis) {
  if (!summary || !axis) return null
  const boothDates = summary.dates ?? []
  const dateToIdx = new Map()
  for (let i = 0; i < COLUMN_COUNT; i++) {
    if (boothDates[i] != null) dateToIdx.set(boothDates[i], i)
  }
  function mapArray(arr) {
    return axis.map(d => {
      if (d == null) return null
      const idx = dateToIdx.get(d)
      return (idx !== undefined) ? (arr?.[idx] ?? null) : null
    })
  }
  return {
    ...summary,
    inDiffs:    mapArray(summary.inDiffs),
    outDiffs:   mapArray(summary.outDiffs),
    daily:      mapArray(summary.daily),
    days:       mapArray(summary.days),
    entryTypes: mapArray(summary.entryTypes),
    dates:      [...axis],
  }
}

// 機械単位 (booths の SUM) / 店舗単位 (全 booth の SUM) 共用集計。
// summaries は対象 booth の computeBoothDiffSummary 出力配列。
// dateAxis が指定された場合、各 summary を日付軸にリマップしてから集計する。
// IN/OUT: 各列 SUM。DAILY: 各列の重み付き平均 SUM(inDiffs[i])/SUM(days[i])。
// 戻り値: 長さ 10 の数値/null 配列 (display index 0=9前 … 9=今回)。
export function aggregateSummaries(summaries, mode, dateAxis = null) {
  const list = (summaries ?? []).filter(Boolean)
  if (!list.length) return Array(COLUMN_COUNT).fill(null)

  const remapped = dateAxis
    ? list.map(s => mapSummaryToDateAxis(s, dateAxis)).filter(Boolean)
    : list

  if (mode === 'DAILY') {
    const result = Array(COLUMN_COUNT).fill(null)
    for (let i = 0; i < COLUMN_COUNT; i++) {
      let inSum = null
      let dSum  = null
      for (const s of remapped) {
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

  const sourceKey = (VIEW_MODES[mode] ?? VIEW_MODES.IN).sourceKey
  const result = Array(COLUMN_COUNT).fill(null)
  for (let i = 0; i < COLUMN_COUNT; i++) {
    let acc = null
    for (const s of remapped) {
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

// SPEC-PATROL-HISTORY-HEATMAP-03 F1: 店舗共通日付軸を生成。
// 全ブースの dates[] を和集合してユニーク化、新しい順10日を採用。閾値/台数比較は一切しない。
// 採用日 < 10 の場合は左側(古い側)を null 埋め(相対ラベルフォールバック禁止)。
// JST 遵守: patrol_date (YYYY-MM-DD) を直使用。toISOString().split/slice 禁止。
export function computeColumnDates(diffMap) {
  const entries = Object.values(diffMap || {})
  if (!entries.length) return Array(COLUMN_COUNT).fill(null)

  const allDates = new Set()
  for (const s of entries) {
    for (const d of (s?.dates ?? [])) {
      if (d != null) allDates.add(d)
    }
  }

  const sorted = [...allDates]
    .sort((a, b) => (a > b ? -1 : 1))  // newest first
    .slice(0, COLUMN_COUNT)

  if (!sorted.length) return Array(COLUMN_COUNT).fill(null)

  // sorted[0]=最新 → display index NEWEST (9)
  const axis = Array(COLUMN_COUNT).fill(null)
  sorted.forEach((d, i) => {
    axis[COLUMN_COUNT - 1 - i] = d
  })
  return axis
}

// F4: 全 booth の diffMap から列ごとにワースト3件のブースコード→色クラスを返す。
// dateAxis が指定された場合、日付軸にリマップしてからワースト計算する。
// ワースト = 各列で値が最小の3件 (低い方が悪い = 集客力弱)。
export function computeWorstBoothMap(allDiffMap, mode, dateAxis = null) {
  const result = {}
  const colors = ['text-red-500', 'text-red-400', 'text-red-300']
  for (let col = 0; col < COLUMN_COUNT; col++) {
    const entries = []
    for (const [bc, s] of Object.entries(allDiffMap || {})) {
      const mapped = dateAxis ? mapSummaryToDateAxis(s, dateAxis) : s
      const arr = sourceArrayFor(mapped, mode)
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
