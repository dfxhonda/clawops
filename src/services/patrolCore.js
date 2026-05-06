// ============================================
// patrolCore: M1 巡回コアサービス (Stage 2+3)
// ============================================
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

// JST の今日の日付文字列 (YYYY-MM-DD)
function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
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
 * set_a/c/l/r/o, prize_name も取得
 */
export async function getLastReadingForBooth(boothCode) {
  const { data } = await supabase
    .from('meter_readings')
    .select('reading_id, in_meter, out_meter, prize_stock_count, prize_restock_count, prize_name, set_a, set_c, set_l, set_r, set_o, patrol_date, read_time')
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
 * @param {object}       next  - 今回入力値 { inMeter, outMeter, prizeName?, setA? ... }
 * @param {boolean}      isCollection - 集金チェックON
 * @returns 'patrol' | 'replace' | 'collection'
 *
 * 判定優先順:
 *   1. isCollection → 'collection'
 *   2. prev なし → 'patrol'
 *   3. メーター変化あり → 'patrol'
 *   4. メーター変化なし + 景品変化あり → 'replace'
 *   5. メーター変化なし + 設定変化あり → 'replace'
 *   6. それ以外 → 'patrol'
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

  // メーター変化なし: 景品 / 設定を比較
  const prizeChanged =
    next.prizeName != null &&
    next.prizeName !== '' &&
    prev.prize_name !== next.prizeName

  const settingChanged =
    (next.setA != null && next.setA !== '' && prev.set_a !== next.setA) ||
    (next.setC != null && next.setC !== '' && prev.set_c !== next.setC) ||
    (next.setL != null && next.setL !== '' && prev.set_l !== next.setL) ||
    (next.setR != null && next.setR !== '' && prev.set_r !== next.setR)

  if (prizeChanged || settingChanged) return 'replace'

  return 'patrol'
}

// ─────────────────────────────────────────────────────────
// M1 Stage 2+3: 巡回記録保存
// ─────────────────────────────────────────────────────────

/**
 * 巡回記録 UPSERT / INSERT
 *
 * entry_type 別動作:
 *   'patrol'     → (booth_code, patrol_date) で1レコード収束、値変化なしなら skip
 *   'replace'    → 新規 INSERT（同日でも複数可、入替・設定変更を別レコードで管理）
 *   'collection' → 新規 INSERT（集金記録）
 */
export async function savePatrolReading({
  boothCode,
  storeCode,
  machineCode,
  inMeter,
  outMeter,
  prizeStock,
  prizeRestock,
  prizeName,
  setA,
  setC,
  setL,
  setR,
  setO,
  entryType = 'patrol',
  staffId,
}) {
  const today  = todayJST()
  const now    = new Date().toISOString()
  const numIn  = inMeter     !== '' && inMeter     != null ? parseFloat(inMeter)      : null
  const numOut = outMeter    !== '' && outMeter    != null ? parseFloat(outMeter)     : null
  const numStk = prizeStock  !== '' && prizeStock  != null ? parseInt(prizeStock, 10) : 0
  const numRst = prizeRestock !== '' && prizeRestock != null ? parseInt(prizeRestock, 10) : 0

  const setFields = {}
  if (setA !== undefined && setA !== null && setA !== '') setFields.set_a = setA
  if (setC !== undefined && setC !== null && setC !== '') setFields.set_c = setC
  if (setL !== undefined && setL !== null && setL !== '') setFields.set_l = setL
  if (setR !== undefined && setR !== null && setR !== '') setFields.set_r = setR
  if (setO !== undefined && setO !== null && setO !== '') setFields.set_o = setO

  const prizeFields = {}
  if (prizeName !== undefined && prizeName !== null && prizeName !== '') {
    prizeFields.prize_name = prizeName
  }

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
    ...prizeFields,
    ...setFields,
  }

  // 'replace' / 'collection' → 新規 INSERT 確定（carry_forward チェックなし）
  if (entryType === 'replace' || entryType === 'collection') {
    const { data, error } = await supabase
      .from('meter_readings')
      .insert({ ...basePayload, reading_id: crypto.randomUUID() })
      .select('reading_id')
      .single()
    if (error) throw new Error(`${entryType} 記録エラー: ` + error.message)
    return { inserted: true, entryType, readingId: data.reading_id }
  }

  // 'patrol' → (booth_code, patrol_date) UPSERT + carry_forward 停止
  const { data: existing } = await supabase
    .from('meter_readings')
    .select('reading_id, in_meter, out_meter, prize_stock_count, prize_restock_count')
    .eq('booth_code', boothCode)
    .eq('patrol_date', today)
    .eq('entry_type', 'patrol')
    .maybeSingle()

  if (existing) {
    const unchanged =
      Number(existing.in_meter)            === numIn  &&
      Number(existing.out_meter)           === numOut &&
      Number(existing.prize_stock_count)   === numStk &&
      Number(existing.prize_restock_count) === numRst
    if (unchanged) return { skipped: true }

    const { error } = await supabase
      .from('meter_readings')
      .update({
        in_meter:            numIn,
        out_meter:           numOut,
        prize_stock_count:   numStk,
        prize_restock_count: numRst,
        entry_type:          'patrol',
        updated_at:          now,
        created_by:          staffId ?? null,
        ...prizeFields,
        ...setFields,
      })
      .eq('reading_id', existing.reading_id)
    if (error) throw new Error('メーター更新エラー: ' + error.message)
    return { updated: true, entryType: 'patrol', readingId: existing.reading_id }
  }

  const { data, error } = await supabase
    .from('meter_readings')
    .insert({ ...basePayload, reading_id: crypto.randomUUID() })
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
