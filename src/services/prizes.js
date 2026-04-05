// ============================================
// 景品マスター・発注 (prize_masters, prize_orders)
// ============================================
import { supabase } from '../lib/supabase'
import { getCache, setCache, clearCache, supName, SUPPLIER_MAP } from './utils'
import { writeAuditLog } from './audit'

export async function getPrizes() {
  if (getCache('prizes')) return getCache('prizes')
  const { data, error } = await supabase.from('prize_masters').select('*').order('prize_id')
  if (error) throw new Error('景品取得エラー: ' + error.message)
  const result = (data || []).map(r => ({
    _id: r.prize_id,
    prize_id: r.prize_id, prize_name: r.prize_name, jan_code: r.jan_code || '',
    barcode_value: r.jan_code || '', unit_cost: String(r.original_cost || '0'),
    supplier_name: supName(r.supplier_id), supplier_id: r.supplier_id || '',
    supplier_contact: '', is_active: r.status === 'active' ? 'TRUE' : 'FALSE',
    created_at: r.created_at || '', updated_at: r.updated_at || '',
    short_name: r.prize_name || '', item_size: r.size || '', category: r.category || '',
    order_at: r.order_date || '', arrival_at: r.expected_date || '',
    restock_count: '', stock_count: '',
    case_count: '', pieces_per_case: String(r.default_case_quantity || ''),
    aliases: r.aliases || '', notes: r.notes || '',
  }))
  setCache('prizes', result)
  return result
}

export async function addPrize(p) {
  const supEntry = Object.entries(SUPPLIER_MAP).find(([, v]) => v === p.supplier_name)
  const supId = supEntry ? supEntry[0] : p.supplier_id || null
  const { data, error } = await supabase.from('prize_masters').insert({
    prize_id: p.prize_id || undefined,
    prize_name: p.prize_name,
    original_cost: parseInt(p.unit_cost) || 0,
    supplier_id: supId,
    supplier_name: p.supplier_name || null,
    jan_code: p.jan_code || null,
    category: p.category || null,
    size: p.item_size || null,
    default_case_quantity: parseInt(p.pieces_per_case) || null,
    status: p.is_active === 'FALSE' ? 'inactive' : 'active',
    notes: p.notes || null,
  }).select().single()
  if (error) throw new Error('景品登録エラー: ' + error.message)
  clearCache()

  writeAuditLog({
    action: 'master_create',
    target_table: 'prize_masters',
    target_id: data.prize_id,
    detail: `景品登録: ${p.prize_name}`,
    staff_id: p.created_by || '',
  })

  return data.prize_id
}

export async function getPrizeOrders() {
  if (getCache('prize_orders')) return getCache('prize_orders')
  const { data, error } = await supabase.from('prize_orders').select('*').order('order_date', { ascending: false })
  if (error) throw new Error('発注取得エラー: ' + error.message)
  const result = (data || []).map(r => ({
    _id: r.order_id,
    order_id: r.order_id, prize_id: r.prize_id || '', prize_name: r.prize_name_raw || '',
    ordered_at: r.order_date || '', order_quantity: String(r.case_quantity || ''),
    arrived_at: r.arrived_at || '', arrival_quantity: String(r.received_quantity || ''),
    unit_cost_at_order: String(r.unit_cost || '0'),
    total_cost: String((r.unit_cost || 0) * (r.case_quantity || 0)),
    note: r.notes || '', created_at: r.created_at || '',
    supplier_name: supName(r.supplier_id),
    status: r.status || '',
    case_count: String(r.case_count || ''),
    case_cost: String(r.case_cost || ''),
    expected_date: r.expected_date || '',
    destination: r.destination || '',
  }))
  setCache('prize_orders', result)
  return result
}

export async function markOrderArrived(orderId, arrivedQuantity, staffId) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('prize_orders').update({
    arrived_at: now,
    received_quantity: arrivedQuantity,
    status: 'arrived',
  }).eq('order_id', orderId)
  if (error) throw new Error('入荷更新エラー: ' + error.message)
  clearCache()

  writeAuditLog({
    action: 'order_arrived',
    target_table: 'prize_orders',
    target_id: orderId,
    detail: `入荷確認: ${arrivedQuantity}個`,
    staff_id: staffId || undefined,
  })
}
