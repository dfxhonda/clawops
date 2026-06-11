import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../shared/auth/useRole'
import { logWithLocation } from '../../services/audit'
import { useGeolocation } from '../../shared/hooks/useGeolocation'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import ArrivalConfirmDrawer from '../components/ArrivalConfirmDrawer'
// SPEC-LIST-FILTER-SORT-01: 共通 filter dropdown + sortable header + 列ソート hook。
import ListFilterBar from '../../components/ListFilterBar'
import SortableTableHeader from '../../components/SortableTableHeader'
import { useListSort } from '../../hooks/useListSort'
// SPEC-ARRIVAL-UX-01: 景品詳細 bottom sheet (全画面共通)。
import PrizeDetailDialog from '../../components/PrizeDetailDialog'

// J-ARRIVAL: 安定版で常時有効化 (VITE_FF_ARRIVAL_CHECK フラグ廃止、ヒロ承認B 2026-05-27)
const ARRIVAL_CHECK_ENABLED = true

const TABS = [
  { key: 'shipped', label: '入荷待ち', color: 'text-rose-400' },
  { key: 'ordered', label: '発注中',   color: 'text-amber-400' },
  { key: 'arrived', label: '入荷済み', color: 'text-emerald-400' },
]

export default function OrderList() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'shipped')
  // SPEC-STOCK-UI-FIX-01: destination 拠点フィルタ。'all' で全件、それ以外なら .eq('destination', value)。
  // SPEC-STOCK-LOCATION-FILTER-01: URL params owner_type='warehouse' + owner_id=<location_id> なら
  // locations から location_name を引いて自動的に destFilter に適用する (DB JOIN 確認済、
  // db_facts.prize_orders.location_id=3687/3828 filled、locations 16 拠点)。失敗時は 'all' 維持。
  const ownerType = params.get('owner_type') ?? ''
  const ownerId   = params.get('owner_id')   ?? ''
  const [destFilter, setDestFilter] = useState('all')
  // 自動解決した location_name (pill bar に hit しなくても候補補完で表示するため独立 state)。
  const [autoLocationName, setAutoLocationName] = useState('')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ shipped: 0, ordered: 0, arrived: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const { staffId } = useRole()
  const { getLocation } = useGeolocation()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  // SPEC-LIST-FILTER-SORT-01: 列ソート hook。初期は挿入順 (supabase order)、ヘッダクリックで切替。
  const { sortKey, sortDir, onSort, sorted } = useListSort()
  // SPEC-ARRIVAL-UX-01: 景品名タップで開く詳細 dialog の対象 row。
  const [detailRow, setDetailRow] = useState(null)

  // SPEC-STOCK-LOCATION-FILTER-01: warehouse + owner_id 受領時、locations から
  // location_name を引いて初期 destFilter に適用。失敗時はそのまま 'all' で続行 (LOG-SPEC-01)。
  // staff owner_type は prize_orders に担当列無いためスコープ外で全件表示。
  useEffect(() => {
    let cancel = false
    async function resolveOwner() {
      if (ownerType !== 'warehouse' || !ownerId) return
      const { data, error } = await supabase
        .from('locations')
        .select('location_name')
        .eq('location_id', ownerId)
        .maybeSingle()
      if (cancel) return
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[ERR-STOCK-LOCATION-LOOKUP]', error.message || String(error))
        return
      }
      const name = data?.location_name
      if (name) {
        setAutoLocationName(name)
        setDestFilter(name)
      }
    }
    resolveOwner()
    return () => { cancel = true }
  }, [ownerType, ownerId])

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

  const load = useCallback(async (status, dest) => {
    setLoading(true)
    // SPEC-STOCK-UI-FIX-01: dest フィルタは pill bar 由来。'all' なら filter なし、
    // それ以外は .eq('destination', dest) を chain に挿入。
    let q = supabase
      .from('prize_orders')
      .select('order_id, prize_name_short, prize_name_raw, supplier_id, order_date, expected_date, case_count, destination, status, arrived_at')
      .eq('status', status)
    if (dest && dest !== 'all') q = q.eq('destination', dest)
    const { data, error } = await q
      .order('expected_date', { ascending: true, nullsFirst: false })
      .limit(300)
    if (error) { setLoading(false); return }
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { setOrders([]); load(tab, destFilter) }, [tab, destFilter, load])

  // SPEC-STOCK-UI-FIX-01: 現在 fetch 済の orders から distinct destination を算出。
  // destination=null は除外、現タブ + 現 dest フィルタ後の値域なので '全て' に戻すまで
  // pill 候補が更新されない点は意図的 (UX 上現状の一覧から絞り込むメンタルモデル維持)。
  // SPEC-STOCK-LOCATION-FILTER-01: auto 解決した location_name が distinct に hit しない
  // ケース (例: 該当拠点に発注がまだ無い) でも pill 候補に補完表示して 'all' へ戻れる動線を維持。
  const distinctDestinations = useMemo(() => {
    const set = new Set()
    for (const o of orders) {
      if (o.destination) set.add(o.destination)
    }
    if (autoLocationName) set.add(autoLocationName)
    return Array.from(set).sort()
  }, [orders, autoLocationName])

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

  // SPEC-ORDERLIST-OVERDUE-ARRIVED-FIX-01: arrived は予定日過去が当然。未入荷のみ遅延判定
  const isOverdue = (o) => o.status !== 'arrived' && o.expected_date && o.expected_date < today

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <PageHeader
        module="tanasupport"
        title="発注一覧"
        onBack={() => ownerType && ownerId
          ? navigate(`/stock/hub?owner_type=${ownerType}&owner_id=${ownerId}`)
          : navigate('/stock')
        }
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
            data-testid={`order-status-tab-${t.key}`}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-surface2 text-text' : 'bg-surface text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SPEC-LIST-FILTER-SORT-01: 旧 pill bar を共通 ListFilterBar (拠点 dropdown) に置換。
          status は既存タブで網羅済のため filter には含めず、destination のみ追加。 */}
      <ListFilterBar
        filters={[{
          key: 'destination',
          label: '拠点',
          options: [
            { value: 'all', label: '全て' },
            ...distinctDestinations.map(d => ({ value: d, label: d })),
          ],
        }]}
        values={{ destination: destFilter }}
        onChange={(_k, v) => setDestFilter(v)}
        onReset={() => setDestFilter('all')}
      />

      {/* SPEC-LIST-FILTER-SORT-01: 列ソート header (div variant、card list 上部に張り付ける strip)。 */}
      <SortableTableHeader
        variant="div"
        columns={[
          { key: 'order_date',       label: '発注日',  className: 'w-[18%]' },
          { key: 'expected_date',    label: '予定',    className: 'w-[18%]' },
          { key: 'prize_name_raw',   label: '景品',    className: 'flex-1' },
          { key: 'destination',      label: '拠点',    className: 'w-[18%]' },
          { key: 'case_count',       label: 'ケース',  className: 'w-[14%]' },
        ]}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="text-xs text-muted bg-surface border-b border-border"
        cellClassName="text-xs"
      />

      {/* スクロール可能なリスト */}
      {/* SPEC-LIST-FILTER-SORT-01: FilterBar (~48px) + SortHeader (~44px) で +92px、calc 余白を 252→300 に。 */}
      <div className="overflow-y-auto h-[calc(100dvh-300px)] px-5 pt-2 pb-4 space-y-2">
        {loading && orders.length === 0 && (
          <p className="text-muted text-center py-8">読み込み中...</p>
        )}
        {!loading && orders.length === 0 && (
          <p className="text-muted text-center py-8">件数ゼロ</p>
        )}
        {sorted(orders).map(o => (
          <div key={o.order_id}>
            <div
              className={`bg-surface p-4 border border-border ${
                isOverdue(o) ? 'border-l-4 border-l-rose-500' : ''
              } ${
                ARRIVAL_CHECK_ENABLED && expandedOrderId === o.order_id
                  ? 'rounded-t-xl'
                  : 'rounded-xl'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* SPEC-ARRIVAL-UX-01: 景品名タップで PrizeDetailDialog 起動 */}
                  <button
                    type="button"
                    onClick={() => setDetailRow(o)}
                    data-testid={`order-prize-name-${o.order_id}`}
                    className="text-text text-sm font-medium leading-snug line-clamp-2 text-left underline decoration-dotted decoration-muted/40 hover:decoration-accent cursor-pointer"
                  >
                    {o.prize_name_short || o.prize_name_raw}
                  </button>
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
                  ARRIVAL_CHECK_ENABLED ? (
                    <button
                      onClick={() => setExpandedOrderId(prev => prev === o.order_id ? null : o.order_id)}
                      className="shrink-0 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      {expandedOrderId === o.order_id ? '▲' : '受取確認'}
                    </button>
                  ) : (
                    <button
                      onClick={() => markArrived(o.order_id)}
                      disabled={saving === o.order_id}
                      className="shrink-0 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      {saving === o.order_id ? '…' : '受取済'}
                    </button>
                  )
                )}
              </div>
            </div>
            {ARRIVAL_CHECK_ENABLED && tab === 'shipped' && expandedOrderId === o.order_id && (
              <ArrivalConfirmDrawer
                order={o}
                staffId={staffId}
                onDone={() => {
                  setOrders(prev => prev.filter(x => x.order_id !== o.order_id))
                  setCounts(c => ({ ...c, shipped: Math.max(0, c.shipped - 1), arrived: c.arrived + 1 }))
                  setExpandedOrderId(null)
                }}
                onCancel={() => setExpandedOrderId(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* SPEC-ARRIVAL-UX-01: 景品名タップで開く詳細 dialog */}
      {detailRow && (
        <PrizeDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  )
}
