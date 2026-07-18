import { supabase } from '../lib/supabase'

// SPEC-LF1-HISTORY-FIX-02 (supersedes FIX-01): history 表示 path は raw meter のみ参照、
// in_diff / out_diff / out_diff_1/2/3 / revenue / profit 列は読まない (deprecate 予定、
// DIAG-INDIFF-REFERENCES-01 で patrolCore.js は 2026-05-09 以降 in_diff を一切 INSERT
// していないことを確認、KOS01 has_in_diff=0 で SPEC-02 history が壊れる根本原因だった)。
// 本 SELECT に in_diff / out_diff は意図的に含めない、computeBoothDiffSummary が
// raw meter 差分 (current.in_meter - previous.in_meter) で常に正しい値を返す。
//
// SPEC-LF1-HISTORY-FIX-03 (DIAG-LF1-HISTORY-RUNTIME-01 で root cause 確定):
// store_code + machine_code を必須として追加。理由: putBaselineRows で IDB に書く時
// IDB index byStoreCode (= store_code keyPath) が値欠落 record を index entry に
// 含めないため、getPatrolRecordsByStore が 0 件返却して全列 '−' になる runtime bug。
// 列 contract test (historyFix02.contract.test.js) で 'store_code / machine_code 含む'
// を assert して再発防止する。
const HISTORY_SELECT =
  'reading_id, booth_code, store_code, machine_code, patrol_date, read_time, created_at, entry_type, ' +
  'in_meter, out_meter, out_meter_2, out_meter_3, ' +
  'prize_name, prize_cost, prize_stock_count, prize_restock_count, ' +
  'set_a, set_c, set_l, set_r, set_o, ' +
  // SPEC-PATROL-SWIPE-LATENCY-FIX-02: align with LAST_READING_SELECT so tier-2 IDB baseline
  // carries all columns that applyPrevFields reads for OUT2/OUT3 multi-dispense booths.
  'prize_id, prize_name_2, prize_name_3, stock_2, stock_3, restock_2, restock_3, ' +
  'prize_cost_1, prize_cost_2, prize_cost_3, theoretical_stock, payout_rate'

// テスト用 export (HISTORY-FIX-02 AC-07: 'no in_diff column dependency' 検証)
export const _RAW_HISTORY_SELECT = HISTORY_SELECT

// SPEC-LF1-HISTORY-FIX-04: fetchStoreBaselineRows が booth ごとに保持する最大行数。
// 9 → 11 に増やす理由: 表示の 10 diff (今回/前回/.../9前) を計算するには
// 11 データ点 (today + prev1..prev10) が必要 (隣接対 diff = 11-1 = 10 ペア)。
// SPEC-PATROL-HISTORY-HEATMAP-01: 10列横スクロール対応。
export const STORE_BASELINE_LIMIT_PER_BOOTH = 11

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
 * SPEC-PATROL-SWIPE-LATENCY-FIX-01: build history display rows from IDB synced baseline
 * (zero Supabase round-trip path). descRows must be sorted DESC (newest first).
 * Returns same shape as fetchBoothHistory. Returns null when descRows is empty/null
 * so the caller can fall back to Supabase.
 */
export function buildBoothHistoryFromIdb(descRows, meterUnitPrice = 100, limit = 10) {
  if (!descRows || !descRows.length) return null
  const asc = [...descRows].reverse()
  const withDiffs = computeDiffs(asc, meterUnitPrice)
  return withDiffs.slice(-limit).reverse()
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
 * Pure helper: rows DESC (latest first、最大 11 件) → 10-visit summary。テスト用に export。
 *
 * SPEC-PATROL-HISTORY-HEATMAP-01: 10 列 (9前/.../前回/今回) の値配列を生成。
 *   display index 0 = 9 前 (oldest of 10 displayed visits)
 *   display index 9 = 今回 (newest)
 *
 *   inDiffs[d]    = rows[9-d].in_meter - rows[10-d].in_meter
 *   outDiffs[d]   = sumOut(rows[9-d]) - sumOut(rows[10-d])
 *   days[d]       = diffPatrolDays(rows[10-d].patrol_date, rows[9-d].patrol_date)
 *   daily[d]      = round1(inDiffs[d] / days[d])
 *   dates[d]      = rows[9-d].patrol_date  (newer row の日付)
 *   entryTypes[d] = rows[9-d].entry_type
 *
 *   レコード数 < 11 なら計算できない列は null (左端から null 埋め)。
 *
 * 後方互換: inDiff/outDiff (最新差分) と currIn/prevIn/currPerDay/prevPerDay は
 * storeMachineSummary.js / SPEC-01 期 caller で使われているため残置。
 */
export function computeBoothDiffSummary(descRows, meterUnitPrice = 100) {
  if (!descRows || descRows.length < 2) return null

  // SPEC-PATROL-HISTORY-HEATMAP-01: 10 列。i は newer-older pair の index (0=最新ペア)。
  // display index = 9 - i (0=9前/oldest left … 9=今回/newest right)
  const COLS = 10
  const inDiffs    = Array(COLS).fill(null)
  const outDiffs   = Array(COLS).fill(null)
  const daily      = Array(COLS).fill(null)
  const days       = Array(COLS).fill(null)
  const dates      = Array(COLS).fill(null)
  const entryTypes = Array(COLS).fill(null)
  for (let i = 0; i < COLS; i++) {
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
    const d = 9 - i
    inDiffs[d]    = inDiff
    outDiffs[d]   = outDiff
    days[d]       = intervalDays
    daily[d]      = dailyVal
    dates[d]      = newer.patrol_date ?? null
    entryTypes[d] = newer.entry_type ?? null
  }

  // ---- 後方互換 (SPEC-01 / storeMachineSummary 用) ----
  const latest = descRows[0]
  const inDiff  = inDiffs[9]
  const outDiff = outDiffs[9]
  const revenue = inDiff != null ? inDiff * meterUnitPrice : null
  const prizeCost = Number(latest.prize_cost ?? 0)
  const profit = revenue != null ? revenue - (outDiff ?? 0) * prizeCost : null
  const currDays   = days[9]
  const currPerDay = daily[9]
  const prevIn     = inDiffs[8]
  const prevDays   = days[8]
  const prevPerDay = daily[8]

  return {
    // SPEC-PATROL-HISTORY-HEATMAP-01 primary shape
    inDiffs, outDiffs, daily, days, dates, entryTypes,
    // SPEC-01 後方互換
    inDiff, outDiff, revenue, profit,
    currIn: inDiff, currDays, currPerDay,
    prevIn, prevDays, prevPerDay,
    // SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 最新行の現在景品名 (表示専用、既存SELECTのprize_name)
    latestPrizeName: latest.prize_name ?? null,
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
    // SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094): FIX-05 は diff 0 汚染防止で patrol 限定にしたが、
    // それが入替後の景品最新値まで道連れで消し DB 汚染ループを招いた。景品系は replace の最新も必要なため
    // patrol+replace を取得し、用途別に分離する: diff/heatmap 集計は consumer 側で patrol 限定を維持
    // (computeLocalStoreView が entry_type!=='patrol' を除外)、prev 合成は buildPrevFromRows が
    // 景品=最新any / メーター=patrol の分離を行う。
    .in('entry_type', ['patrol', 'replace'])
    .order('patrol_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return []
  const byBooth = new Map()
  for (const row of data ?? []) {
    const bc = row.booth_code
    if (!bc) continue
    const arr = byBooth.get(bc) ?? []
    if (arr.length < STORE_BASELINE_LIMIT_PER_BOOTH) {
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

  // SPEC-PATROL-HISTORY-HEATMAP-01: 10 列分の diff を計算するため、booth あたり
  // 最大 11 レコード保持 (11 行で 10 ペア)。
  const byBooth = {}
  for (const row of data ?? []) {
    const bc = row.booth_code
    if (!byBooth[bc]) byBooth[bc] = []
    if (byBooth[bc].length < 11) byBooth[bc].push(row)
  }

  const result = {}
  for (const [bc, rows] of Object.entries(byBooth)) {
    result[bc] = computeBoothDiffSummary(rows, meterUnitPriceMap[bc] ?? 100)
  }
  return result
}
