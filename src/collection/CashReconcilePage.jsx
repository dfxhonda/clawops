// SPEC-CASH-RECONCILE-PAGE-01 (D-067): 金庫照合ページ。手持ち金種 vs 集金総計 の差額照合 + 保存 + 履歴。
// cash_collections / meter_readings へは書き込まない (読みのみ)。JST 日付厳守。grid は min-w-0。
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../shared/ui/PageHeader'
import NumpadField, { NumpadFooterPanel } from '../clawsupport/components/NumpadField'
import StorePickerSheet from '../components/StorePickerSheet'
import { useAuth } from '../hooks/useAuth'
import {
  DENOMINATIONS, cashTotal, collectionsTotal, adjustmentsTotal, reconcileDifference,
  denomSubtotal, visibleReconciliations, canDeleteReconciliation,
} from './lib/cashReconcileCalc'
import {
  listRecentCollectionsForReconcile, insertReconciliation, listReconciliations, deleteReconciliation,
} from '../services/cashReconcile'

const DRAFT_KEY = 'clawops_cash_reconcile_draft'
// JST 日付 (CLAUDE.md: toLocaleDateString sv-SE + Asia/Tokyo。UTC slice 禁止)。collection→admin の boundary を避け inline。
const formatJstDate = v => (v ? new Date(v).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : '')
const yen = n => Number(n || 0).toLocaleString('ja-JP')
const signYen = n => (n > 0 ? '+' : '') + yen(n)
const DENOM_LABEL = { 10000: '一万円', 5000: '五千円', 2000: '二千円', 1000: '千円', 500: '五百円', 100: '百円', 50: '五十円', 10: '十円', 5: '五円', 1: '一円' }
const denomInputStyle = { width: '100%', height: '40px', fontSize: 16, padding: '0 8px', textAlign: 'right' }

function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null') } catch { return null }
}

export default function CashReconcilePage() {
  const navigate = useNavigate()
  const { staffId, staffRole } = useAuth()

  const draft = readDraft()
  const [counts, setCounts]           = useState(() => draft?.counts ?? {})        // { <unit>: '枚数' }
  const [picked, setPicked]           = useState(() => draft?.picked ?? [])        // [{collection_id, store_name, collected_at, total}]
  const [adjustments, setAdjustments] = useState(() => draft?.adjustments ?? [])   // [{amount, note}]
  const [note, setNote]               = useState(() => draft?.note ?? '')
  const [currentField, setCurrentField] = useState(null)

  const [filterStore, setFilterStore] = useState(null)
  const [pickOptions, setPickOptions] = useState([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [history, setHistory] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // F2: 入力途中を sessionStorage 保持 (離脱・復帰で消えない)
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ counts, picked, adjustments, note }))
  }, [counts, picked, adjustments, note])

  useEffect(() => {
    let cancel = false
    listRecentCollectionsForReconcile({ storeCode: filterStore, limit: 50 })
      .then(r => { if (!cancel) setPickOptions(r) }).catch(() => { if (!cancel) setPickOptions([]) })
    return () => { cancel = true }
  }, [filterStore])

  function reloadHistory() {
    return listReconciliations({ staffRole, staffId }).then(setHistory).catch(() => setHistory([]))
  }
  useEffect(() => { reloadHistory() }, [staffRole, staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  const denomObj = useMemo(() => Object.fromEntries(DENOMINATIONS.map(u => [u, counts[u]])), [counts])
  const cash   = cashTotal(denomObj)
  const colTot = collectionsTotal(picked)
  const adjTot = adjustmentsTotal(adjustments)
  const diff   = reconcileDifference(cash, colTot, adjTot)

  const setCount = (unit, v) => setCounts(c => ({ ...c, [unit]: v }))
  const addPick = (opt) => { if (!opt || picked.some(p => p.collection_id === opt.collection_id)) return; setPicked(p => [...p, opt]) }
  const removePick = (id) => setPicked(p => p.filter(x => x.collection_id !== id))
  const addAdjustment = () => setAdjustments(a => [...a, { amount: '', note: '' }])
  const setAdjustment = (i, patch) => setAdjustments(a => a.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const removeAdjustment = (i) => setAdjustments(a => a.filter((_, j) => j !== i))

  const visibleHistory = visibleReconciliations(history, staffRole, staffId)

  function handleOutsideTap(e) {
    if (e.target.closest('[data-numpad-field]')) return
    if (e.target.closest('[data-testid="numpad-footer"]')) return
    if (e.target.closest('[data-testid="recon-interactive"]')) return
    setCurrentField(null)
  }

  async function handleSave() {
    if (!staffId) { setError('ログインが必要です'); return }
    setSaving(true); setError(null)
    try {
      await insertReconciliation({
        denominations: Object.fromEntries(DENOMINATIONS.filter(u => Number(counts[u]) > 0).map(u => [u, Number(counts[u])])),
        cashTotal: cash,
        collectionIds: picked.map(p => p.collection_id),
        collectionsTotal: colTot,
        adjustments: adjustments.filter(a => a.amount !== '' && a.amount != null).map(a => ({ amount: Number(a.amount) || 0, note: a.note || null })),
        adjustmentsTotal: adjTot,
        difference: diff,
        note,
        staffId,
      })
      sessionStorage.removeItem(DRAFT_KEY)
      setCounts({}); setPicked([]); setAdjustments([]); setNote(''); setCurrentField(null)
      await reloadHistory()
    } catch (e) {
      setError('保存に失敗しました: ' + (e?.message ?? ''))
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try { await deleteReconciliation(id); setDeleteConfirm(null); if (expanded === id) setExpanded(null); await reloadHistory() }
    catch (e) { setError('削除に失敗しました: ' + (e?.message ?? '')) }
  }

  return (
    <div data-testid="cash-reconcile" className="flex flex-col min-w-0" style={{ height: '100svh' }} onPointerDown={handleOutsideTap}>
      <PageHeader module="admin" title="金庫照合" onBack={() => navigate('/admin/collection')} />

      <div className="flex-1 overflow-y-auto min-h-0 min-w-0 p-3 pb-2 space-y-4">
        {error && <p data-testid="recon-error" className="text-red-400 text-sm">{error}</p>}

        <div className="grid grid-cols-2 gap-3 min-w-0">
          {/* 左: 金種 */}
          <div className="min-w-0 space-y-1">
            <div className="text-xs text-muted font-bold mb-1">手持ち金種</div>
            {DENOMINATIONS.map(u => (
              <div key={u} className="flex items-center gap-1 min-w-0">
                <span className="text-xs text-muted w-12 text-right shrink-0">{DENOM_LABEL[u]}</span>
                <div className="w-16 shrink-0">
                  <NumpadField
                    value={counts[u] ? String(counts[u]) : ''}
                    onChange={v => setCount(u, v)}
                    label={`${DENOM_LABEL[u]} 枚数`} max={99999}
                    testId={`recon-denom-${u}`}
                    isActive={currentField?.testId === `recon-denom-${u}`}
                    strongActive
                    onRegister={setCurrentField}
                    onClear={() => setCurrentField(null)}
                    style={denomInputStyle}
                  />
                </div>
                <span data-testid={`recon-denom-sub-${u}`} className="text-xs text-text tabular-nums ml-auto">{yen(denomSubtotal(u, counts[u]))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-1 mt-1">
              <span className="text-xs text-muted">手持ち合計</span>
              <span data-testid="recon-cash-total" className="text-sm font-bold text-text tabular-nums">{yen(cash)} 円</span>
            </div>
          </div>

          {/* 右: 集金ピック */}
          <div className="min-w-0 space-y-2" data-testid="recon-interactive">
            <div className="text-xs text-muted font-bold">集金選択</div>
            <StorePickerSheet value={filterStore} onChange={setFilterStore} placeholder="店舗で絞込" />
            <select
              data-testid="recon-pick-select"
              value=""
              onChange={e => { const opt = pickOptions.find(o => o.collection_id === e.target.value); addPick(opt) }}
              className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full min-h-[40px]"
            >
              <option value="">集金を選択して追加…</option>
              {pickOptions.filter(o => !picked.some(p => p.collection_id === o.collection_id)).map(o => (
                <option key={o.collection_id} value={o.collection_id}>
                  {o.store_name} / {formatJstDate(o.collected_at)} / {yen(o.total)}円
                </option>
              ))}
            </select>
            <div className="space-y-1">
              {picked.map(p => (
                <div key={p.collection_id} data-testid={`recon-pick-item-${p.collection_id}`} className="flex items-center gap-2 bg-surface/40 rounded px-2 py-1 min-w-0">
                  <span className="text-xs text-text truncate min-w-0 flex-1">{p.store_name} {formatJstDate(p.collected_at)}</span>
                  <span className="text-xs tabular-nums shrink-0">{yen(p.total)}円</span>
                  <button data-testid={`recon-remove-${p.collection_id}`} onClick={() => removePick(p.collection_id)} className="text-red-400 text-xs shrink-0 min-h-[32px] px-1">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1">
              <span className="text-xs text-muted">集金総計</span>
              <span data-testid="recon-collections-total" className="text-sm font-bold text-text tabular-nums">{yen(colTot)} 円</span>
            </div>
          </div>
        </div>

        {/* 調整行 */}
        <div className="min-w-0 space-y-1" data-testid="recon-interactive">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-bold">調整 (釣銭持出・経費等)</span>
            <button data-testid="recon-add-adjustment" onClick={addAdjustment} className="text-blue-400 text-xs min-h-[36px] px-2">+ 追加</button>
          </div>
          {adjustments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <input data-testid={`recon-adj-amount-${i}`} type="number" inputMode="numeric" value={a.amount}
                onChange={e => setAdjustment(i, { amount: e.target.value })} placeholder="±金額"
                className="bg-bg border border-border rounded px-2 min-h-[40px] text-sm text-text w-24 shrink-0 tabular-nums text-right" />
              <input data-testid={`recon-adj-note-${i}`} value={a.note}
                onChange={e => setAdjustment(i, { note: e.target.value })} placeholder="メモ"
                className="bg-bg border border-border rounded px-2 min-h-[40px] text-sm text-text flex-1 min-w-0" />
              <button data-testid={`recon-adj-remove-${i}`} onClick={() => removeAdjustment(i)} className="text-red-400 text-xs shrink-0 min-h-[36px] px-1">×</button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-1">
            <span className="text-xs text-muted">調整合計</span>
            <span data-testid="recon-adjustments-total" className="text-sm tabular-nums">{signYen(adjTot)} 円</span>
          </div>
        </div>

        {/* 差額 */}
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <span className="text-sm text-muted font-bold">差額</span>
          <span data-testid="recon-difference"
            className={`text-2xl font-bold tabular-nums ${diff === 0 ? 'text-emerald-400' : 'text-red-500'}`}>
            {diff === 0 ? '±0' : signYen(diff)} 円
          </span>
        </div>

        {/* メモ + 保存 */}
        <div data-testid="recon-interactive" className="space-y-2">
          <input data-testid="recon-note" value={note} onChange={e => setNote(e.target.value)} placeholder="メモ (任意)"
            className="bg-bg border border-border rounded px-3 min-h-[44px] text-sm text-text w-full" />
          <button data-testid="recon-save" onClick={handleSave} disabled={saving}
            className="w-full min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {saving ? '保存中…' : '照合を保存'}
          </button>
        </div>

        {/* 履歴 (F3) */}
        <div data-testid="recon-interactive" className="space-y-1 min-w-0">
          <div className="text-xs text-muted font-bold border-t border-border pt-2">照合履歴</div>
          {visibleHistory.length === 0 && <p className="text-xs text-muted">履歴はまだありません</p>}
          {visibleHistory.map(r => (
            <Fragment key={r.reconciliation_id}>
              <button data-testid={`recon-history-row-${r.reconciliation_id}`}
                onClick={() => setExpanded(e => (e === r.reconciliation_id ? null : r.reconciliation_id))}
                className="w-full flex items-center gap-2 bg-surface/40 rounded px-2 py-2 text-left min-w-0">
                <span className="text-xs text-muted shrink-0">{formatJstDate(r.created_at)}</span>
                <span className="text-xs text-text tabular-nums shrink-0">手持 {yen(r.cash_total)}</span>
                <span className={`text-xs tabular-nums shrink-0 ${Number(r.difference) === 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                  差 {Number(r.difference) === 0 ? '±0' : signYen(Number(r.difference))}
                </span>
                <span className="text-xs text-muted truncate min-w-0 flex-1 text-right">{r.created_by_name}</span>
              </button>
              {expanded === r.reconciliation_id && (
                <div data-testid={`recon-history-detail-${r.reconciliation_id}`} className="bg-bg/60 rounded px-3 py-2 text-xs text-muted space-y-1">
                  <div>集金 {(r.collection_ids ?? []).length} 件 / 総計 {yen(r.collections_total)}円</div>
                  <div>調整合計 {signYen(Number(r.adjustments_total))}円</div>
                  <div>金種: {DENOMINATIONS.filter(u => r.denominations?.[u]).map(u => `${DENOM_LABEL[u]}×${r.denominations[u]}`).join(' ') || '—'}</div>
                  {r.note && <div>メモ: {r.note}</div>}
                  {canDeleteReconciliation(r, staffId) && (
                    <button data-testid={`recon-delete-${r.reconciliation_id}`} onClick={() => setDeleteConfirm(r.reconciliation_id)}
                      className="text-red-400 text-xs min-h-[36px] px-2 border border-red-500/40 rounded mt-1">この照合を削除</button>
                  )}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* テンキー footer (D-052/D-054 パターン) */}
      <div className={`${currentField ? 'flex-shrink-0' : 'h-0'} flex-none shrink-0 flex flex-col overflow-hidden`}>
        <NumpadFooterPanel currentField={currentField} />
      </div>

      {/* 削除確認 */}
      {deleteConfirm && (
        <div data-testid="recon-delete-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}>
          <div className="bg-bg border border-border rounded-2xl w-full max-w-sm p-4 space-y-3">
            <p className="text-sm text-text">この照合を削除しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 min-h-[44px] rounded border border-border text-sm text-muted">キャンセル</button>
              <button data-testid="recon-delete-confirm" onClick={() => handleDelete(deleteConfirm)} className="flex-1 min-h-[44px] rounded bg-red-600 text-white text-sm font-bold">削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
