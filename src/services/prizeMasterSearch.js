// ============================================
// prizeMasterSearch: 景品名インクリメンタル検索
// INC-005: SELECT列は仕様書の上流クエリと一致させる
// ============================================
import { supabase } from '../lib/supabase'

/**
 * 景品名・読み・エイリアス・略称でインクリメンタル検索
 * RLS で organization_id 自動絞り — anon 側でフィルタ禁止
 *
 * @param {string} keyword - 検索キーワード (3文字未満は空配列を返す)
 * @returns {Promise<Array<{prize_id, prize_name, prize_name_kana, aliases, short_name, original_cost}>>}
 */
export async function searchPrizeMasters(keyword) {
  if (!keyword || keyword.trim().length < 3) return []
  const kw = keyword.trim()
  const { data, error } = await supabase
    .from('prize_masters')
    .select('prize_id, prize_name, prize_name_kana, aliases, short_name, original_cost')
    .eq('status', 'active')
    .or(
      `prize_name.ilike.%${kw}%,` +
      `prize_name_kana.ilike.%${kw}%,` +
      `aliases.ilike.%${kw}%,` +
      `short_name.ilike.%${kw}%`,
    )
    .limit(10)
  if (error) return []
  return data ?? []
}
