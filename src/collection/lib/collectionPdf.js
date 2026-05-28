// J-COLLECTION-02: 売上伝票PDF生成 (jsPDF, A4縦)
// 発行元は株式会社ナイスランド固定。
// 仕様刷新: 金種内訳ブロック削除 / 立替額列(参考、合計除外) / サイン欄「弊社担当 / 御社ご担当様」
import { jsPDF } from 'jspdf'
import jpFontUrl from './fonts/NotoSansJP-Regular.ttf?url'
import { fetchAsDataURL } from './imageUtil'

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
 * @returns {Promise<jsPDF>} 生成済みドキュメント (J-COLLECTION-05: async化、レシート画像fetchのため)
 */
export async function buildCollectionSlip({ collection, store, booths, total, advanceTotal, collectedByName, signatureDataUrl }) {
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

  // 明細テーブル (J-COLLECTION-03): レンタルコード/機械名/ブース/前回IN/今回IN/差/集金額/立替/備考
  doc.setFontSize(7)
  // J-COLLECTION-05 fix_A: 'レンタル' → 'コード'
  const cols = [
    { x: 15,  label: 'コード' },
    { x: 30,  label: '機械名' },
    { x: 63,  label: 'ブース' },
    { x: 95,  label: '前回IN', align: 'right' },
    { x: 117, label: '今回IN', align: 'right' },
    { x: 133, label: '差',     align: 'right' },
    { x: 153, label: '集金額', align: 'right' },
    { x: 172, label: '立替',   align: 'right' },
    { x: 175, label: '備考' },
  ]
  doc.setDrawColor(120)
  doc.line(L, y, R, y); y += 3.5
  cols.forEach(c => doc.text(c.label, c.x, y, c.align ? { align: c.align } : undefined))
  y += 2
  doc.line(L, y, R, y); y += 4

  ;(booths ?? []).forEach(b => {
    const cur = b.in_meter_current != null ? Number(b.in_meter_current) : null
    const prv = b.in_meter_prev != null ? Number(b.in_meter_prev) : null
    const inDiff = (cur != null && prv != null) ? cur - prv : null
    const mName = String(b.machine_name || b.machine_code || '')
    const notes = String(b.notes || '')
    doc.text(String(b.rental_code || ''), 15, y)
    doc.text(mName.length > 16 ? mName.slice(0, 15) + '…' : mName, 30, y)
    doc.text(String(b.booth_name || b.booth_code || ''), 63, y)
    doc.text(yen(b.in_meter_prev), 95, y, { align: 'right' })
    doc.text(yen(b.in_meter_current), 117, y, { align: 'right' })
    doc.text(inDiff == null ? '—' : (inDiff >= 0 ? '+' : '') + inDiff, 133, y, { align: 'right' })
    doc.text(yen(b.total), 153, y, { align: 'right' })
    doc.text(yen(b.advance_payment), 172, y, { align: 'right' })
    doc.text(notes.length > 10 ? notes.slice(0, 9) + '…' : notes, 175, y)
    y += 4.5
    if (y > 250) { doc.addPage(); applyFont(doc); y = 20 }
  })

  doc.line(L, y, R, y); y += 6
  doc.setFontSize(11)
  doc.text('合計金額', 130, y)
  doc.text(`${yen(total)} 円`, 168, y, { align: 'right' })
  y += 10

  // サイン欄 (J-COLLECTION-02: 弊社担当 / 御社ご担当様)
  doc.setFontSize(9)
  if (collectedByName) {
    doc.text(`弊社担当: ${collectedByName}`, L, y)
  } else {
    doc.text('弊社担当 ____________________', L, y)
  }
  doc.text('御社ご担当様 ____________________', 115, y)
  y += 8

  // J-COLLECTION-05 fix_B: 担当者署名 (PDF page1下部に埋込)
  if (signatureDataUrl) {
    doc.setFontSize(8)
    doc.text('担当者署名:', L, y)
    try {
      // 60mm x 18mm (アスペクト比は内部で維持されないので明示指定)
      doc.addImage(signatureDataUrl, 'PNG', L + 22, y - 5, 60, 18)
    } catch { /* ignore */ }
    y += 22
  }

  // J-COLLECTION-05 fix_D: page2以降にブース別レシートページを追加
  for (const b of booths ?? []) {
    doc.addPage()
    applyFont(doc)
    let py = 18
    doc.setFontSize(11)
    doc.text(`${store.store_name_official || store.store_name || ''}　${collection.collected_at || ''}`, L, py); py += 7
    doc.setFontSize(10)
    doc.text(`コード: ${b.rental_code || ''}　ブース: ${b.booth_name || b.booth_code || ''}`, L, py); py += 8

    const imgTop = py
    const imgMaxH = 200 // mm (A4縦の主要領域)
    const imgMaxW = R - L
    if (b.receipt_photo_url) {
      try {
        const dataUrl = await fetchAsDataURL(b.receipt_photo_url)
        const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        // 画像のメタからアスペクト計算
        const props = doc.getImageProperties(dataUrl)
        const ratio = props.width / props.height
        let w = imgMaxW, h = w / ratio
        if (h > imgMaxH) { h = imgMaxH; w = h * ratio }
        doc.addImage(dataUrl, fmt, L, imgTop, w, h)
        py = imgTop + h + 6
      } catch {
        doc.setFontSize(10)
        doc.text('レシート写真の読込に失敗しました', L, imgTop + 8)
        py = imgTop + 14
      }
    } else {
      doc.setFontSize(10)
      doc.text('レシート写真なし', 105, imgTop + 80, { align: 'center' })
      py = imgTop + 90
    }
    // footer: 集金額 / 立替 / 備考
    doc.setFontSize(9)
    doc.text(`集金額: ${yen(b.total)} 円`, L, py); py += 5
    doc.text(`立替: ${yen(b.advance_payment)} 円`, L, py); py += 5
    if (b.notes) doc.text(`備考: ${b.notes}`, L, py)
  }

  doc.setFont(font, 'normal')
  return doc
}

export function slipFileName(collectionId) {
  return `uriage_${collectionId || 'slip'}.pdf`
}
