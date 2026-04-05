// ============================================
// 店舗・機械・ブース・ロケーション（マスター参照）
// ============================================
import { supabase } from '../lib/supabase'
import { parseNum, getCache, setCache } from './utils'

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
    .select('store_code, store_id, store_name, is_active')
    .in('store_code', storeCodes)
    .eq('is_active', true)
    .order('store_name')
  if (error) { console.error('stores取得エラー:', error.message); return [] }
  const result = data.map(r => ({
    store_id: r.store_code,
    store_code: r.store_code,
    store_name: r.store_name,
    active_flag: r.is_active ? 1 : 0,
  }))
  setCache('stores', result)
  return result
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
    machine_id: r.machine_code,
    store_id: r.store_code,
    machine_code: r.machine_code,
    machine_name: r.machine_name || '',
    machine_model: r.model_id || '',
    machine_type: '',
    booth_count: '',
    default_price: parseNum(r.play_price || '100'),
    meter_layout: '',
    rental_code: r.machine_number || '',
    monthly_advance: 0,
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
    booth_id: r.booth_code,
    machine_id: r.machine_code,
    booth_code: r.booth_code,
    booth_number: r.booth_number,
    full_booth_code: r.booth_code,
    meter_in_digit: r.meter_in_number || '7',
    meter_out_digit: r.meter_out_number || '7',
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
    booth_id: data.booth_code, machine_id: data.machine_code,
    booth_code: data.booth_code, booth_number: data.booth_number,
    full_booth_code: data.booth_code,
    meter_in_digit: data.meter_in_number || '7',
    meter_out_digit: data.meter_out_number || '7',
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
  return { machine_id: data.machine_code, store_id: data.store_code, machine_code: data.machine_code, machine_name: data.machine_name }
}

export async function findStoreById(storeId) {
  const stores = await getStores()
  return stores.find(s => String(s.store_id) === String(storeId)) || null
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
    location_id: r.location_id, name: r.location_name || '',
    location_name: r.location_name || '',
    parent_location_id: r.parent_location_id || '',
    store_code: r.store_code || '', location_type: r.location_type || '',
    note: r.notes || '', notes: r.notes || '',
    active_flag: r.is_active ? '1' : '0', is_active: r.is_active,
    operator_id: r.operator_id || '',
    capacity_note: r.capacity_note || '', is_full: r.is_full || false,
    created_at: r.created_at || '', updated_at: r.updated_at || '',
    updated_by: r.updated_by || '',
  }))
  setCache('locations', result)
  return result
}
