// SPEC-CASH-RECONCILE-PAGE-01 (D-067): 集金額照合の純計算 + 表示分岐ヘルパー (UI/service で共有、vitest 可能)。

// 金種 額面 (円)。上から 10000..1。denominations jsonb は { "<額面>": 枚数 } で保持。
export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1]

const num = v => (v === '' || v == null ? 0 : Number(v) || 0)

/** 1 金種の小計 = 額面 × 枚数 */
export function denomSubtotal(unit, count) {
  return unit * num(count)
}

/** 手持ち合計 = Σ(額面 × 枚数) */
export function cashTotal(denominations) {
  return DENOMINATIONS.reduce((s, u) => s + u * num(denominations?.[u]), 0)
}

/** 選択集金の総計 = Σ total */
export function collectionsTotal(picked) {
  return (picked ?? []).reduce((s, c) => s + num(c?.total), 0)
}

/** 調整合計 = Σ amount (負値可) */
export function adjustmentsTotal(adjustments) {
  return (adjustments ?? []).reduce((s, a) => s + num(a?.amount), 0)
}

/** 差額 = 手持ち - (集金総計 + 調整合計)。0=一致、+=余剰、-=不足。 */
export function reconcileDifference(cash, collections, adjustments) {
  return num(cash) - (num(collections) + num(adjustments))
}

// ── 表示・権限分岐 (F3) ─────────────────────────────────────
/** manager/admin は全件閲覧可、それ以外は本人のみ。 */
export function canManageAll(staffRole) {
  return staffRole === 'admin' || staffRole === 'manager'
}

/** role に応じた閲覧可能行の絞り込み (アプリ層フィルタ)。 */
export function visibleReconciliations(rows, staffRole, staffId) {
  const list = rows ?? []
  return canManageAll(staffRole) ? list : list.filter(r => r?.created_by === staffId)
}

/** 削除ボタンは本人の行のみ。 */
export function canDeleteReconciliation(row, staffId) {
  return !!staffId && row?.created_by === staffId
}
