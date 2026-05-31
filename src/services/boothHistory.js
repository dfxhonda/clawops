import { supabase } from '../lib/supabase'

const HISTORY_SELECT =
  'reading_id, booth_code, patrol_date, read_time, created_at, entry_type, ' +
  'in_meter, out_meter, out_meter_2, out_meter_3, ' +
  'prize_name, prize_cost, prize_stock_count, prize_restock_count, ' +
  'set_a, set_c, set_l, set_r, set_o'

function sumOut(row) {
  return (
    Number(row.out_meter ?? 0) +
    Number(row.out_meter_2 ?? 0) +
    Number(row.out_meter_3 ?? 0)
  )
}

// J-PATROL-IN-DAILY-fix-01: patrol_date 'YYYY-MM-DD' 文字列差 → 日数 (JST 解釈)。
// CLAUDE.md jst_date_handling: toISOString 禁止のため new Date(str + 'T00:00:00+09:00')。
export function diffPatrolDays(prevStr, currStr) {
  if (!prevStr || !currStr) return null
  const p = new Date(prevStr + 'T00:00:00+09:00').getTime()
  const c = new Date(currStr + 'T00:00:00+09:00').getTime()
  const d = Math.round((c - p) / 86400000)
  return d > 0 ? d : null
}

function round1(n) {
  if (n == null || !isFinite(n)) return null
  return Math.round(n * 10) / 10
}

function computeDiffs(ascRows, meterUnitPrice) {
  return ascRows.map((row, i) => {
    const prev = i > 0 ? ascRows[i - 1] : null
    const inDiff =
      prev != null && row.in_meter != null && prev.in_meter != null
        ? Number(row.in_meter) - Number(prev.in_meter)
        : null
    const outDiff = prev != null ? sumOut(row) - sumOut(prev) : null
    const revenue = inDiff != null ? inDiff * meterUnitPrice : null
    const prizeCost = Number(row.prize_cost ?? 0)
    const profit =
      revenue != null && outDiff != null ? revenue - outDiff * prizeCost : null
    return { ...row, in_diff: inDiff, out_diff: outDiff, revenue, profit }
  })
}

/**
 * Fetch last `limit` readings for a booth with diffs computed client-side.
 */
export async function fetchBoothHistory(boothCode, meterUnitPrice = 100, limit = 10) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select(HISTORY_SELECT)
    .eq('booth_code', boothCode)
    .order('patrol_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (error) return []

  const asc = [...(data ?? [])].reverse()
  const withDiffs = computeDiffs(asc, meterUnitPrice)
  return withDiffs.slice(-limit).reverse()
}

/**
 * Pure helper: rows DESC (latest first) → diff summary。テスト用に export。
 * J-PATROL-IN-DAILY-fix-01: 直近 3 件から 今IN/前IN, 今/日/前/日 を計算。
 * 後方互換: inDiff/outDiff/revenue/profit はそのまま残す (既存ストア集計が依存)。
 */
export function computeBoothDiffSummary(descRows, meterUnitPrice = 100) {
  if (!descRows || descRows.length < 2) return null
  const [latest, prev, prev2] = descRows
  const inDiff =
    latest.in_meter != null && prev.in_meter != null
      ? Number(latest.in_meter) - Number(prev.in_meter)
      : null
  const outDiff = sumOut(latest) - sumOut(prev)
  const revenue = inDiff != null ? inDiff * meterUnitPrice : null
  const prizeCost = Number(latest.prize_cost ?? 0)
  const profit = revenue != null ? revenue - outDiff * prizeCost : null

  const currDays = diffPatrolDays(prev.patrol_date, latest.patrol_date)
  const currPerDay = inDiff != null && currDays ? round1(inDiff / currDays) : null

  let prevIn = null
  let prevDays = null
  let prevPerDay = null
  if (prev2 && prev.in_meter != null && prev2.in_meter != null) {
    prevIn = Number(prev.in_meter) - Number(prev2.in_meter)
    prevDays = diffPatrolDays(prev2.patrol_date, prev.patrol_date)
    prevPerDay = prevDays ? round1(prevIn / prevDays) : null
  }

  return {
    inDiff, outDiff, revenue, profit,
    currIn: inDiff, currDays, currPerDay,
    prevIn, prevDays, prevPerDay,
  }
}

/**
 * Fetch latest diff per booth for machine list chips.
 * Returns: Record<boothCode, summary | null>
 */
export async function fetchBoothDiffMap(boothCodes, meterUnitPriceMap = {}) {
  if (!boothCodes.length) return {}

  // J-PATROL-IN-DAILY-fix-01: 3 件取得 (前IN 用に 2nd-prev も必要)
  const { data, error } = await supabase
    .from('meter_readings')
    .select(HISTORY_SELECT)
    .in('booth_code', boothCodes)
    .order('created_at', { ascending: false })
  if (error) return {}

  const byBooth = {}
  for (const row of data ?? []) {
    const bc = row.booth_code
    if (!byBooth[bc]) byBooth[bc] = []
    if (byBooth[bc].length < 3) byBooth[bc].push(row)
  }

  const result = {}
  for (const [bc, rows] of Object.entries(byBooth)) {
    result[bc] = computeBoothDiffSummary(rows, meterUnitPriceMap[bc] ?? 100)
  }
  return result
}
