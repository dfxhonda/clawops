// ============================================
// メーター読み値 (meter_readings)
// ============================================
import { supabase } from '../lib/supabase'
import { parseNum, getCache, setCache, clearCache, isOldEnough } from './utils'
import { writeAuditLog } from './audit'

export async function getAllMeterReadings(forceRefresh = false) {
  if (!forceRefresh && getCache('meter_readings')) return getCache('meter_readings')
  const pageSize = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('meter_readings')
      .select('*')
      .order('read_time', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) { console.error('meter_readings取得エラー:', error.message); return [] }
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const result = all.map(r => ({
    reading_id: r.reading_id,
    booth_id: r.booth_id || '',
    full_booth_code: r.full_booth_code || '',
    read_time: r.read_time || '',
    in_meter: r.in_meter != null ? String(r.in_meter) : '',
    out_meter: r.out_meter != null ? String(r.out_meter) : '',
    prize_restock_count: r.prize_restock_count != null ? String(r.prize_restock_count) : '',
    prize_stock_count: r.prize_stock_count != null ? String(r.prize_stock_count) : '',
    prize_name: r.prize_name || '',
    set_a: r.set_a || '', set_c: r.set_c || '', set_l: r.set_l || '',
    set_r: r.set_r || '', set_o: r.set_o || '',
    note: r.note || '', source: r.source || 'manual',
  }))
  setCache('meter_readings', result)
  return result
}

export async function getLastReadingsMap(boothIds) {
  const all = await getAllMeterReadings()
  const map = {}
  for (const id of boothIds) {
    const rows = all.filter(r => String(r.booth_id) === String(id))
    const latest = rows.length ? rows[rows.length - 1] : null
    const last = [...rows].reverse().find(r => isOldEnough(r.read_time)) || null
    map[id] = { latest, last }
  }
  return map
}

export async function getStaffMap() {
  if (getCache('staff_map')) return getCache('staff_map')
  const { data, error } = await supabase.from('staff_public').select('staff_id, name').eq('is_active', true)
  if (error) { console.error('staff取得エラー:', error.message); return {} }
  const map = Object.fromEntries(data.map(s => [s.staff_id, s.name]))
  setCache('staff_map', map)
  return map
}

export async function saveReading(r) {
  const now = r.read_date ? new Date(r.read_date + "T12:00:00").toISOString() : new Date().toISOString()
  const { error } = await supabase.from('meter_readings').insert({
    booth_id: r.booth_id,
    full_booth_code: r.full_booth_code || null,
    read_time: now,
    in_meter: r.in_meter ? parseFloat(r.in_meter) : null,
    out_meter: r.out_meter ? parseFloat(r.out_meter) : null,
    prize_restock_count: parseInt(r.prize_restock_count) || 0,
    prize_stock_count: parseInt(r.prize_stock_count) || 0,
    prize_name: r.prize_name || null,
    set_a: r.set_a || null, set_c: r.set_c || null, set_l: r.set_l || null,
    set_r: r.set_r || null, set_o: r.set_o || null,
    note: r.note || null,
    source: r.source || (r.input_method === 'ocr' ? 'ocr' : 'manual'),
    input_method: r.input_method || 'manual',
    ocr_confidence: r.ocr_confidence != null ? parseFloat(r.ocr_confidence) : null,
    created_at: now,
    created_by: r.created_by || null,
  })
  if (error) throw new Error('メーター保存エラー: ' + error.message)
  clearCache()
  writeAuditLog({
    action: 'reading_create',
    target_table: 'meter_readings',
    target_id: r.booth_id,
    detail: `メーター入力: IN=${r.in_meter || '-'} OUT=${r.out_meter || '-'} (${r.full_booth_code || r.booth_id})${r.input_method === 'ocr' ? ` [OCR: ${r.ocr_confidence != null ? (r.ocr_confidence * 100).toFixed(0) + '%' : '-'}]` : ''}`,
    staff_id: r.created_by || undefined,
  })
}

export async function updateReading(readingId, r, { before, reason, reason_code, reason_note } = {}) {
  const { error } = await supabase.from('meter_readings').update({
    in_meter: r.in_meter ? parseFloat(r.in_meter) : null,
    out_meter: r.out_meter ? parseFloat(r.out_meter) : null,
    prize_restock_count: parseInt(r.prize_restock_count) || 0,
    prize_stock_count: parseInt(r.prize_stock_count) || 0,
    prize_name: r.prize_name || null,
  }).eq('reading_id', readingId)
  if (error) throw new Error('メーター更新エラー: ' + error.message)
  clearCache()
  const parts = [`メーター修正:`]
  if (before) {
    parts.push(`IN: ${before.in_meter || '-'}→${r.in_meter || '-'}`)
    parts.push(`OUT: ${before.out_meter || '-'}→${r.out_meter || '-'}`)
  } else {
    parts.push(`IN=${r.in_meter || '-'} OUT=${r.out_meter || '-'}`)
  }
  if (reason) parts.push(`理由: ${reason}`)
  writeAuditLog({
    action: 'reading_update',
    target_table: 'meter_readings',
    target_id: readingId,
    detail: parts.join(' '),
    before_data: before ? { in_meter: before.in_meter, out_meter: before.out_meter, prize_name: before.prize_name } : undefined,
    after_data: { in_meter: r.in_meter, out_meter: r.out_meter, prize_name: r.prize_name },
    reason: reason || undefined,
    reason_code: reason_code || undefined,
    reason_note: reason_note || undefined,
  })
}
