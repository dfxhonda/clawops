// J-COLLECTION-01: 集金の金種計算・集金ID生成 (純関数、UIとPDFで共有)

// 金種定義 (万/五千/千/五百/百/五十)。DB列名と1:1対応。
export const DENOMINATIONS = [
  { key: 'bill_10000', unit: 10000, label: '万',   short: '一万円' },
  { key: 'bill_5000',  unit: 5000,  label: '五千', short: '五千円' },
  { key: 'bill_1000',  unit: 1000,  label: '千',   short: '千円' },
  { key: 'coin_500',   unit: 500,   label: '五百', short: '五百円' },
  { key: 'coin_100',   unit: 100,   label: '百',   short: '百円' },
  { key: 'coin_50',    unit: 50,    label: '五十', short: '五十円' },
]

const pad2 = n => String(n).padStart(2, '0')

/** 集金ID: {store_code}-{YYYYMMDD}-{seq(2桁)} */
export function genCollectionId(storeCode, dateStr, seq) {
  const ymd = String(dateStr).slice(0, 10).replace(/-/g, '')
  return `${storeCode}-${ymd}-${pad2(seq)}`
}

/** 1ブースの金種合計 */
export function boothTotal(counts) {
  return DENOMINATIONS.reduce((sum, d) => sum + d.unit * (Number(counts?.[d.key]) || 0), 0)
}

/** 全ブース合計 */
export function grandTotal(booths) {
  return (booths ?? []).reduce((sum, b) => sum + boothTotal(b), 0)
}

/** 金種別の枚数集計 + 小計 + 総額 (計数票/PDF用) */
export function denominationSummary(booths) {
  const rows = DENOMINATIONS.map(d => {
    const count = (booths ?? []).reduce((s, b) => s + (Number(b?.[d.key]) || 0), 0)
    return { key: d.key, unit: d.unit, label: d.label, short: d.short, count, subtotal: count * d.unit }
  })
  return { rows, total: rows.reduce((s, r) => s + r.subtotal, 0) }
}
