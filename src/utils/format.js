// フォーマットユーティリティ (toLocaleString禁止 → 手動カンマ)

export function fmtYen(n) {
  if (n == null || n === '') return '—'
  const num = Math.round(typeof n === 'string' ? parseFloat(n) : n)
  if (isNaN(num)) return '—'
  const sign = num < 0 ? '-' : ''
  return '¥' + sign + String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function fmtNum(n) {
  if (n == null || n === '') return '—'
  const num = Math.round(typeof n === 'string' ? parseFloat(n) : n)
  if (isNaN(num)) return '—'
  const sign = num < 0 ? '-' : ''
  return sign + String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function fmtDiff(n) {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + fmtNum(n)
}

export function fmtRate(n) {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}

// 過去N日分の日付オプション [{value:'YYYY-MM-DD', label:'MM/DD'}]
export function getDateOptions(count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const v = d.toISOString().slice(0, 10)
    return { value: v, label: v.slice(5).replace('-', '/') }
  })
}
