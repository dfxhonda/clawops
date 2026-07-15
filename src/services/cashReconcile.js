// SPEC-CASH-RECONCILE-PAGE-01 (D-067): cash_reconciliations の保存/一覧/削除 + 集金ピック読み。
// cash_collections / meter_readings への書き込みは一切しない (ど安定ver 不触)。
import { supabase } from '../lib/supabase'
import { CHANGE_ORG_ID } from '../lib/auth/orgConstants'
import { canManageAll } from '../collection/lib/cashReconcileCalc'

/**
 * 集金ピック用: 店舗フィルタ + 新しい順 + limit (全件fetch禁止)。
 * 返り値行: { collection_id, store_code, store_name, collected_at, status, total }
 */
export async function listRecentCollectionsForReconcile({ storeCode = null, limit = 50 } = {}) {
  let q = supabase
    .from('cash_collections')
    .select('collection_id, store_code, collected_at, status')
    .order('collected_at', { ascending: false })
    .limit(limit)
  if (storeCode) q = q.eq('store_code', storeCode)
  const { data: cols, error } = await q
  if (error || !cols?.length) return []

  const codes = [...new Set(cols.map(c => c.store_code))]
  const ids = cols.map(c => c.collection_id)
  const [{ data: stores }, { data: booths }] = await Promise.all([
    supabase.from('stores').select('store_code, store_name').in('store_code', codes),
    supabase.from('cash_collection_booths').select('collection_id, total').in('collection_id', ids),
  ])
  const nameMap = Object.fromEntries((stores ?? []).map(s => [s.store_code, s.store_name]))
  const totalMap = {}
  for (const b of booths ?? []) totalMap[b.collection_id] = (totalMap[b.collection_id] ?? 0) + Number(b.total || 0)

  return cols.map(c => ({
    ...c,
    store_name: nameMap[c.store_code] ?? c.store_code,
    total: totalMap[c.collection_id] ?? 0,
  }))
}

/**
 * 照合保存。organization_id は CHANGE、created_by=ログイン staff_id。何度でも保存可。
 */
export async function insertReconciliation({
  denominations, cashTotal, collectionIds, collectionsTotal,
  adjustments, adjustmentsTotal, difference, note, staffId,
}) {
  const payload = {
    organization_id:   CHANGE_ORG_ID,
    denominations:     denominations ?? {},
    cash_total:        Number(cashTotal) || 0,
    collection_ids:    collectionIds ?? [],
    collections_total: Number(collectionsTotal) || 0,
    adjustments:       adjustments ?? [],
    adjustments_total: Number(adjustmentsTotal) || 0,
    difference:        Number(difference) || 0,
    note:              note || null,
    created_by:        staffId,
  }
  const { data, error } = await supabase
    .from('cash_reconciliations')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

const RECON_SELECT =
  'reconciliation_id, denominations, cash_total, collection_ids, collections_total, ' +
  'adjustments, adjustments_total, difference, note, created_by, created_at'

/**
 * 一覧。manager/admin=全件、それ以外=本人のみ (アプリ層絞り、RLS は authenticated 型)。
 * 各行に created_by_name (作成者名) を付与。新しい順。
 */
export async function listReconciliations({ staffRole, staffId }) {
  let q = supabase.from('cash_reconciliations').select(RECON_SELECT).order('created_at', { ascending: false })
  if (!canManageAll(staffRole)) q = q.eq('created_by', staffId)
  const { data: rows, error } = await q
  if (error || !rows?.length) return []

  const staffIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))]
  const { data: staff } = await supabase.from('staff_public').select('staff_id, name').in('staff_id', staffIds)
  const nameMap = Object.fromEntries((staff ?? []).map(s => [s.staff_id, s.name]))
  return rows.map(r => ({ ...r, created_by_name: nameMap[r.created_by] ?? r.created_by }))
}

/** 削除 (本人の行のみ UI で許可、RLS も担保)。 */
export async function deleteReconciliation(reconciliationId) {
  const { error } = await supabase.from('cash_reconciliations').delete().eq('reconciliation_id', reconciliationId)
  if (error) throw error
}
