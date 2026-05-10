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
 * No entry_type filter — replace/patrol/collection all included as prev candidates.
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
 * Fetch latest diff per booth for machine list chips.
 * boothCodes: string[]
 * meterUnitPriceMap: Record<boothCode, number>
 * Returns: Record<boothCode, { inDiff, outDiff, revenue, profit } | null>
 */
export async function fetchBoothDiffMap(boothCodes, meterUnitPriceMap = {}) {
  if (!boothCodes.length) return {}

  // Fetch last 2 readings per booth (no entry_type filter = bug fix)
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
    if (byBooth[bc].length < 2) byBooth[bc].push(row)
  }

  const result = {}
  for (const [bc, rows] of Object.entries(byBooth)) {
    if (rows.length < 2) { result[bc] = null; continue }
    const [latest, prev] = rows
    const mup = meterUnitPriceMap[bc] ?? 100
    const inDiff =
      latest.in_meter != null && prev.in_meter != null
        ? Number(latest.in_meter) - Number(prev.in_meter)
        : null
    const outDiff = sumOut(latest) - sumOut(prev)
    const revenue = inDiff != null ? inDiff * mup : null
    const prizeCost = Number(latest.prize_cost ?? 0)
    const profit = revenue != null ? revenue - outDiff * prizeCost : null
    result[bc] = { inDiff, outDiff, revenue, profit }
  }
  return result
}
