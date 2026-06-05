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
 * @returns {Promise<Array<{prize_id, prize_name, aliases, short_name, original_cost, latest_order_date}>>}
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
    .select('prize_id, prize_name, short_name, original_cost, latest_order_date')
    // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status='active' → phase!='dead' (廃番のみ除外)
    .neq('phase', 'dead')
    .or(
      `prize_name.ilike.%${kw}%,` +
      `short_name.ilike.%${kw}%`,
    )
    .order('latest_order_date', { ascending: false, nullsFirst: false })
    // SPEC-PATROL-PRIZE-SUGGEST-01: 旧 .limit(10) 削除。フィルター結果を全件返し、
    // 画面側 PrizeNameAutocomplete の max-h-[240px] + overflow-y-auto でスクロール表示。
    // .or() の 4 列 ilike フィルタは spec forbidden_to_touch、絞り込みは入力文字数を増やす運用。
  if (error) return []
  return data ?? []
}
