import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField from '../../clawsupport/components/NumpadField'
import { useStocktakeCount } from './useStocktakeCount'
import { addBatch, sortUnenteredFirst, isAllEntered } from './stocktakeCountLogic'

// J-STOCKTAKE-MVP-fix-01: 倉庫/担当者の個数入力。
// NumpadField で「数える単位ごとにバッチ入力 → 加算 → 合計を保存」(多段足し込み)。
// prize_stocks/stock_movements は触らない (締めの台帳反映はDBトリガー任せ)。
export default function StocktakeCountSession() {
  const { ownerType, ownerCode: rawCode } = useParams()
  const ownerCode = decodeURIComponent(rawCode)
  const navigate = useNavigate()
  const { state } = useLocation()
  const { staffId } = useAuth()
  const label = state?.label ?? ownerCode

  const { loading, error, prizes, countsMap, saveCount } =
    useStocktakeCount(ownerType, ownerCode, staffId)

  const [selectedId, setSelectedId] = useState(null) // 入力中SKU
  const [batch, setBatch] = useState('')             // numpad 現在値
  const [total, setTotal] = useState(0)              // 確定済み合計
  const [saving, setSaving] = useState(false)

  const ordered = useMemo(() => sortUnenteredFirst(prizes, countsMap), [prizes, countsMap])
  const selected = prizes.find(p => p.prize_id === selectedId) ?? null
  const allEntered = isAllEntered(prizes, countsMap)

  function openPrize(prize) {
    setSelectedId(prize.prize_id)
    setTotal(countsMap[prize.prize_id]?.actual_count ?? 0)
    setBatch('')
  }
  function closeSheet() {
    setSelectedId(null)
    setBatch('')
    setTotal(0)
  }

  // 加算: 現在バッチを合計に足し込み、バッチをクリア
  function commitBatch() {
    setTotal(t => addBatch(t, batch))
    setBatch('')
  }

  // 保存して次へ: 未確定バッチを足してから upsert → 次の未入力SKUを開く
  async function saveAndNext() {
    if (!selected || saving) return
    const finalTotal = addBatch(total, batch)
    setSaving(true)
    try {
      await saveCount(selected.prize_id, finalTotal, selected.theoretical_count)
    } finally {
      setSaving(false)
    }
    // 保存後の最新リストで次の未入力を探す (selected は今入力済みになる)
    const remaining = prizes.filter(
      p => p.prize_id !== selected.prize_id &&
        !Object.prototype.hasOwnProperty.call(countsMap, p.prize_id),
    )
    if (remaining.length > 0) openPrize(remaining[0])
    else closeSheet()
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text" data-testid="stocktake-count-session">
      <PageHeader
        module="tanasupport"
        title={label}
        subtitle="個数を入力"
        onBack={() => navigate('/tanasupport/stocktake/count')}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && <p className="text-center text-muted text-base py-12">読み込み中...</p>}
        {error && <p className="text-center text-rose-400 text-base py-12">{error}</p>}
        {!loading && !error && ordered.length === 0 && (
          <p className="text-center text-muted text-base py-12">対象景品がありません</p>
        )}
        {ordered.map(p => {
          const entry = countsMap[p.prize_id]
          const entered = !!entry
          return (
            <button
              key={p.prize_id}
              onClick={() => openPrize(p)}
              data-testid={`stocktake-prize-${p.prize_id}`}
              className={`w-full min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-2xl border text-left active:scale-[0.98] transition-all ${
                entered ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-surface'
              }`}
            >
              <span className="flex-1 text-base font-semibold truncate">{p.prize_name}</span>
              <span className="text-xs text-muted">理論 {p.theoretical_count}</span>
              {entered
                ? <span className="text-base font-bold text-emerald-400" data-testid={`stocktake-count-${p.prize_id}`}>{entry.actual_count}</span>
                : <span className="text-muted text-xl">›</span>}
            </button>
          )
        })}
      </div>

      {!loading && !error && (
        <div className="shrink-0 px-4 py-3 border-t border-border">
          <button
            onClick={() => navigate('/tanasupport/stocktake/count')}
            disabled={!allEntered}
            data-testid="stocktake-close-button"
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
              allEntered ? 'bg-accent text-bg active:scale-[0.98]' : 'bg-surface text-muted opacity-40'
            }`}
          >
            {allEntered ? '締める(入力完了)' : '全SKU入力で締められます'}
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" data-testid="stocktake-numpad-sheet">
          <div className="bg-bg border-t border-border rounded-t-2xl flex flex-col" style={{ maxHeight: '80dvh' }}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border">
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate">{selected.prize_name}</p>
                <p className="text-xs text-muted">理論 {selected.theoretical_count}</p>
              </div>
              <button onClick={closeSheet} data-testid="stocktake-sheet-close" className="text-muted text-2xl leading-none px-2">×</button>
            </div>

            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">合計</p>
                <p className="text-3xl font-mono font-bold text-accent" data-testid="stocktake-running-total">
                  {addBatch(total, batch)}
                </p>
              </div>
              <button
                onClick={commitBatch}
                disabled={batch === ''}
                data-testid="stocktake-add-batch"
                className={`px-5 py-3 rounded-2xl font-bold text-base ${
                  batch === '' ? 'bg-surface text-muted opacity-40' : 'border border-accent/50 text-accent bg-accent/10 active:scale-[0.98]'
                }`}
              >
                + 加算
              </button>
            </div>

            <div style={{ height: 220 }} className="px-2">
              <NumpadField alwaysOpen value={batch} onChange={setBatch} onNext={commitBatch} max={99999} />
            </div>

            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={saveAndNext}
                disabled={saving}
                data-testid="stocktake-save-next"
                className="w-full py-4 rounded-2xl bg-accent text-bg font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {saving ? '保存中...' : '保存して次へ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
