// SPEC-PATROL-VIEW-MODE-SWITCH-01: 巡回機械リストの 3 モード列定義 + 集計/フォーマット。
// IN (default) / OUT / STOCK の 4 列ずつ。
// MachineRow / MachineRowExpandedBoothList / StoreTotalsHeader / storeTotalsRanking が共用。

export const VIEW_MODES = {
  IN: {
    label: 'IN',
    cols: [
      { key: 'prevIn',     label: '前IN',   type: 'count',  today: false },
      { key: 'currIn',     label: '今IN',   type: 'count',  today: true  },
      { key: 'prevPerDay', label: '前/日',  type: 'perDay', today: false },
      { key: 'currPerDay', label: '今/日',  type: 'perDay', today: true  },
    ],
  },
  OUT: {
    label: 'OUT',
    cols: [
      { key: 'prevOut',    label: '前OUT',  type: 'count',   today: false },
      { key: 'currOut',    label: '今OUT',  type: 'count',   today: true  },
      { key: 'prevPayout', label: '前出率', type: 'percent', today: false },
      { key: 'currPayout', label: '今出率', type: 'percent', today: true  },
    ],
  },
  STOCK: {
    label: '在庫',
    cols: [
      { key: 'prevStock',   label: '前在庫', type: 'count', today: false },
      { key: 'currStock',   label: '今在庫', type: 'count', today: true  },
      { key: 'prevRestock', label: '前補充', type: 'count', today: false },
      { key: 'currRestock', label: '今補充', type: 'count', today: true  },
    ],
  },
}

export const VIEW_MODE_ORDER = ['IN', 'OUT', 'STOCK']

function round1(n) {
  if (n == null || !isFinite(n)) return null
  return Math.round(n * 10) / 10
}

export function formatCell(value, type) {
  if (value == null) return '−'
  switch (type) {
    case 'percent': return `${value.toFixed(1)}%`
    case 'perDay':  return value.toFixed(1)
    case 'count':
    default:        return value.toLocaleString()
  }
}

function sumKey(summaries, key) {
  let acc = null
  for (const s of summaries) {
    if (!s) continue
    const v = s[key]
    if (v == null) continue
    acc = (acc ?? 0) + v
  }
  return acc
}

// 機械単位 (booths の SUM) / 店舗単位 (全 booth の SUM) 共用集計。
// summaries は対象 booth の computeBoothDiffSummary 出力配列。
// IN/STOCK: 各列 SUM。OUT: count 系は SUM、payout は SUM(out)/SUM(in)*100 (重み付き平均)。
export function aggregateSummaries(summaries, mode) {
  const list = summaries.filter(Boolean)
  if (mode === 'OUT') {
    const prevOut = sumKey(list, 'prevOut')
    const currOut = sumKey(list, 'currOut')
    const prevIn  = sumKey(list, 'prevIn')
    const currIn  = sumKey(list, 'currIn')
    return {
      prevOut,
      currOut,
      prevPayout: prevIn != null && prevIn > 0 && prevOut != null ? round1((prevOut / prevIn) * 100) : null,
      currPayout: currIn != null && currIn > 0 && currOut != null ? round1((currOut / currIn) * 100) : null,
    }
  }
  const cols = VIEW_MODES[mode]?.cols ?? VIEW_MODES.IN.cols
  const out = {}
  for (const c of cols) out[c.key] = sumKey(list, c.key)
  return out
}

// 機械 → booths の summaries 配列
export function machineBoothSummaries(machine, diffMap) {
  return (machine?.booths ?? []).map(b => diffMap[b.booth_code] ?? null)
}
