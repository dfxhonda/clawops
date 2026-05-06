/**
 * DateTime — 日時表示の共通コンポーネント (F-6 仕様)
 *
 * format:
 *   "full"     → 「M/D(曜) HH:MM」  例: 5/5(火) 22:30
 *   "date"     → 「M/D(曜)」         例: 5/5(火)
 *   "short"    → 「M/D」             例: 5/5
 *   "time"     → 「HH:MM」           例: 22:30
 *   "datetime" → 「M/D HH:MM」       例: 5/5 22:30
 *
 * タイムゾーン: 常に Asia/Tokyo
 */
export default function DateTime({ value, format = 'full', className }) {
  if (!value) return null

  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return null

  const JST = 'Asia/Tokyo'
  let text

  if (format === 'date') {
    text = d.toLocaleDateString('ja-JP', { timeZone: JST, month: 'numeric', day: 'numeric', weekday: 'short' })
  } else if (format === 'short') {
    text = d.toLocaleDateString('ja-JP', { timeZone: JST, month: 'numeric', day: 'numeric' })
  } else if (format === 'time') {
    text = d.toLocaleTimeString('ja-JP', { timeZone: JST, hour: '2-digit', minute: '2-digit' })
  } else if (format === 'datetime') {
    const datePart = d.toLocaleDateString('ja-JP', { timeZone: JST, month: 'numeric', day: 'numeric' })
    const timePart = d.toLocaleTimeString('ja-JP', { timeZone: JST, hour: '2-digit', minute: '2-digit' })
    text = `${datePart} ${timePart}`
  } else {
    // full
    const datePart = d.toLocaleDateString('ja-JP', { timeZone: JST, month: 'numeric', day: 'numeric', weekday: 'short' })
    const timePart = d.toLocaleTimeString('ja-JP', { timeZone: JST, hour: '2-digit', minute: '2-digit' })
    text = `${datePart} ${timePart}`
  }

  return <span className={className}>{text}</span>
}
