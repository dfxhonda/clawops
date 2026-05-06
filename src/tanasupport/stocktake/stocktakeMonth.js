/**
 * 棚卸しセッションの「対象月」締切（その月の末日 23:59:59.999 JST）を過ぎたら true。
 * @param {string} monthStr stocktake_sessions.month ('YYYY-MM-01')
 */
export function isPastMonthEndJst(monthStr) {
  if (!monthStr) return false
  const part = monthStr.slice(0, 10)
  const [y, m] = part.split('-').map(Number)
  if (!y || !m) return false
  const lastDay = new Date(y, m, 0).getDate()
  const pad = n => String(n).padStart(2, '0')
  const deadlineMs = new Date(`${y}-${pad(m)}-${pad(lastDay)}T23:59:59.999+09:00`).getTime()
  return Date.now() > deadlineMs
}
