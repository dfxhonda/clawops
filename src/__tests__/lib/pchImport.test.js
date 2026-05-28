// J-INTAKE-PCH-EXCEL-fix-01: PCH照合取込エンジンのユニットテスト
// 実ファイル archive/取込/(株)Change.xlsx をfixtureに使用 (4シート版)
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// loadExistingPchOrders 用に from().select().eq() を空配列で返すチェーンをモック
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) },
}))
vi.mock('../../services/audit', () => ({ writeAuditLog: vi.fn() }))

const {
  parseSheets, explodeToRecords, parseDistribution, parseExpectedDate,
  normalizeStore, toNum, buildRawImportId, reconcile, previewPchImport, MANUAL_MARKER,
} = await import('../../admin/lib/pchImport')

// archive/ は .gitignore 対象 (顧客実ファイル) のため CI には存在しない。
// 実ファイル依存テストは fixture がある環境(ローカル)のみ実行し、CIでは skip する。
// 純関数/合成データのテストは常時実行 (CIで vitest が緑になる = 自動ロールバック誤爆防止)。
const fixturePath = resolve('archive/取込/(株)Change.xlsx')
const HAS_FIXTURE = existsSync(fixturePath)
const xlsxBuf = HAS_FIXTURE ? readFileSync(fixturePath) : null

describe('toNum (厳密数値)', () => {
  it('数値はそのまま、非数値はnull', () => {
    expect(toNum(3.25)).toBe(3.25)
    expect(toNum('5')).toBe(5)
    expect(toNum('10Kg')).toBeNull()
    expect(toNum('')).toBeNull()
    expect(toNum(null)).toBeNull()
  })
})

describe('parseExpectedDate', () => {
  it('明示日付 / 旬 / 月のみ / 着表記', () => {
    expect(parseExpectedDate('3/3出荷', 2026, 3)).toBe('2026-03-03')
    expect(parseExpectedDate('3/中旬', 2026, 3)).toBe('2026-03-15')
    expect(parseExpectedDate('5/下旬', 2026, 5)).toBe('2026-05-25')
    expect(parseExpectedDate('6/上旬', 2026, 6)).toBe('2026-06-01')
    expect(parseExpectedDate('6月', 2026, 6)).toBe('2026-06-01')
    expect(parseExpectedDate('5/1着', 2026, 5)).toBe('2026-05-01')
    expect(parseExpectedDate(null, 2026, 5)).toBeNull()
  })
})

describe('normalizeStore / parseDistribution', () => {
  it('略号・正式名を地名へ正規化', () => {
    expect(normalizeStore('田')).toBe('田淵')
    expect(normalizeStore('田隈')).toBe('田淵')
    expect(normalizeStore('賀')).toBe('佐賀')
    expect(normalizeStore('世')).toBe('佐世保')
    expect(normalizeStore('謎')).toBeNull()
  })
  it('複数店配分を店舗別に分割', () => {
    const r = parseDistribution('田2，久4，飯1，鹿2', 9)
    expect(r.map(x => [x.destination, x.caseCount])).toEqual([
      ['田淵', 2], ['久留米', 4], ['飯塚', 1], ['鹿児島', 2],
    ])
    expect(r.every(x => !x.unresolved)).toBe(true)
  })
  it('小数配分を許容', () => {
    const r = parseDistribution('田1.25,賀1,世1', 3.25)
    expect(r[0]).toMatchObject({ destination: '田淵', caseCount: 1.25 })
    expect(r.map(x => x.caseCount)).toEqual([1.25, 1, 1])
  })
  it('数量なし単独店名は全ケース1店舗', () => {
    expect(parseDistribution('田隈', 1)).toEqual([{ destination: '田淵', caseCount: 1, unresolved: false }])
  })
  it('「各」「6ヶ所各120ヶ」はunresolved(自動按分しない)', () => {
    expect(parseDistribution('各', 5)[0]).toMatchObject({ destination: MANUAL_MARKER, unresolved: true })
    expect(parseDistribution('6ヶ所各120ヶ', 3)[0]).toMatchObject({ destination: MANUAL_MARKER, unresolved: true })
  })
})

describe.skipIf(!HAS_FIXTURE)('parseSheets (実ファイル)', () => {
  // 注: リポジトリ内 (株)Change.xlsx は4シート版・31明細行 (5/24要件fixtureの68行とは別版)。
  // 小数ケース/10Kg等のedge_caseは本ファイルには無く、上の合成テストで網羅。
  it('4シート(3-6月)をパースし明細行を抽出 (ヘッダ/合計行除外)', async () => {
    const details = await parseSheets(xlsxBuf)
    const months = [...new Set(details.map(d => d.sheetMonth))].sort((a, b) => a - b)
    expect(months).toEqual([3, 4, 5, 6])
    expect(details.length).toBe(31)
    expect(details.every(d => d.prizeNameRaw && !/合計/.test(d.prizeNameRaw))).toBe(true)
  })
  it('送料行を検出し、issue_dateから年(2026)を取得', async () => {
    const details = await parseSheets(xlsxBuf)
    const shipping = details.find(d => d.isShipping)
    expect(shipping, '送料行が存在').toBeTruthy()
    expect(shipping.prizeNameRaw).toBe('送料')
    expect(details[0].year).toBe(2026)
  })
  it('検算(case*pieces*unit=subExcl)が大半一致', async () => {
    const details = await parseSheets(xlsxBuf)
    const checkable = details.filter(d => d.piecesPerCase != null && !d.isShipping)
    const mismatches = checkable.filter(d => d.calcMismatch)
    expect(mismatches.length).toBe(0)
  })
})

describe('explodeToRecords (店舗別分割 + raw_import_id)', () => {
  it.skipIf(!HAS_FIXTURE)('明細を店舗別レコードに展開、送料は分割しない', async () => {
    const details = await parseSheets(xlsxBuf)
    const records = explodeToRecords(details)
    expect(records.length).toBeGreaterThan(details.length) // 分割で増える
    const shippingRecs = records.filter(r => r.shipping)
    expect(shippingRecs.every(r => r.rawImportId === null)).toBe(true)
    const prizeRecs = records.filter(r => !r.shipping)
    expect(prizeRecs.every(r => typeof r.rawImportId === 'string' && r.rawImportId.startsWith('pch_'))).toBe(true)
  })
  it.skipIf(!HAS_FIXTURE)('raw_import_idは再実行で安定(冪等)', async () => {
    const a = explodeToRecords(await parseSheets(xlsxBuf)).filter(r => !r.shipping).map(r => r.rawImportId)
    const b = explodeToRecords(await parseSheets(xlsxBuf)).filter(r => !r.shipping).map(r => r.rawImportId)
    expect(a).toEqual(b)
  })
  it('同match_key衝突はocc_indexで別id化', () => {
    const dup = [
      { sheetMonth: 5, prizeNameRaw: 'X', piecesPerCase: 72, unitCost: 1000, caseCount: 1, distRaw: '田1', isShipping: false },
      { sheetMonth: 5, prizeNameRaw: 'X', piecesPerCase: 72, unitCost: 1000, caseCount: 1, distRaw: '田1', isShipping: false },
    ]
    const recs = explodeToRecords(dup)
    expect(recs[0].rawImportId).not.toBe(recs[1].rawImportId)
    expect(recs[0].occIndex).toBe(0)
    expect(recs[1].occIndex).toBe(1)
  })
})

describe('reconcile (照合)', () => {
  const mk = (over = {}) => ({
    rawImportId: 'pch_a', prizeNameRaw: 'P', destination: '田淵',
    caseCount: 2, expectedDate: '2026-05-15', memoRaw: '5/15出荷', shipping: false, ...over,
  })
  it('既存なし=insert', () => {
    const { summary } = reconcile([mk()], [])
    expect(summary.insert).toBe(1)
  })
  it('同値=skip', () => {
    const existing = [{ raw_import_id: 'pch_a', case_count: 2, expected_date: '2026-05-15', notes: '5/15出荷', status: 'ordered' }]
    const { summary } = reconcile([mk()], existing)
    expect(summary.skip).toBe(1)
  })
  it('数量変更=update', () => {
    const existing = [{ raw_import_id: 'pch_a', case_count: 1, expected_date: '2026-05-15', notes: '5/15出荷', status: 'ordered' }]
    const { summary } = reconcile([mk({ caseCount: 2 })], existing)
    expect(summary.update).toBe(1)
  })
  it('arrived済の変更=conflict(上書きしない)', () => {
    const existing = [{ raw_import_id: 'pch_a', case_count: 1, expected_date: '2026-05-15', notes: '5/15出荷', status: 'arrived', arrived_at: '2026-05-20T00:00:00Z' }]
    const { records, summary } = reconcile([mk({ caseCount: 9 })], existing)
    expect(summary.conflict).toBe(1)
    expect(records.find(r => r.state === 'conflict').conflictReason).toBe('arrived_changed')
  })
  it('Excelから消失(ordered)=cancel', () => {
    const existing = [{ raw_import_id: 'pch_gone', case_count: 1, status: 'ordered', import_meta: { sheet_month: 5 } }]
    const { summary } = reconcile([], existing)
    expect(summary.cancel).toBe(1)
  })
  it('arrived済が消失=conflict(cancelしない)', () => {
    const existing = [{ raw_import_id: 'pch_gone', case_count: 1, status: 'arrived', arrived_at: '2026-05-20T00:00:00Z', import_meta: { sheet_month: 5 } }]
    const { summary, records } = reconcile([], existing)
    expect(summary.conflict).toBe(1)
    expect(records[0].conflictReason).toBe('arrived_disappeared')
  })
})

describe.skipIf(!HAS_FIXTURE)('previewPchImport (state付きrecords契約 / regression)', () => {
  const fileLike = { arrayBuffer: async () => xlsxBuf }
  it('返すrecordsは全件state付き (reconcile結果、生explodeで上書きしない)', async () => {
    const preview = await previewPchImport(fileLike)
    expect(preview.records.length).toBeGreaterThan(0)
    // 全レコードに state がある (state無し=executePchImportが0件INSERTになるバグ)
    expect(preview.records.every(r => typeof r.state === 'string')).toBe(true)
  })
  it('既存pch_excel無し → 大半insert / state==insert件数とsummary.insertが一致', async () => {
    const preview = await previewPchImport(fileLike)
    const insertRecs = preview.records.filter(r => r.state === 'insert')
    expect(insertRecs.length).toBeGreaterThan(0)
    expect(insertRecs.length).toBe(preview.summary.insert)
  })
})
