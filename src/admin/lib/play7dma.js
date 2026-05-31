// J-REPORTS-7DMA-FIX-01 2026-05-31 司令塔Opus spec
// 巡回スパースなデータの 7DMA 計算ユーティリティ
//   step1 interpolate: 連続巡回日間で value を均等分配 (value/gap、初回 value/1)
//   step2 7DMA: 連続日次系列に対して 7日 sliding window、分母は常に 7

function* eachDayBetween(prevStr, currStr) {
  // exclusive of prevStr, inclusive of currStr (JST 解釈)
  const d = new Date(prevStr + 'T00:00:00+09:00')
  const end = new Date(currStr + 'T00:00:00+09:00')
  while (true) {
    d.setDate(d.getDate() + 1)
    if (d.getTime() > end.getTime()) break
    yield d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  }
}

function diffCalendarDays(prevStr, currStr) {
  const a = new Date(prevStr + 'T00:00:00+09:00').getTime()
  const b = new Date(currStr + 'T00:00:00+09:00').getTime()
  return Math.round((b - a) / (24 * 3600 * 1000))
}

// rawPoints: [{ stat_date, [valueKey]: number }] sorted asc by stat_date
// 返り値: [{ stat_date, value }] 連続 calendar 日 (補間後)
export function interpolateDaily(rawPoints, valueKey) {
  if (!rawPoints || rawPoints.length === 0) return []
  const result = []
  let prevDate = null
  for (const p of rawPoints) {
    const value = Number(p[valueKey] || 0)
    if (!prevDate) {
      // 初回: value/1 を当日1日分として使う
      result.push({ stat_date: p.stat_date, value })
    } else {
      const gap = diffCalendarDays(prevDate, p.stat_date)
      const perDay = gap > 0 ? value / gap : value
      for (const dStr of eachDayBetween(prevDate, p.stat_date)) {
        result.push({ stat_date: dStr, value: perDay })
      }
    }
    prevDate = p.stat_date
  }
  return result
}

// 7日 sliding window、分母 = 7 固定 (spec: denominator always 7)
export function rolling7dmaFixed(interpolated) {
  return interpolated.map((_, i) => {
    const start = Math.max(0, i - 6)
    const slice = interpolated.slice(start, i + 1)
    const sum = slice.reduce((a, b) => a + (b.value || 0), 0)
    return { stat_date: interpolated[i].stat_date, value: sum / 7 }
  })
}

// 便利関数: rawPoints → 直接 7DMA 系列に変換
export function calc7dmaSeries(rawPoints, valueKey) {
  return rolling7dmaFixed(interpolateDaily(rawPoints, valueKey))
}

// 期間内の calendar 日数 (両端含む)
export function periodDays(fromStr, toStr) {
  if (!fromStr || !toStr) return 0
  return diffCalendarDays(fromStr, toStr) + 1
}
