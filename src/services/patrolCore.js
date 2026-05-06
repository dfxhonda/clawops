// ============================================
// patrolCore: M1 Stage 2 巡回コアサービス
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
 * ブース直近読み値取得（Stage 2 参考値表示用）
 */
export async function getLastReadingForBooth(boothCode) {
  const { data } = await supabase
    .from('meter_readings')
    .select('reading_id, in_meter, out_meter, prize_stock_count, prize_restock_count, patrol_date, read_time')
    .eq('booth_code', boothCode)
    .order('patrol_date', { ascending: false })
    .order('read_time', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/**
 * M1 Stage 2 メーター即時 UPSERT
 *
 * - (booth_code, patrol_date) で 1 レコード収束
 * - 4値が全て前回と同じ → upsert せずに { skipped: true } を返す（carry_forward 停止）
 * - set_a/c/l/r/o は値が渡された時だけ更新（null/undefined は無視）
 * - entry_type='patrol' 固定
 */
export async function upsertPatrolReading({
  boothCode,
  storeCode,
  machineCode,
  inMeter,
  outMeter,
  prizeStock,
  prizeRestock,
  setA,
  setC,
  setL,
  setR,
  setO,
  staffId,
}) {
  const today = todayJST()
  const numIn     = inMeter     !== '' && inMeter     != null ? parseFloat(inMeter)     : null
  const numOut    = outMeter    !== '' && outMeter    != null ? parseFloat(outMeter)    : null
  const numStock  = prizeStock  !== '' && prizeStock  != null ? parseInt(prizeStock, 10)  : 0
  const numRest   = prizeRestock !== '' && prizeRestock != null ? parseInt(prizeRestock, 10) : 0

  // 当日の既存レコードを確認
  const { data: existing } = await supabase
    .from('meter_readings')
    .select('reading_id, in_meter, out_meter, prize_stock_count, prize_restock_count, set_a, set_c, set_l, set_r, set_o')
    .eq('booth_code', boothCode)
    .eq('patrol_date', today)
    .maybeSingle()

  // 4値が全て変化なし → carry_forward 停止
  if (existing) {
    const unchanged =
      Number(existing.in_meter)            === numIn    &&
      Number(existing.out_meter)           === numOut   &&
      Number(existing.prize_stock_count)   === numStock &&
      Number(existing.prize_restock_count) === numRest
    if (unchanged) return { skipped: true }
  }

  const now = new Date().toISOString()

  // set_* は undefined/null でなければ更新
  const setFields = {}
  if (setA !== undefined && setA !== null) setFields.set_a = setA
  if (setC !== undefined && setC !== null) setFields.set_c = setC
  if (setL !== undefined && setL !== null) setFields.set_l = setL
  if (setR !== undefined && setR !== null) setFields.set_r = setR
  if (setO !== undefined && setO !== null) setFields.set_o = setO

  if (existing) {
    const { error } = await supabase
      .from('meter_readings')
      .update({
        in_meter:            numIn,
        out_meter:           numOut,
        prize_stock_count:   numStock,
        prize_restock_count: numRest,
        entry_type:          'patrol',
        updated_at:          now,
        created_by:          staffId ?? null,
        ...setFields,
      })
      .eq('reading_id', existing.reading_id)
    if (error) throw new Error('メーター更新エラー: ' + error.message)
    return { updated: true, readingId: existing.reading_id }
  }

  const { data, error } = await supabase
    .from('meter_readings')
    .insert({
      reading_id:          crypto.randomUUID(),
      booth_id:            boothCode,
      full_booth_code:     boothCode,
      booth_code:          boothCode,
      store_code:          storeCode  ?? null,
      machine_code:        machineCode ?? null,
      patrol_date:         today,
      read_time:           now,
      in_meter:            numIn,
      out_meter:           numOut,
      prize_stock_count:   numStock,
      prize_restock_count: numRest,
      entry_type:          'patrol',
      source:              'manual',
      input_method:        'manual',
      created_by:          staffId ?? null,
      organization_id:     DFX_ORG_ID,
      ...setFields,
    })
    .select('reading_id')
    .single()

  if (error) throw new Error('メーター保存エラー: ' + error.message)
  return { inserted: true, readingId: data.reading_id }
}
