import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSaveState } from '../../hooks/useSaveState'
import ErrorBanner from '../../components/ErrorBanner'
import { useAuth } from '../../hooks/useAuth'
import { logger } from '../../lib/logger'

const DESTINATION_MAP = {
  '田隈':   'TKM01',
  '飯塚':   'IZK01',
  '鹿児島': 'KGS01',
  '久留米': 'KRM02',
  '霧島':   'KRS01',
}

function guessLocationId(destination) {
  if (!destination) return ''
  for (const [key, id] of Object.entries(DESTINATION_MAP)) {
    if (destination.includes(key)) return id
  }
  return ''
}

export default function ArrivalReceiveSheet({ order, onDone, onCancel, contextLocationId = null }) {
  const { staffId } = useAuth()
  const [locations, setLocations]   = useState([])
  const [locationId, setLocationId] = useState('')
  const [qty, setQty] = useState('')
  const [saveState, { setLoading, setError, setSuccess, reset }] = useSaveState()

  useEffect(() => {
    supabase.from('locations').select('location_id, location_name')
      .eq('is_active', true).order('location_name')
      .then(({ data }) => {
        const locs = data ?? []
        setLocations(locs)
        // SPEC-ARRIVAL-RECEIVE-LOCATION-CONTEXT-01 (D-084) C2: 入庫先初期値の優先度。
        // (1) 拠点コンテキスト = 拠点を選んで入荷チェックを開いているのが真実、テキスト推測より優先。
        // (2) コンテキスト無しのみ order.destination テキスト推測 (guessLocationId)。
        // (3) どちらも無理なら空欄のまま。旧 locs[0] (location_name 順先頭=エイド) 自動選択 fallback は
        //     黙って誤拠点入庫を招く安全違反のため廃止。未選択保存は既存 ERR-STOCK-003 がブロック。
        if (contextLocationId && locs.some(l => l.location_id === contextLocationId)) {
          setLocationId(contextLocationId)
        } else {
          const guess = guessLocationId(order.destination)
          if (guess && locs.some(l => l.location_id === guess)) {
            setLocationId(guess)
          }
        }
      })
  }, [order.destination, contextLocationId])

  const alreadyReceived = order.received_quantity ?? 0
  const remaining       = (order.case_count ?? 0) - alreadyReceived
  const parsedQty       = parseInt(qty, 10)
  const newTotal        = alreadyReceived + (isNaN(parsedQty) ? 0 : parsedQty)
  const isOver          = order.case_count != null && newTotal > order.case_count

  async function handleConfirm() {
    if (!parsedQty || parsedQty <= 0) { setError('ERR-STOCK-008', '受取数を入力してください'); return }
    if (!locationId)                  { setError('ERR-STOCK-003', '入庫先を選択してください'); return }
    if (isOver) {
      setError('ERR-ARRIVAL-001', `入庫数合計 ${newTotal} がケース数 ${order.case_count} を超えます`)
      return
    }
    if (!setLoading()) return

    try {
      const { error } = await supabase.rpc('fn_confirm_arrival', {
        p_order_id:          order.order_id,
        p_to_owner_type:     'location',
        p_to_owner_id:       locationId,
        p_received_quantity: parsedQty,
        p_staff_id:          staffId || 'unknown',
      })
      if (error) {
        const code = error.message?.includes('ERR-ARRIVAL-001') ? 'ERR-ARRIVAL-001'
                   : error.message?.includes('ERR-STOCK-004')   ? 'ERR-STOCK-004'
                   : 'ERR-STOCK-003'
        const msg  = code === 'ERR-ARRIVAL-001' ? `入庫数がケース数 ${order.case_count} を超えます`
                   : code === 'ERR-STOCK-004'   ? 'この発注は既に入庫確定済みです'
                   : (error.message || '入庫確定に失敗しました')
        logger.error('arrival_receive_error', { code, order_id: order.order_id, raw: error.message })
        setError(code, msg)
        return
      }
      logger.info('arrival_received', { order_id: order.order_id, qty: parsedQty, location: locationId })
      setSuccess()
      setTimeout(() => onDone(), 1200)
    } catch (e) {
      logger.error('arrival_receive_error', { errCode: 'ERR-STOCK-003', raw: e?.message })
      setError('ERR-STOCK-003', e?.message || '入庫確定に失敗しました')
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-bg border-t border-border rounded-t-2xl">
        <div className="w-12 h-1 bg-border/60 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-5 pb-10 space-y-4">
          {/* order name */}
          <p className="text-text text-base font-bold line-clamp-2 pr-2">
            {order.prize_name_short || order.prize_name_raw || '（景品未設定）'}
          </p>

          {/* progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted">
              <span>入庫済 {alreadyReceived} / {order.case_count ?? '?'} ケース</span>
              {order.case_count != null && (
                <span className={remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  残り {remaining} ケース
                </span>
              )}
            </div>
            {order.case_count != null && (
              <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (alreadyReceived / order.case_count) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* destination select */}
          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">入庫先</div>
            <select
              value={locationId}
              onChange={e => { reset(); setLocationId(e.target.value) }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark]"
            >
              <option value="">選択してください</option>
              {locations.map(l => (
                <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
              ))}
            </select>
          </div>

          {/* qty input */}
          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">受取数 (ケース)</div>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={qty}
              onChange={e => { reset(); setQty(e.target.value) }}
              placeholder={remaining > 0 ? String(remaining) : '0'}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-lg text-right font-mono outline-none"
            />
          </div>

          {/* over warning */}
          {isOver && (
            <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              ⚠ 受取数合計 {newTotal} がケース数 {order.case_count} を超えます
            </div>
          )}

          {saveState.status === 'error' && (
            <ErrorBanner
              errCode={saveState.errCode}
              message={saveState.errMessage}
              onClose={reset}
              onRetry={handleConfirm}
            />
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 text-sm font-bold rounded-xl bg-surface border border-border text-muted active:scale-[0.98] transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={!qty || isOver || saveState.status === 'loading' || saveState.status === 'success'}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 ${
                saveState.status === 'success' ? 'bg-emerald-600 text-white' : 'bg-accent text-bg'
              }`}
            >
              {saveState.status === 'loading' ? '確定中…'
                : saveState.status === 'success' ? '✓ 完了'
                : '入庫確定'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
