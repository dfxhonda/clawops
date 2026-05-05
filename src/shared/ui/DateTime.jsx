/**
 * DateTime — 日時表示の共通コンポーネント (F-6 仕様)
 *
 * format:
 *   "full" → 「M/D(曜) HH:MM」
 *   "date" → 「M/D(曜)」
 *   "time" → 「HH:MM」
 *
 * タイムゾーン: 常に Asia/Tokyo
 */
export default function DateTime({ value, format = 'full', className }) {
  if (!value) return null

  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return null

  let text
  if (format === 'date') {
    text = d.toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
  } else if (format === 'time') {
    text = d.toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    })
  } else {
    // full
    const datePart = d.toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
    const timePart = d.toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    })
    text = `${datePart} ${timePart}`
  }

  return <span className={className}>{text}</span>
}
