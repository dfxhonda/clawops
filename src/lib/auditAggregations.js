// ============================================
// 監査ログ集計 — 純粋関数群
// React なし・副作用なし → 単体テスト可
// ============================================

/**
 * 4指標の総件数を集計
 * @param {Array} logs - audit_logs の配列
 * @returns {{ stock_count_adjust: number, input_fix: number, stock_transfer: number, order_arrived: number }}
 */
export function aggregateByMetric(logs) {
  const result = { stock_count_adjust: 0, input_fix: 0, stock_transfer: 0, order_arrived: 0 }
  for (const log of logs) {
    if (log.action === 'stock_count_adjust') result.stock_count_adjust++
    if (log.reason_code === 'INPUT_FIX') result.input_fix++
    if (log.action === 'stock_transfer') result.stock_transfer++
    if (log.action === 'order_arrived') result.order_arrived++
  }
  return result
}

/**
 * 月別集計
 * @param {Array} logs
 * @returns {Object} { 'YYYY-MM': { stock_count_adjust, input_fix, stock_transfer, order_arrived } }
 */
export function aggregateByMonth(logs) {
  const result = {}
  for (const log of logs) {
    const month = (log.created_at || '').substring(0, 7)
    if (!month) continue
    if (!result[month]) result[month] = { stock_count_adjust: 0, input_fix: 0, stock_transfer: 0, order_arrived: 0 }
    const m = result[month]
    if (log.action === 'stock_count_adjust') m.stock_count_adjust++
    if (log.reason_code === 'INPUT_FIX') m.input_fix++
    if (log.action === 'stock_transfer') m.stock_transfer++
    if (log.action === 'order_arrived') m.order_arrived++
  }
  return result
}

/**
 * 担当者別集計（total降順）
 * @param {Array} logs
 * @param {Object} staffMap - { staff_id: name }
 * @returns {Array} [{ staffId, name, counts: {...}, total }, ...]
 */
export function aggregateByStaff(logs, staffMap = {}) {
  const map = {}
  for (const log of logs) {
    const id = log.staff_id || 'unknown'
    if (!map[id]) map[id] = { staffId: id, name: staffMap[id] || id, counts: { stock_count_adjust: 0, input_fix: 0, stock_transfer: 0, order_arrived: 0 }, total: 0 }
    const c = map[id].counts
    if (log.action === 'stock_count_adjust') { c.stock_count_adjust++; map[id].total++ }
    if (log.reason_code === 'INPUT_FIX') { c.input_fix++; map[id].total++ }
    if (log.action === 'stock_transfer') { c.stock_transfer++; map[id].total++ }
    if (log.action === 'order_arrived') { c.order_arrived++; map[id].total++ }
  }
  return Object.values(map).sort((a, b) => b.total - a.total)
}

const LOCATION_RE = /location\/([A-Za-z0-9_-]+)/g

/**
 * 拠点別集計（stock_transfer のみ、detail の location/ をパース）
 * @param {Array} logs
 * @param {Object} locationMap - { location_id: name }
 * @returns {Array} [{ locationId, name, transfer: N }, ...] ※ "拠点不明" バケット含む
 */
export function aggregateByLocation(logs, locationMap = {}) {
  const map = {}

  function bucket(locationId) {
    if (!map[locationId]) {
      map[locationId] = {
        locationId,
        name: locationId === '拠点不明' ? '拠点不明' : (locationMap[locationId] || locationId),
        transfer: 0,
      }
    }
    return map[locationId]
  }

  for (const log of logs) {
    if (log.action !== 'stock_transfer') continue
    const detail = log.detail || ''
    LOCATION_RE.lastIndex = 0
    const matches = [...detail.matchAll(LOCATION_RE)]
    if (matches.length === 0) {
      bucket('拠点不明').transfer++
    } else {
      for (const m of matches) {
        bucket(m[1]).transfer++
      }
    }
  }

  return Object.values(map).sort((a, b) => b.transfer - a.transfer)
}
