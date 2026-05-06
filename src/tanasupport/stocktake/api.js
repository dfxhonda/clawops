import { supabase } from '../../lib/supabase'

// M2 Stage 1 — 新スキーマ (organization_id/month/owner_type/owner_code/actual_count)
// 旧 store_code/session_name/actual_qty ベース API は全廃

const DFX_ORG_ID = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'

/**
 * 当月の棚卸しセッションを取得または新規作成
 * UNIQUE(organization_id, month) のため月1セッション固定
 */
export async function getOrCreateMonthSession(organizationId = DFX_ORG_ID) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const month = today.slice(0, 7) + '-01'

  const { data: existing } = await supabase
    .from('stocktake_sessions')
    .select('session_id, month, status')
    .eq('organization_id', organizationId)
    .eq('month', month)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('stocktake_sessions')
    .insert({ organization_id: organizationId, month, status: 'open' })
    .select('session_id, month, status')
    .single()
  if (error) throw error
  return data
}

/**
 * location_id に紐づく景品一覧を prize_stocks から取得
 */
export async function getLocationPrizes(locationId) {
  const { data, error } = await supabase
    .from('prize_stocks')
    .select('prize_id, quantity, prize:prize_masters(prize_name)')
    .eq('owner_type', 'location')
    .eq('owner_id', locationId)
    .gt('quantity', 0)
    .order('prize_id')
  if (error) throw error
  return (data ?? []).map(s => ({
    prize_id: s.prize_id,
    prize_name: s.prize?.prize_name ?? s.prize_id,
    theoretical_count: s.quantity ?? 0,
  }))
}

/**
 * セッション + オーナーの既存カウントを { prize_id → item } の Map で返す
 */
export async function getOwnerItemsMap(sessionId, ownerType, ownerCode) {
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('prize_id, actual_count, theoretical_count, variance_rate')
    .eq('session_id', sessionId)
    .eq('owner_type', ownerType)
    .eq('owner_code', ownerCode)
  if (error) throw error
  const map = {}
  for (const item of data ?? []) {
    map[item.prize_id] = item
  }
  return map
}

/**
 * 景品カウントを即時 UPSERT
 * 複合 PK: (session_id, prize_id, owner_type, owner_code)
 */
export async function upsertItem({ sessionId, prizeId, ownerType, ownerCode, actualCount, theoreticalCount, staffId }) {
  const { error } = await supabase
    .from('stocktake_items')
    .upsert(
      {
        session_id:        sessionId,
        prize_id:          prizeId,
        owner_type:        ownerType,
        owner_code:        ownerCode,
        actual_count:      actualCount,
        theoretical_count: theoreticalCount ?? null,
        recorded_by:       staffId ?? null,
        recorded_at:       new Date().toISOString(),
      },
      { onConflict: 'session_id,prize_id,owner_type,owner_code' }
    )
  if (error) throw error
}

/**
 * 倉庫ロケーション一覧 (hub 用)
 */
export async function getWarehouseLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('location_id, location_name, location_type')
    .eq('is_active', true)
    .in('location_type', ['warehouse', 'store'])
    .order('location_type', { ascending: false })
    .order('location_name')
  if (error) throw error
  return data ?? []
}

/**
 * セッション一覧 (admin 用)
 */
export async function getAllSessions(organizationId = DFX_ORG_ID) {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('session_id, month, status, created_at')
    .eq('organization_id', organizationId)
    .order('month', { ascending: false })
    .limit(24)
  if (error) throw error
  return data ?? []
}
