// ============================================
// prizeMasterSearch: 景品名インクリメンタル検索
// INC-005: SELECT列は仕様書の上流クエリと一致させる
// ============================================
import { supabase } from '../lib/supabase'

/**
 * 景品名・読み・エイリアス・略称でインクリメンタル検索
 * RLS で organization_id 自動絞り — anon 側でフィルタ禁止
 *
 * @param {string} keyword - 検索キーワード (2文字未満は空配列を返す)
 * @returns {Promise<Array<{prize_id, prize_name, prize_name_kana, aliases, short_name, original_cost, latest_order_date}>>}
 *
 * 並び順: 納期(=最終発注日 latest_order_date)の新しい順。
 *   ※ prize_masters の expected_date(納品予定日)は現状全件null運用のため、
 *     実データで意味のある「納期新しい順」= latest_order_date desc を採用 (nulls last)。
 */
export async function searchPrizeMasters(keyword) {
  if (!keyword || keyword.trim().length < 2) return []
  const kw = keyword.trim()
  const { data, error } = await supabase
    .from('prize_masters')
    .select('prize_id, prize_name, prize_name_kana, aliases, short_name, original_cost, latest_order_date')
    .eq('status', 'active')
    .or(
      `prize_name.ilike.%${kw}%,` +
      `prize_name_kana.ilike.%${kw}%,` +
      `aliases.ilike.%${kw}%,` +
      `short_name.ilike.%${kw}%`,
    )
    .order('latest_order_date', { ascending: false, nullsFirst: false })
    .limit(10)
  if (error) return []
  return data ?? []
}
