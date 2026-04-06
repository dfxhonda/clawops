// ============================================
// daily_booth_stats サービス層
// ============================================
import { supabase } from '../lib/supabase'

/**
 * 期間内の日次集計を取得（booth/machine 情報付き）
 * @returns {Array<{ booth_code, store_code, stat_date, play_count, prize_out_count, revenue, payout_rate, meter_in_start, meter_in_end, meter_out_start, meter_out_end, notes }>}
 */
export async function getDailyBoothStats({ storeId, dateFrom, dateTo }) {
  let query = supabase
    .from('daily_booth_stats')
    .select('*')
    .order('stat_date', { ascending: false })

  if (storeId) query = query.eq('store_code', storeId)
  if (dateFrom) query = query.gte('stat_date', dateFrom)
  if (dateTo) query = query.lte('stat_date', dateTo)

  const { data, error } = await query
  if (error) throw new Error('daily_booth_stats取得エラー: ' + error.message)
  return data || []
}

/**
 * 任意日付の集計を手動実行
 * @param {string} targetDate - 'YYYY-MM-DD'
 * @returns {{ count: number }}
 */
export async function triggerDailyStatsCompute(targetDate) {
  const { data, error } = await supabase.rpc('compute_daily_booth_stats', {
    target_date: targetDate,
  })
  if (error) throw new Error('集計実行エラー: ' + error.message)
  return { count: data ?? 0 }
}
