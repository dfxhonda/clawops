// ============================================
// manuals: 機械マニュアルCRUD + 画像アップロード
// ============================================
import { supabase } from '../lib/supabase'
import { writeAuditLog } from './audit'

export async function getModels() {
  const { data, error } = await supabase
    .from('machine_models')
    .select('model_id, model_name, type_id, manufacturer, notes')
    .order('model_name')
  if (error) { console.error('machine_models取得エラー:', error.message); return [] }
  return data
}

// 管理用（published 問わず）
export async function getManualForModel(modelId) {
  const { data, error } = await supabase
    .from('machine_manuals')
    .select('*, manual_sections(*)')
    .eq('model_id', modelId)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return null
  const manual = data[0]
  // sort_order で並び替え
  manual.manual_sections = (manual.manual_sections || []).sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
  return manual
}

// manual header の作成 or 更新
export async function upsertManual(modelId, { version, is_published, notes }) {
  const existing = await getManualForModel(modelId)
  const now = new Date().toISOString()
  if (existing) {
    const { data, error } = await supabase
      .from('machine_manuals')
      .update({ version: version || null, is_published: !!is_published, notes: notes || null, updated_at: now })
      .eq('manual_id', existing.manual_id)
      .select()
      .single()
    if (error) throw error
    await writeAuditLog({
      action: 'master_update',
      target_table: 'machine_manuals',
      target_id: existing.manual_id,
      detail: `マニュアル更新: model_id=${modelId} v${version || ''}`,
      after_data: { version, is_published, notes },
    })
    return data
  } else {
    const { data, error } = await supabase
      .from('machine_manuals')
      .insert({ model_id: modelId, version: version || null, is_published: !!is_published, notes: notes || null, updated_at: now })
      .select()
      .single()
    if (error) throw error
    await writeAuditLog({
      action: 'master_create',
      target_table: 'machine_manuals',
      target_id: data.manual_id,
      detail: `マニュアル作成: model_id=${modelId}`,
      after_data: data,
    })
    return data
  }
}

// section_id あり → UPDATE, なし → INSERT
export async function saveSection(manualId, { section_id, section_type, title, content, sort_order }) {
  const now = new Date().toISOString()
  if (section_id) {
    const { error } = await supabase
      .from('manual_sections')
      .update({ title, content: content || '', sort_order: sort_order ?? 0, updated_at: now })
      .eq('section_id', section_id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('manual_sections')
      .insert({ manual_id: manualId, section_type, title, content: content || '', sort_order: sort_order ?? 0, updated_at: now })
    if (error) throw error
  }
}

// 画像アップロード → public URL 返却
export async function uploadManualImage(modelId, file) {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}.${ext}`
  const path = `${modelId}/${fileName}`
  const { data, error } = await supabase.storage
    .from('manual-images')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw new Error(`画像アップロード失敗: ${error.message}`)
  const { data: urlData } = supabase.storage.from('manual-images').getPublicUrl(data.path)
  return urlData.publicUrl
}

// 現場用（is_published=true のみ）
export async function getPublishedManual(modelId) {
  const cacheKey = `manual_${modelId}`
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch { /* ignore */ }

  const { data, error } = await supabase
    .from('machine_manuals')
    .select('*, manual_sections(*)')
    .eq('model_id', modelId)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return null
  const manual = data[0]
  manual.manual_sections = (manual.manual_sections || []).sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
  try { sessionStorage.setItem(cacheKey, JSON.stringify(manual)) } catch { /* ignore */ }
  return manual
}

// MachineList 📖 判定用: 公開マニュアルがある model_id の Set
export async function getPublishedModelIds() {
  const { data, error } = await supabase
    .from('machine_manuals')
    .select('model_id')
    .eq('is_published', true)
  if (error || !data) return new Set()
  return new Set(data.map(r => r.model_id))
}
