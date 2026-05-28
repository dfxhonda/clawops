// J-COLLECTION-02: 売上伝票PDF生成 (jsPDF, A4縦)
// 発行元は株式会社ナイスランド固定。
// 仕様刷新: 金種内訳ブロック削除 / 立替額列(参考、合計除外) / サイン欄「弊社担当 / 御社ご担当様」
import { jsPDF } from 'jspdf'
import jpFontUrl from './fonts/NotoSansJP-Regular.ttf?url'

const ISSUER = {
  name: '株式会社ナイスランド',
  zip: '〒901-2133',
  addr: '沖縄県浦添市城間3-15-1 レジデンス吉元102',
  tel: 'TEL/FAX 098-874-8106',
}

// CJKフォント後差し用フック
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

// バンドル NotoSansJP の初回ロード (J-COLLECTION-PDF-JP-01)
let jpLoading = null
function abToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
export async function ensureJpFont() {
  if (JP_FONT) return
  if (!jpLoading) {
    jpLoading = (async () => {
      const res = await fetch(jpFontUrl)
      const buf = await res.arrayBuffer()
      registerJpFont({ vfsName: 'NotoSansJP-Regular.ttf', base64: abToBase64(buf), fontName: 'NotoSansJP' })
    })()
  }
  await jpLoading
}

const yen = n => `${Number(n || 0).toLocaleString()}`

/**
 * @returns {jsPDF} 生成済みドキュメント
 */
export function buildCollectionSlip({ collection, store, booths, total, advanceTotal, collectedByName }) {
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
  doc.text(`集金日: ${collection.collected_at || ''}`, L, y)
  if (collection.prev_collection_date) {
    doc.text(`前回集金日: ${collection.prev_collection_date}`, L + 60, y)
  }
  y += 6

  // 発行元
  doc.text(ISSUER.name, R, y, { align: 'right' }); y += 4
  doc.setFontSize(8)
  doc.text(`${ISSUER.zip} ${ISSUER.addr}`, R, y, { align: 'right' }); y += 4
  doc.text(ISSUER.tel, R, y, { align: 'right' }); y += 8

  // 宛先
  doc.setFontSize(11)
  doc.text(`${store.store_name_official || store.store_name || ''}　様`, L, y); y += 6
  doc.setFontSize(9)
  doc.text('下記のとおり精算申し上げます', L, y); y += 8

  // 明細テーブル: No / レンタル番号 / 機械名 / ブース / IN(前→今) / OUT(前→今) / 金額 / 立替
  doc.setFontSize(8)
  const cols = [
    { x: L,    label: 'No' },
    { x: L+8,  label: 'レンタル' },
    { x: L+30, label: '機械名 / ブース' },
    { x: 100,  label: 'IN(前→今)' },
    { x: 130,  label: 'OUT(前→今)' },
    { x: 168,  label: '金額', align: 'right' },
    { x: R,    label: '立替※', align: 'right' },
  ]
  doc.setDrawColor(120)
  doc.line(L, y, R, y); y += 4
  cols.forEach(c => doc.text(c.label, c.x, y, c.align ? { align: c.align } : undefined))
  y += 2
  doc.line(L, y, R, y); y += 4

  ;(booths ?? []).forEach((b, i) => {
    const machine = `${b.machine_name || b.machine_code} / ${b.booth_name || b.booth_code}`
    doc.text(String(i + 1), L, y)
    doc.text(String(b.rental_code || b.machine_code || ''), L + 8, y)
    doc.text(machine.length > 24 ? machine.slice(0, 23) + '…' : machine, L + 30, y)
    doc.text(`${yen(b.in_meter_prev)}→${yen(b.in_meter_current)}`, 100, y)
    doc.text(`${yen(b.out_meter_prev)}→${yen(b.out_meter_current)}`, 130, y)
    doc.text(`${yen(b.total)}`, 168, y, { align: 'right' })
    doc.text(`${yen(b.advance_payment)}`, R, y, { align: 'right' })
    y += 5
    if (y > 250) { doc.addPage(); applyFont(doc); y = 20 }
  })

  doc.line(L, y, R, y); y += 6
  doc.setFontSize(11)
  doc.text('合計金額', 130, y)
  doc.text(`${yen(total)} 円`, 168, y, { align: 'right' })
  y += 6
  doc.setFontSize(8)
  doc.text(`※ 立替額(参考) 合計 ${yen(advanceTotal)} 円 ─ 合計金額には含めません`, L, y)
  y += 12

  // サイン欄 (J-COLLECTION-02: 弊社担当 / 御社ご担当様)
  doc.setFontSize(9)
  if (collectedByName) {
    doc.text(`弊社担当: ${collectedByName}`, L, y)
  } else {
    doc.text('弊社担当 ____________________', L, y)
  }
  doc.text('御社ご担当様 ____________________', 115, y)

  doc.setFont(font, 'normal')
  return doc
}

export function slipFileName(collectionId) {
  return `uriage_${collectionId || 'slip'}.pdf`
}
