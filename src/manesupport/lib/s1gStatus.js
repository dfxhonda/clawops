// SPEC-S1G-DONKI-DEADLINE-ALERT-01: donki_tenant 締日 (毎月20日 JST) アラート
//
// 本番の唯一の真実は SQL 側 fn_forecast_store_list.s1g_status (RPC が返す row.s1g_status)。
// UI はその値を s1gBadge() で badge に変換するだけ (再計算しない — UI は
// store_forecast_settings.next_collection_date の生値を持たないため recompute 不可)。
//
// deriveS1gStatus は上記 SQL 導出の JS ミラー。AC3 (導出マトリクスの simulated-date 単体テスト)
// 用の参照実装であり、SQL とロジックを一致させて回帰を検知する。
// 日付は JST 'YYYY-MM-DD' 文字列で辞書順比較 (ISO date は文字列比較で正しく順序化)。

/**
 * @param {object} p
 * @param {string|null} p.storeType             stores.store_type
 * @param {string|null} p.lastReadingDate       最終メーター日 (null=休眠, 絶対にアラートしない)
 * @param {string|null} p.nextCollectionDate    store_forecast_settings.next_collection_date (集金計画)
 * @param {boolean}     p.doneThisMonth         当月 JST に cash_collections 実績あり
 * @param {string}      p.today                  JST 'YYYY-MM-DD'
 * @returns {'done'|'overdue'|'planned'|'unplanned'|null}
 */
export function deriveS1gStatus({ storeType, lastReadingDate, nextCollectionDate, doneThisMonth, today }) {
  if (storeType !== 'donki_tenant' || !lastReadingDate) return null
  if (doneThisMonth) return 'done'
  const twentieth = today.slice(0, 7) + '-20'
  if (today > twentieth) return 'overdue'
  if (nextCollectionDate && nextCollectionDate <= twentieth) return 'planned'
  return 'unplanned'
}

/**
 * s1g_status を forecast list の badge 表示に変換。
 * アラート対象 (unplanned/overdue) のみ badge を返し、それ以外 (done/planned/null) は silent。
 * 色は DESIGN-TOKENS の semantic token (--color-warning / --color-danger) のみ使用、raw hex なし。
 * @param {string|null} status
 * @returns {{ text: string, cls: string }|null}
 */
export function s1gBadge(status) {
  if (status === 'unplanned') return { text: '予定なし', cls: 'bg-warning/15 text-warning' }
  if (status === 'overdue') return { text: '締日超過', cls: 'bg-danger/15 text-danger-text' }
  return null
}
