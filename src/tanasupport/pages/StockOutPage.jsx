import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHierarchicalBack } from '../../shared/nav/hierarchicalBack' // J-NAV-BACK-HIERARCHICAL-01
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSaveState } from '../../hooks/useSaveState'
import ErrorBanner from '../../components/ErrorBanner'
import { logger } from '../../lib/logger'
import NumpadField, { NumpadFooterPanel } from '../../clawsupport/components/NumpadField'

const OUT_TYPES = [
  { key: 'out_to_staff',    label: '担当持出',   targetType: 'staff' },
  { key: 'out_to_location', label: '他店送付',   targetType: 'location' },
  { key: 'out_adjust',      label: '出庫調整',   targetType: 'adjustment' },
]
const ADJUST_REASONS = [
  { key: 'disposal', label: '廃棄' },
  { key: 'return',   label: '返品' },
  { key: 'loss',     label: '損耗' },
]

let lineIdSeq = 0
function newLine() {
  return { id: ++lineIdSeq, prizeId: '', outType: 'out_to_staff', targetId: '', qty: '' }
}

function outTypeTargetType(outType) {
  return OUT_TYPES.find(t => t.key === outType)?.targetType ?? 'staff'
}

export default function StockOutPage() {
  const navigate = useNavigate()
  const goBack = useHierarchicalBack() // J-NAV-BACK-HIERARCHICAL-01
  const { staffId } = useAuth()

  const [locations, setLocations]       = useState([])
  const [staffList, setStaffList]       = useState([])
  const [fromLocationId, setFromLocationId] = useState('')
  const [locationStocks, setLocationStocks] = useState([]) // [{prize_id, quantity, prize_name}]
  const [lines, setLines]               = useState([newLine()])
  const [currentField, setCurrentField] = useState(null)
  const [saveState, { setLoading, setError, setSuccess, reset }] = useSaveState()

  useEffect(() => {
    Promise.all([
      supabase.from('locations').select('location_id, location_name').eq('is_active', true).order('location_name'),
      supabase.from('staff').select('staff_id, name').order('name'),
    ]).then(([{ data: locs }, { data: slist }]) => {
      setLocations(locs ?? [])
      setStaffList(slist ?? [])
    })
  }, [])

  useEffect(() => {
    if (!fromLocationId) { setLocationStocks([]); return }
    supabase
      .from('prize_stocks')
      .select('prize_id, quantity, prize_masters(prize_name_short, prize_name_raw)')
      .eq('owner_type', 'location')
      .eq('owner_id', fromLocationId)
      .then(({ data }) => {
        const stocks = (data ?? []).map(s => ({
          prize_id: s.prize_id,
          quantity: s.quantity,
          prize_name: s.prize_masters?.prize_name_short || s.prize_masters?.prize_name_raw || s.prize_id,
        })).sort((a, b) => a.prize_name.localeCompare(b.prize_name, 'ja'))
        setLocationStocks(stocks)
      })
  }, [fromLocationId])

  function getBalance(prizeId) {
    if (!prizeId) return null
    const s = locationStocks.find(s => s.prize_id === prizeId)
    return s ? s.quantity : null
  }

  function updateLine(id, patch) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  function removeLine(id) {
    setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev)
  }

  function addLine() {
    setLines(prev => [...prev, newLine()])
    reset()
  }

  function validateLines() {
    for (const line of lines) {
      if (!line.prizeId) return 'すべての行で景品を選択してください'
      const qty = parseInt(line.qty, 10)
      if (!qty || qty <= 0) return `数量を入力してください (景品: ${line.prizeId})`
      if (!line.targetId) return '移動先/理由を選択してください'
      if (line.outType === 'out_adjust' && !line.targetId) return '出庫調整の理由を選択してください'
    }
    return null
  }

  async function handleConfirm() {
    const validationError = validateLines()
    if (validationError) { setError('ERR-STOCK-005', validationError); return }
    if (!setLoading()) return

    try {
      for (const line of lines) {
        const targetOwnerType = outTypeTargetType(line.outType)
        const { error } = await supabase.rpc('fn_record_stock_out', {
          p_from_location_id:  fromLocationId,
          p_prize_id:          line.prizeId,
          p_out_type:          line.outType,
          p_target_owner_type: targetOwnerType,
          p_target_owner_id:   line.targetId,
          p_quantity:          parseInt(line.qty, 10),
          p_reason:            line.outType === 'out_adjust' ? line.targetId : null,
          p_staff_id:          staffId || 'unknown',
        })
        if (error) {
          const isReasonError = error.message?.includes('ERR-STOCK-006')
          const errCode = isReasonError ? 'ERR-STOCK-006' : 'ERR-STOCK-005'
          const msg     = isReasonError ? '出庫調整には理由が必要です' : (error.message || '出庫記録に失敗しました')
          logger.error('stock_out_error', {
            errCode, from: fromLocationId, prize: line.prizeId,
            out_type: line.outType, qty: line.qty, raw: error.message,
          })
          setError(errCode, msg)
          return
        }
        logger.info('stock_out_recorded', {
          from_location: fromLocationId, prize_id: line.prizeId,
          out_type: line.outType, target: line.targetId, qty: parseInt(line.qty, 10),
        })
      }
      setSuccess()
      setTimeout(() => {
        setLines([newLine()])
        reset()
      }, 1500)
    } catch (e) {
      logger.error('stock_out_error', { errCode: 'ERR-STOCK-005', raw: e?.message })
      setError('ERR-STOCK-005', e?.message || '出庫記録に失敗しました')
    }
  }

  const canConfirm = !!fromLocationId && lines.every(l => l.prizeId && l.qty && l.targetId)

  return (
    <div className="min-h-dvh flex flex-col bg-bg text-text">

      {/* ヘッダー */}
      <div className="sticky top-0 z-40 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#f59e0b' }}>
        <button onClick={goBack} className="text-muted text-xl leading-none">‹</button>
        <div className="flex-1 font-bold text-base">出庫記録</div>
      </div>

      <div className="flex-1 px-4 pt-3 pb-[340px] space-y-3">

        {/* 出庫元拠点 */}
        <div>
          <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">出庫元拠点</div>
          <select
            value={fromLocationId}
            onChange={e => { setFromLocationId(e.target.value); reset() }}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark]"
          >
            <option value="">選択してください</option>
            {locations.map(l => (
              <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
            ))}
          </select>
        </div>

        {/* 出庫行リスト */}
        {lines.map((line, idx) => {
          const balance = getBalance(line.prizeId)
          const qty     = parseInt(line.qty, 10)
          const willNeg = balance !== null && !isNaN(qty) && qty > balance

          return (
            <div key={line.id} className="bg-surface border border-border rounded-xl p-3 space-y-2.5">

              {/* 行番号 + 削除 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted font-bold">#{idx + 1}</span>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(line.id)} className="text-muted text-sm px-2 py-0.5">✕</button>
                )}
              </div>

              {/* 景品 */}
              <div>
                <div className="text-[10px] text-muted mb-1">景品</div>
                <div className="flex items-center gap-2">
                  <select
                    value={line.prizeId}
                    onChange={e => updateLine(line.id, { prizeId: e.target.value })}
                    disabled={!fromLocationId}
                    className="flex-1 px-2 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none [color-scheme:dark] disabled:opacity-40"
                  >
                    <option value="">景品を選択</option>
                    {locationStocks.map(s => (
                      <option key={s.prize_id} value={s.prize_id}>
                        {s.prize_name}
                      </option>
                    ))}
                  </select>
                  {line.prizeId && balance !== null && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
                      willNeg ? 'bg-amber-500/20 text-amber-400' : 'bg-surface2 text-muted'
                    }`}>
                      在庫 {balance}
                    </span>
                  )}
                </div>
              </div>

              {/* 出庫種別 */}
              <div>
                <div className="text-[10px] text-muted mb-1">出庫種別</div>
                <div className="flex gap-1">
                  {OUT_TYPES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => updateLine(line.id, { outType: t.key, targetId: '' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        line.outType === t.key
                          ? 'bg-accent text-bg border-accent'
                          : 'bg-bg border-border text-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 移動先 */}
              <div>
                <div className="text-[10px] text-muted mb-1">
                  {line.outType === 'out_to_staff' ? '担当者' :
                   line.outType === 'out_to_location' ? '送付先' : '理由'}
                </div>
                {line.outType === 'out_to_staff' && (
                  <select
                    value={line.targetId}
                    onChange={e => updateLine(line.id, { targetId: e.target.value })}
                    className="w-full px-2 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none [color-scheme:dark]"
                  >
                    <option value="">担当者を選択</option>
                    {staffList.map(s => (
                      <option key={s.staff_id} value={s.staff_id}>{s.name}</option>
                    ))}
                  </select>
                )}
                {line.outType === 'out_to_location' && (
                  <select
                    value={line.targetId}
                    onChange={e => updateLine(line.id, { targetId: e.target.value })}
                    className="w-full px-2 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none [color-scheme:dark]"
                  >
                    <option value="">送付先を選択</option>
                    {locations.filter(l => l.location_id !== fromLocationId).map(l => (
                      <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
                    ))}
                  </select>
                )}
                {line.outType === 'out_adjust' && (
                  <div className="flex gap-1">
                    {ADJUST_REASONS.map(r => (
                      <button
                        key={r.key}
                        onClick={() => updateLine(line.id, { targetId: r.key })}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                          line.targetId === r.key
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-bg border-border text-muted'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 数量 */}
              <div>
                <div className="text-[10px] text-muted mb-1">数量</div>
                <NumpadField
                  value={line.qty}
                  onChange={v => updateLine(line.id, { qty: v })}
                  label={`数量 #${idx + 1}`}
                  dataTabindex={idx * 10}
                  onRegister={setCurrentField}
                  max={99999}
                  inputClassName="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm text-right font-mono"
                  inputPlaceholder="0"
                  style={{ width: '100%' }}
                />
              </div>

              {/* 残高警告 */}
              {willNeg && (
                <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                  ⚠ 残高不足（現在 {balance}、出庫後 {balance - qty}）— 続行できますが棚卸しで要確認
                </div>
              )}
            </div>
          )
        })}

        {/* 追加ボタン */}
        <button
          onClick={addLine}
          disabled={!fromLocationId}
          className="w-full py-2.5 rounded-xl border border-dashed border-border text-muted text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40"
        >
          + 行を追加
        </button>

        {/* エラーバナー */}
        {saveState.status === 'error' && (
          <ErrorBanner
            errCode={saveState.errCode}
            message={saveState.errMessage}
            onClose={reset}
            onRetry={handleConfirm}
          />
        )}

        {/* 確定ボタン */}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || saveState.status === 'loading' || saveState.status === 'success'}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 ${
            saveState.status === 'success' ? 'bg-emerald-600 text-white' : 'bg-accent text-bg'
          }`}
        >
          {saveState.status === 'loading' ? '記録中…'
            : saveState.status === 'success' ? `✓ ${lines.length}件 記録完了`
            : `出庫確定 (${lines.length}件)`}
        </button>

      </div>

      <div className={`${currentField ? 'h-[30dvh]' : 'h-0'} flex-none shrink-0 flex flex-col overflow-hidden`}>
        <NumpadFooterPanel currentField={currentField} />
      </div>
    </div>
  )
}
