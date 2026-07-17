import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../shared/ui/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { isAdmin } from '../../services/permissions'
import NumpadField from '../../clawsupport/components/NumpadField'
import NumpadFooterSlot from '../../clawsupport/components/NumpadFooterSlot'
import { useFieldNavigation } from '../../clawsupport/hooks/useFieldNavigation'
import { getCollectionDetail, updateCollectionAdvanceNotes } from '../../services/collections'
import { logger } from '../../lib/logger'

// SPEC-COLLECTION-PAST-EDIT-ADVANCE-01 (D-086): 過去集金のブース別編集。編集可能は立替金 (advance_payment) と
// 備考 (notes) のみ。メーター/集金額/金種/署名は署名済確定値のため読取専用表示 (入力経路を作らない = AC3)。

function UnauthorizedView() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/clawsupport', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [navigate])
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div data-testid="unauthorized-toast" className="text-amber-400 text-base font-bold px-4 py-3 border border-amber-400/40 rounded-xl">
        権限なし
      </div>
    </div>
  )
}

const yen = (v) => `¥${Number(v || 0).toLocaleString()}`

export default function AdminCollectionBoothEditPage() {
  const { collectionId } = useParams()
  const navigate = useNavigate()
  const { staffId, staffRole, loading } = useAuth()
  const { navigateNext, currentField, registerField, clearField } = useFieldNavigation()

  const [detail, setDetail] = useState(null)
  const [rows, setRows] = useState([])          // 編集用: { booth_code, id, advance_payment(str), notes(str) }
  const [dataLoading, setDataLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)    // 'ok' | 'err'

  function handleOutsideTap(e) {
    // D-052 一貫性: numpad フィールド/フッター外タップで閉じる
    if (e.target.closest('[data-numpad-field]')) return
    if (e.target.closest('[data-tabindex]')) return
    if (e.target.closest('[data-testid="numpad-footer"]')) return
    clearField()
  }

  useEffect(() => {
    if (!collectionId) return
    let alive = true
    setDataLoading(true)
    getCollectionDetail(decodeURIComponent(collectionId)).then(({ data, error }) => {
      if (!alive) return
      if (error || !data) { setResult('err'); setDataLoading(false); return }
      setDetail(data)
      setRows(data.booths.map(b => ({
        booth_code: b.booth_code,
        id: b.id,
        advance_payment: b.advance_payment != null ? String(b.advance_payment) : '',
        notes: b.notes ?? '',
      })))
      setDataLoading(false)
    })
    return () => { alive = false }
  }, [collectionId])

  const editMap = useMemo(() => Object.fromEntries(rows.map(r => [r.booth_code, r])), [rows])

  function setRow(boothCode, patch) {
    setRows(prev => prev.map(r => (r.booth_code === boothCode ? { ...r, ...patch } : r)))
    setResult(null)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setResult(null)
    clearField()
    const updates = rows.map(r => ({ id: r.id, advance_payment: r.advance_payment, notes: r.notes }))
    const { error } = await updateCollectionAdvanceNotes(decodeURIComponent(collectionId), updates, staffId)
    setSaving(false)
    if (error) { logger.error('collection_advance_save_failed', { collectionId, error: String(error?.message ?? error) }); setResult('err'); return }
    logger.info('collection_advance_saved', { collectionId, booths: updates.length, by: staffId })
    setResult('ok')
  }

  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />

  return (
    <div
      data-testid="collection-booth-edit"
      className="h-dvh bg-bg text-text grid"
      style={{ gridTemplateRows: 'auto 1fr auto auto', minHeight: 0 }}
      onPointerDown={handleOutsideTap}
    >
      <PageHeader
        module="admin"
        title="過去集金編集"
        variant="compact"
        hideHome
        onBack={() => navigate('/admin/audit/collection-edit')}
      />

      <div className="min-h-0 overflow-y-auto px-3 py-2 space-y-3" data-testid="collection-booth-scroll">
        {dataLoading && <div className="text-center text-muted text-base py-12">読み込み中...</div>}
        {!dataLoading && detail && (
          <>
            <div className="text-xs text-muted px-1">
              {detail.store?.store_name ?? detail.collection?.store_code} / 集金額合計 {yen(detail.total)} ・ 立替は合計除外の参考値
            </div>
            {detail.booths.map((b, i) => {
              const e = editMap[b.booth_code] ?? { advance_payment: '', notes: '' }
              return (
                <div key={b.booth_code} data-testid={`booth-card-${b.booth_code}`} className="rounded-2xl border border-border bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold">{b.machine_name} / {b.booth_name}</span>
                    <span className="text-sm text-muted font-mono">集金 {yen(b.total)}</span>
                  </div>
                  {/* 読取専用: メーター/金種 (編集経路なし) */}
                  <div className="text-xs text-muted grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono" data-testid={`booth-readonly-${b.booth_code}`}>
                    <span>IN {b.in_meter_prev ?? '—'}→{b.in_meter_current ?? '—'}</span>
                    <span>OUT {b.out_meter_prev ?? '—'}→{b.out_meter_current ?? '—'}</span>
                    <span>万{b.bill_10000 ?? 0} 五千{b.bill_5000 ?? 0} 千{b.bill_1000 ?? 0}</span>
                    <span>500:{b.coin_500 ?? 0} 100:{b.coin_100 ?? 0} 50:{b.coin_50 ?? 0}</span>
                  </div>
                  {/* 編集可: 立替金 */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-accent shrink-0 w-16">立替金</label>
                    <NumpadField
                      id={`booth-advance-${b.booth_code}`}
                      value={e.advance_payment}
                      onChange={v => setRow(b.booth_code, { advance_payment: v })}
                      label="立替"
                      max={9999999}
                      dataTabindex={i + 1}
                      testId={`booth-advance-${b.booth_code}`}
                      isActive={currentField?.testId === `booth-advance-${b.booth_code}`}
                      strongActive
                      onNext={() => navigateNext?.(i + 1)}
                      onRegister={registerField}
                      onClear={clearField}
                      style={{ fontSize: 16, width: '100%' }}
                    />
                  </div>
                  {/* 編集可: 備考 */}
                  <div className="flex items-start gap-2">
                    <label className="text-sm font-bold text-muted shrink-0 w-16 pt-2">備考</label>
                    <textarea
                      data-testid={`booth-notes-${b.booth_code}`}
                      value={e.notes}
                      onChange={ev => setRow(b.booth_code, { notes: ev.target.value })}
                      rows={2}
                      className="flex-1 rounded-xl bg-surface2 border border-border px-3 py-2 text-base resize-none"
                      placeholder="備考 (任意)"
                    />
                  </div>
                </div>
              )
            })}
          </>
        )}
        {!dataLoading && !detail && result === 'err' && (
          <div className="text-center text-danger-text text-base py-12">集金記録を読み込めませんでした</div>
        )}
      </div>

      {/* 保存バー */}
      <div className="flex-none shrink-0 px-3 py-2 border-t border-border flex items-center gap-3">
        {result === 'ok' && <span data-testid="save-ok" className="text-sm text-success font-bold">保存しました</span>}
        {result === 'err' && detail && <span data-testid="save-err" className="text-sm text-danger-text font-bold">保存に失敗しました</span>}
        <button
          type="button"
          data-testid="collection-advance-save"
          onClick={handleSave}
          disabled={saving || dataLoading || !detail}
          className="ml-auto px-6 py-3 min-h-[44px] rounded-2xl font-bold text-base bg-blue-600 text-white disabled:opacity-40"
        >
          {saving ? '保存中...' : '立替金・備考を保存'}
        </button>
      </div>

      <NumpadFooterSlot currentField={currentField} />
    </div>
  )
}
