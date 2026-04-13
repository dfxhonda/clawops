// ============================================
// patrol: 巡回アプリ用データ取得・保存
// ============================================
import { supabase } from '../lib/supabase'
import { writeAuditLog } from './audit'
import { clearCache } from './utils'

// 店舗の機械一覧（booths + machine_lockers + machine_models/types 付き）
export async function getPatrolMachines(storeCode) {
  const { data, error } = await supabase
    .from('machines')
    .select(`
      machine_code, machine_name, store_code, type_id, model_id, billing_order,
      machine_types!type_id(category),
      booths(booth_code, booth_number, play_price, meter_in_number, meter_out_number, is_active, machine_code),
      machine_lockers(locker_id, locker_number, slot_count, lock_type, is_active)
    `)
    .eq('store_code', storeCode)
    .eq('is_active', true)
    .order('billing_order', { nullsFirst: false })
  if (error) { console.error('getPatrolMachines error:', error.message); return [] }
  return (data || []).map(m => ({
    ...m,
    booths: (m.booths || []).filter(b => b.is_active).sort((a, b) => a.booth_number - b.booth_number),
    machine_lockers: (m.machine_lockers || []).filter(l => l.is_active).sort((a, b) => a.locker_number - b.locker_number),
  }))
}

// 当日の入力済みブース一覧 → Map<booth_code, {read_time, created_by}>
export async function getTodayReadings(boothCodes) {
  if (!boothCodes.length) return {}
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('meter_readings')
    .select('full_booth_code, read_time, created_by')
    .in('full_booth_code', boothCodes)
    .gte('read_time', today + 'T00:00:00')
    .lte('read_time', today + 'T23:59:59')
    .order('read_time', { ascending: false })
  if (error) { console.error('getTodayReadings error:', error.message); return {} }
  const map = {}
  for (const r of (data || [])) {
    if (!map[r.full_booth_code]) {
      map[r.full_booth_code] = { read_time: r.read_time, created_by: r.created_by }
    }
  }
  return map
}

// 当日のロッカー補充済み一覧 → Map<locker_id, {read_time}>
export async function getTodayLockerLogs(machineCode) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('locker_restock_logs')
    .select('locker_id, read_time')
    .eq('machine_code', machineCode)
    .gte('read_time', today + 'T00:00:00')
    .lte('read_time', today + 'T23:59:59')
  if (error) { console.error('getTodayLockerLogs error:', error.message); return {} }
  const map = {}
  for (const r of (data || [])) {
    if (!map[r.locker_id]) map[r.locker_id] = { read_time: r.read_time }
  }
  return map
}

// ブースの直近読み値
export async function getLastReading(boothCode) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('reading_id, in_meter, out_meter, prize_name, read_time')
    .eq('full_booth_code', boothCode)
    .order('read_time', { ascending: false })
    .limit(1)
  if (error || !data?.length) return null
  return data[0]
}

// ブースメーター保存（当日既存レコードがあればUPDATE、なければINSERT）
export async function saveBoothReading({ boothCode, inMeter, outMeter, prizeName, prizeRestock, prizeStock, note, createdBy, source }) {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  // 当日の既存レコードを確認
  const { data: existing } = await supabase
    .from('meter_readings')
    .select('reading_id')
    .eq('full_booth_code', boothCode)
    .gte('read_time', today + 'T00:00:00')
    .lte('read_time', today + 'T23:59:59')
    .limit(1)

  const payload = {
    booth_id: boothCode,
    full_booth_code: boothCode,
    in_meter: inMeter != null ? parseFloat(inMeter) : null,
    out_meter: outMeter != null ? parseFloat(outMeter) : null,
    prize_restock_count: parseInt(prizeRestock) || 0,
    prize_stock_count: parseInt(prizeStock) || 0,
    prize_name: prizeName || null,
    note: note || null,
    source: source || 'manual',
    input_method: 'manual',
    created_by: createdBy || null,
  }

  let readingId
  if (existing?.length) {
    readingId = existing[0].reading_id
    const { error } = await supabase.from('meter_readings').update({ ...payload, read_time: now }).eq('reading_id', readingId)
    if (error) throw new Error('メーター保存エラー: ' + error.message)
  } else {
    const { data, error } = await supabase.from('meter_readings').insert({ ...payload, read_time: now, created_at: now }).select('reading_id').single()
    if (error) throw new Error('メーター保存エラー: ' + error.message)
    readingId = data.reading_id
  }

  clearCache()
  writeAuditLog({
    action: existing?.length ? 'reading_update' : 'reading_create',
    target_table: 'meter_readings',
    target_id: boothCode,
    detail: `巡回メーター入力: IN=${inMeter || '-'} OUT=${outMeter || '-'} (${boothCode})`,
    staff_id: createdBy || undefined,
  })
  return readingId
}

// ロッカー補充記録を保存
export async function saveLockerRestocks(restocks) {
  if (!restocks.length) return
  const { error } = await supabase.from('locker_restock_logs').insert(restocks)
  if (error) throw new Error('ロッカー補充保存エラー: ' + error.message)
}

// 機械のロッカー一覧
export async function getMachineLockers(machineCode) {
  const { data, error } = await supabase
    .from('machine_lockers')
    .select('*')
    .eq('machine_code', machineCode)
    .eq('is_active', true)
    .order('locker_number')
  if (error) { console.error('getMachineLockers error:', error.message); return [] }
  return data || []
}

// ロッカー登録（admin用）
export async function addLocker({ machineCode, storeCode, lockerNumber, slotCount, lockType }) {
  const { data, error } = await supabase
    .from('machine_lockers')
    .insert({ machine_code: machineCode, store_code: storeCode, locker_number: lockerNumber, slot_count: slotCount, lock_type: lockType, is_active: true })
    .select()
    .single()
  if (error) throw new Error('ロッカー登録エラー: ' + error.message)
  return data
}

// ロッカー削除（soft delete）
export async function deleteLocker(lockerId) {
  const { error } = await supabase.from('machine_lockers').update({ is_active: false }).eq('locker_id', lockerId)
  if (error) throw new Error('ロッカー削除エラー: ' + error.message)
}

// ロッカー全件取得（admin用 — is_active 問わず）
export async function getAllMachineLockers(machineCode) {
  const { data, error } = await supabase
    .from('machine_lockers')
    .select('*')
    .eq('machine_code', machineCode)
    .order('locker_number')
  if (error) { console.error('getAllMachineLockers error:', error.message); return [] }
  return data || []
}

// ロッカー有効化
export async function activateLocker(lockerId) {
  const { error } = await supabase.from('machine_lockers').update({ is_active: true }).eq('locker_id', lockerId)
  if (error) throw new Error('有効化エラー: ' + error.message)
}

// ロッカー更新（スロット数・ロック種別）
export async function updateLocker(lockerId, { slotCount, lockType }) {
  const { error } = await supabase
    .from('machine_lockers')
    .update({ slot_count: slotCount, lock_type: lockType })
    .eq('locker_id', lockerId)
  if (error) throw new Error('更新エラー: ' + error.message)
}
