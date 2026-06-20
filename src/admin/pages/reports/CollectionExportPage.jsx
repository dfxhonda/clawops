// SPEC-COLLECTION-EXPORT-FIX-03: changer除外(type_id='changer'クライアントフィルタ)
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../../lib/supabase'
import ReportPageLayout from './ReportPageLayout'

function prevMonthJst() {
  const now = new Date()
  const jstStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const [y, m] = jstStr.split('-').map(Number)
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  return `${py}-${String(pm).padStart(2, '0')}`
}

function monthRange(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const start = `${yyyyMM}-01`
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  const end = `${ny}-${String(nm).padStart(2, '0')}-01`
  return { start, end }
}

// collected_at は date 型 (YYYY-MM-DD)、そのまま返す
function toJstDate(dateStr) {
  return dateStr ?? ''
}

export default function CollectionExportPage() {
  const [month, setMonth] = useState(prevMonthJst)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!month) return
    setLoading(true)
    const { start, end } = monthRange(month)
    supabase
      .from('cash_collection_booths')
      .select(`
        booth_code,
        machine_code,
        in_meter_prev,
        in_meter_current,
        total,
        advance_payment,
        notes,
        machines(machine_name, type_id),
        cash_collections!inner(
          collection_id,
          collected_at,
          status,
          store_code,
          stores!inner(store_name)
        )
      `)
      .eq('cash_collections.status', 'confirmed')
      .gte('cash_collections.collected_at', start)
      .lt('cash_collections.collected_at', end)
      .order('cash_collections(store_code)', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) { setRows([]); setLoading(false); return }
        const nonChanger = data.filter(r => r.machines?.type_id !== 'changer')
        const sorted = [...nonChanger].sort((a, b) => {
          const sc = a.cash_collections.store_code.localeCompare(b.cash_collections.store_code)
          if (sc !== 0) return sc
          const dc = a.cash_collections.collected_at.localeCompare(b.cash_collections.collected_at)
          if (dc !== 0) return dc
          return a.booth_code.localeCompare(b.booth_code)
        })
        setRows(sorted)
        setLoading(false)
      })
  }, [month])

  function handleDownload() {
    if (rows.length === 0) return
    const header = ['集金日', '店舗名', '機械番号', '機械名', '前回メーター', '今回メーター', 'メーター差', '集金金額', '建て替え金額', '備考']
    const dataRows = rows.map((r, i) => {
      const col = r.cash_collections
      const eRow = i + 2 // 1-indexed, row 1 = header
      return [
        toJstDate(col.collected_at),
        col.stores?.store_name ?? '',
        r.machine_code ?? '',
        r.machines?.machine_name ?? '',
        r.in_meter_prev != null ? Number(r.in_meter_prev) : '',
        r.in_meter_current != null ? Number(r.in_meter_current) : '',
        { f: `F${eRow}-E${eRow}` },
        r.total != null ? Number(r.total) : '',
        r.advance_payment != null ? Number(r.advance_payment) : '',
        r.notes ?? '',
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows])

    // header bold
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c })
      if (!ws[cellAddr]) continue
      ws[cellAddr].s = { font: { bold: true } }
    }
    // freeze pane A2
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '集金明細')
    XLSX.writeFile(wb, `集金明細_${month}.xlsx`)
  }

  return (
    <ReportPageLayout title="集金抽出" testid="report-collection-export">
      <div className="space-y-4 max-w-lg">
        {/* 月選択 */}
        <div>
          <label className="block text-xs text-muted mb-1">対象月</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {/* 件数プレビュー */}
        <div className="text-sm text-muted">
          {loading ? '読み込み中…' : `${rows.length} 明細行`}
        </div>

        {/* DLボタン */}
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-muted bg-surface border border-border rounded-lg px-4 py-3">
            該当データなし
          </p>
        ) : (
          <button
            onClick={handleDownload}
            disabled={loading || rows.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            {`集金明細_${month}.xlsx をダウンロード`}
          </button>
        )}
      </div>
    </ReportPageLayout>
  )
}
