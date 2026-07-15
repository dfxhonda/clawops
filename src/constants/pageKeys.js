// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068): 分析ページの page_key 一元定義 + 利用ソート定数。
// 将来の権限マトリクス page_key と同一規約で共用 (F3)。

export const PAGE_KEY = {
  FORECAST:            'forecast',
  BOOTH_RANKING:       'booth_ranking',
  PAYOUT_TREND:        'payout_trend',
  DMA7:                'dma7',
  PRIZE_COST_RECOVERY: 'prize_cost_recovery',
  STORE_COMPARE:       'store_compare',
  PROFIT_CALENDAR:     'profit_calendar',
  COLLECTION_EXPORT:   'collection_export',
}

// score = view_count + total_seconds / USAGE_SECONDS_PER_CLICK (1分の滞在 = 1クリック相当)。将来調整はここ1箇所。
export const USAGE_SECONDS_PER_CLICK = 60
// 1回の滞在秒 加算上限 (放置タブ対策)。
export const USAGE_DWELL_CLIP_SECONDS = 600
