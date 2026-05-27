// J-COLLECTION-01: 売上伝票PDF生成 (jsPDF, A4縦)
// 発行元は株式会社ナイスランド固定 (COLLECTION-REQUIREMENTS-V1 伝票写真IMG_3877準拠)。
//
// 日本語グリフ描画について:
//   jsPDF標準フォント(helvetica)はCJKグリフを含まず、specは「CDN不可」のため実行時フォント取得も不可。
//   テキスト値(店舗名/金種ラベル等)はdoc.textでPDFに配置済み(=内容は存在)だが、視認可能な
//   日本語描画にはCJK TTFのバンドルが必要。フォント資産(サイズ/ライセンス)はヒロ/司令塔判断事項のため、
//   registerJpFont() フックで後差し可能にし、未登録時はhelveticaにフォールバックする。
import { jsPDF } from 'jspdf'
import { DENOMINATIONS, denominationSummary } from './collectionCalc'

const ISSUER = {
  name: '株式会社ナイスランド',
  zip: '〒901-2133',
  addr: '沖縄県浦添市城間3-15-1 レジデンス吉元102',
  tel: 'TEL/FAX 098-874-8106',
}

// CJKフォント後差し用フック (base64 TTF を渡すと以後その font を使う)
let JP_FONT = null
export function registerJpFont({ vfsName, base64, fontName }) {
  JP_FONT = { vfsName, base64, fontName }
}
function applyFont(doc) {
  if (JP_FONT) {
    doc.addFileToVFS(JP_FONT.vfsName, JP_FONT.base64)
    doc.addFont(JP_FONT.vfsName, JP_FONT.fontName, 'normal')
    doc.setFont(JP_FONT.fontName, 'normal')
    return JP_FONT.fontName
  }
  doc.setFont('helvetica', 'normal')
  return 'helvetica'
}

const yen = n => `${Number(n || 0).toLocaleString()}`

/**
 * @returns {jsPDF} 生成済みドキュメント (呼び出し側で .save()/.output() する)
 */
export function buildCollectionSlip({ collection, store, booths, total }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const font = applyFont(doc)
  const L = 15, R = 195
  let y = 18

  doc.setFontSize(16)
  doc.text('売上伝票', 105, y, { align: 'center' })
  doc.setFontSize(9)
  const no = String(collection.collection_id || '').slice(-4)
  doc.text(`No. ${no}`, R, y, { align: 'right' })
  y += 8

  doc.setFontSize(9)
  doc.text(`日付: ${collection.collected_at || ''}`, L, y); y += 6

  // 発行元
  doc.text(ISSUER.name, R, y, { align: 'right' }); y += 4
  doc.setFontSize ? null : null
  doc.setFontSize(8)
  doc.text(`${ISSUER.zip} ${ISSUER.addr}`, R, y, { align: 'right' }); y += 4
  doc.text(ISSUER.tel, R, y, { align: 'right' }); y += 8

  // 宛先
  doc.setFontSize(11)
  doc.text(`${store.store_name_official || store.store_name || ''}　様`, L, y); y += 6
  doc.setFontSize(9)
  doc.text('下記のとおり精算申し上げます', L, y); y += 8

  // 明細テーブル
  doc.setFontSize(8)
  const cols = [
    { x: L,   label: 'No' },
    { x: L+10, label: '機械名 / ブース' },
    { x: 95,  label: 'IN(前→今)' },
    { x: 130, label: 'OUT(前→今)' },
    { x: R,   label: '金額', align: 'right' },
  ]
  doc.setDrawColor(120)
  doc.line(L, y, R, y); y += 4
  cols.forEach(c => doc.text(c.label, c.x, y, c.align ? { align: c.align } : undefined))
  y += 2
  doc.line(L, y, R, y); y += 4

  ;(booths ?? []).forEach((b, i) => {
    const label = `${b.machine_name || b.machine_code} / ${b.booth_code}`
    doc.text(String(i + 1), L, y)
    doc.text(label.length > 26 ? label.slice(0, 25) + '…' : label, L + 10, y)
    doc.text(`${yen(b.in_meter_prev)}→${yen(b.in_meter_current)}`, 95, y)
    doc.text(`${yen(b.out_meter_prev)}→${yen(b.out_meter_current)}`, 130, y)
    doc.text(`${yen(b.total)}`, R, y, { align: 'right' })
    y += 5
    if (y > 250) { doc.addPage(); applyFont(doc); y = 20 }
  })

  doc.line(L, y, R, y); y += 6
  doc.setFontSize(11)
  doc.text(`合計金額`, 130, y)
  doc.text(`${yen(total)} 円`, R, y, { align: 'right' }); y += 12

  // 金種票
  doc.setFontSize(9)
  doc.text('金種内訳', L, y); y += 5
  doc.setFontSize(8)
  const summ = denominationSummary(booths)
  summ.rows.forEach(r => {
    doc.text(`${r.short}`, L, y)
    doc.text(`${r.count} 枚`, 60, y, { align: 'right' })
    doc.text(`× ${yen(r.unit)}`, 75, y)
    doc.text(`= ${yen(r.subtotal)} 円`, 130, y, { align: 'right' })
    y += 5
  })
  y += 6

  // サイン欄
  doc.setFontSize(9)
  doc.text('DFX担当 ____________________', L, y)
  doc.text('経理担当 ____________________', 115, y)

  doc.setFont(font, 'normal')
  return doc
}

// 確定後のファイル名
export function slipFileName(collectionId) {
  return `uriage_${collectionId || 'slip'}.pdf`
}

export { DENOMINATIONS }
