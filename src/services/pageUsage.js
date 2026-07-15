// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068): page_usage_stats 計測 (fn_track_page_usage) + 本人 stats 読み。
import { supabase } from '../lib/supabase'

/**
 * fn_track_page_usage 累積 upsert。計測が UX を壊すの禁止 → 失敗は silent (console.warn のみ、ERR-USAGE-001)。
 */
export async function trackPageUsage({ staffId, pageKey, addViews = 0, addSeconds = 0 }) {
  if (!staffId || !pageKey) return
  try {
    const { error } = await supabase.rpc('fn_track_page_usage', {
      p_staff_id: staffId,
      p_page_key: pageKey,
      p_add_views: addViews,
      p_add_seconds: addSeconds,
    })
    if (error) throw error
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('ERR-USAGE-001 track_page_usage failed (silent):', pageKey, e?.message)
  }
}

/**
 * 本人の page_usage_stats を { [page_key]: { view_count, total_seconds } } で返す。
 * 失敗時は {} (ソートがハブ表示をブロックしない → 既定順)。
 */
export async function fetchMyPageUsage(staffId) {
  if (!staffId) return {}
  try {
    const { data, error } = await supabase
      .from('page_usage_stats')
      .select('page_key, view_count, total_seconds')
      .eq('staff_id', staffId)
    if (error) throw error
    return Object.fromEntries((data ?? []).map(r => [r.page_key, r]))
  } catch {
    return {}
  }
}
