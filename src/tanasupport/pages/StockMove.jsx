import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getPrizeStocksExtended } from '../../services/inventory'
import { transferStock } from '../../services/movements'
import { useAuth } from '../../hooks/useAuth'

const STEP_SELECT = 'select'
const STEP_CONFIRM = 'confirm'

export default function StockMove() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [step, setStep] = useState(STEP_SELECT)
  const [stocks, setStocks] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [fromOwner, setFromOwner] = useState('')    // "owner_type:owner_id"
  const [toOwner, setToOwner] = useState('')
  const [prizeId, setPrizeId] = useState('')
  const [quantity, setQuantity] = useState('')

  useEffect(() => {
    Promise.all([
      getPrizeStocksExtended(true),
      supabase.from('locations').select('location_id, location_name, location_type').eq('is_active', true),
    ]).then(([stockData, { data: locData }]) => {
      setStocks(stockData)
      setLocations(locData ?? [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  // オーナー選択肢 (location + staff)
  function ownerOptions() {
    const opts = locations.map(l => ({
      value: `location:${l.location_id}`,
      label: l.location_name,
    }))
    // スタッフオーナーは在庫がある分だけ
    const staffOwners = [...new Set(stocks.filter(s => s.owner_type === 'staff').map(s => s.owner_id))]
    staffOwners.forEach(id => opts.push({ value: `staff:${id}`, label: `スタッフ: ${id}` }))
    return opts
  }

  // 選択中 from オーナーの景品
  function availablePrizes() {
    if (!fromOwner) return []
    const [type, id] = fromOwner.split(':')
    return stocks.filter(s => s.owner_type === type && s.owner_id === id && s.quantity > 0)
  }

  function getOwnerLabel(val) {
    if (!val) return '—'
    const [type, id] = val.split(':')
    if (type === 'location') return locations.find(l => l.location_id === id)?.location_name ?? id
    return `スタッフ: ${id}`
  }

  const selectedPrize = stocks.find(s => s.prize_id === prizeId && fromOwner && s.owner_type === fromOwner.split(':')[0] && s.owner_id === fromOwner.split(':')[1])

  function canProceed() {
    const qty = parseInt(quantity)
    if (!fromOwner || !toOwner || fromOwner === toOwner) return false
    if (!prizeId || !selectedPrize) return false
    if (!Number.isFinite(qty) || qty <= 0 || qty > (selectedPrize?.quantity ?? 0)) return false
    return true
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      const [fromType, fromId] = fromOwner.split(':')
      const [toType, toId] = toOwner.split(':')
      await transferStock({
        prizeId,
        prizeName: selectedPrize?.prize_name ?? prizeId,
        fromOwnerType: fromType,
        fromOwnerId: fromId,
        toOwnerType: toType,
        toOwnerId: toId,
        quantity: parseInt(quantity),
        createdBy: staffId ?? '',
        reason: '在庫移動',
      })
      navigate('/stock/dashboard')
    } catch (e) {
      setError(e.message)
      setStep(STEP_SELECT)
    } finally {
      setSaving(false)
    }
  }

  const opts = ownerOptions()
  const prizes = availablePrizes()

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">

      {/* ヘッダー */}
      <div className="shrink-0 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => step === STEP_CONFIRM ? setStep(STEP_SELECT) : navigate(-1)}
          className="text-muted text-xl leading-none"
        >
          ‹
        </button>
        <div className="flex-1 font-bold text-base">
          在庫移動 {step === STEP_CONFIRM ? '— 確認' : ''}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-muted text-sm">読み込み中...</div>
      ) : step === STEP_SELECT ? (
        /* Step 1: 選択 */
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">

          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">移動元</div>
            <select
              value={fromOwner}
              onChange={e => { setFromOwner(e.target.value); setPrizeId('') }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark]"
            >
              <option value="">選択してください</option>
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">景品</div>
            <select
              value={prizeId}
              onChange={e => setPrizeId(e.target.value)}
              disabled={!fromOwner}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark] disabled:opacity-40"
            >
              <option value="">選択してください</option>
              {prizes.map(p => (
                <option key={p.prize_id} value={p.prize_id}>
                  {p.prize_name || p.prize_id} (在庫: {p.quantity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">移動先</div>
            <select
              value={toOwner}
              onChange={e => setToOwner(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark]"
            >
              <option value="">選択してください</option>
              {opts.filter(o => o.value !== fromOwner).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">数量</div>
            <input
              type="number"
              min="1"
              max={selectedPrize?.quantity ?? 1}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark]"
            />
            {selectedPrize && (
              <div className="text-xs text-muted mt-1 pl-1">最大: {selectedPrize.quantity}個</div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg border-t border-border">
            <button
              onClick={() => setStep(STEP_CONFIRM)}
              disabled={!canProceed()}
              className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              確認へ進む
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: 確認 */
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3">
          <div className="rounded-xl bg-surface border border-border p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">景品</span>
              <span className="font-bold">{selectedPrize?.prize_name ?? prizeId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">移動元</span>
              <span className="font-bold">{getOwnerLabel(fromOwner)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">移動先</span>
              <span className="font-bold">{getOwnerLabel(toOwner)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">数量</span>
              <span className="font-bold text-accent">{quantity} 個</span>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg border-t border-border">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {saving ? '処理中...' : '移動を確定する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
