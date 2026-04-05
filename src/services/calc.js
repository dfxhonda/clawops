// ============================================
// ビジネスロジック純粋関数（テスト容易）
// 画面から切り出した計算・差分・在庫・権限判定
// ============================================

/**
 * 売上計算: IN差分 × 単価
 */
export function calcSales(currentIn, previousIn, playPrice = 100) {
  const diff = (currentIn || 0) - (previousIn || 0)
  if (diff < 0 || !Number.isFinite(diff)) return 0
  return diff * playPrice
}

/**
 * 出率計算: OUT差分 / IN差分
 */
export function calcPayoutRate(currentIn, previousIn, currentOut, previousOut) {
  const inDiff = (currentIn || 0) - (previousIn || 0)
  const outDiff = (currentOut || 0) - (previousOut || 0)
  if (inDiff <= 0) return 0
  return outDiff / inDiff
}

/**
 * メーター差分（桁あふれ対応）
 * 例: 7桁メーターで 9999990 → 30 の場合、差分は 40
 */
export function calcMeterDiff(current, previous, digitCount = 7) {
  if (current == null || previous == null) return null
  const c = Number(current)
  const p = Number(previous)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null
  let diff = c - p
  if (diff < 0) {
    // 桁あふれ: maxValue + 差分
    const maxValue = Math.pow(10, digitCount)
    diff = maxValue + diff
  }
  return diff
}

/**
 * 在庫移動の検証
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTransfer({ fromQuantity, transferQuantity }) {
  const qty = parseInt(transferQuantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    return { valid: false, error: '移動数量は1以上の整数で入力してください' }
  }
  if (fromQuantity < qty) {
    return { valid: false, error: `在庫不足: 現在${fromQuantity}個、移動要求${qty}個` }
  }
  return { valid: true }
}

/**
 * 棚卸し差分判定
 * @returns {{ status: 'match' | 'shortage' | 'excess', diff: number }}
 */
export function checkInventoryDiff(theoreticalQty, actualQty) {
  const diff = actualQty - theoreticalQty
  if (diff === 0) return { status: 'match', diff: 0 }
  if (diff < 0) return { status: 'shortage', diff }
  return { status: 'excess', diff }
}

/**
 * ロール権限チェック
 * ROLE_HIERARCHY: admin > manager > patrol > staff
 */
const ROLE_HIERARCHY = { admin: 4, manager: 3, patrol: 2, staff: 1 }

export function hasRequiredRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0)
}

/**
 * 二重送信防止: 前回送信からの経過時間チェック
 */
export function isDuplicateSubmission(lastSubmitTime, cooldownMs = 3000) {
  if (!lastSubmitTime) return false
  return Date.now() - lastSubmitTime < cooldownMs
}

/**
 * 当日判定: ISO文字列が今日の日付で始まるか
 * @param {string} isoString - ISO 8601 日付時刻文字列
 * @param {string} [today] - 比較対象の日付（テスト用）YYYY-MM-DD形式
 */
export function isToday(isoString, today) {
  if (!isoString) return false
  const t = today || new Date().toISOString().slice(0, 10)
  return isoString.startsWith(t)
}

/**
 * 棚卸しダッシュボード用の集計
 * @param {{ locations: any[], stocks: any[], movements: any[] }} data
 * @returns {object} 集計結果
 */
export function calcInventoryStats({ locations, stocks, movements }) {
  const staffStocks = stocks.filter(s => s.owner_type === 'staff')
  const locStocks   = stocks.filter(s => s.owner_type === 'location')
  const today       = new Date().toISOString().slice(0, 10)
  const todayMoves  = movements.filter(m => isToday(m.created_at, today))

  return {
    locationCount:    locations.filter(l => !l.parent_location_id).length,
    subLocationCount: locations.filter(l =>  l.parent_location_id).length,
    staffStockItems:  staffStocks.length,
    staffStockTotal:  staffStocks.reduce((s, x) => s + (x.quantity || 0), 0),
    locStockItems:    locStocks.length,
    locStockTotal:    locStocks.reduce((s, x) => s + (x.quantity || 0), 0),
    todayMovements:   todayMoves.length,
    totalMovements:   movements.length,
  }
}
