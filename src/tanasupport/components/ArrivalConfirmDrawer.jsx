import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSaveState } from '../../hooks/useSaveState'
import ErrorBanner from '../../components/ErrorBanner'
import { logger } from '../../lib/logger'

const DESTINATION_MAP = {
  '田隈':  { owner_type: 'location', owner_id: 'TKM01' },
  '飯塚':  { owner_type: 'location', owner_id: 'IZK01' },
  '鹿児島': { owner_type: 'location', owner_id: 'KGS01' },
  '久留米': { owner_type: 'location', owner_id: 'KRM02' },
  '霧島':  { owner_type: 'location', owner_id: 'KRS01' },
}

function guessOwner(destination) {
  if (!destination) return null
  for (const [key, val] of Object.entries(DESTINATION_MAP)) {
    if (destination.includes(key)) return val
  }
  return null
}

export default function ArrivalConfirmDrawer({ order, staffId, onDone, onCancel, contextLocationId = null }) {
  const [locations, setLocations] = useState([])
  const [ownerMode, setOwnerMode] = useState('location')
  const [locationId, setLocationId] = useState('')
  const [qty, setQty] = useState(String(order.case_count || ''))
  const [saveState, { setLoading, setError, setSuccess, reset }] = useSaveState()

  useEffect(() => {
    supabase
      .from('locations')
      .select('location_id, location_name')
      .eq('is_active', true)
      .order('location_name')
      .then(({ data }) => {
        const locs = data || []
        setLocations(locs)
        // SPEC-ARRIVAL-RECEIVE-LOCATION-CONTEXT-01 (D-084) C3: 拠点コンテキスト優先、locs[0]=エイド 自動選択 fallback 廃止。
        // (1) 拠点コンテキスト (warehouse 文脈で開いている拠点) → それを採用。
        // (2) 無ければ order.destination テキスト推測。
        // (3) どちらも無理なら空欄 (黙って誤拠点入庫を招く旧 locs[0] fallback は安全違反のため廃止)。既存バリデーションがブロック。
        if (contextLocationId && locs.some(l => l.location_id === contextLocationId)) {
          setOwnerMode('location')
          setLocationId(contextLocationId)
        } else {
          const guess = guessOwner(order.destination)
          if (guess?.owner_type === 'location') {
            setLocationId(guess.owner_id)
          }
        }
      })
  }, [order.destination, contextLocationId])

  const toOwnerType = ownerMode === 'location' ? 'location' : 'staff'
  const toOwnerId   = ownerMode === 'location' ? locationId : (staffId || '')

  async function handleConfirm() {
    const parsedQty = parseInt(qty, 10)
    if (!parsedQty || parsedQty <= 0) {
      setError('ERR-STOCK-003', '受取数を入力してください')
      return
    }
    if (!toOwnerId) {
      setError('ERR-STOCK-003', '入庫先を選択してください')
      return
    }
    if (!setLoading()) return

    try {
      const { error } = await supabase.rpc('fn_confirm_arrival', {
        p_order_id:          order.order_id,
        p_to_owner_type:     toOwnerType,
        p_to_owner_id:       toOwnerId,
        p_received_quantity: parsedQty,
        p_staff_id:          staffId || 'unknown',
      })
      if (error) {
        const isDouble = error.message?.includes('ERR-STOCK-004')
        const errCode  = isDouble ? 'ERR-STOCK-004' : 'ERR-STOCK-003'
        const msg      = isDouble
          ? 'この発注は既に入庫確定済みです'
          : (error.message || '入庫確定に失敗しました')
        logger.error('arrival_confirm_error', {
          errCode, order_id: order.order_id,
          to_owner: toOwnerId, qty: parsedQty, raw: error.message,
        })
        setError(errCode, msg)
        return
      }
      logger.info('arrival_confirmed', {
        order_id: order.order_id,
        to_owner_type: toOwnerType, to_owner_id: toOwnerId, qty: parsedQty,
      })
      setSuccess()
      setTimeout(() => onDone(), 1500)
    } catch (e) {
      logger.error('arrival_confirm_error', {
        errCode: 'ERR-STOCK-003', order_id: order.order_id, raw: e?.message,
      })
      setError('ERR-STOCK-003', e?.message || '入庫確定に失敗しました')
    }
  }

  return (
    <div className="bg-surface2 border-t border-accent/30 px-4 pt-3 pb-4 space-y-3 rounded-b-xl">
      {/* 入庫先モード */}
      <div className="flex gap-2">
        {['location', 'staff'].map(mode => (
          <button
            key={mode}
            onClick={() => { reset(); setOwnerMode(mode) }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
              ownerMode === mode
                ? 'bg-accent text-bg border-accent'
                : 'bg-surface border-border text-muted'
            }`}
          >
            {mode === 'location' ? '拠点' : '担当持出'}
          </button>
        ))}
      </div>

      {ownerMode === 'location' ? (
        <select
          value={locationId}
          onChange={e => { reset(); setLocationId(e.target.value) }}
          className="w-full bg-surface border border-border text-text text-sm rounded-lg px-3 py-2"
        >
          {locations.map(l => (
            <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
          ))}
        </select>
      ) : (
        <div className="text-xs text-muted px-1 py-1">
          担当: <span className="text-text font-mono">{staffId || '—'}</span> で確定
        </div>
      )}

      {/* 受取数 */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted whitespace-nowrap">受取数(ケース)</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={qty}
          onChange={e => { reset(); setQty(e.target.value) }}
          className="flex-1 bg-surface border border-border text-text text-sm rounded-lg px-3 py-2 text-right font-mono"
        />
      </div>

      {saveState.status === 'error' && (
        <ErrorBanner
          errCode={saveState.errCode}
          message={saveState.errMessage}
          onClose={reset}
          onRetry={handleConfirm}
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 text-sm font-bold rounded-xl bg-surface border border-border text-muted active:scale-[0.98] transition-all"
        >
          キャンセル
        </button>
        <button
          onClick={handleConfirm}
          disabled={saveState.status === 'loading' || saveState.status === 'success'}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 ${
            saveState.status === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-accent text-bg'
          }`}
        >
          {saveState.status === 'loading' ? '確定中…'
            : saveState.status === 'success' ? '✓ 完了'
            : '入庫確定'}
        </button>
      </div>
    </div>
  )
}
