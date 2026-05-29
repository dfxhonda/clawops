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
// J-COLLECTION-08: reset-on-failure + silent swallow。
// 旧実装は jpLoading に rejected Promise が残置し、以後セッション全体のPDF生成が固定エラー化する
// (ERR-COLLECTION-003: TypeError: Load failed in iPad Safari)。
// 修正: fetch失敗時に jpLoading=null でリセットして次回retry可能化。
// さらに throw せず吸収して、呼出側 (downloadPdf/outputPdf) は helvetica フォールバックでPDF生成継続。
export async function ensureJpFont() {
  if (JP_FONT) return
  if (!jpLoading) {
    jpLoading = (async () => {
      try {
        const res = await fetch(jpFontUrl)
        if (!res.ok) throw new Error(`font fetch ${res.status}`)
        const buf = await res.arrayBuffer()
        registerJpFont({ vfsName: 'NotoSansJP-Regular.ttf', base64: abToBase64(buf), fontName: 'NotoSansJP' })
      } catch (e) {
        jpLoading = null // 次回呼出で retry可能にする
        // 呼出側はhelveticaフォールバックでPDF生成可、ログのみ残し例外吸収
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('ensureJpFont: load failed, fallback to helvetica (will retry next call)', e)
        }
      }
    })()
  }
  await jpLoading
}

const yen = n => `${Number(n || 0).toLocaleString()}`

/**
 * @returns {Promise<jsPDF>} 生成済みドキュメント
 * J-COLLECTION-07: page1 下部に 左=弊社担当 / 右=先方ご担当者様 の署名欄2枠を常時描画。
 *   staffSignatureDataUrl / customerSignatureDataUrl がそれぞれ与えられた場合は対応する枠内に embed。
 */
export async function buildCollectionSlip({
  collection, store, booths, total, advanceTotal, collectedByName,
  staffSignatureDataUrl, customerSignatureDataUrl,
}) {
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

  // J-COLLECTION-07: 署名欄 (左=弊社担当 / 右=先方ご担当者様、常時2枠表示)
  const sigBoxW = 85, sigBoxH = 26
  const leftX = L, rightX = L + sigBoxW + 5
  doc.setDrawColor(140)
  doc.rect(leftX, y, sigBoxW, sigBoxH)
  doc.rect(rightX, y, sigBoxW, sigBoxH)
  doc.setFontSize(8)
  doc.text(collectedByName ? `弊社担当: ${collectedByName}` : '弊社担当', leftX + 2, y + 4)
  doc.text('先方ご担当者様', rightX + 2, y + 4)
  if (staffSignatureDataUrl) {
    try { doc.addImage(staffSignatureDataUrl, 'PNG', leftX + 3, y + 6, sigBoxW - 6, sigBoxH - 9) } catch { /* ignore */ }
  }
  if (customerSignatureDataUrl) {
    try { doc.addImage(customerSignatureDataUrl, 'PNG', rightX + 3, y + 6, sigBoxW - 6, sigBoxH - 9) } catch { /* ignore */ }
  }
  y += sigBoxH + 4

  // J-COLLECTION-10: レシートページを 3列×4行=12枚/ページ グリッドに変更。
  //   - ヘッダ/フッタ/キャプション削除、写真のみ
  //   - 写真なしブースは空セル (改ページせずページ内で次セルへ進む)
  //   - 写真 fetch 失敗は try/catch で吸収 (J-COLLECTION-09 fix_3、placeholder なし=空セル)
  //   - cell内の image は contain (アスペクト維持、左上起点)
  //   - 13枚目以降は自動改ページ
  const PT_TO_MM = 25.4 / 72 // ≈ 0.35278
  const RM = 20 * PT_TO_MM   // ≈ 7.06mm 四辺余白 (spec: 20pt)
  const RG = 8 * PT_TO_MM    // ≈ 2.82mm セル間 gap (spec: 8pt)
  const COLS_GRID = 3
  const ROWS_GRID = 4
  const PER_PAGE = COLS_GRID * ROWS_GRID
  const cellW = (210 - RM * 2 - RG * (COLS_GRID - 1)) / COLS_GRID  // ≈ 63.42mm
  const cellH = (297 - RM * 2 - RG * (ROWS_GRID - 1)) / ROWS_GRID  // ≈ 68.61mm

  const boothsArr = booths ?? []
  for (let i = 0; i < boothsArr.length; i++) {
    const indexOnPage = i % PER_PAGE
    if (indexOnPage === 0) {
      doc.addPage()
      applyFont(doc)
    }
    const row = Math.floor(indexOnPage / COLS_GRID)
    const col = indexOnPage % COLS_GRID
    const x = RM + col * (cellW + RG)
    const y = RM + row * (cellH + RG)
    const b = boothsArr[i]
    if (!b.receipt_photo_url) continue // 空セル (写真なし)
    try {
      const dataUrl = await fetchAsDataURL(b.receipt_photo_url)
      const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      // contain: アスペクト維持で cell に収める、左上起点
      const props = doc.getImageProperties(dataUrl)
      const ratio = props.width / props.height
      let w = cellW, h = w / ratio
      if (h > cellH) { h = cellH; w = h * ratio }
      doc.addImage(dataUrl, fmt, x, y, w, h)
    } catch {
      // J-COLLECTION-09 fix_3: fetch失敗は空セルのまま PDF生成継続 (placeholder text なし)
    }
  }

  doc.setFont(font, 'normal')
  return doc
}

export function slipFileName(collectionId) {
  return `uriage_${collectionId || 'slip'}.pdf`
}
