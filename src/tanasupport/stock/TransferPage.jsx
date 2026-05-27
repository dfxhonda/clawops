import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField from '../../clawsupport/components/NumpadField'
import { useTransfer } from './useTransfer'

// J-STOCK-TRANSFER-fix-02: 担当者の持ち出し(倉庫→自分)/帰庫(自分→倉庫)。
// stock_movements INSERT のみ。prize_stocks はトリガー任せ。FF=VITE_FF_STOCK_TRANSFER。
export default function TransferPage() {
  const navigate = useNavigate()
  const { staffId, staffName } = useAuth()

  const [direction, setDirection] = useState('out') // 'out'=持ち出し / 'in'=帰庫
  const [warehouses, setWarehouses] = useState([])
  const [warehouseId, setWarehouseId] = useState('')

  const [selected, setSelected] = useState(null) // 入力中の景品 {prize_id, prize_name, available}
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState(null)

  const { prizes, loading, error, transfer } = useTransfer(direction, warehouseId, staffId)

  useEffect(() => {
    supabase
      .from('locations')
      .select('location_id, location_name')
      .eq('is_active', true)
      .eq('location_type', 'warehouse')
      .order('location_name')
      .then(({ data }) => {
        const list = data ?? []
        setWarehouses(list)
        if (list.length && !warehouseId) setWarehouseId(list[0].location_id)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openPrize(p) {
    setSelected(p)
    setQty('')
    setSheetError(null)
  }
  function closeSheet() {
    setSelected(null)
    setQty('')
    setSheetError(null)
  }

  async function handleSave() {
    if (!selected || saving) return
    setSaving(true)
    setSheetError(null)
    try {
      await transfer(selected.prize_id, qty, selected.available)
      closeSheet()
    } catch (e) {
      setSheetError(e?.message ?? '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const warehouseLabel = warehouses.find(w => w.location_id === warehouseId)?.location_name ?? warehouseId
  const fromLabel = direction === 'out' ? warehouseLabel : (staffName || '自分')
  const toLabel = direction === 'out' ? (staffName || '自分') : warehouseLabel

  return (
    <div className="h-dvh flex flex-col bg-bg text-text" data-testid="transfer-page">
      <PageHeader
        module="tanasupport"
        title="在庫の持ち出し / 帰庫"
        onBack={() => navigate('/tanasupport')}
      />

      {/* 方向 */}
      <div className="flex border-b border-border shrink-0">
        {[{ k: 'out', l: '持ち出し（倉庫→自分）' }, { k: 'in', l: '帰庫（自分→倉庫）' }].map(t => (
          <button
            key={t.k}
            onClick={() => { setDirection(t.k); closeSheet() }}
            data-testid={`transfer-dir-${t.k}`}
            className={`flex-1 py-3 text-base font-bold transition-colors ${
              direction === t.k ? 'text-accent border-b-2 border-accent' : 'text-muted'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* 倉庫選択 + 方向表示 */}
      <div className="shrink-0 px-4 py-3 border-b border-border space-y-2">
        <div className="text-[10px] text-muted font-bold uppercase tracking-wider">倉庫</div>
        <select
          value={warehouseId}
          onChange={e => { closeSheet(); setWarehouseId(e.target.value) }}
          data-testid="transfer-warehouse"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-base outline-none [color-scheme:dark]"
        >
          {warehouses.map(w => (
            <option key={w.location_id} value={w.location_id}>{w.location_name}</option>
          ))}
        </select>
        <div className="text-sm text-muted">{fromLabel} <span className="text-accent">→</span> {toLabel}</div>
      </div>

      {/* 景品リスト (from側在庫) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && <p className="text-center text-muted text-base py-12">読み込み中...</p>}
        {error && <p className="text-center text-rose-400 text-base py-12">{error}</p>}
        {!loading && !error && prizes.length === 0 && (
          <p className="text-center text-muted text-base py-12">移動できる在庫がありません</p>
        )}
        {prizes.map(p => (
          <button
            key={p.prize_id}
            onClick={() => openPrize(p)}
            data-testid={`transfer-prize-${p.prize_id}`}
            className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-surface text-left active:scale-[0.98] transition-all"
          >
            <span className="flex-1 text-base font-semibold truncate">{p.prize_name}</span>
            <span className="text-xs text-muted">在庫 {p.available}</span>
            <span className="text-muted text-xl">›</span>
          </button>
        ))}
      </div>

      {/* 個数入力シート */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" data-testid="transfer-sheet">
          <div className="bg-bg border-t border-border rounded-t-2xl flex flex-col" style={{ maxHeight: '80dvh' }}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border">
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate">{selected.prize_name}</p>
                <p className="text-xs text-muted">{fromLabel} → {toLabel} ・ 在庫 {selected.available}</p>
              </div>
              <button onClick={closeSheet} data-testid="transfer-sheet-close" className="text-muted text-2xl leading-none px-2">×</button>
            </div>

            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-muted">移動数</p>
              <p className="text-3xl font-mono font-bold text-accent" data-testid="transfer-qty">{qty || '0'}</p>
            </div>

            {sheetError && (
              <p className="px-4 pb-2 text-sm text-rose-400" data-testid="transfer-error">{sheetError}</p>
            )}

            <div style={{ height: 220 }} className="px-2">
              <NumpadField alwaysOpen value={qty} onChange={setQty} onNext={handleSave} max={99999} />
            </div>

            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving || !qty}
                data-testid="transfer-save"
                className="w-full py-4 rounded-2xl bg-accent text-bg font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {saving ? '保存中...' : direction === 'out' ? '持ち出しを記録' : '帰庫を記録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
