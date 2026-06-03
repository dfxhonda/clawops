import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// J-SCHEMA-DROP-FIX-01: for_operator_id 列は DB から削除済、SELECT から除外。
const LIST_SELECT = 'order_id,order_date,expected_date,arrived_at,prize_name_raw,prize_name_short,supplier_id,case_count,case_quantity,unit_cost,case_cost,total_tax_included,shipping_cost,shipping_allocation,status,is_fully_received,received_quantity,received_by,destination,ordered_by,notes,order_source,import_meta'

const STATUS_VALUES = ['ordered', 'arrived', 'cancelled']

function fmt(v) { return v != null ? Number(v).toLocaleString() : '' }

function SortTh({ col, label, align = 'left', sortCol, sortAsc, onSort }) {
  const active = sortCol === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`py-1 px-2 whitespace-nowrap cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'} ${active ? 'text-blue-400' : 'text-muted hover:text-text'}`}
    >
      {label}{active ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  )
}

function ModalSection({ title, items }) {
  return (
    <div>
      <div className="text-xs font-bold text-muted border-b border-border pb-1 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        {items.map(([label, val]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">{label}</span>
            <span className="text-text">{val ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminOrderHistoryPage() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [totalCount, setTotal]    = useState(null)
  const [stFilter, setSt]         = useState('')
  const [receivedOnly, setRecv]   = useState(false)
  const [dateFrom, setFrom]       = useState('')
  const [dateTo, setTo]           = useState('')
  const [sortCol, setSortCol]     = useState('order_date')
  const [sortAsc, setSortAsc]     = useState(false)
  const [modal, setModal]         = useState(null)
  const [error, setError]         = useState(null)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('prize_orders')
      .select(`${LIST_SELECT}, prize_masters!prize_id(supplier_name)`, { count: 'exact' })
      .order(sortCol, { ascending: sortAsc })
    if (stFilter)     q = q.eq('status', stFilter)
    if (receivedOnly) q = q.eq('is_fully_received', true)
    if (dateFrom)     q = q.gte('order_date', dateFrom)
    if (dateTo)       q = q.lte('order_date', dateTo)
    const { data, count, error: e } = await q
    if (e) setError(e.message)
    else { setRows(data ?? []); if (count !== null) setTotal(count) }
    setLoading(false)
  }

  useEffect(() => { load() }, [stFilter, receivedOnly, dateFrom, dateTo, sortCol, sortAsc]) // eslint-disable-line

  function handleSort(col) {
    if (col === sortCol) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  const total = rows.reduce((s, r) => s + (r.total_tax_included ?? 0), 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            data-testid="order-filter-status"
            value={stFilter}
            onChange={e => setSt(e.target.value)}
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
          >
            <option value="">ステータス ALL</option>
            {STATUS_VALUES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm text-muted cursor-pointer">
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
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
          />
          <span className="text-muted text-sm">〜</span>
          <input
            type="date"
            data-testid="order-filter-date-to"
            value={dateTo}
            onChange={e => setTo(e.target.value)}
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
          />
          {totalCount !== null && (
            <span className="ml-auto text-sm text-muted whitespace-nowrap">
              全{totalCount.toLocaleString()}件 / 合計 ¥{total.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 overflow-x-auto">
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center text-muted text-sm py-8">該当なし</p>
        )}
        <div data-testid="order-list">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="text-muted border-b border-border">
                <SortTh col="order_date"          label="発注日"      align="left"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                <th className="text-left py-1 px-2 whitespace-nowrap text-muted">納品予定日</th>
                <th className="text-left py-1 px-2 whitespace-nowrap">景品名</th>
                <th className="text-left py-1 px-2 whitespace-nowrap">取引先</th>
                <SortTh col="case_count"          label="ケース数"    align="right" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                <SortTh col="total_tax_included"  label="合計(税込)"  align="right" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
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
                  <td className="py-1 px-2 text-muted whitespace-nowrap">{r.expected_date ?? ''}</td>
                  <td className="py-1 px-2 max-w-[180px]">
                    <div className="truncate text-text">{r.prize_name_raw}</div>
                    {r.prize_name_short && (
                      <div className="truncate text-sm text-gray-400">{r.prize_name_short}</div>
                    )}
                  </td>
                  <td className="py-1 px-2">
                    <div className="text-muted">{r.prize_masters?.supplier_name ?? r.supplier_id}</div>
                    {r.supplier_id && (
                      <div className="text-sm text-gray-400">{r.supplier_id}</div>
                    )}
                  </td>
                  <td className="py-1 px-2 text-right text-muted">{r.case_count}</td>
                  <td className="py-1 px-2 text-right text-text">{fmt(r.total_tax_included)}</td>
                  <td className="py-1 px-2">
                    <span className={`px-1 py-0.5 rounded text-xs font-bold ${
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
          </table>
        </div>
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
            <div className="flex flex-col gap-4 text-sm">
              <ModalSection title="発注情報" items={[
                ['発注日',       modal.order_date],
                ['納品予定日',   modal.expected_date],
                ['入荷日',       modal.arrived_at],
                ['ステータス',   modal.status],
                ['入荷済',       modal.is_fully_received ? 'Yes' : 'No'],
              ]} />
              <ModalSection title="景品・数量" items={[
                ['景品名(raw)',  modal.prize_name_raw],
                ['景品名(短縮)', modal.prize_name_short],
                ['ケース数',     modal.case_count],
                ['入数',         modal.case_quantity],
                ['単価',         fmt(modal.unit_cost)],
                ['ケース金額',   fmt(modal.case_cost)],
                ['合計(税込)',   fmt(modal.total_tax_included)],
                ['送料',         fmt(modal.shipping_cost)],
                ['送料按分',     fmt(modal.shipping_allocation)],
              ]} />
              <ModalSection title="関係者・備考" items={[
                ['納品先',           modal.destination],
                ['発注者',           modal.ordered_by],
                ['受取者',           modal.received_by],
                ['受取数量',         modal.received_quantity],
                ['発注元',           modal.order_source],
                ['備考',             modal.notes],
              ]} />
            </div>
            <p className="mt-4 text-xs text-muted">※ 発注操作は別システムで管理。このページは閲覧専用です。</p>
          </div>
        </div>
      )}
    </div>
  )
}
