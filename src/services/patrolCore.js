// ============================================
// patrolCore: M1 巡回コアサービス (Stage 2+3)
// ============================================
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

// JST の今日の日付文字列 (YYYY-MM-DD)
function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

/** UI / 比較用に文字列正規化 */
function strNorm(v) {
  if (v == null || v === '') return ''
  return String(v).trim()
}

/**
 * getLastReadingForBooth の完全列（SELECT 欠落 → UI 空白・NULL 上書り事故防止）
 */
export const LAST_READING_SELECT =
  'reading_id, booth_code, prize_id, prize_name, prize_name_2, prize_name_3, ' +
  'set_a, set_c, set_l, set_r, set_o, ' +
  'prize_stock_count, prize_restock_count, stock_2, stock_3, restock_2, restock_3, ' +
  'theoretical_stock, payout_rate, ' +
  'prize_cost, prize_cost_1, prize_cost_2, prize_cost_3, ' +
  'in_meter, out_meter, out_meter_2, out_meter_3, patrol_date, read_time'

/** INSERT 時に prev から補完するオプション列（触ってない値＝規定値） */
const OPTIONAL_DEFAULT_KEYS = [
  'prize_id',
  'prize_name',
  'prize_name_2',
  'prize_name_3',
  'set_a',
  'set_c',
  'set_l',
  'set_r',
  'set_o',
  'prize_cost',
  'prize_cost_1',
  'prize_cost_2',
  'prize_cost_3',
]

function pickOptionalDefaultsFromPrev(prev) {
  if (!prev) return {}
  const o = {}
  for (const k of OPTIONAL_DEFAULT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(prev, k) && prev[k] !== undefined) {
      o[k] = prev[k]
    }
  }
  return o
}

/**
 * optionalPatch: ユーザーが触ったフィールドのみ。キーが無い列は UPDATE しない（NULL 上書き防止）
 * 値は null 許容（明示クリア）。空文字は null に正規化。
 */
function normalizeOptionalPatch(patch) {
  if (!patch || typeof patch !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v === undefined) {
      out[k] = null
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * 今日の巡回記録をブースコードでバルク取得
 * @returns Map<boothCode, { readingId, readTime }>
 */
export async function getTodayReadingsMap(boothCodes) {
  if (!boothCodes.length) return {}
  const today = todayJST()
  const { data } = await supabase
    .from('meter_readings')
    .select('booth_code, reading_id, read_time')
    .in('booth_code', boothCodes)
    .eq('patrol_date', today)
  const map = {}
  for (const r of (data ?? [])) {
    map[r.booth_code] = { readingId: r.reading_id, readTime: r.read_time }
  }
  return map
}

/**
 * ブース直近読み値取得（前回値表示 + 入替判定用）
 */
export async function getLastReadingForBooth(boothCode) {
  const { data } = await supabase
    .from('meter_readings')
    .select(LAST_READING_SELECT)
    .eq('booth_code', boothCode)
    .order('patrol_date', { ascending: false })
    .order('read_time', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

// ─────────────────────────────────────────────────────────
// M1 Stage 3: entry_type 自動判定
// ─────────────────────────────────────────────────────────

/**
 * 同一ブース連続2レコードの差分から entry_type を判定
 *
 * @param {object|null} prev  - 直前レコード (DB行)
 * @param {object}       next  - 今回入力値 { inMeter, outMeter, prizeName?, setA? ... setO? }
 * @param {boolean}      isCollection - 集金として寄録（stores.is_collection_day かつチェック ON）
 * @returns 'patrol' | 'replace' | 'collection'
 */
export function classifyEntryType({ prev, next, isCollection = false }) {
  if (isCollection) return 'collection'
  if (!prev) return 'patrol'

  const numIn  = next.inMeter  !== '' && next.inMeter  != null ? parseFloat(next.inMeter)  : null
  const numOut = next.outMeter !== '' && next.outMeter != null ? parseFloat(next.outMeter) : null

  const meterChanged =
    Number(prev.in_meter)  !== numIn ||
    Number(prev.out_meter) !== numOut

  if (meterChanged) return 'patrol'

  const prizeChanged = strNorm(next.prizeName) !== strNorm(prev.prize_name)

  const settingChanged =
    strNorm(next.setA) !== strNorm(prev.set_a) ||
    strNorm(next.setC) !== strNorm(prev.set_c) ||
    strNorm(next.setL) !== strNorm(prev.set_l) ||
    strNorm(next.setR) !== strNorm(prev.set_r) ||
    strNorm(next.setO) !== strNorm(prev.set_o)

  if (prizeChanged || settingChanged) return 'replace'

  return 'patrol'
}

// ─────────────────────────────────────────────────────────
// M1 Stage 2+3: 巡回記録保存
// ─────────────────────────────────────────────────────────

const TODAY_EXISTING_SELECT =
  'reading_id, in_meter, out_meter, prize_stock_count, prize_restock_count, ' +
  'prize_name, prize_id, set_a, set_c, set_l, set_r, set_o, prize_cost'

/**
 * 巡回記録 UPSERT / INSERT
 *
 * optionalPatch: ユーザー操作のあった列のみ（差分）。UPDATE 時はこれらのキーのみ列更新。
 * defaultsFromPrev: INSERT 時・replace/collection INSERT 時に optional を prev から補完。
 *
 * entry_type 別動作:
 *   'patrol'     → (booth_code, patrol_date) で1レコード収束、コア値＋optional 差分とも変化なしなら skip
 *   'replace'    → 新規 INSERT（optional は prev マージ＋patch）
 *   'collection' → 新規 INSERT
 */
export async function savePatrolReading({
  boothCode,
  storeCode,
  machineCode,
  inMeter,
  outMeter,
  prizeStock,
  prizeRestock,
  entryType = 'patrol',
  staffId,
  optionalPatch = {},
  defaultsFromPrev = null,
}) {
  const today  = todayJST()
  const now    = new Date().toISOString()
  const numIn  = inMeter     !== '' && inMeter     != null ? parseFloat(inMeter)      : null
  const numOut = outMeter    !== '' && outMeter    != null ? parseFloat(outMeter)     : null
  const numStk = prizeStock  !== '' && prizeStock  != null ? parseInt(prizeStock, 10) : 0
  const numRst = prizeRestock !== '' && prizeRestock != null ? parseInt(prizeRestock, 10) : 0

  const patch = normalizeOptionalPatch(optionalPatch)
  const defaults = pickOptionalDefaultsFromPrev(defaultsFromPrev)
  const mergedOptionalForInsert = { ...defaults, ...patch }

  const basePayload = {
    booth_id:            boothCode,
    full_booth_code:     boothCode,
    booth_code:          boothCode,
    store_code:          storeCode   ?? null,
    machine_code:        machineCode ?? null,
    patrol_date:         today,
    read_time:           now,
    in_meter:            numIn,
    out_meter:           numOut,
    prize_stock_count:   numStk,
    prize_restock_count: numRst,
    entry_type:          entryType,
    source:              'manual',
    input_method:        'manual',
    created_by:          staffId ?? null,
    organization_id:     DFX_ORG_ID,
  }

  // 'replace' / 'collection' → 新規 INSERT
  if (entryType === 'replace' || entryType === 'collection') {
    const { data, error } = await supabase
      .from('meter_readings')
      .insert({
        ...basePayload,
        ...mergedOptionalForInsert,
        reading_id: crypto.randomUUID(),
      })
      .select('reading_id')
      .single()
    if (error) throw new Error(`${entryType} 記録エラー: ` + error.message)
    return { inserted: true, entryType, readingId: data.reading_id }
  }

  // 'patrol' → (booth_code, patrol_date) UPSERT + carry_forward 停止
  const { data: existing } = await supabase
    .from('meter_readings')
    .select(TODAY_EXISTING_SELECT)
    .eq('booth_code', boothCode)
    .eq('patrol_date', today)
    .eq('entry_type', 'patrol')
    .maybeSingle()

  const patchKeys = Object.keys(patch)
  const optionalUnchanged =
    patchKeys.length === 0 ||
    patchKeys.every((k) => {
      const a = existing?.[k]
      const b = patch[k]
      if (a == null && b == null) return true
      if (typeof a === 'number' || typeof b === 'number') {
        return Number(a) === Number(b)
      }
      return strNorm(a) === strNorm(b)
    })

  if (existing) {
    const coreUnchanged =
      Number(existing.in_meter)            === numIn  &&
      Number(existing.out_meter)           === numOut &&
      Number(existing.prize_stock_count)   === numStk &&
      Number(existing.prize_restock_count) === numRst

    if (coreUnchanged && optionalUnchanged) return { skipped: true }

    const updatePayload = {
      in_meter:            numIn,
      out_meter:           numOut,
      prize_stock_count:   numStk,
      prize_restock_count: numRst,
      entry_type:          'patrol',
      updated_at:          now,
      created_by:          staffId ?? null,
      ...patch,
    }

    const { error } = await supabase
      .from('meter_readings')
      .update(updatePayload)
      .eq('reading_id', existing.reading_id)
    if (error) throw new Error('メーター更新エラー: ' + error.message)
    return { updated: true, entryType: 'patrol', readingId: existing.reading_id }
  }

  const { data, error } = await supabase
    .from('meter_readings')
    .insert({
      ...basePayload,
      ...mergedOptionalForInsert,
      reading_id: crypto.randomUUID(),
    })
    .select('reading_id')
    .single()
  if (error) throw new Error('メーター保存エラー: ' + error.message)
  return { inserted: true, entryType: 'patrol', readingId: data.reading_id }
}

/**
 * Stage 2 後方互換 wrapper
 * @deprecated Stage 3 では savePatrolReading を使うこと
 */
export async function upsertPatrolReading(args) {
  return savePatrolReading({ ...args, entryType: 'patrol' })
}
