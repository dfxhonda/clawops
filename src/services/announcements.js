// SPEC-STOCK-ANNOUNCEMENTS-01: 景品案内 (prize_announcements) アクセス service。
// CLAUDE.md multi_tenant_isolation: anon クエリで organization_id フィルタ禁止 (RLS で担保)。
// LOG-SPEC-01: 失敗時は ERR-CODE 付き console.warn + null/[] return、UI には ERROR-HANDLING-V1 で表示。
import { supabase } from '../lib/supabase'

// SPEC-STOCK-ANNOUNCEMENTS-02: 詳細 bottom sheet 用に image_url / release_date / notes を追加。
// case_cost は ANNOUNCEMENTS-01 で既に含有済 (ケース合計表示用)。
const SELECT_COLS =
  'id, prize_name, supplier_id, unit_cost, case_cost, case_quantity, ' +
  'status, source_type, created_at, release_date, image_url, notes, ' +
  'favorited_by, favorite_memo, favorited_at'

function logErr(tag, err) {
  // eslint-disable-next-line no-console
  console.warn(`[${tag}]`, err?.message || String(err))
}

/**
 * 新着タブ用: prize_announcements を created_at DESC で fetch。
 * supplier 絞り込みは supplierId が null/'all' なら全件、それ以外なら eq('supplier_id', supplierId)。
 */
export async function fetchNewAnnouncements({ supplierId = null, limit = 200 } = {}) {
  let q = supabase
    .from('prize_announcements')
    .select(SELECT_COLS)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (supplierId && supplierId !== 'all') q = q.eq('supplier_id', supplierId)
  const { data, error } = await q
  if (error) { logErr('ERR-ANNOUNCE-FETCH-NEW', error); return [] }
  return data ?? []
}

/**
 * お気に入りタブ用: favorited_by が空配列でない行を favorited_at DESC で fetch。
 * 全 staff の合算 (どの staff_id でも 1 件以上含まれていればヒット)。
 */
export async function fetchFavoriteAnnouncements({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('prize_announcements')
    .select(SELECT_COLS)
    .not('favorited_by', 'eq', '{}')   // 空配列でない (PostgREST array literal)
    .order('favorited_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) { logErr('ERR-ANNOUNCE-FETCH-FAV', error); return [] }
  return data ?? []
}

/**
 * staff_id を favorited_by に追加 (重複しない) + favorite_memo 上書き + favorited_at=NOW()。
 * 既に追加済なら memo + favorited_at だけ更新。
 *
 * 競合考慮: 同時編集による配列上書きはレアケース、本 MVP では last-write-wins。
 *           将来必要なら DB 関数 (atomic array_append) 化検討。
 */
export async function addFavorite({ id, staffId, memo = null }) {
  if (!id || !staffId) return null
  // 現状の favorited_by を取得 → 追加して書き戻す。
  const { data: cur, error: e1 } = await supabase
    .from('prize_announcements')
    .select('favorited_by')
    .eq('id', id)
    .maybeSingle()
  if (e1) { logErr('ERR-ANNOUNCE-FAV-READ', e1); return null }
  const list = Array.isArray(cur?.favorited_by) ? cur.favorited_by : []
  const next = list.includes(staffId) ? list : [...list, staffId]
  const payload = {
    favorited_by: next,
    favorite_memo: memo,
    favorited_at: new Date().toISOString(),
  }
  const { data, error: e2 } = await supabase
    .from('prize_announcements')
    .update(payload)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()
  if (e2) { logErr('ERR-ANNOUNCE-FAV-WRITE', e2); return null }
  return data
}

/**
 * staff_id を favorited_by から削除。残数 0 になったら favorited_at=null。
 * favorite_memo は spec で「メモは個人に紐付かない共有メモ」扱いのため触らない。
 */
export async function removeFavorite({ id, staffId }) {
  if (!id || !staffId) return null
  const { data: cur, error: e1 } = await supabase
    .from('prize_announcements')
    .select('favorited_by, favorite_memo')
    .eq('id', id)
    .maybeSingle()
  if (e1) { logErr('ERR-ANNOUNCE-UNFAV-READ', e1); return null }
  const list = Array.isArray(cur?.favorited_by) ? cur.favorited_by : []
  const next = list.filter(s => s !== staffId)
  const payload = {
    favorited_by: next,
    favorited_at: next.length === 0 ? null : undefined,
  }
  // undefined キーは PostgREST update payload で送られないため、残数 > 0 のときは
  // favorited_at を変更しない (最後にお気に入りした人の時刻を保持)。
  if (payload.favorited_at === undefined) delete payload.favorited_at
  const { data, error: e2 } = await supabase
    .from('prize_announcements')
    .update(payload)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()
  if (e2) { logErr('ERR-ANNOUNCE-UNFAV-WRITE', e2); return null }
  return data
}

/**
 * staff_id 配列 → {staff_id: name} マップ。お気に入りタブで名前表示用。
 * 空配列の場合は空 object。
 */
export async function fetchStaffNamesMap(staffIds) {
  if (!Array.isArray(staffIds) || staffIds.length === 0) return {}
  const uniq = [...new Set(staffIds)]
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id, name')
    .in('staff_id', uniq)
  if (error) {
    logErr('ERR-ANNOUNCE-STAFF-NAMES', error)
    // staff テーブル直接 SELECT が anon で許可されない場合は staff_public ビューにフォールバック
    const { data: pub } = await supabase
      .from('staff_public')
      .select('staff_id, name')
      .in('staff_id', uniq)
    return Object.fromEntries((pub ?? []).map(r => [r.staff_id, r.name]))
  }
  return Object.fromEntries((data ?? []).map(r => [r.staff_id, r.name]))
}

// テスト用 export
export const _SELECT_COLS = SELECT_COLS
