import { useNavigate, useLocation } from 'react-router-dom'
import { calcMeterDiff } from '../../services/calc'
import { REPORT_KEY } from './DraftList'

const REPORT_TTL_MS = 24 * 60 * 60 * 1000

function loadReport(locationState) {
  // location.state 優先
  if (locationState?.savedDrafts) return locationState
  // sessionStorage からフォールバック（24時間以内のみ）
  try {
    const raw = sessionStorage.getItem(REPORT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.savedAt || Date.now() - data.savedAt > REPORT_TTL_MS) {
      sessionStorage.removeItem(REPORT_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function clearReport() {
  sessionStorage.removeItem(REPORT_KEY)
}

function buildRows(savedDrafts) {
  return (savedDrafts || []).map(d => {
    const inDiff  = calcMeterDiff(Number(d.in_meter),  Number(d.prev_in_meter))  ?? 0
    const outDiff = calcMeterDiff(Number(d.out_meter), Number(d.prev_out_meter)) ?? 0
    const sales   = inDiff * (d.play_price || 100)
    const payout  = inDiff > 0 ? Math.round(outDiff / inDiff * 100) : null
    const restock = parseInt(d.prize_restock_count) || 0
    return { ...d, inDiff, outDiff, sales, payout, restock }
  })
}

export default function Complete() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const report = loadReport(state)
  const rows = buildRows(report?.savedDrafts)
  const hasReport = rows.length > 0

  const totalInDiff  = rows.reduce((s, r) => s + r.inDiff,  0)
  const totalSales   = rows.reduce((s, r) => s + r.sales,   0)
  const totalRestock = rows.reduce((s, r) => s + r.restock, 0)
  const avgPayout = rows.filter(r => r.inDiff > 0).length > 0
    ? Math.round(rows.filter(r => r.inDiff > 0).reduce((s, r) => s + r.outDiff, 0) /
        rows.filter(r => r.inDiff > 0).reduce((s, r) => s + r.inDiff, 0) * 100)
    : null

  const readDate = rows[0]?.read_date || new Date().toISOString().slice(0, 10)
  const storeName = report?.storeName || state?.storeName || ''
  const storeId   = report?.storeId   || state?.storeId   || ''

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; color: black; } }`}</style>
      <div className="min-h-screen pb-8">
        {/* ヘッダー */}
        <div className="no-print sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5" />

        <div className="px-4 pt-6 text-center mb-6">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold">入力完了！</h2>
          <p className="text-muted text-sm mt-1">
            {storeName}　{readDate}
          </p>
        </div>

        {hasReport && (
          <div className="px-3 mb-6">
            {/* 帳票タイトル */}
            <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 px-1">
              集金帳票
            </div>

            {/* テーブル */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="text-left px-2 py-2 font-semibold">ブース</th>
                    <th className="text-left px-2 py-2 font-semibold">景品</th>
                    <th className="text-right px-2 py-2 font-semibold">IN差</th>
                    <th className="text-right px-2 py-2 font-semibold">売上</th>
                    <th className="text-right px-2 py-2 font-semibold">出率</th>
                    <th className="text-right px-2 py-2 font-semibold">補充</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.booth_id || i} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-1.5 font-mono text-[11px]">{r.full_booth_code || r.booth_id}</td>
                      <td className="px-2 py-1.5 text-muted max-w-[80px] truncate">{r.prize_name || '-'}</td>
                      <td className="px-2 py-1.5 text-right">{r.inDiff > 0 ? r.inDiff.toLocaleString() : '-'}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">
                        {r.inDiff > 0 ? `¥${r.sales.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {r.payout !== null ? `${r.payout}%` : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {r.restock > 0 ? r.restock : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold bg-surface2">
                    <td className="px-2 py-2 text-xs" colSpan={2}>合計</td>
                    <td className="px-2 py-2 text-right">{totalInDiff.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-accent">¥{totalSales.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">
                      {avgPayout !== null ? `${avgPayout}%` : '-'}
                    </td>
                    <td className="px-2 py-2 text-right">{totalRestock > 0 ? totalRestock : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 印刷ボタン */}
            <button
              onClick={() => { window.print(); clearReport() }}
              className="no-print w-full mt-3 py-3 rounded-xl border border-border bg-surface2 text-sm font-semibold hover:border-accent/40 transition-all active:scale-[0.98]">
              🖨️ 帳票を印刷
            </button>
          </div>
        )}

        {/* ナビゲーションボタン */}
        <div className="no-print px-4 space-y-2 max-w-sm mx-auto">
          {storeId && (
            <button
              onClick={() => { clearReport(); navigate(`/machines/${storeId}`, { state: { storeName } }) }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors">
              機械選択に戻る
            </button>
          )}
          <button
            onClick={() => { clearReport(); navigate('/') }}
            className="w-full bg-surface2 border border-border text-text font-medium py-3 rounded-xl hover:border-accent/30 transition-colors">
            店舗選択に戻る
          </button>
        </div>
      </div>
    </>
  )
}
