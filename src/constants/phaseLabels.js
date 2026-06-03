// SPEC-PHASE-LABEL-FIX-01: prize_masters.phase 表示名 / バッジ色 / フィルター選択肢を集約。
// DB の実在値は active / provisional / yobigun / dead の 4 種のみ
// (commander spec の db_facts_verified 参照、normal/out_of_stock/discontinued/retired は 0 件のハードコード遺産)。
// provisional と yobigun は表示名「入荷予定」に統一するが、フィルター値は別々のまま (DB 値は変更しない)。

// 内部 phase 値 → 日本語ラベル
export const PHASE_LABEL_MAP = Object.freeze({
  active: '稼働中',
  provisional: '入荷予定',
  yobigun: '入荷予定',
  dead: '廃番',
})

// 未知 / null / 未マップ値の fallback ラベル
export const PHASE_UNKNOWN_LABEL = '不明'

// バッジの Tailwind class (リストの「ステータス」列 / 詳細 dialog 共通)
export const PHASE_BADGE_CLASS_MAP = Object.freeze({
  active:      'bg-green-600 text-white',
  provisional: 'bg-amber-600 text-white',
  yobigun:     'bg-amber-600 text-white',
  dead:        'bg-gray-600 text-gray-300',
})

export const PHASE_UNKNOWN_BADGE_CLASS = 'bg-gray-600 text-gray-300'

// AdminPrizeMasterPage の ListFilterBar / モーダル「フェーズ」セレクトで使う選択肢。
// 先頭の {value:'', label:'全て'} はフィルター用 (デフォルト = 未選択)。
// モーダル編集用に使う場合は PHASE_EDIT_OPTIONS (空 value 除外) を使う。
export const PHASE_FILTER_OPTIONS = Object.freeze([
  { value: '',            label: '全て' },
  { value: 'active',      label: '稼働中' },
  { value: 'provisional', label: '入荷予定' },
  { value: 'yobigun',     label: '入荷予定' },
  { value: 'dead',        label: '廃番' },
])

// 編集セレクト (モーダル/グリッド) で使う、'全て' を含まない値リスト
export const PHASE_EDIT_OPTIONS = Object.freeze(
  PHASE_FILTER_OPTIONS.filter(o => o.value !== '')
)

// 値 → ラベル
export function getPhaseLabel(phase) {
  if (phase == null || phase === '') return PHASE_UNKNOWN_LABEL
  return PHASE_LABEL_MAP[phase] ?? PHASE_UNKNOWN_LABEL
}

// 値 → バッジ Tailwind class
export function getPhaseBadgeClass(phase) {
  if (phase == null || phase === '') return PHASE_UNKNOWN_BADGE_CLASS
  return PHASE_BADGE_CLASS_MAP[phase] ?? PHASE_UNKNOWN_BADGE_CLASS
}
