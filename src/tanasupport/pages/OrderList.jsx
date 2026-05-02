import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../shared/auth/useRole'
import { PageHeader } from '../../shared/ui/PageHeader'

const TABS = [
  { key: 'shipped', label: '入荷待ち', color: 'text-rose-400' },
  { key: 'ordered', label: '発注中',   color: 'text-amber-400' },
  { key: 'arrived', label: '入荷済み', color: 'text-emerald-400' },
]

const PAGE_SIZE = 30

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' })
}

export default function OrderList() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'shipped')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [saving, setSaving] = useState(null)
  const { staffId } = useRole()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const load = useCallback(async (status, pageNum) => {
    setLoading(true)
    let q = supabase
      .from('prize_orders')
      .select('order_id, prize_name_short, prize_name_raw, supplier_id, order_date, expected_date, case_count, destination, status, arrived_at')
      .eq('status', status)
      .order('expected_date', { ascending: true, nullsFirst: false })
      .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE)
    const { data, error } = await q
    if (error) { setLoading(false); return }
    setOrders(prev => pageNum === 0 ? (data || []) : [...prev, ...(data || [])])
    setHasMore((data || []).length === PAGE_SIZE + 1)
    setLoading(false)
  }, [])

  useEffect(() => { setPage(0); setOrders([]); load(tab, 0) }, [tab, load])

  async function markArrived(orderId) {
    setSaving(orderId)
    const { error } = await supabase
      .from('prize_orders')
      .update({
        status: 'arrived',
        arrived_at: new Date().toISOString(),
        received_by: staffId || 'unknown',
        is_fully_received: true,
      })
      .eq('order_id', orderId)
    if (!error) {
      setOrders(prev => prev.filter(o => o.order_id !== orderId))
    }
    setSaving(null)
  }

  const isOverdue = (o) => o.status === 'ordered' && o.expected_date && o.expected_date < today

  return (
    <div className="min-h-screen bg-bg text-text">

      <PageHeader
        module="tanasupport"
        title="発注一覧"
        onBack={() => navigate('/tanasupport')}
      />

      {/* Tabs */}
      <div className="flex px-5 gap-2 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-surface2 text-text'
                : 'bg-surface text-muted'
            }`}
            style={{ fontSize: 15 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-5 space-y-2 pb-10">
        {loading && orders.length === 0 && (
          <p className="text-muted text-center py-8">読み込み中...</p>
        )}
        {!loading && orders.length === 0 && (
          <p className="text-muted text-center py-8">件数ゼロ</p>
        )}
        {orders.map(o => (
          <div
            key={o.order_id}
            className={`bg-surface rounded-xl p-4 border ${
              isOverdue(o) ? 'border-amber-700/60' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm font-medium leading-snug line-clamp-2">
                  {o.prize_name_short || o.prize_name_raw}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted">
                  <span>{o.case_count}ケース</span>
                  <span>{o.supplier_id}</span>
                  {o.destination && <span>{o.destination}</span>}
                  <span>
                    {isOverdue(o)
                      ? <span className="text-amber-400">⚠️ 遅延 {fmtDate(o.expected_date)}予定</span>
                      : tab === 'arrived'
                        ? `入荷 ${fmtDate(o.arrived_at)}`
                        : `予定 ${fmtDate(o.expected_date)}`
                    }
                  </span>
                </div>
              </div>
              {tab === 'shipped' && (
                <button
                  onClick={() => markArrived(o.order_id)}
                  disabled={saving === o.order_id}
                  className="shrink-0 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg"
                  style={{ fontSize: 13 }}
                >
                  {saving === o.order_id ? '…' : '受取済'}
                </button>
              )}
            </div>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => { const next = page + 1; setPage(next); load(tab, next) }}
            className="w-full py-3 text-muted text-sm"
          >
            さらに読み込む
          </button>
        )}
      </div>
    </div>
  )
}
