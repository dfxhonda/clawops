// ============================================
// 店舗・機械・ブース・ロケーション（マスター参照・追加）
// ============================================
import { supabase } from '../lib/supabase'
import { parseNum, getCache, setCache, clearCache } from './utils'
import { writeAuditLog } from './audit'

export async function getStores() {
  if (getCache('stores')) return getCache('stores')
  const { data: machineStores, error: mErr } = await supabase
    .from('machines')
    .select('store_code')
    .eq('is_active', true)
  if (mErr) { console.error('machines取得エラー:', mErr.message); return [] }
  const storeCodes = [...new Set(machineStores.map(m => m.store_code).filter(Boolean))]
  if (storeCodes.length === 0) return []
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_name, is_active')
    .in('store_code', storeCodes)
    .eq('is_active', true)
    .order('store_name')
  if (error) { console.error('stores取得エラー:', error.message); return [] }
  const result = data.map(r => ({
    store_code: r.store_code,
    store_name: r.store_name,
    active_flag: r.is_active ? 1 : 0,
  }))
  setCache('stores', result)
  return result
}

export async function getMachineTypes() {
  if (getCache('machine_types')) return getCache('machine_types')
  const { data, error } = await supabase
    .from('machine_types')
    .select('type_id, type_name, category, locker_slots, manufacturer, booth_count, meter_count, meter_unit_price, notes')
    .order('type_id')
  if (error) { console.error('machine_types取得エラー:', error.message); return [] }
  setCache('machine_types', data)
  return data
}

export async function getMachines(storeId) {
  const ckey = `machines_${storeId}`
  if (getCache(ckey)) return getCache(ckey)
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('store_code', storeId)
    .eq('is_active', true)
    .order('machine_code')
  if (error) { console.error('machines取得エラー:', error.message); return [] }
  const result = data.map(r => ({
    machine_code: r.machine_code,
    store_code: r.store_code,
    machine_name: r.machine_name || '',
    machine_type: r.type_id || '',
    default_price: parseNum(r.play_price || '100'),
    rental_code: r.machine_number || '',
    location_note: r.notes || '',
    active_flag: r.is_active ? '1' : '0',
  }))
  setCache(ckey, result)
  return result
}

export async function getBooths(machineId) {
  const ckey = `booths_${machineId}`
  if (getCache(ckey)) return getCache(ckey)
  const { data, error } = await supabase
    .from('booths')
    .select('*')
    .eq('machine_code', machineId)
    .eq('is_active', true)
    .order('booth_number')
  if (error) { console.error('booths取得エラー:', error.message); return [] }
  const result = data.map(r => ({
    booth_code: r.booth_code,
    machine_code: r.machine_code,
    booth_number: r.booth_number,
    meter_in_number: r.meter_in_number || '7',
    meter_out_number: r.meter_out_number || '7',
    play_price: r.play_price,
  }))
  setCache(ckey, result)
  return result
}

export async function findBoothByCode(fullBoothCode) {
  const { data, error } = await supabase
    .from('booths')
    .select('*')
    .eq('booth_code', String(fullBoothCode).trim())
    .eq('is_active', true)
    .limit(1)
    .single()
  if (error || !data) return null
  return {
    booth_code: data.booth_code,
    machine_code: data.machine_code,
    booth_number: data.booth_number,
    meter_in_number: data.meter_in_number || '7',
    meter_out_number: data.meter_out_number || '7',
    play_price: data.play_price,
  }
}

export async function findMachineById(machineId) {
  const { data, error } = await supabase
    .from('machines')
    .select('machine_code, store_code, machine_name')
    .eq('machine_code', machineId)
    .limit(1)
    .single()
  if (error || !data) return null
  return { machine_code: data.machine_code, store_code: data.store_code, machine_name: data.machine_name }
}

export async function findStoreById(storeId) {
  const stores = await getStores()
  return stores.find(s => String(s.store_code) === String(storeId)) || null
}

export async function getNextMachineCode(storeCode) {
  const { data } = await supabase
    .from('machines')
    .select('machine_code')
    .eq('store_code', storeCode)
    .order('machine_code', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return `${storeCode}-M01`
  const last = data[0].machine_code
  const m = last.match(/-M(\d+)$/)
  const n = m ? parseInt(m[1], 10) + 1 : 1
  return `${storeCode}-M${String(n).padStart(2, '0')}`
}

export async function getNextBoothNumber(machineCode) {
  const { data } = await supabase
    .from('booths')
    .select('booth_number')
    .eq('machine_code', machineCode)
    .order('booth_number', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return 1
  return (data[0].booth_number || 0) + 1
}

export async function addMachine(m) {
  const { data, error } = await supabase
    .from('machines')
    .insert({
      machine_code: m.machine_code,
      store_code: m.store_code,
      machine_name: m.machine_name,
      machine_number: m.machine_number || null,
      model_id: m.model_id || null,
      type_id: m.type_id || null,
      play_price: m.play_price || 100,
      notes: m.notes || null,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_create',
    target_table: 'machines',
    target_id: data.machine_code,
    detail: `機械追加: ${data.machine_name} (${data.machine_code})`,
    after_data: data,
  })
  return data
}

export async function addBooth(b) {
  const machineCodeSuffix = b.machine_code.split('-').slice(1).join('-')
  const boothCode = `${b.store_code}-${machineCodeSuffix}-B${String(b.booth_number).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('booths')
    .insert({
      booth_code: boothCode,
      machine_code: b.machine_code,
      booth_number: b.booth_number,
      play_price: b.play_price || null,
      meter_in_number: b.meter_in_number || 7,
      meter_out_number: b.meter_out_number || 7,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_create',
    target_table: 'booths',
    target_id: data.booth_code,
    detail: `ブース追加: ${data.booth_code} (B${String(b.booth_number).padStart(2, '0')})`,
    after_data: data,
  })
  return data
}

export async function updateMachine(machineCode, updates) {
  const { data: before } = await supabase
    .from('machines')
    .select('machine_name, model_id, type_id, machine_number, play_price, notes, store_code')
    .eq('machine_code', machineCode)
    .single()
  const { data: updated, error } = await supabase
    .from('machines')
    .update({
      machine_name: updates.machine_name ?? before?.machine_name,
      model_id: updates.model_id ?? before?.model_id,
      type_id: 'type_id' in updates ? (updates.type_id || null) : before?.type_id,
      machine_number: 'machine_number' in updates ? (updates.machine_number || null) : before?.machine_number,
      play_price: updates.play_price ?? before?.play_price,
      notes: updates.notes ?? before?.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('machine_code', machineCode)
    .select()
  if (error) throw new Error(error.message)
  if (!updated || updated.length === 0) throw new Error('更新できませんでした（権限不足の可能性があります）')
  clearCache()
  await writeAuditLog({
    action: 'master_update',
    target_table: 'machines',
    target_id: machineCode,
    detail: `機械情報更新: ${updates.machine_name || machineCode}`,
    before_data: before,
    after_data: updates,
  })
}

export async function deleteMachine(machineCode) {
  const { data: before } = await supabase
    .from('machines')
    .select('machine_name, store_code')
    .eq('machine_code', machineCode)
    .single()
  const { data: updated, error } = await supabase
    .from('machines')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('machine_code', machineCode)
    .select()
  if (error) throw new Error(error.message)
  if (!updated || updated.length === 0) throw new Error('削除できませんでした（権限不足の可能性があります）')
  clearCache()
  await writeAuditLog({
    action: 'master_deactivate',
    target_table: 'machines',
    target_id: machineCode,
    detail: `機械無効化: ${before?.machine_name || machineCode}`,
    reason_code: 'machine_deactivate',
    before_data: before,
    after_data: { is_active: false },
  })
}

export async function getLocations(forceRefresh = false) {
  if (!forceRefresh && getCache('locations')) return getCache('locations')
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('location_name')
  if (error) { console.error('locations取得エラー:', error.message); return [] }
  const result = data.map(r => ({
    location_id: r.location_id,
    location_name: r.location_name || '',
    parent_location_id: r.parent_location_id || '',
    store_code: r.store_code || '', location_type: r.location_type || '',
    notes: r.notes || '',
    active_flag: r.is_active ? '1' : '0', is_active: r.is_active,
    operator_id: r.operator_id || '',
    capacity_note: r.capacity_note || '', is_full: r.is_full || false,
    created_at: r.created_at || '', updated_at: r.updated_at || '',
    updated_by: r.updated_by || '',
  }))
  setCache('locations', result)
  return result
}
