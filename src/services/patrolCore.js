// ============================================
// patrolCore: M1 巡回コアサービス (Stage 2+3)
// ============================================
import { supabase } from '../lib/supabase'
import { CHANGE_ORG_ID } from '../lib/auth/orgConstants'
import { logger } from '../lib/logger'
import { ERR } from '../lib/errorCodes'
import { buildPrevFromRows } from './prevBaseline'

// JST の今日の日付文字列 (YYYY-MM-DD)
function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

/** UI / 比較用に文字列正規化 */
function strNorm(v) {
  if (v == null || v === '') return ''
  return String(v).trim()
}

// SPEC-LF1-REPLAY-CONSTRAINT-NORMALIZE-01: DB CHECK chk_stock2/3_present_when_out2/3 =
// (out_meter_N IS NULL OR stock_N IS NOT NULL)。out_meter_N があるのに stock_N が無い
// payload は POST 400。空 stock=0 のアプリ意味に忠実に補完する (捏造ではない)。
// INSERT / UPDATE payload を送信前に正規化する。
function normalizeSlotStock(payload) {
  if (payload.out_meter_2 != null && payload.stock_2 == null) payload.stock_2 = 0
  if (payload.out_meter_3 != null && payload.stock_3 == null) payload.stock_3 = 0
  return payload
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
  // SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094): entry_type/created_at を追加し、
  // getLastReadingForBooth(tier-3) も buildPrevFromRows で 景品=最新any / メーター=patrol を合成できるようにする。
  'entry_type, created_at, ' +
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
  // SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094): tier-3 も合成方式に統一。
  // 単一行 (最新any) だと replace 直後は in_meter=0 の replace 行が景品もメーターも供給してしまう。
  // 直近複数行を取り buildPrevFromRows で 景品=最新any / メーター=patrol に分離する。
  const { data } = await supabase
    .from('meter_readings')
    .select(LAST_READING_SELECT)
    .eq('booth_code', boothCode)
    .order('patrol_date', { ascending: false })
    .order('read_time', { ascending: false })
    .limit(11)
  return buildPrevFromRows(data ?? [])
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
  'prize_name, prize_id, set_a, set_c, set_l, set_r, set_o, prize_cost, updated_at, ' +
  'stock_2, stock_3'

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
  // SPEC-LF1-IDEMPOTENT-SYNC-01 D1/D2/D3: LF1 replay carries the queued record's own values.
  patrolDate,        // D1: queued record の patrol_date (未指定=UI直接保存 → todayJST)
  readingId,         // D2: 冪等キー (r.localId)。INSERT 時に reading_id として使う
  clientTimestamp,   // D3: r.createdLocally。UPDATE stale-guard 判定に使う
}) {
  if (!CHANGE_ORG_ID) {
    logger.error(ERR.AUTH_001, { message: 'CHANGE_ORG_ID is not set', boothCode })
    return { ok: false, errCode: ERR.AUTH_001, message: 'organization_id が設定されていません', raw: null }
  }

  // D1: patrol_date と既存行 lookup は patrolDate を優先 (LF1 が D 日作成→D+k replay しても D 日行になる)
  const today  = patrolDate ?? todayJST()
  const now    = new Date().toISOString()
  const numIn  = inMeter      !== '' && inMeter      != null ? parseFloat(inMeter)       : null
  const numOut = outMeter     !== '' && outMeter     != null ? parseFloat(outMeter)      : null
  const numStk = prizeStock   !== '' && prizeStock   != null ? parseInt(prizeStock, 10)  : 0
  const numRst = prizeRestock !== '' && prizeRestock != null ? parseInt(prizeRestock, 10): 0

  logger.info('patrol_save_attempted', {
    boothCode,
    patrol_date: today,
    organization_id: CHANGE_ORG_ID,
    entryType,
    has_in_meter: numIn != null,
    has_out_meter: numOut != null,
    patch_keys: Object.keys(optionalPatch ?? {}),
  })

  try {
    const patch = normalizeOptionalPatch(optionalPatch)
    const defaults = pickOptionalDefaultsFromPrev(defaultsFromPrev)
    const mergedOptionalForInsert = { ...defaults, ...patch }

    const basePayload = {
      booth_id:            boothCode,
      full_booth_code:     boothCode,
      booth_code:          boothCode,
      // SPEC-METER-READINGS-ORG-AND-DENORM-FIX-01 (D-065) F2: 引数未供給時は booth_code から導出し
      // denorm null 保存を構造的に不能化 (machine_code=末尾 -B\d+ 除去 / store_code=先頭ハイフン前)。
      store_code:          storeCode   ?? boothCode.split('-')[0],
      machine_code:        machineCode ?? boothCode.replace(/-B\d+$/, ''),
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
      organization_id:     CHANGE_ORG_ID,
    }

    // 'replace' / 'collection' → 新規 INSERT
    if (entryType === 'replace' || entryType === 'collection') {
      const insertPayload = normalizeSlotStock({
        ...basePayload,
        ...mergedOptionalForInsert,
        reading_id: readingId ?? crypto.randomUUID(),
      })
      const { data, error } = await supabase
        .from('meter_readings')
        .insert(insertPayload)
        .select('reading_id')
        .single()
      if (error) {
        // D2: 23505 = 同一 reading_id/一意制約 で既に配信済み → 冪等成功として扱う
        if (error.code === '23505') {
          logger.info('patrol_save_duplicate_skipped', { boothCode, patrol_date: today, entryType, readingId })
          return { ok: true, skipped: 'duplicate', entryType, readingId: readingId ?? null }
        }
        const ctx = { boothCode, patrol_date: today, entryType, raw: error }
        logger.error(ERR.METER_002, ctx)
        return { ok: false, errCode: ERR.METER_002, message: `${entryType} 記録エラー: ${error.message}`, raw: error }
      }
      logger.info('patrol_save_succeeded', { boothCode, entryType, readingId: data.reading_id })
      return { ok: true, inserted: true, entryType, readingId: data.reading_id }
    }

    // 'patrol' → (booth_code, patrol_date) UPSERT
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
      // D3: stale-guard — server 行が client record 作成時刻以降に更新済みなら書かない
      // (古い queued record が新しい手動入力を上書きしない。server-newer wins)。
      if (
        clientTimestamp &&
        existing.updated_at &&
        new Date(existing.updated_at).getTime() >= new Date(clientTimestamp).getTime()
      ) {
        return { ok: true, skipped: 'stale', entryType: 'patrol', readingId: existing.reading_id }
      }

      const coreUnchanged =
        Number(existing.in_meter)            === numIn  &&
        Number(existing.out_meter)           === numOut &&
        Number(existing.prize_stock_count)   === numStk &&
        Number(existing.prize_restock_count) === numRst

      if (coreUnchanged && optionalUnchanged) return { ok: true, skipped: true }

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
      // SPEC-LF1-REPLAY-CONSTRAINT-NORMALIZE-02: UPDATE の CHECK は結果行全体で評価される。
      // -01 の無条件 normalizeSlotStock は既存 stock_N を 0 で破壊した。既存行も stock_N が
      // 無い時だけ 0 を注入する (patch が out_meter_N を立て、patch/existing 両方 null)。
      if (patch.out_meter_2 != null && patch.stock_2 == null && existing.stock_2 == null) updatePayload.stock_2 = 0
      if (patch.out_meter_3 != null && patch.stock_3 == null && existing.stock_3 == null) updatePayload.stock_3 = 0

      const { error } = await supabase
        .from('meter_readings')
        .update(updatePayload)
        .eq('reading_id', existing.reading_id)
      if (error) {
        const ctx = { boothCode, patrol_date: today, entryType, readingId: existing.reading_id, raw: error }
        logger.error(ERR.METER_001, ctx)
        return { ok: false, errCode: ERR.METER_001, message: 'メーター更新エラー: ' + error.message, raw: error }
      }
      logger.info('patrol_save_succeeded', { boothCode, entryType: 'patrol', readingId: existing.reading_id })
      return { ok: true, updated: true, entryType: 'patrol', readingId: existing.reading_id }
    }

    const patrolInsertPayload = normalizeSlotStock({
      ...basePayload,
      ...mergedOptionalForInsert,
      reading_id: readingId ?? crypto.randomUUID(),
    })
    const { data, error } = await supabase
      .from('meter_readings')
      .insert(patrolInsertPayload)
      .select('reading_id')
      .single()
    if (error) {
      // D2: 23505 = 既に配信済み (並行 replay / DB uq_meter_readings_patrol_day) → 冪等成功
      if (error.code === '23505') {
        logger.info('patrol_save_duplicate_skipped', { boothCode, patrol_date: today, entryType: 'patrol', readingId })
        return { ok: true, skipped: 'duplicate', entryType: 'patrol', readingId: readingId ?? null }
      }
      const ctx = { boothCode, patrol_date: today, entryType, raw: error }
      logger.error(ERR.METER_001, ctx)
      return { ok: false, errCode: ERR.METER_001, message: 'メーター保存エラー: ' + error.message, raw: error }
    }
    logger.info('patrol_save_succeeded', { boothCode, entryType: 'patrol', readingId: data.reading_id })
    return { ok: true, inserted: true, entryType: 'patrol', readingId: data.reading_id }

  } catch (e) {
    logger.error('patrol_save_failed_unexpected', { message: e?.message, boothCode, entryType })
    return { ok: false, errCode: ERR.METER_001, message: e?.message ?? '予期しないエラー', raw: e }
  }
}

/**
 * Stage 2 後方互換 wrapper
 * @deprecated Stage 3 では savePatrolReading を使うこと
 */
export async function upsertPatrolReading(args) {
  return savePatrolReading({ ...args, entryType: 'patrol' })
}
