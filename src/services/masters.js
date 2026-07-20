// ============================================
// 店舗・機械・ブース・ロケーション（マスター参照・追加）
// ============================================
import { supabase } from '../lib/supabase'
import { parseNum, getCache, setCache, clearCache } from './utils'
import { writeAuditLog } from './audit'
import { MachineRowSchema, StoreRowSchema } from './schemas/index.js'
import { CHANGE_ORG_ID } from '../lib/auth/orgConstants'

// getStores 用部分スキーマ (INC-005: SELECT列不一致防止)
const StoreSearchSchema = StoreRowSchema.pick({
  store_code: true, store_name: true, locality: true, locality_kana: true, is_active: true,
}).array()

export async function getStores() {
  if (getCache('stores')) return getCache('stores')
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_name, locality, locality_kana, is_active')
    .eq('is_active', true)
    .order('store_name')
  if (error) { console.error('stores取得エラー:', error.message); return [] }
  const _storesParsed = StoreSearchSchema.safeParse(data ?? [])
  const rows = _storesParsed.success ? _storesParsed.data : (data ?? [])
  const result = rows.map(r => ({
    store_code: r.store_code,
    store_name: r.store_name,
    locality: r.locality ?? '',
    locality_kana: r.locality_kana ?? '',
    active_flag: r.is_active ? 1 : 0,
  }))
  setCache('stores', result)
  return result
}

export async function getMachineTypes() {
  if (getCache('machine_types')) return getCache('machine_types')
  const { data, error } = await supabase
    .from('machine_types')
    .select('type_id, type_name, category, locker_slots, notes') // J-SCHEMA-DROP-FIX-01: manufacturer/booth_count/meter_count/meter_unit_price 列削除済
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
  const _machinesParsed = MachineRowSchema.array().safeParse(data ?? [])
  const rows = _machinesParsed.success ? _machinesParsed.data : (data ?? [])
  const result = rows.map(r => ({
    machine_code: r.machine_code,
    store_code: r.store_code,
    machine_name: r.machine_name || '',
    machine_type: r.type_id || '',
    default_price: parseNum(r.play_price || '100'),
    rental_code: r.machine_number || '',
    model_id: r.model_id || '',
    location_note: r.notes || '',
    active_flag: r.is_active ? '1' : '0',
    billing_order: r.billing_order ?? null,
    round_order: r.round_order ?? null,
  }))
  setCache(ckey, result)
  return result
}

export async function batchUpdateRoundOrder(storeCode, updates) {
  clearCache(`machines_${storeCode}`)
  const results = await Promise.all(
    updates.map(({ machine_code, round_order }) =>
      supabase.from('machines').update({ round_order }).eq('machine_code', machine_code)
    )
  )
  const failed = results.find(r => r.error)
  if (failed) throw new Error(failed.error.message)
}

export async function batchUpdateOrder(storeCode, updates, column) {
  clearCache(`machines_${storeCode}`)
  const results = await Promise.all(
    updates.map(({ machine_code, order_value }) =>
      supabase.from('machines').update({ [column]: order_value }).eq('machine_code', machine_code)
    )
  )
  const failed = results.find(r => r.error)
  if (failed) throw new Error(failed.error.message)
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
  if (!data || data.length === 0) return `${storeCode}-M01`
  const prefix = `${storeCode}-M`
  const max = data.reduce((acc, { machine_code }) => {
    if (!machine_code.startsWith(prefix)) return acc
    const n = parseInt(machine_code.slice(prefix.length), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `${storeCode}-M${String(max + 1).padStart(2, '0')}`
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
  // machines.organization_id NOT NULL 制約を満たすため org を明示付与 (J-ADMIN-99, ヒロ 2026-05-31 IMG_4228.png)。
  // SPEC-MACHINE-REGISTER-ORG-DEFAULT-CHANGE-01 (D-064): 値を DFX_ORG_ID -> CHANGE_ORG_ID に是正 (store と org 一致)。
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
      // SPEC-MACHINE-REGISTER-ORG-DEFAULT-CHANGE-01 (D-064): 実運用全店は CHANGE org。DFX org 登録だと
      // store と org 不一致で過去メーター/巡回保存が ERR-METER-001 連鎖するため CHANGE に統一。
      organization_id: CHANGE_ORG_ID,
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
  // J-ADMIN-99_adhoc_machine_add_org_id_fix-02: booths テーブルは organization_id 列なし
  // (schema cache "Could not find the 'organization_id' column of 'booths'" エラー、ヒロ実機 IMG_4229)。
  // machines だけ NOT NULL 制約あり、booths は store_code 経由で RLS 担保。
  const { data, error } = await supabase
    .from('booths')
    .insert({
      booth_code: boothCode,
      machine_code: b.machine_code,
      store_code: b.store_code,
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

// ============================================
// SPEC-MACHINE-MODEL-LINK-ADMIN-01 (D-101): 全店横断 機械一覧・model_id紐付管理
// ============================================
// 全店舗・非稼働含む全機械を取得し、model_id 経由で機種の model_name/short_name を JOIN(表示ラベルのみ)。
// is_active フィルタなし(既存 getMachines は稼働のみ・店舗指定)。organization_id フィルタは付けない(RLS担保)。
export async function getAllMachinesForAdmin() {
  const [machinesRes, modelsRes] = await Promise.all([
    supabase.from('machines').select('*').order('store_code').order('machine_code'),
    supabase.from('machine_models').select('model_id, model_name, short_name'),
  ])
  if (machinesRes.error) { console.error('全機械取得エラー:', machinesRes.error.message); return [] }
  const modelMap = {}
  for (const m of (modelsRes.data ?? [])) modelMap[m.model_id] = m
  return (machinesRes.data ?? []).map(r => ({
    ...r,
    // 機種マスタ参照の表示ラベル (machines 側にはコピー保存しない=機種側変更に自動追従)
    model_name: r.model_id ? (modelMap[r.model_id]?.model_name ?? null) : null,
    short_name: r.model_id ? (modelMap[r.model_id]?.short_name ?? null) : null,
  }))
}

// 行単位更新。編集許可カラムのみホワイトリスト適用。machine_code/store_code(不変キー)・organization_id・監査列は更新不可。
// meter_unit_price/out_meter_count は NOT NULL のため空値では触らない(既存温存)。model_id 空→null(紐付解除)。
const EDITABLE_MACHINE_COLS = new Set([
  'model_id', 'machine_name', 'name_suffix', 'type_id', 'machine_number', 'billing_order', 'round_order', 'is_active',
  'meter_unit_price', 'play_price', 'meter_per_play', 'out_meter_count', 'floor', 'zone', 'floor_area_m2',
  'ownership_type', 'acquisition_cost', 'acquired_at', 'installed_at', 'lease_monthly', 'lease_months', 'lease_end_date',
  'maintenance_status', 'last_maintenance_at', 'notes', 'operator_id', 'contract_id',
])
const NUMERIC_MACHINE_COLS = new Set([
  'meter_unit_price', 'play_price', 'meter_per_play', 'out_meter_count', 'floor_area_m2',
  'acquisition_cost', 'lease_monthly', 'lease_months', 'billing_order', 'round_order',
])
const NOT_NULL_MACHINE_COLS = new Set(['meter_unit_price', 'out_meter_count'])

export async function updateMachineAdmin(machineCode, patch) {
  const upd = {}
  for (const key of Object.keys(patch || {})) {
    if (!EDITABLE_MACHINE_COLS.has(key)) continue // machine_code/store_code/organization_id/監査/JOIN列は破棄
    const v = patch[key]
    if (key === 'is_active') { upd[key] = !!v; continue }
    const empty = v === '' || v === null || v === undefined
    if (empty) {
      if (NOT_NULL_MACHINE_COLS.has(key)) continue // NOT NULL列は空なら触らない
      upd[key] = null
      continue
    }
    upd[key] = NUMERIC_MACHINE_COLS.has(key) ? Number(v) : v
  }
  if (Object.keys(upd).length === 0) return null
  const { data: before } = await supabase.from('machines').select('*').eq('machine_code', machineCode).single()
  upd.updated_at = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('machines')
    .update(upd)
    .eq('machine_code', machineCode)
    .select()
  if (error) throw new Error(error.message)
  if (!updated || updated.length === 0) throw new Error('更新できませんでした（権限不足の可能性があります）')
  clearCache()
  await writeAuditLog({
    action: 'master_update',
    target_table: 'machines',
    target_id: machineCode,
    detail: `機械管理更新: ${machineCode}`,
    before_data: before,
    after_data: upd,
  })
  return updated[0]
}

export async function getAllStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_name, locality, locality_kana, is_active')
    .eq('is_active', true)
    .order('store_code')
  if (error) { console.error('stores取得エラー:', error.message); return [] }
  return data.map(r => ({
    store_code: r.store_code,
    store_name: r.store_name,
    locality: r.locality ?? '',
    locality_kana: r.locality_kana ?? '',
  }))
}

// ============================================
// machine_models CRUD
// ============================================
export async function getMachineModels() {
  if (getCache('machine_models')) return getCache('machine_models')
  const { data, error } = await supabase
    .from('machine_models')
    .select('model_id, model_name, short_name, type_id, manufacturer, booth_count, in_meter_count, out_meter_count, meter_unit_price, size_info, weight_kg, power_w, width_mm, depth_mm, height_mm, image_url, notes, created_at')
    .order('model_id')
  if (error) { console.error('machine_models取得エラー:', error.message); return [] }
  setCache('machine_models', data)
  return data
}

export async function addMachineModel(m) {
  const { data, error } = await supabase
    .from('machine_models')
    .insert({
      model_id: crypto.randomUUID(),
      model_name: m.model_name,
      // SPEC-MODEL-SHORTNAME-EDIT-01 (D-100): 短縮通名。null許容 (空で保存可、必須バリデーションなし)。
      short_name: m.short_name || null,
      type_id: m.type_id || null,
      manufacturer: m.manufacturer || null,
      booth_count: m.booth_count ? Number(m.booth_count) : null,
      in_meter_count: m.in_meter_count ? Number(m.in_meter_count) : null,
      out_meter_count: m.out_meter_count ? Number(m.out_meter_count) : null,
      meter_unit_price: m.meter_unit_price ? Number(m.meter_unit_price) : null,
      size_info: m.size_info || null,
      weight_kg: m.weight_kg ? Number(m.weight_kg) : null,
      power_w: m.power_w ? Number(m.power_w) : null,
      width_mm: m.width_mm ? Number(m.width_mm) : null,
      depth_mm: m.depth_mm ? Number(m.depth_mm) : null,
      height_mm: m.height_mm ? Number(m.height_mm) : null,
      image_url: m.image_url || null,
      notes: m.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_create',
    target_table: 'machine_models',
    target_id: String(data.model_id),
    detail: `機種追加: ${data.model_name}`,
    after_data: data,
  })
  return data
}

export async function updateMachineModel(modelId, updates) {
  const { data, error } = await supabase
    .from('machine_models')
    .update({
      model_name: updates.model_name,
      // SPEC-MODEL-SHORTNAME-EDIT-01 (D-100): 短縮通名。null許容。
      short_name: updates.short_name || null,
      type_id: updates.type_id || null,
      manufacturer: updates.manufacturer || null,
      booth_count: updates.booth_count ? Number(updates.booth_count) : null,
      in_meter_count: updates.in_meter_count ? Number(updates.in_meter_count) : null,
      out_meter_count: updates.out_meter_count ? Number(updates.out_meter_count) : null,
      meter_unit_price: updates.meter_unit_price ? Number(updates.meter_unit_price) : null,
      size_info: updates.size_info || null,
      weight_kg: updates.weight_kg ? Number(updates.weight_kg) : null,
      power_w: updates.power_w ? Number(updates.power_w) : null,
      width_mm: updates.width_mm ? Number(updates.width_mm) : null,
      depth_mm: updates.depth_mm ? Number(updates.depth_mm) : null,
      height_mm: updates.height_mm ? Number(updates.height_mm) : null,
      image_url: updates.image_url || null,
      notes: updates.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('model_id', modelId)
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_update',
    target_table: 'machine_models',
    target_id: String(modelId),
    detail: `機種更新: ${updates.model_name}`,
    after_data: updates,
  })
  return data
}

export async function deleteMachineModel(modelId) {
  const { error } = await supabase
    .from('machine_models')
    .delete()
    .eq('model_id', modelId)
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_delete',
    target_table: 'machine_models',
    target_id: String(modelId),
    detail: `機種削除: model_id=${modelId}`,
  })
}

export async function addMachineType(t) {
  const { data, error } = await supabase
    .from('machine_types')
    .insert({
      // J-SCHEMA-DROP-FIX-01: manufacturer/booth_count/meter_count/meter_unit_price 列削除済、payload から除外。
      type_name: t.type_name,
      category: t.category || null,
      locker_slots: t.locker_slots ? Number(t.locker_slots) : null,
      notes: t.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_create',
    target_table: 'machine_types',
    target_id: String(data.type_id),
    detail: `機種追加: ${data.type_name}`,
    after_data: data,
  })
  return data
}

export async function updateMachineType(typeId, updates) {
  const { data, error } = await supabase
    .from('machine_types')
    .update({
      // J-SCHEMA-DROP-FIX-01: manufacturer/booth_count/meter_count/meter_unit_price 列削除済、payload から除外。
      type_name: updates.type_name,
      category: updates.category || null,
      locker_slots: updates.locker_slots ? Number(updates.locker_slots) : null,
      notes: updates.notes || null,
    })
    .eq('type_id', typeId)
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_update',
    target_table: 'machine_types',
    target_id: String(typeId),
    detail: `機種更新: ${updates.type_name}`,
    after_data: updates,
  })
  return data
}

export async function deleteMachineType(typeId) {
  const { error } = await supabase
    .from('machine_types')
    .delete()
    .eq('type_id', typeId)
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_delete',
    target_table: 'machine_types',
    target_id: String(typeId),
    detail: `機種削除: type_id=${typeId}`,
  })
}

export async function updateBooth(boothCode, updates) {
  const { data, error } = await supabase
    .from('booths')
    .update({
      play_price: updates.play_price !== undefined ? (updates.play_price || null) : undefined,
      meter_in_number: updates.meter_in_number !== undefined ? (Number(updates.meter_in_number) || 7) : undefined,
      meter_out_number: updates.meter_out_number !== undefined ? (Number(updates.meter_out_number) || 7) : undefined,
      is_active: updates.is_active !== undefined ? updates.is_active : undefined,
    })
    .eq('booth_code', boothCode)
    .select()
    .single()
  if (error) throw error
  clearCache()
  await writeAuditLog({
    action: 'master_update',
    target_table: 'booths',
    target_id: boothCode,
    detail: `ブース更新: ${boothCode}`,
    after_data: updates,
  })
  return data
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
