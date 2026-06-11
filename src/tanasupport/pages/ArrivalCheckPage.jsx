import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useArrivalOrders } from '../../hooks/useArrivalOrders'
import { supabase } from '../../lib/supabase'
import ArrivalReceiveSheet from '../components/ArrivalReceiveSheet'
import DateTime from '../../shared/ui/DateTime'
// SPEC-LIST-FILTER-SORT-01: 共通 filter bar + sortable header + ソート hook。
import ListFilterBar from '../../components/ListFilterBar'
import SortableTableHeader from '../../components/SortableTableHeader'
import { useListSort } from '../../hooks/useListSort'
// SPEC-ARRIVAL-UX-01: 景品詳細 bottom sheet (全画面共通)。
import PrizeDetailDialog from '../../components/PrizeDetailDialog'

// J-ARRIVAL: 安定版で常時有効化 (VITE_FF_ARRIVAL_CHECK フラグ廃止、ヒロ承認B 2026-05-27)
const ARRIVAL_CHECK_ENABLED = true

// SPEC-ARRIVAL-LANE-CATCHALL-01: 要確認 → 予定 → 入庫済 の順、初期タブ=要確認
const LANES = [
  { key: 'youkakunin', label: '要確認', emptyMsg: '要確認なし' },
  { key: 'upcoming',   label: '予定',   emptyMsg: '入荷予定なし' },
  { key: 'recent',     label: '入庫済', emptyMsg: '直近入庫なし' },
]

// J-STOCK-OWNER-FILTER-01 (司令塔Opus spec):
// URL クエリ owner_type / owner_id を受け取り、warehouse なら location_id eq 絞り。
// ヘッダーに locations.location_name を表示。テキスト絞り (destination ilike) は併用維持。
// owner_type=staff は prize_orders に担当列が無いためスコープ外 → 全件 + 'staff 担当別未対応' 表示。
export default function ArrivalCheckPage() {
  if (!ARRIVAL_CHECK_ENABLED) return <Navigate to="/tanasupport" replace />

  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ownerType = params.get('owner_type') ?? ''
  const ownerId   = params.get('owner_id')   ?? ''
  const goBack = () => ownerType && ownerId
    ? navigate(`/stock/hub?owner_type=${ownerType}&owner_id=${ownerId}`)
    : navigate('/stock')

  const isWarehouse = ownerType === 'warehouse' && !!ownerId
  const isStaff     = ownerType === 'staff'     && !!ownerId
  const locationId  = isWarehouse ? ownerId : null

  const [lane, setLane]             = useState('youkakunin')
  // SPEC-ARRIVAL-UX-01 fix_1: 旧「入庫先で絞り込み...」textFilter UI 廃止。
  // useArrivalOrders は textFilter を依然受け取るため空文字で固定 (シグネチャ維持)。
  const textFilter = ''
  // SPEC-ARRIVAL-UX-01 fix_2: 景品名タップで開く詳細 dialog の対象 row state。
  const [detailRow, setDetailRow]   = useState(null)
  // SPEC-LIST-FILTER-SORT-01: destination dropdown (現 lane の distinct から構築、'all' で全件)。
  const [destFilter, setDestFilter] = useState('all')
  const [selected, setSelected]     = useState(null)
  const [ownerName, setOwnerName]   = useState('')

  const { lanes, loading, reload }  = useArrivalOrders(locationId, textFilter)

  // SPEC-LIST-FILTER-SORT-01: 列ソート。lane ごとに display 直前で sorted() を適用。
  const { sortKey, sortDir, onSort, sorted } = useListSort()

  // 現 lane の distinct destination (FilterBar dropdown 用)。
  const distinctDestinations = useMemo(() => {
    const set = new Set()
    for (const o of (lanes?.[lane] ?? [])) {
      if (o.destination) set.add(o.destination)
    }
    return Array.from(set).sort()
  }, [lanes, lane])

  // 表示 list = lane data → destFilter で絞込 → ソート。
  const visible = useMemo(() => {
    const base = (lanes?.[lane] ?? []).filter(o =>
      destFilter === 'all' || o.destination === destFilter
    )
    return sorted(base)
  }, [lanes, lane, destFilter, sorted])

  // ヘッダ用に拠点名/担当名を fetch
  useEffect(() => {
    let cancel = false
    async function load() {
      if (isWarehouse) {
        const { data } = await supabase
          .from('locations')
          .select('location_id, location_name')
          .eq('location_id', ownerId)
          .maybeSingle()
        if (!cancel) setOwnerName(data?.location_name ?? ownerId)
      } else if (isStaff) {
        const { data } = await supabase
          .from('staff')
          .select('staff_id, name')
          .eq('staff_id', ownerId)
          .maybeSingle()
        if (!cancel) setOwnerName(data?.name ?? ownerId)
      } else {
        if (!cancel) setOwnerName('')
      }
    }
    load()
    return () => { cancel = true }
  }, [isWarehouse, isStaff, ownerId])

  const currentLane = LANES.find(l => l.key === lane)
  const headerSub = isWarehouse
    ? (ownerName || ownerId)
    : isStaff
      ? `${ownerName || ownerId} (担当別未対応)`
      : null

  return (
    // scroll fix: min-h-dvh → h-dvh で flex container を viewport 高さに固定、
    // 内部 flex-1 overflow-y-auto に min-h-0 を付与してスクロールコンテキスト確立。
    // html/body は index.css で overflow:hidden 済みなので、最外側は h-dvh + 内部スクロールが正規パターン。
    <div className="h-dvh flex flex-col bg-bg text-text">
      {/* header */}
      <div
        className="sticky top-0 z-40 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#f43f5e' }}
      >
        <button onClick={goBack} className="text-muted text-xl leading-none shrink-0">‹</button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">入荷チェック</div>
          {headerSub && (
            <div data-testid="arrival-owner-name" className="text-[11px] text-muted truncate mt-0.5">{headerSub}</div>
          )}
        </div>
      </div>

      {/* staff スコープ外案内 */}
      {isStaff && (
        <div data-testid="arrival-staff-unsupported" className="px-4 pt-2 shrink-0">
          <p className="text-[11px] text-amber-400/90 leading-snug">
            担当別の入荷絞り込みは未対応です (prize_orders に担当列なし)。全件を表示しています。
          </p>
        </div>
      )}

      {/* SPEC-ARRIVAL-UX-01 fix_1: 旧「入庫先で絞り込み...」テキスト box 削除 (拠点 DD で代替済)。 */}

      {/* SPEC-LIST-FILTER-SORT-01: 共通 ListFilterBar (現 lane の distinct から作成)。 */}
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

      {/* lane tabs */}
      <div className="flex px-4 gap-1 pb-2 shrink-0">
        {LANES.map(l => {
          const count = lanes[l.key].length
          return (
            <button
              key={l.key}
              onClick={() => setLane(l.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                lane === l.key ? 'bg-accent text-white' : 'bg-surface text-muted'
              }`}
            >
              {l.label}
              {!loading && (
                <span className={`ml-0.5 ${lane === l.key ? 'text-white/70' : ''}`}>
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* SPEC-LIST-FILTER-SORT-01: sortable header (div variant、card list 上部 strip)。 */}
      <SortableTableHeader
        variant="div"
        columns={[
          { key: 'expected_date',    label: '予定',   className: 'w-[22%]' },
          { key: 'prize_name_raw',   label: '景品',   className: 'flex-1' },
          { key: 'destination',      label: '拠点',   className: 'w-[22%]' },
          { key: 'case_count',       label: 'ケース', className: 'w-[14%]' },
        ]}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="px-2 text-xs text-muted bg-surface border-b border-border shrink-0"
        cellClassName="text-xs"
      />

      {/* order list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-2">
        {loading && (
          <p className="text-muted text-center py-8 text-sm">読み込み中...</p>
        )}
        {!loading && visible.length === 0 && (
          <p className="text-muted text-center py-8 text-sm">{currentLane?.emptyMsg}</p>
        )}
        {!loading && visible.map(order => (
          <OrderCard
            key={order.order_id}
            order={order}
            showReceiveBtn={lane !== 'recent'}
            onReceive={() => setSelected(order)}
            onTapName={() => setDetailRow(order)}
          />
        ))}
      </div>

      {selected && (
        <ArrivalReceiveSheet
          order={selected}
          onDone={() => { setSelected(null); reload() }}
          onCancel={() => setSelected(null)}
        />
      )}

      {/* SPEC-ARRIVAL-UX-01 fix_2: 景品名タップで開く詳細 dialog */}
      {detailRow && (
        <PrizeDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  )
}

function OrderCard({ order, showReceiveBtn, onReceive, onTapName }) {
  const alreadyReceived = order.received_quantity ?? 0
  const remaining       = (order.case_count ?? 0) - alreadyReceived
  const isPartial       = order.status === 'partial'
  const isArrived       = order.status === 'arrived'

  return (
    <div className={`bg-surface border rounded-xl p-4 ${
      isPartial ? 'border-amber-500/50' :
      isArrived ? 'border-emerald-500/40' :
      'border-border'
    }`}>
      <div className="flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          {/* SPEC-ARRIVAL-UX-01 fix_2: 景品名タップで PrizeDetailDialog 起動 */}
          <button
            type="button"
            onClick={onTapName}
            data-testid={`arrival-prize-name-${order.order_id}`}
            className="text-text text-sm font-medium line-clamp-2 text-left underline decoration-dotted decoration-muted/40 hover:decoration-accent cursor-pointer"
          >
            {order.prize_name_short || order.prize_name_raw || '（景品未設定）'}
          </button>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
            {order.supplier_id && <span>{order.supplier_id}</span>}
            {order.destination && <span>{order.destination}</span>}
            {order.case_count != null
              ? <span>{order.case_count}ケース</span>
              : <span>ケース数不明</span>
            }
            {order.expected_date && !isArrived && (
              <span>予定 <DateTime value={order.expected_date} format="short" /></span>
            )}
            {isArrived && order.arrived_at && (
              <span className="text-emerald-400">
                入庫 <DateTime value={order.arrived_at} format="short" />
              </span>
            )}
          </div>

          {/* partial progress bar */}
          {isPartial && order.case_count != null && (
            <div className="mt-2 space-y-0.5">
              <div className="flex justify-between text-[10px] text-muted">
                <span>入庫済 {alreadyReceived} / {order.case_count}</span>
                <span className="text-amber-400">残り {remaining}</span>
              </div>
              <div className="h-1 bg-surface2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${Math.min(100, (alreadyReceived / order.case_count) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {order.unplanned_flag && (
            <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
              予定外
            </span>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isArrived && (
            <span className="text-[10px] text-emerald-400 font-bold border border-emerald-500/40 px-2 py-0.5 rounded-full">
              入庫済
            </span>
          )}
          {isPartial && (
            <span className="text-[10px] text-amber-400 font-bold border border-amber-500/40 px-2 py-0.5 rounded-full">
              一部入庫
            </span>
          )}
          {showReceiveBtn && !isArrived && (
            <button
              onClick={onReceive}
              className="mt-1 bg-rose-500 text-white text-xs font-bold px-3 py-2 rounded-lg active:scale-[0.97] transition-transform"
            >
              受取
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
