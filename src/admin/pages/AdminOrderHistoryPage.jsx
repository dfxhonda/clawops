import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const LIST_SELECT = 'order_id,order_date,prize_name_raw,prize_name_short,supplier_id,case_count,unit_cost,total_tax_included,status,destination,ordered_by,expected_date,arrived_at,is_fully_received'

const STATUS_VALUES = ['ordered', 'arrived', 'cancelled']

function fmt(v) { return v != null ? Number(v).toLocaleString() : '' }

export default function AdminOrderHistoryPage() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [stFilter, setSt]         = useState('')
  const [receivedOnly, setRecv]   = useState(false)
  const [dateFrom, setFrom]       = useState('')
  const [dateTo, setTo]           = useState('')
  const [modal, setModal]         = useState(null)
  const [error, setError]         = useState(null)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('prize_orders')
      .select(LIST_SELECT)
      .order('order_date', { ascending: false })
      .limit(50)
    if (stFilter)     q = q.eq('status', stFilter)
    if (receivedOnly) q = q.eq('is_fully_received', true)
    if (dateFrom)     q = q.gte('order_date', dateFrom)
    if (dateTo)       q = q.lte('order_date', dateTo)
    const { data, error: e } = await q
    if (e) setError(e.message)
    else setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [stFilter, receivedOnly, dateFrom, dateTo]) // eslint-disable-line

  const total = rows.reduce((s, r) => s + (r.total_tax_included ?? 0), 0)

  return (
    <div className="p-3 min-h-full">
      {/* toolbar */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select
          data-testid="order-filter-status"
          value={stFilter}
          onChange={e => setSt(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
        >
          <option value="">ステータス ALL</option>
          {STATUS_VALUES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            data-testid="order-filter-received"
            checked={receivedOnly}
            onChange={e => setRecv(e.target.checked)}
            className="accent-blue-500"
          />
          入荷済のみ
        </label>
        <input
          type="date"
          data-testid="order-filter-date-from"
          value={dateFrom}
          onChange={e => setFrom(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
        />
        <span className="text-muted text-xs">〜</span>
        <input
          type="date"
          data-testid="order-filter-date-to"
          value={dateTo}
          onChange={e => setTo(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
        />
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      {loading && <p className="text-center text-muted text-xs py-8">読込中…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-muted text-xs py-8">該当なし</p>
      )}

      {/* list */}
      <div data-testid="order-list" className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="text-left py-1 px-2 whitespace-nowrap">発注日</th>
              <th className="text-left py-1 px-2 whitespace-nowrap">景品名</th>
              <th className="text-left py-1 px-2 whitespace-nowrap">取引先</th>
              <th className="text-right py-1 px-2 whitespace-nowrap">ケース数</th>
              <th className="text-right py-1 px-2 whitespace-nowrap">合計(税込)</th>
              <th className="text-left py-1 px-2 whitespace-nowrap">ステータス</th>
              <th className="text-left py-1 px-2 whitespace-nowrap">納品先</th>
              <th className="text-center py-1 px-2 whitespace-nowrap">入荷済</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.order_id}
                data-testid="order-row"
                onClick={() => setModal(r)}
                className="border-b border-border/50 hover:bg-surface cursor-pointer"
              >
                <td className="py-1 px-2 text-muted whitespace-nowrap">{r.order_date}</td>
                <td className="py-1 px-2 text-text max-w-[180px] truncate">{r.prize_name_raw}</td>
                <td className="py-1 px-2 text-muted">{r.supplier_id}</td>
                <td className="py-1 px-2 text-right text-muted">{r.case_count}</td>
                <td className="py-1 px-2 text-right text-text">{fmt(r.total_tax_included)}</td>
                <td className="py-1 px-2">
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'arrived' ? 'bg-green-600 text-white' :
                    r.status === 'cancelled' ? 'bg-gray-600 text-gray-300' :
                    'bg-blue-600 text-white'
                  }`}>{r.status}</span>
                </td>
                <td className="py-1 px-2 text-muted">{r.destination}</td>
                <td className="py-1 px-2 text-center">{r.is_fully_received ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border font-bold">
                <td colSpan={4} className="py-1 px-2 text-muted text-xs">合計 ({rows.length}件)</td>
                <td className="py-1 px-2 text-right text-text">{total.toLocaleString()}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* detail modal (READ ONLY) */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div data-testid="order-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">発注詳細</span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['発注日', modal.order_date],
                ['景品名(raw)', modal.prize_name_raw],
                ['景品名(短縮)', modal.prize_name_short],
                ['取引先ID', modal.supplier_id],
                ['ケース数', modal.case_count],
                ['単価', fmt(modal.unit_cost)],
                ['合計(税込)', fmt(modal.total_tax_included)],
                ['ステータス', modal.status],
                ['納品先', modal.destination],
                ['発注者', modal.ordered_by],
                ['予定日', modal.expected_date],
                ['入荷日', modal.arrived_at],
                ['入荷済', modal.is_fully_received ? 'Yes' : 'No'],
              ].map(([label, val]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted">{label}</span>
                  <span className="text-text">{val ?? '—'}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-muted">※ 発注操作は別システムで管理。このページは閲覧専用です。</p>
          </div>
        </div>
      )}
    </div>
  )
}
