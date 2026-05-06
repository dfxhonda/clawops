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

// ────────────────────────────────────────────────────────────────
// Stage 2 API
// ────────────────────────────────────────────────────────────────

/**
 * 機械タブ: 機械内スナップショットアイテム (owner_type='booth', READ ONLY)
 */
export async function getMachineItems(sessionId) {
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('prize_id, owner_code, theoretical_count, prize:prize_masters(prize_name)')
    .eq('session_id', sessionId)
    .eq('owner_type', 'booth')
    .order('owner_code')
    .order('prize_id')
  if (error) throw error
  return (data ?? []).map(item => ({
    prize_id:          item.prize_id,
    owner_code:        item.owner_code,
    prize_name:        item.prize?.prize_name ?? item.prize_id,
    theoretical_count: item.theoretical_count ?? 0,
  }))
}

/**
 * 個人タブ: スタッフの申告済みアイテム
 */
export async function getStaffItems(sessionId, staffId) {
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('prize_id, actual_count, prize:prize_masters(prize_name)')
    .eq('session_id', sessionId)
    .eq('owner_type', 'staff')
    .eq('owner_code', staffId)
  if (error) throw error
  return (data ?? []).map(item => ({
    prize_id:     item.prize_id,
    prize_name:   item.prize?.prize_name ?? item.prize_id,
    actual_count: item.actual_count,
  }))
}

/**
 * 個人ゼロ申告 (1タップで「個人持ち回りゼロ」を記録)
 */
export async function declareZero(sessionId, staffId) {
  const { error } = await supabase
    .from('stocktake_zero_declarations')
    .upsert(
      { session_id: sessionId, staff_id: staffId, declared_at: new Date().toISOString() },
      { onConflict: 'session_id,staff_id' }
    )
  if (error) throw error
}

/**
 * ゼロ申告の有無を返す ({ declared_at } or null)
 */
export async function getZeroDeclaration(sessionId, staffId) {
  const { data } = await supabase
    .from('stocktake_zero_declarations')
    .select('declared_at')
    .eq('session_id', sessionId)
    .eq('staff_id', staffId)
    .maybeSingle()
  return data ?? null
}

/**
 * 全社合計サマリー: { location, booth, staff } の actual_count 合計
 * booth は theoretical_count を使用 (READ ONLY スナップショット)
 */
export async function getSessionSummary(sessionId) {
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('owner_type, actual_count, theoretical_count')
    .eq('session_id', sessionId)
  if (error) throw error
  const totals = { location: 0, booth: 0, staff: 0 }
  for (const item of data ?? []) {
    if (item.owner_type === 'booth') {
      totals.booth += item.theoretical_count ?? 0
    } else {
      totals[item.owner_type] = (totals[item.owner_type] ?? 0) + (item.actual_count ?? 0)
    }
  }
  return totals
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
