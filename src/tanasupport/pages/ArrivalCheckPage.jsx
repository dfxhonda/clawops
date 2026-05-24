import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useArrivalOrders } from '../../hooks/useArrivalOrders'
import ArrivalReceiveSheet from '../components/ArrivalReceiveSheet'
import DateTime from '../../shared/ui/DateTime'

const ARRIVAL_CHECK_ENABLED = import.meta.env.VITE_FF_ARRIVAL_CHECK === 'true'

const LANES = [
  { key: 'upcoming', label: '予定',     emptyMsg: '入荷予定なし' },
  { key: 'overdue',  label: '期日超過', emptyMsg: '超過なし' },
  { key: 'recent',   label: '入庫済',   emptyMsg: '直近入庫なし' },
]

export default function ArrivalCheckPage() {
  if (!ARRIVAL_CHECK_ENABLED) return <Navigate to="/tanasupport" replace />

  const navigate = useNavigate()
  const [lane, setLane]             = useState('upcoming')
  const [destFilter, setDestFilter] = useState('')
  const [selected, setSelected]     = useState(null)
  const { lanes, loading, reload }  = useArrivalOrders(destFilter)

  const currentLane = LANES.find(l => l.key === lane)

  return (
    <div className="min-h-dvh flex flex-col bg-bg text-text">
      {/* header */}
      <div
        className="sticky top-0 z-40 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#f43f5e' }}
      >
        <button onClick={() => navigate(-1)} className="text-muted text-xl leading-none shrink-0">‹</button>
        <div className="flex-1 font-bold text-base">入荷チェック</div>
      </div>

      {/* destination filter */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <input
          type="text"
          placeholder="入庫先で絞り込み..."
          value={destFilter}
          onChange={e => setDestFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-text text-sm outline-none"
        />
      </div>

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

      {/* order list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {loading && (
          <p className="text-muted text-center py-8 text-sm">読み込み中...</p>
        )}
        {!loading && lanes[lane].length === 0 && (
          <p className="text-muted text-center py-8 text-sm">{currentLane?.emptyMsg}</p>
        )}
        {!loading && lanes[lane].map(order => (
          <OrderCard
            key={order.order_id}
            order={order}
            showReceiveBtn={lane !== 'recent'}
            onReceive={() => setSelected(order)}
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
    </div>
  )
}

function OrderCard({ order, showReceiveBtn, onReceive }) {
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
          <p className="text-text text-sm font-medium line-clamp-2">
            {order.prize_name_short || order.prize_name_raw || '（景品未設定）'}
          </p>
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
