// J-REPORTS-ANALYTICS-01 2026-05-30: JST 日付ユーティリティ
// CLAUDE.md JST_date_handling: toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) 必須、
// toISOString().split / .slice 禁止 (UTC変換バグ)。本ファイルで一元化。

export function todayJst() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function jstDateNDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return null
  const f = new Date(fromDate).getTime()
  const t = new Date(toDate).getTime()
  if (Number.isNaN(f) || Number.isNaN(t)) return null
  return Math.floor((t - f) / (24 * 3600 * 1000))
}

export function formatJstDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
  } catch {
    return String(iso)
  }
}

export function rangePresetDays(preset) {
  const map = { '7d': 7, '14d': 14, '30d': 30, '60d': 60 }
  return map[preset] ?? 30
}
