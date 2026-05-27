// ============================================
// J-INTAKE-PCH-EXCEL-fix-01: PCH(Change/ピーチトイ)請書Excel 照合取込エンジン
// SheetJS parse → 店舗別分割 → スナップショット差分照合 → upsert/cancel/conflict
//
// 設計根拠: PCH-INTAKE-REQUIREMENTS-V1 + raw_file_audit(2026-05-24)
// - 発注番号が請書に存在しない → row_hash(match_key+occ_index)照合が唯一解
// - 1明細行を店舗別レコードに分割 (入荷チェックが店舗別のため)
// - arrived済は保護: Excelで消えても/変わっても上書きせずconflict表示
// - 母体哲学(空欄=保護)の逆: 行消失=cancel検知 (差分照合で実現)
// ============================================
import { supabase } from '../../lib/supabase'
import { writeAuditLog } from '../../services/audit'
import { ERR } from '../../lib/errorCodes'

export const SUPPLIER_ID = 'PCH'
export const ORDER_SOURCE = 'pch_excel'
export const MANUAL_MARKER = '__MANUAL__'

// PCH配分略号/正式名 → SGP destination同体系の地名 (J-ARRIVALの店舗別フィルタが効く)
export const STORE_NORMALIZATION = {
  田: '田淵', 田隈: '田淵', 田淵: '田淵',
  久: '久留米', 久留米: '久留米',
  飯: '飯塚', 飯塚: '飯塚',
  鹿: '鹿児島', 鹿児島: '鹿児島',
  賀: '佐賀', 佐賀: '佐賀',
  世: '佐世保', 佐世保: '佐世保',
  各: MANUAL_MARKER, // 全店指定=自動按分禁止、手動確認フラグ
}

// 列マッピング (0-based、PCH固定様式)
const COL = { name: 0, caseCount: 1, pieces: 3, unitCost: 4, subExcl: 5, totalIncl: 6, memo: 7, dist: 8 }
const DATA_START_ROW = 6
const ISSUE_DATE_ROW = 4

// ---- 数値/日付ユーティリティ ----

// 厳密数値パース: "10Kg" 等の非数値は null (pieces_per_case の非数値退避用)
export function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

// Excelシリアル値 → JS Date (1900日付システム、1899-12-30 起点)
export function excelSerialToDate(serial) {
  const n = toNum(serial)
  if (n == null) return null
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000)
}

// "3月" → 3
export function sheetMonthToNumber(sheetName) {
  const m = String(sheetName ?? '').match(/(\d{1,2})\s*月/)
  return m ? parseInt(m[1], 10) : null
}

// 年跨ぎ補正: 月 > 発行月+3 なら前年 (1月請書の12月シート等)
function resolveYear(monthNum, issueYear, issueMonth) {
  if (monthNum == null || issueYear == null) return issueYear
  if (issueMonth != null && monthNum > issueMonth + 3) return issueYear - 1
  return issueYear
}

function ymd(year, month, day) {
  if (!year || !month || !day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 出荷/着メモ → expected_date。上旬=01 中旬=15 下旬=25 月のみ=01 日付明記=その日。
export function parseExpectedDate(memoRaw, year, fallbackMonth) {
  if (!memoRaw) return null
  const s = String(memoRaw)
  let m = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})/) // 5/15, 3/3
  if (m) return ymd(year, parseInt(m[1], 10), parseInt(m[2], 10))
  m = s.match(/(\d{1,2})\s*\/?\s*(上旬|中旬|下旬)/) // 3/中旬, 5/下旬
  if (m) {
    const day = m[2] === '上旬' ? 1 : m[2] === '中旬' ? 15 : 25
    return ymd(year, parseInt(m[1], 10), day)
  }
  m = s.match(/(上旬|中旬|下旬)/)
  if (m && fallbackMonth) {
    const day = m[1] === '上旬' ? 1 : m[1] === '中旬' ? 15 : 25
    return ymd(year, fallbackMonth, day)
  }
  m = s.match(/(\d{1,2})\s*月/) // 6月, 7月
  if (m) return ymd(year, parseInt(m[1], 10), 1)
  return null
}

export function normalizeStore(token) {
  if (token == null) return null
  const t = String(token).trim()
  return STORE_NORMALIZATION[t] ?? null
}

// 配分文字列 → 店舗別 [{destination, caseCount, unresolved}]
// 「各」「N ヶ所」等のフリーテキストは自動按分せず unresolved (手動確認要)
export function parseDistribution(distRaw, totalCaseCount) {
  const raw = distRaw == null ? '' : String(distRaw).trim()
  if (!raw) {
    return [{ destination: MANUAL_MARKER, caseCount: totalCaseCount, unresolved: true }]
  }
  if (/各|ヶ所|ケ所|箇所/.test(raw)) {
    return [{ destination: MANUAL_MARKER, caseCount: totalCaseCount, unresolved: true }]
  }
  // [，、,] を区切りに、店舗(略号/正式名)+数量(小数可) を全抽出
  const tokens = [...raw.matchAll(/([一-鿿ぁ-んァ-ヶ]+)\s*(\d+(?:\.\d+)?)/g)]
  if (tokens.length > 0) {
    return tokens.map(t => {
      const store = normalizeStore(t[1])
      const resolved = store && store !== MANUAL_MARKER
      return {
        destination: resolved ? store : MANUAL_MARKER,
        caseCount: Number(t[2]),
        unresolved: !resolved,
      }
    })
  }
  // 数量なし単独店名 (例「田隈」) → 全ケース1店舗
  const single = normalizeStore(raw)
  if (single && single !== MANUAL_MARKER) {
    return [{ destination: single, caseCount: totalCaseCount, unresolved: false }]
  }
  return [{ destination: MANUAL_MARKER, caseCount: totalCaseCount, unresolved: true }]
}

// 安定ハッシュ (djb2)。match_key+occ_index から raw_import_id を生成
function hashKey(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) & 0xffffffff
  return (h >>> 0).toString(36)
}

function buildMatchKey(r) {
  return [r.sheetMonth, r.prizeNameRaw, r.piecesPerCase ?? '', r.unitCost ?? '', r.destination].join('|')
}
export function buildRawImportId(matchKey, occIndex) {
  return 'pch_' + hashKey(`${matchKey}#${occIndex}`)
}

// ---- パース: 全シート → 明細行 ----
export async function parseSheets(arrayBuffer) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
  if (!wb.SheetNames.length) throw new Error('シートが見つかりません (ERR-IMPORT-001)')

  const details = []
  let orderIndex = 0
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
    const monthNum = sheetMonthToNumber(sheetName)
    const issueDate = excelSerialToDate(rows[ISSUE_DATE_ROW]?.[COL.name])
    const issueYear = issueDate ? issueDate.getUTCFullYear() : new Date().getUTCFullYear()
    const issueMonth = issueDate ? issueDate.getUTCMonth() + 1 : null
    const year = resolveYear(monthNum, issueYear, issueMonth)

    for (let i = DATA_START_ROW; i < rows.length; i++) {
      const row = rows[i] ?? []
      const name = row[COL.name] == null ? '' : String(row[COL.name]).trim()
      if (!name) continue                          // 合計行/空行 (商品名空)
      if (/合計/.test(name)) continue               // 明示的合計行
      const nonNullCount = row.filter(c => c != null && c !== '').length
      if (nonNullCount <= 2) continue              // フッター集計行 (列数僅少)

      const caseCount = toNum(row[COL.caseCount])
      const piecesRaw = row[COL.pieces]
      const piecesPerCase = toNum(piecesRaw)
      const unitCost = toNum(row[COL.unitCost])
      const subExcl = toNum(row[COL.subExcl])
      const totalIncl = toNum(row[COL.totalIncl])
      const memoRaw = row[COL.memo] == null ? null : String(row[COL.memo]).trim() || null
      const distRaw = row[COL.dist] == null ? null : String(row[COL.dist]).trim() || null

      const isShipping = name === '送料'
      const nonNumericPieces = piecesRaw != null && piecesRaw !== '' && piecesPerCase == null
      const calcMismatch = piecesPerCase != null && caseCount != null && unitCost != null && subExcl != null
        && Math.round(caseCount * piecesPerCase * unitCost) !== Math.round(subExcl)

      details.push({
        orderIndex: orderIndex++,
        sheetName, sheetMonth: monthNum, year, issueDate,
        prizeNameRaw: name,
        rowCaseCount: caseCount,
        caseCount, piecesPerCase, unitCost,
        caseCostExcl: caseCount ? (subExcl != null ? subExcl / caseCount : (piecesPerCase != null && unitCost != null ? piecesPerCase * unitCost : null)) : null,
        subExcl, totalIncl,
        memoRaw, distRaw,
        isShipping, nonNumericPieces, calcMismatch,
        expectedDate: parseExpectedDate(memoRaw, year, monthNum),
      })
    }
  }
  return details
}

// 明細行 → 店舗別レコード (raw_import_id 付与)。送料行は分割せず shipping レコード。
export function explodeToRecords(details) {
  const records = []
  const occ = new Map() // matchKey → 出現回数
  for (const d of details) {
    if (d.isShipping) {
      records.push({ ...d, destination: null, caseCount: d.caseCount, unresolved: false, shipping: true, rawImportId: null })
      continue
    }
    const splits = parseDistribution(d.distRaw, d.caseCount)
    for (const s of splits) {
      const rec = { ...d, destination: s.destination, caseCount: s.caseCount, unresolved: s.unresolved, shipping: false }
      const mk = buildMatchKey(rec)
      const idx = occ.get(mk) ?? 0
      occ.set(mk, idx + 1)
      rec.matchKey = mk
      rec.occIndex = idx
      rec.rawImportId = buildRawImportId(mk, idx)
      records.push(rec)
    }
  }
  return records
}

// ---- 既存PCHレコード取得 (照合対象月のみ) ----
export async function loadExistingPchOrders(sheetMonths) {
  const { data, error } = await supabase
    .from('prize_orders')
    .select('order_id, raw_import_id, case_count, expected_date, notes, status, arrived_at, import_meta')
    .eq('order_source', ORDER_SOURCE)
  if (error) throw new Error('既存PCH発注取得エラー: ' + error.message)
  // 今回アップロードに含まれる月のみ対象 (含まれない月は触らない)
  const months = new Set((sheetMonths ?? []).filter(m => m != null))
  return (data ?? []).filter(r => {
    if (!months.size) return true
    const m = r.import_meta?.sheet_month
    return m == null || months.has(m)
  })
}

function isArrived(existing) {
  return existing.status === 'arrived' || existing.status === 'received' || !!existing.arrived_at
}

// notes: メモ原文 + edge_case/conflictフラグ
export function buildNotes(rec) {
  const parts = []
  if (rec.memoRaw) parts.push(rec.memoRaw)
  if (rec.nonNumericPieces) parts.push('[非数値入数]')
  if (rec.unresolved) parts.push('[配分要手動確認]')
  if (rec.calcMismatch) parts.push('[検算不一致]')
  return parts.join(' ')
}

// ---- 照合: 今回Excel vs 既存スナップショット ----
// 戻り: { records: [{...rec, state, existing}], summary }
export function reconcile(currentRecords, existingRows) {
  const currentIds = new Set()
  const out = []

  for (const rec of currentRecords) {
    if (rec.shipping) { out.push({ ...rec, state: 'shipping' }); continue }
    currentIds.add(rec.rawImportId)
    const existing = (existingRows ?? []).find(r => r.raw_import_id === rec.rawImportId)
    if (!existing) { out.push({ ...rec, state: 'insert' }); continue }
    const changed =
      Number(existing.case_count) !== Number(rec.caseCount) ||
      (existing.expected_date ?? null) !== (rec.expectedDate ?? null) ||
      (existing.notes ?? '') !== buildNotes(rec)
    if (!changed) { out.push({ ...rec, state: 'skip', existing }); continue }
    if (isArrived(existing)) { out.push({ ...rec, state: 'conflict', existing, conflictReason: 'arrived_changed' }); continue }
    out.push({ ...rec, state: 'update', existing })
  }

  // 消失行: 既存(対象月)で今回に無いもの
  for (const ex of existingRows ?? []) {
    if (currentIds.has(ex.raw_import_id)) continue
    if (ex.status === 'cancelled') continue
    if (isArrived(ex)) { out.push({ rawImportId: ex.raw_import_id, existing: ex, state: 'conflict', conflictReason: 'arrived_disappeared', prizeNameRaw: ex.notes ?? '(既存arrived)', destination: '-', caseCount: ex.case_count }); continue }
    out.push({ rawImportId: ex.raw_import_id, existing: ex, state: 'cancel', prizeNameRaw: '(Excelから消失)', destination: String(ex.import_meta?.sheet_month ?? '-'), caseCount: ex.case_count })
  }

  const summary = { insert: 0, update: 0, skip: 0, cancel: 0, conflict: 0, shipping: 0, unresolved: 0 }
  for (const r of out) {
    summary[r.state] = (summary[r.state] ?? 0) + 1
    if (r.unresolved) summary.unresolved++
  }
  return { records: out, summary }
}

function buildInsertRow(rec, staffId, sourceFile) {
  const rowCases = rec.rowCaseCount || rec.caseCount
  return {
    order_id: crypto.randomUUID(),
    prize_name_raw: rec.prizeNameRaw,
    supplier_id: SUPPLIER_ID,
    order_source: ORDER_SOURCE,
    order_date: ymd(rec.year, rec.sheetMonth, 1),
    order_date_source: 'sheet_month',
    expected_date: rec.expectedDate,
    case_count: rec.caseCount,
    pieces_per_case: rec.piecesPerCase,
    unit_cost: rec.unitCost,
    case_cost: rec.caseCostExcl,
    // 店舗按分: 行の税込合計を行ケース数で割り、当店ケース数分を割当 (近似)
    total_tax_included: rec.totalIncl != null && rowCases ? Math.round(rec.totalIncl / rowCases * rec.caseCount) : rec.totalIncl,
    destination: rec.destination === MANUAL_MARKER ? null : rec.destination,
    status: 'ordered',
    notes: buildNotes(rec),
    source_file: sourceFile ?? null,
    raw_import_id: rec.rawImportId,
    import_meta: {
      issue_date: rec.issueDate ? rec.issueDate.toISOString().slice(0, 10) : null,
      sheet_month: rec.sheetMonth,
      raw_dist_string: rec.distRaw ?? null,
      order_index: rec.occIndex ?? null,
      unresolved_distribution: !!rec.unresolved,
    },
    unplanned_flag: false,
    updated_by: staffId ?? null,
  }
}

// ---- 実行: INSERT(新規) / UPDATE(変更) / cancel(消失)。conflict/skip/shippingはDB非書込 ----
export async function executePchImport(reconciled, { staffId, sourceFile } = {}) {
  const recs = reconciled.records ?? []
  const inserts = recs.filter(r => r.state === 'insert').map(r => buildInsertRow(r, staffId, sourceFile))
  const updates = recs.filter(r => r.state === 'update')
  const cancels = recs.filter(r => r.state === 'cancel')
  const now = new Date().toISOString()

  try {
    if (inserts.length) {
      const { error } = await supabase.from('prize_orders').insert(inserts)
      if (error) throw new Error('INSERT失敗: ' + error.message)
    }
    for (const u of updates) {
      const { error } = await supabase.from('prize_orders').update({
        case_count: u.caseCount,
        expected_date: u.expectedDate,
        notes: buildNotes(u),
        updated_at: now, updated_by: staffId ?? null,
      }).eq('raw_import_id', u.rawImportId)
      if (error) throw new Error('UPDATE失敗: ' + error.message)
    }
    for (const c of cancels) {
      const { error } = await supabase.from('prize_orders').update({
        status: 'cancelled', updated_at: now, updated_by: staffId ?? null,
      }).eq('raw_import_id', c.rawImportId)
      if (error) throw new Error('cancel失敗: ' + error.message)
    }

    writeAuditLog({
      action: 'pch_excel_import',
      target_table: 'prize_orders',
      detail: `PCH取込 ${sourceFile ?? ''}: insert=${inserts.length} update=${updates.length} cancel=${cancels.length}`,
      staff_id: staffId,
      after_data: { inserted: inserts.length, updated: updates.length, cancelled: cancels.length },
    })
    return { ok: true, inserted: inserts.length, updated: updates.length, cancelled: cancels.length }
  } catch (e) {
    return { ok: false, errCode: ERR.IMPORT_003, message: e?.message ?? '取込エラー' }
  }
}

// UI入口: File → parse → explode → loadExisting → reconcile
export async function previewPchImport(file) {
  const ab = await file.arrayBuffer()
  const details = await parseSheets(ab)
  const records = explodeToRecords(details)
  const months = [...new Set(details.map(d => d.sheetMonth).filter(m => m != null))]
  const existing = await loadExistingPchOrders(months)
  const result = reconcile(records, existing)
  return { ...result, details, records, months }
}
