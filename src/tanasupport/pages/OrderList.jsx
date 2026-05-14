import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../shared/auth/useRole'
import { logWithLocation } from '../../services/audit'
import { useGeolocation } from '../../shared/hooks/useGeolocation'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'

const TABS = [
  { key: 'shipped', label: '入荷待ち', color: 'text-rose-400' },
  { key: 'ordered', label: '発注中',   color: 'text-amber-400' },
  { key: 'arrived', label: '入荷済み', color: 'text-emerald-400' },
]

export default function OrderList() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'shipped')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ shipped: 0, ordered: 0, arrived: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const { staffId } = useRole()
  const { getLocation } = useGeolocation()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  useEffect(() => {
    async function loadCounts() {
      const [r1, r2, r3] = await Promise.all([
        supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped'),
        supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'ordered'),
        supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'arrived'),
      ])
      setCounts({ shipped: r1.count ?? 0, ordered: r2.count ?? 0, arrived: r3.count ?? 0 })
    }
    loadCounts()
  }, [])

  const load = useCallback(async (status) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('prize_orders')
      .select('order_id, prize_name_short, prize_name_raw, supplier_id, order_date, expected_date, case_count, destination, status, arrived_at')
      .eq('status', status)
      .order('expected_date', { ascending: true, nullsFirst: false })
      .limit(300)
    if (error) { setLoading(false); return }
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { setOrders([]); load(tab) }, [tab, load])

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
      setCounts(c => ({ ...c, shipped: Math.max(0, c.shipped - 1), arrived: c.arrived + 1 }))
      // fire-and-forget: 業務優先
      getLocation().then(location => logWithLocation({
        staff_id: staffId,
        action: 'order_received',
        target_table: 'prize_orders',
        target_id: orderId,
        organization_id: '14e907a7-65a3-4891-9a3c-20ea0a7c14fd',
        location,
      }))
    }
    setSaving(null)
  }

  const isOverdue = (o) => o.expected_date && o.expected_date < today

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <PageHeader
        module="tanasupport"
        title="発注一覧"
        onBack={() => navigate('/tanasupport')}
      />

      {/* 3列サマリーバー */}
      <div className="grid grid-cols-3 border-b border-border">
        <div className="flex flex-col items-center py-2.5 border-r border-border">
          <span className="text-lg font-mono font-bold text-rose-400">{counts.shipped}</span>
          <span className="text-[10px] text-muted mt-0.5">入荷待ち</span>
        </div>
        <div className="flex flex-col items-center py-2.5 border-r border-border">
          <span className="text-lg font-mono font-bold text-amber-400">{counts.ordered}</span>
          <span className="text-[10px] text-muted mt-0.5">発注中</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="text-lg font-mono font-bold text-emerald-400">{counts.arrived}</span>
          <span className="text-[10px] text-muted mt-0.5">完了</span>
        </div>
      </div>

      {/* タブバー */}
      <div className="flex px-5 gap-2 py-2.5 border-b border-border overflow-x-auto shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-surface2 text-text' : 'bg-surface text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* スクロール可能なリスト */}
      <div className="overflow-y-auto h-[calc(100dvh-196px)] px-5 pt-2 pb-4 space-y-2">
        {loading && orders.length === 0 && (
          <p className="text-muted text-center py-8">読み込み中...</p>
        )}
        {!loading && orders.length === 0 && (
          <p className="text-muted text-center py-8">件数ゼロ</p>
        )}
        {orders.map(o => (
          <div
            key={o.order_id}
            className={`bg-surface rounded-xl p-4 border border-border ${
              isOverdue(o) ? 'border-l-4 border-l-rose-500' : ''
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
                      ? <span className="text-rose-400">⚠️ 遅延 <DateTime value={o.expected_date} format="short" />予定</span>
                      : tab === 'arrived'
                        ? <><span>入荷 </span><DateTime value={o.arrived_at} format="short" /></>
                        : <><span>予定 </span><DateTime value={o.expected_date} format="short" /></>
                    }
                  </span>
                </div>
              </div>
              {tab === 'shipped' && (
                <button
                  onClick={() => markArrived(o.order_id)}
                  disabled={saving === o.order_id}
                  className="shrink-0 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                  style={{ fontSize: 13 }}
                >
                  {saving === o.order_id ? '…' : '受取済'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
