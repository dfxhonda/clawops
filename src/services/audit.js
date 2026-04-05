// ============================================
// 監査ログ (audit_logs)
// 「誰が・いつ・何を・どう変えたか」を記録
// ============================================
import { supabase } from '../lib/supabase'
import { getAuthSession, extractMeta } from '../lib/auth/session'

/**
 * 監査ログを書き込む
 * @param {object} entry
 * @param {string} entry.action - 操作種別
 * @param {string} entry.target_table - 対象テーブル名
 * @param {string} [entry.target_id] - 対象レコードID
 * @param {string} entry.detail - 変更内容の説明
 * @param {string} [entry.staff_id] - 操作者のstaff_id（省略時はセッションから取得）
 * @param {object} [entry.before_data] - 変更前の値（構造化JSON）
 * @param {object} [entry.after_data] - 変更後の値（構造化JSON）
 * @param {string} [entry.reason] - 変更理由
 */
export async function writeAuditLog(entry) {
  let staffId = entry.staff_id
  if (!staffId) {
    const session = await getAuthSession()
    staffId = extractMeta(session).staffId || 'unknown'
  }
  try {
    await supabase.from('audit_logs').insert({
      staff_id: staffId,
      action: entry.action,
      target_table: entry.target_table || '',
      target_id: entry.target_id || '',
      detail: entry.detail || '',
      before_data: entry.before_data || null,
      after_data: entry.after_data || null,
      reason: entry.reason || null,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // 監査ログの書き込み失敗は本体処理を止めない
    console.warn('監査ログ書き込み失敗:', err.message)
  }
}
