// ============================================
// patrolV2: 巡回入力 V2 (multi-OUT対応)
// ============================================
import { supabase } from '../lib/supabase'
import { getMachineTypes, getMachineModels, getStores } from './masters'
import { writeAuditLog } from './audit'
import { clearCache } from './utils'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

// 機械のカテゴリ・outCount・ロッカー情報
export async function getMachineInfo(machineCode) {
  const { data: machine, error } = await supabase
    .from('machines')
    .select('machine_code, machine_name, store_code, type_id, model_id')
    .eq('machine_code', machineCode)
    .single()
  if (error || !machine) return null

  const [types, models, stores] = await Promise.all([
    getMachineTypes(),
    getMachineModels(),
    getStores(),
  ])

  const model = models.find(m => m.model_id === machine.model_id) || {}
  const typeId = machine.type_id || model.type_id  // machine優先、なければmodelのtype継承
  const type = types.find(t => t.type_id === typeId) || {}
  const store = stores.find(s => s.store_code === machine.store_code) || {}

  return {
    machineName: machine.machine_name || '',
    storeName: store.store_name || '',
    storeCode: machine.store_code || '',
    category: type.category || 'crane',      // crane / gacha / other
    outCount: model.out_meter_count || 1,    // ブースあたりOUT本数: crane=1, gacha_st2=2, barber=3
    hasLocker: (type.locker_slots || 0) > 0,
    playPrice: model.meter_unit_price || null,
  }
}

// ブース直近読み値 (multi-OUT対応)
export async function getLastReadingV2(boothCode) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('full_booth_code', boothCode)
    .order('read_time', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return {
    readTime: data.read_time,
    inMeter: data.in_meter,
    outMeter: data.out_meter,
    outMeter2: data.out_meter_2,
    outMeter3: data.out_meter_3,
    prizeName: data.prize_name,
    prizeId: data.prize_id,
    prizeName2: data.prize_name_2,
    prizeName3: data.prize_name_3,
    prizeCost1: data.prize_cost_1,
    prizeCost2: data.prize_cost_2,
    prizeCost3: data.prize_cost_3,
    stock1: data.prize_stock_count,
    stock2: data.stock_2,
    stock3: data.stock_3,
    restock1: data.prize_restock_count,
    restock2: data.restock_2,
    restock3: data.restock_3,
    setA: data.set_a,
    setC: data.set_c,
    setL: data.set_l,
    setR: data.set_r,
    setO: data.set_o,
  }
}

// ブース売上履歴 (集金区間リスト)
// J2-a: patrol_date(営業日)ベースに変更 — 発生主義
export async function getBoothHistory(boothCode, limit = 6) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('reading_id, read_time, patrol_date, in_meter, out_meter, in_diff, out_diff_1, prize_name, play_price, revenue')
    .eq('full_booth_code', boothCode)
    .or('entry_type.eq.patrol,entry_type.is.null')
    .order('patrol_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  // 古い順に並べて差分を patrol_date ベースで再計算
  const rows = (data || []).reverse()
  return rows.map((current, i) => {
    const previous = rows[i - 1]
    if (!previous) return { ...current, in_diff: 0, out_diff_1: 0, revenue: 0 }
    if (current.in_meter == null || previous.in_meter == null) return current
    const in_diff = Number(current.in_meter) - Number(previous.in_meter)
    const out_diff_1 = current.out_meter != null && previous.out_meter != null
      ? Number(current.out_meter) - Number(previous.out_meter)
      : current.out_diff_1
    const revenue = in_diff * (current.play_price || 100)
    return { ...current, in_diff, out_diff_1, revenue }
  })
}

// ロッカースロット一覧
export async function getLockerSlots(lockerId) {
  const { data, error } = await supabase
    .from('locker_slots')
    .select('*')
    .eq('locker_id', lockerId)
    .order('slot_number')
  if (error) { console.error('locker_slots:', error.message); return [] }
  return data || []
}

// スロット未作成のロッカー向け — 存在しなければ空スロットを自動生成
export async function ensureLockerSlots(lockerId, slotCount) {
  const existing = await getLockerSlots(lockerId)
  if (existing.length > 0) return existing
  const slots = Array.from({ length: slotCount }, (_, i) => ({
    slot_id: crypto.randomUUID(),
    locker_id: lockerId,
    slot_number: i + 1,
    status: 'empty',
  }))
  const { data, error } = await supabase.from('locker_slots').insert(slots).select()
  if (error) { console.error('locker_slots init:', error.message); return [] }
  return (data || []).sort((a, b) => a.slot_number - b.slot_number)
}

// スロット更新
export async function updateLockerSlot(slotId, { prizeName, prizeValue, status, staffId, action }) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('locker_slots')
    .update({ prize_name: prizeName || null, prize_value: prizeValue || 0, status, updated_at: now, updated_by: staffId || null })
    .eq('slot_id', slotId)
    .select()
    .single()
  if (error) throw new Error('スロット更新エラー: ' + error.message)

  await supabase.from('locker_slot_logs').insert({
    log_id: crypto.randomUUID(),
    slot_id: slotId,
    locker_id: data.locker_id,
    action,
    prize_name: prizeName || null,
    prize_value: prizeValue || 0,
    logged_at: now,
    logged_by: staffId || null,
  })
  return data
}

// メーター読み値保存 V2
export async function saveReadingV2({ boothCode, patrol, change, outCount, staffId, entryType = 'patrol' }) {
  const patrolPayload = _buildPayload(boothCode, entryType, patrol, outCount, staffId)
  const { error: e1 } = await supabase.from('meter_readings').insert(patrolPayload)
  if (e1) throw new Error('巡回保存エラー: ' + e1.message)

  if (change && change.entryType !== 'none') {
    const changePayload = _buildPayload(boothCode, change.entryType, change, outCount, staffId)
    const { error: e2 } = await supabase.from('meter_readings').insert(changePayload)
    if (e2) throw new Error('変更保存エラー: ' + e2.message)
  }

  clearCache()
  writeAuditLog({
    action: 'reading_create',
    target_table: 'meter_readings',
    target_id: boothCode,
    detail: `巡回V2: IN=${patrol.inMeter || '-'} (${boothCode})`,
    staff_id: staffId || undefined,
  })
}

// 指定レコードを除いた直前のpatrolレコードを取得（修正/入替モードの prev 用）
export async function getReadingBefore(boothCode, excludeReadingId) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('full_booth_code', boothCode)
    .neq('reading_id', excludeReadingId)
    .or('entry_type.eq.patrol,entry_type.is.null')
    .order('patrol_date', { ascending: false, nullsFirst: false })
    .order('read_time', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return {
    readTime: data.read_time,
    inMeter: data.in_meter,
    outMeter: data.out_meter,
    outMeter2: data.out_meter_2,
    outMeter3: data.out_meter_3,
    prizeName: data.prize_name,
    prizeName2: data.prize_name_2,
    prizeName3: data.prize_name_3,
    prizeCost1: data.prize_cost_1,
    prizeCost2: data.prize_cost_2,
    prizeCost3: data.prize_cost_3,
    stock1: data.prize_stock_count,
    stock2: data.stock_2,
    stock3: data.stock_3,
    restock1: data.prize_restock_count,
    restock2: data.restock_2,
    restock3: data.restock_3,
    setA: data.set_a,
    setC: data.set_c,
    setL: data.set_l,
    setR: data.set_r,
    setO: data.set_o,
  }
}

// 前日のpatrolレコードを検索（モード判定用）
export async function getYesterdayPatrol(boothCode) {
  const d = new Date(); d.setDate(d.getDate() - 1)
  // toISOString()はUTC変換されるため、ローカル日付で計算する（JST午前9時前に1日ずれる問題を防ぐ）
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('full_booth_code', boothCode)
    .eq('patrol_date', yesterday)
    .eq('entry_type', 'patrol')
    .maybeSingle()
  if (error) return null
  return data || null
}

// 修正モード: 既存レコードをUPDATE
export async function updatePatrolReading({ readingId, formData, outCount, staffId, existingRecord }) {
  const now = new Date().toISOString()
  const upd = {
    in_meter: formData.inMeter ? parseFloat(formData.inMeter) : null,
    out_meter: formData.outs?.[0]?.meter ? parseFloat(formData.outs[0].meter) : null,
    prize_name: formData.outs?.[0]?.prize || null,
    prize_id: formData.outs?.[0]?.prize_id || null,
    prize_cost: formData.outs?.[0]?.cost != null && formData.outs[0].cost !== '' ? parseInt(formData.outs[0].cost) : null,
    prize_cost_1: formData.outs?.[0]?.cost != null && formData.outs[0].cost !== '' ? parseInt(formData.outs[0].cost) : null,
    prize_stock_count: formData.outs?.[0]?.zan ? parseInt(formData.outs[0].zan) : null,
    prize_restock_count: formData.outs?.[0]?.ho && formData.outs[0].ho !== 'ー' ? parseInt(formData.outs[0].ho) : 0,
    in_diff: formData.inDiff ?? null,
    out_diff_1: formData.outs?.[0]?.diff ?? null,
    play_price: formData.playPrice || null,
    revenue: _calcRevenue(formData),
    set_o: formData.setO || null,
    updated_at: now,
    updated_by: staffId || null,
  }
  if (outCount >= 2 && formData.outs?.[1]) {
    upd.out_meter_2 = formData.outs[1].meter ? parseFloat(formData.outs[1].meter) : null
    upd.prize_name_2 = formData.outs[1].prize || null
    upd.prize_cost_2 = formData.outs[1].cost != null && formData.outs[1].cost !== '' ? parseInt(formData.outs[1].cost) : null
    upd.stock_2 = formData.outs[1].zan ? parseInt(formData.outs[1].zan) : null
    upd.restock_2 = formData.outs[1].ho && formData.outs[1].ho !== 'ー' ? parseInt(formData.outs[1].ho) : 0
    upd.out_diff_2 = formData.outs[1].diff ?? null
  }
  if (outCount >= 3 && formData.outs?.[2]) {
    upd.out_meter_3 = formData.outs[2].meter ? parseFloat(formData.outs[2].meter) : null
    upd.prize_name_3 = formData.outs[2].prize || null
    upd.prize_cost_3 = formData.outs[2].cost != null && formData.outs[2].cost !== '' ? parseInt(formData.outs[2].cost) : null
    upd.stock_3 = formData.outs[2].zan ? parseInt(formData.outs[2].zan) : null
    upd.restock_3 = formData.outs[2].ho && formData.outs[2].ho !== 'ー' ? parseInt(formData.outs[2].ho) : 0
    upd.out_diff_3 = formData.outs[2].diff ?? null
  }
  const { error } = await supabase.from('meter_readings').update(upd).eq('reading_id', readingId)
  if (error) throw new Error('修正保存エラー: ' + error.message)
  clearCache()
  await writeAuditLog({
    action: 'reading_update',
    target_table: 'meter_readings',
    target_id: existingRecord.full_booth_code,
    detail: `修正: IN=${formData.inMeter || '-'} (${existingRecord.full_booth_code})`,
    before_data: existingRecord,
    after_data: { ...existingRecord, ...upd },
    reason_code: 'INPUT_FIX',
    staff_id: staffId || undefined,
  })
}

// 入替変更モード: 新規INSERT entry_type='replace'
export async function saveReplaceReadingV2({ boothCode, formData, outCount, staffId, relatedRecord }) {
  const payload = _buildPayload(boothCode, 'replace', formData, outCount, staffId)
  const { error } = await supabase.from('meter_readings').insert(payload)
  if (error) throw new Error('入替保存エラー: ' + error.message)
  clearCache()
  await writeAuditLog({
    action: 'reading_replace',
    target_table: 'meter_readings',
    target_id: boothCode,
    detail: `入替: (${boothCode})`,
    before_data: relatedRecord,
    after_data: payload,
    reason_code: 'REPLACE',
    staff_id: staffId || undefined,
  })
}

function _calcRevenue(inp) {
  const outs = inp.outs || []
  let outRev = 0
  for (const o of outs) {
    const d = o.diff != null ? Number(o.diff) : 0
    const c = o.cost != null && o.cost !== '' ? parseInt(o.cost) : 0
    if (d > 0 && c > 0) outRev += d * c
  }
  // OUT×景品原価 が取れた場合はそちらを優先（ガチャ）、なければ IN×プレイ単価（クレーン）
  return outRev > 0 ? outRev : (inp.inDiff || 0) * (inp.playPrice || 100)
}

function _buildPayload(boothCode, entryType, inp, outCount, staffId) {
  const now = new Date().toISOString()
  const parts = boothCode.split('-')
  const p = {
    reading_id: crypto.randomUUID(),
    full_booth_code: boothCode,
    booth_id: boothCode,
    patrol_date: inp.readDate,
    store_code: parts[0],
    machine_code: parts.slice(0, 2).join('-'),
    booth_code: boothCode,
    read_time: now,
    entry_type: entryType,
    in_meter: inp.inMeter ? parseFloat(inp.inMeter) : null,
    out_meter: inp.outs?.[0]?.meter ? parseFloat(inp.outs[0].meter) : null,
    prize_name: inp.outs?.[0]?.prize || null,
    prize_id: inp.outs?.[0]?.prize_id || null,
    prize_cost_1: inp.outs?.[0]?.cost != null && inp.outs[0].cost !== '' ? parseInt(inp.outs[0].cost) : null,
    prize_cost: inp.outs?.[0]?.cost != null && inp.outs[0].cost !== '' ? parseInt(inp.outs[0].cost) : null,
    prize_stock_count: inp.outs?.[0]?.zan ? parseInt(inp.outs[0].zan) : null,
    prize_restock_count: inp.outs?.[0]?.ho && inp.outs[0].ho !== 'ー' ? parseInt(inp.outs[0].ho) : 0,
    set_a: inp.setA || null, set_c: inp.setC || null,
    set_l: inp.setL || null, set_r: inp.setR || null,
    set_o: inp.setO || null,
    in_diff: inp.inDiff ?? null,
    out_diff_1: inp.outs?.[0]?.diff ?? null,
    play_price: inp.playPrice || null,
    revenue: _calcRevenue(inp),
    source: 'manual',
    created_at: now,
    created_by: staffId || null,
    organization_id: DFX_ORG_ID,
  }
  if (outCount >= 2 && inp.outs?.[1]) {
    p.out_meter_2 = inp.outs[1].meter ? parseFloat(inp.outs[1].meter) : null
    p.prize_name_2 = inp.outs[1].prize || null
    p.prize_cost_2 = inp.outs[1].cost != null && inp.outs[1].cost !== '' ? parseInt(inp.outs[1].cost) : null
    p.stock_2 = inp.outs[1].zan ? parseInt(inp.outs[1].zan) : null
    p.restock_2 = inp.outs[1].ho && inp.outs[1].ho !== 'ー' ? parseInt(inp.outs[1].ho) : 0
    p.out_diff_2 = inp.outs[1].diff ?? null
  }
  if (outCount >= 3 && inp.outs?.[2]) {
    p.out_meter_3 = inp.outs[2].meter ? parseFloat(inp.outs[2].meter) : null
    p.prize_name_3 = inp.outs[2].prize || null
    p.prize_cost_3 = inp.outs[2].cost != null && inp.outs[2].cost !== '' ? parseInt(inp.outs[2].cost) : null
    p.stock_3 = inp.outs[2].zan ? parseInt(inp.outs[2].zan) : null
    p.restock_3 = inp.outs[2].ho && inp.outs[2].ho !== 'ー' ? parseInt(inp.outs[2].ho) : 0
    p.out_diff_3 = inp.outs[2].diff ?? null
  }
  return p
}
