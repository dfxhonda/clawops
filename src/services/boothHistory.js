import { supabase } from '../lib/supabase'

const HISTORY_SELECT =
  'reading_id, booth_code, patrol_date, read_time, created_at, entry_type, ' +
  'in_meter, out_meter, out_meter_2, out_meter_3, ' +
  'prize_name, prize_cost, prize_stock_count, prize_restock_count, ' +
  'set_a, set_c, set_l, set_r, set_o'

// SPEC-PATROL-VIEW-MODE-SWITCH-02: 4-visit history。各列 (4 前 / 3 前 / 前回 / 今回) の
// in_diff / out_diff / daily (= in_diff / 間隔日数) を 4 要素配列で返す。4 つの diff を
// 計算するには 5 レコード必要 (diff = newer - older 連続対) のため fetchBoothDiffMap は
// booth ごと最大 5 行取得。レコード数 < 5 なら左端 (古い側) から null で埋めて表示。

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
 * Pure helper: rows DESC (latest first、最大 5 件) → 4-visit summary。テスト用に export。
 *
 * SPEC-PATROL-VIEW-MODE-SWITCH-02: 4 列 (4 前 / 3 前 / 前回 / 今回) の値配列を生成。
 *   display index 0 = 4 前 (oldest of 4 displayed visits)
 *   display index 1 = 3 前
 *   display index 2 = 前回
 *   display index 3 = 今回 (newest)
 *
 *   inDiffs[d]  = rows[3-d].in_meter - rows[4-d].in_meter
 *   outDiffs[d] = sumOut(rows[3-d]) - sumOut(rows[4-d])
 *   days[d]     = diffPatrolDays(rows[4-d].patrol_date, rows[3-d].patrol_date)
 *   daily[d]    = round1(inDiffs[d] / days[d])
 *
 *   レコード数 < 5 なら計算できない列は null。
 *
 * 後方互換: inDiff/outDiff (最新差分) と currIn/prevIn/currPerDay/prevPerDay は
 * storeMachineSummary.js / SPEC-01 期 caller で使われているため残置。
 */
export function computeBoothDiffSummary(descRows, meterUnitPrice = 100) {
  if (!descRows || descRows.length < 2) return null

  // SPEC-02: 4 列 (4前/3前/前回/今回) を埋める。i は newer-older pair の index (0=最新ペア)。
  // display index = 3 - i (0=4前/oldest left … 3=今回/newest right)
  const inDiffs  = [null, null, null, null]
  const outDiffs = [null, null, null, null]
  const daily    = [null, null, null, null]
  const days     = [null, null, null, null]
  for (let i = 0; i < 4; i++) {
    const newer = descRows[i]
    const older = descRows[i + 1]
    if (!newer || !older) break
    const inDiff = (newer.in_meter != null && older.in_meter != null)
      ? Number(newer.in_meter) - Number(older.in_meter)
      : null
    const outDiff = sumOut(newer) - sumOut(older)
    const intervalDays = diffPatrolDays(older.patrol_date, newer.patrol_date)
    const dailyVal = inDiff != null && intervalDays
      ? round1(inDiff / intervalDays)
      : null
    const d = 3 - i
    inDiffs[d]  = inDiff
    outDiffs[d] = outDiff
    days[d]     = intervalDays
    daily[d]    = dailyVal
  }

  // ---- 後方互換 (SPEC-01 / storeMachineSummary 用) ----
  const latest = descRows[0]
  const prev   = descRows[1]
  const prev2  = descRows[2]
  const inDiff  = inDiffs[3]
  const outDiff = outDiffs[3]
  const revenue = inDiff != null ? inDiff * meterUnitPrice : null
  const prizeCost = Number(latest.prize_cost ?? 0)
  const profit = revenue != null ? revenue - (outDiff ?? 0) * prizeCost : null
  const currDays   = days[3]
  const currPerDay = daily[3]
  const prevIn = (prev2 && prev.in_meter != null && prev2.in_meter != null)
    ? Number(prev.in_meter) - Number(prev2.in_meter) : null
  const prevDays = prev2 ? diffPatrolDays(prev2.patrol_date, prev.patrol_date) : null
  const prevPerDay = prevIn != null && prevDays ? round1(prevIn / prevDays) : null

  return {
    // SPEC-02 primary shape
    inDiffs, outDiffs, daily, days,
    // SPEC-01 後方互換
    inDiff, outDiff, revenue, profit,
    currIn: inDiff, currDays, currPerDay,
    prevIn, prevDays, prevPerDay,
  }
}

/**
 * SPEC-LF1-HISTORY-FIX-01 (approach A):
 * Store の全 booth について 最新 5 行 (raw rows) を single windowed query で取得して返す。
 * 戻り値は flat array (caller 側で booth ごと group + put to IndexedDB)。
 * fetchBoothDiffMap と同じ複合ソート (patrol_date DESC + created_at DESC) で late-entry を抑止。
 * 用途: PatrolStorePage で IDB baseline 同期、computeLocalStoreView が unified path で再計算可能に。
 */
export async function fetchStoreBaselineRows(boothCodes) {
  if (!boothCodes || !boothCodes.length) return []
  const { data, error } = await supabase
    .from('meter_readings')
    .select(HISTORY_SELECT)
    .in('booth_code', boothCodes)
    .order('patrol_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return []
  const byBooth = new Map()
  for (const row of data ?? []) {
    const bc = row.booth_code
    if (!bc) continue
    const arr = byBooth.get(bc) ?? []
    if (arr.length < 5) {
      arr.push(row)
      byBooth.set(bc, arr)
    }
  }
  return Array.from(byBooth.values()).flat()
}

/**
 * Fetch latest diff per booth for machine list chips.
 * Returns: Record<boothCode, summary | null>
 */
export async function fetchBoothDiffMap(boothCodes, meterUnitPriceMap = {}) {
  if (!boothCodes.length) return {}

  // J-PATROL-IN-DAILY-fix-03 (ヒロ Discord IMG_4232): patrol_date DESC を主キー、created_at DESC 副キー。
  // 旧 created_at DESC 単独ソートは「古い patrol_date を後で入力 (late entry)」が最新扱いになり、
  // 結果 前IN が in_meter 非単調変化で異常な負値になっていた (BUZZクレーン 前IN -549 等)。
  // fetchBoothHistory (履歴一覧) も同じ複合ソートで一致させる。
  const { data, error } = await supabase
    .from('meter_readings')
    .select(HISTORY_SELECT)
    .in('booth_code', boothCodes)
    .order('patrol_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return {}

  // SPEC-PATROL-VIEW-MODE-SWITCH-02: 4 列分の diff を計算するため、booth あたり
  // 最大 5 レコード保持 (5 行で 4 ペア)。SPEC-01 期は 3 だった。
  const byBooth = {}
  for (const row of data ?? []) {
    const bc = row.booth_code
    if (!byBooth[bc]) byBooth[bc] = []
    if (byBooth[bc].length < 5) byBooth[bc].push(row)
  }

  const result = {}
  for (const [bc, rows] of Object.entries(byBooth)) {
    result[bc] = computeBoothDiffSummary(rows, meterUnitPriceMap[bc] ?? 100)
  }
  return result
}
