import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import { writeAuditLog } from '../../services/audit'
import {
  getOrCreateMonthSession,
  getLocationPrizes,
  getOwnerItemsMap,
  upsertItem,
} from './api'
import { isPastMonthEndJst } from './stocktakeMonth'

const WARN_THRESHOLD  = 0.10
const ALERT_THRESHOLD = 0.30
const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','C','0','✓']

function varianceClass(rate) {
  if (rate === null || rate === undefined) return 'text-emerald-400'
  if (rate < WARN_THRESHOLD)  return 'text-emerald-400'
  if (rate < ALERT_THRESHOLD) return 'text-amber-400'
  return 'text-rose-400'
}

function borderClass(isFilled, rate) {
  if (!isFilled) return 'border-border'
  if (rate === null || rate < WARN_THRESHOLD)  return 'border-emerald-500/30'
  if (rate < ALERT_THRESHOLD) return 'border-amber-500/40'
  return 'border-rose-500/60'
}

function PrizeCard({ prize, qty, onQtyChange, onConfirm, onTap, isSelected, isLocked }) {
  const theoCnt = prize.theoretical_count ?? 0
  const isFilled = qty !== '' && !isNaN(parseInt(qty, 10))
  const n    = isFilled ? parseInt(qty, 10) : null
  const varRate = (n != null && theoCnt > 0) ? Math.abs(n - theoCnt) / theoCnt : null
  const diff    = n != null ? n - theoCnt : null

  return (
    <div
      className={`bg-surface border rounded-xl p-2.5 cursor-pointer active:scale-[0.97] transition-transform ${
        isSelected ? 'border-accent' : borderClass(isFilled, varRate)
      } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
      data-testid={`prize-card-${prize.prize_id}`}
      onClick={() => !isLocked && onTap()}
    >
      <p className="text-xs text-text truncate font-medium leading-snug">{prize.prize_name}</p>
      <p className="text-xs text-muted mt-0.5">理論値: {theoCnt}</p>

      {/* visual qty display */}
      <div className={`w-full h-9 bg-bg border border-border rounded-lg mt-1.5 flex items-center justify-center font-mono font-bold text-base ${
        isFilled ? 'text-text' : 'text-muted/40'
      }`}>
        {isFilled ? qty : '—'}
      </div>

      {/* hidden input — kept for e2e test compatibility (fill/blur interaction) */}
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={qty}
        onChange={e => !isLocked && onQtyChange(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => !isLocked && onConfirm()}
        disabled={isLocked}
        style={{ position: 'absolute', left: '-9999px', fontSize: 16 }}
        data-testid={`prize-input-${prize.prize_id}`}
      />

      {diff != null && (
        <p
          className={`text-xs mt-1 text-center font-bold ${varianceClass(varRate)}`}
          data-testid={`variance-rate-${prize.prize_id}`}
        >
          {varRate != null
            ? (varRate === 0 ? '✓' : `${diff > 0 ? '+' : ''}${diff} (${Math.round(varRate * 100)}%)`)
            : (diff === 0 ? '✓' : diff > 0 ? `+${diff}` : String(diff))
          }
        </p>
      )}
    </div>
  )
}

const FILTERS = [
  { key: 'unfilled', label: '未入力' },
  { key: 'filled',   label: '入力済' },
  { key: 'all',      label: '全て' },
]

export default function StocktakeInput() {
  const { locationId } = useParams()
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [session,      setSession]      = useState(null)
  const [prizes,       setPrizes]       = useState([])
  const [itemsMap,     setItemsMap]     = useState({})
  const [locationName, setLocationName] = useState(locationId)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [filter,       setFilter]       = useState('unfilled')

  const [selectedPrizeId, setSelectedPrizeId] = useState(null)
  const [draftMap,        setDraftMap]        = useState({})
  const [saving,          setSaving]          = useState(false)

  // Ref so confirm handler always reads latest draftMap without stale closure
  const draftMapRef = useRef({})
  draftMapRef.current = draftMap

  const sessionLocked = session?.status === 'locked'
  const pastMonthEnd  = session?.month ? isPastMonthEndJst(session.month) : false
  const isEditLocked  = sessionLocked || pastMonthEnd
  const ownerType     = 'location'
  const ownerCode     = locationId

  useEffect(() => {
    if (!locationId) return
    let cancelled = false

    async function load() {
      try {
        const [sess, prizeList, { data: locRow }] = await Promise.all([
          getOrCreateMonthSession(),
          getLocationPrizes(locationId),
          import('../../lib/supabase').then(m =>
            m.supabase.from('locations').select('location_name').eq('location_id', locationId).maybeSingle()
          ),
        ])
        if (cancelled) return
        setSession(sess)
        setPrizes(prizeList)
        setLocationName(locRow?.location_name ?? locationId)

        const map = await getOwnerItemsMap(sess.session_id, ownerType, ownerCode)
        if (!cancelled) setItemsMap(map)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filledCount = useMemo(
    () => prizes.filter(p => itemsMap[p.prize_id] != null).length,
    [prizes, itemsMap]
  )

  const filteredPrizes = useMemo(() => {
    if (filter === 'unfilled') return prizes.filter(p => itemsMap[p.prize_id] == null)
    if (filter === 'filled')   return prizes.filter(p => itemsMap[p.prize_id] != null)
    return prizes
  }, [filter, prizes, itemsMap])

  function getDraft(prizeId) {
    if (prizeId in draftMap) return draftMap[prizeId]
    const existing = itemsMap[prizeId]?.actual_count
    return existing != null ? String(existing) : ''
  }

  function handleOpenCard(prizeId) {
    if (isEditLocked) return
    setSelectedPrizeId(prizeId)
    setDraftMap(m => {
      if (prizeId in m) return m
      const existing = itemsMap[prizeId]?.actual_count
      return { ...m, [prizeId]: existing != null ? String(existing) : '' }
    })
  }

  const handleConfirm = useCallback(async (prizeId) => {
    const qty = draftMapRef.current[prizeId] ?? ''
    if (qty === '') return
    const parsed = parseInt(qty, 10)
    if (isNaN(parsed) || parsed < 0) return
    const prize = prizes.find(p => p.prize_id === prizeId)
    if (!prize) return
    const theoCnt = prize.theoretical_count ?? 0
    const curRate = theoCnt > 0 ? Math.abs(parsed - theoCnt) / theoCnt : null

    if (curRate != null && curRate >= ALERT_THRESHOLD) {
      const confirmed = window.confirm(
        `理論値から ${Math.round(curRate * 100)}% 乖離しています。\n本当によろしいですか？\n（押し切って保存した場合は記録に残ります）`
      )
      if (!confirmed) {
        const prevCount = itemsMap[prizeId]?.actual_count
        setDraftMap(m => ({ ...m, [prizeId]: prevCount != null ? String(prevCount) : '' }))
        setSelectedPrizeId(null)
        return
      }
      writeAuditLog({
        action: 'stocktake_variance_override',
        target_table: 'stocktake_items',
        target_id: `${session.session_id}:${prizeId}:${ownerType}:${ownerCode}`,
        detail: `乖離率 ${Math.round(curRate * 100)}% を確認の上で保存`,
        staff_id: staffId,
        after_data: { actual_count: parsed, theoretical_count: theoCnt, variance_rate: curRate },
        reason_code: 'COUNT_DIFF',
      })
    }

    setSaving(true)
    try {
      await upsertItem({
        sessionId:        session.session_id,
        prizeId,
        ownerType,
        ownerCode,
        actualCount:      parsed,
        theoreticalCount: theoCnt || null,
        staffId,
      })
      setItemsMap(m => ({ ...m, [prizeId]: { actual_count: parsed } }))
      setDraftMap(m => { const next = { ...m }; delete next[prizeId]; return next })
      setSelectedPrizeId(null)
    } finally {
      setSaving(false)
    }
  }, [prizes, session, ownerType, ownerCode, staffId, itemsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNumKey(k) {
    if (!selectedPrizeId) return
    if (k === 'C') {
      setDraftMap(m => ({ ...m, [selectedPrizeId]: '' }))
      return
    }
    if (k === '✓') {
      handleConfirm(selectedPrizeId)
      return
    }
    setDraftMap(m => {
      const cur  = m[selectedPrizeId] ?? ''
      const next = cur + k
      return { ...m, [selectedPrizeId]: next.length <= 5 ? next : cur }
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
      読み込み中...
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-rose-400 text-sm px-5 text-center">
      {error}
    </div>
  )

  const monthLabel = session?.month
    ? new Date(session.month + 'T00:00:00+09:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-screen bg-bg text-text pb-32" data-testid="stocktake-input">
      <PageHeader
        module="tanasupport"
        title={locationName}
        subtitle={`${monthLabel} · 倉庫 ${filledCount}/${prizes.length}`}
        onBack={() => navigate('/tanasupport')}
      />

      {sessionLocked && (
        <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/30 text-center" data-testid="lock-banner">
          <p className="text-rose-400 text-xs font-bold">このセッションはロック済みです — 修正不可</p>
        </div>
      )}
      {!sessionLocked && pastMonthEnd && (
        <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/30 text-center" data-testid="deadline-banner">
          <p className="text-rose-400 text-xs font-bold">当月締切（月末23:59 JST）を過ぎたため修正できません</p>
        </div>
      )}

      {/* フィルターバー */}
      <div className="px-5 flex gap-2 py-3 border-b border-border">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filter === f.key ? 'bg-accent text-bg' : 'bg-surface text-muted border border-border'
            }`}
          >
            {f.label}
            {f.key === 'unfilled' && ` ${prizes.filter(p => itemsMap[p.prize_id] == null).length}`}
            {f.key === 'filled'   && ` ${filledCount}`}
          </button>
        ))}
      </div>

      {/* 景品グリッド */}
      <div className="px-5 pt-3">
        {prizes.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">この倉庫に景品在庫データがありません</div>
        ) : filteredPrizes.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">
            {filter === 'unfilled' ? 'すべて入力済みです' : '該当なし'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredPrizes.map(prize => (
              <PrizeCard
                key={prize.prize_id}
                prize={prize}
                qty={getDraft(prize.prize_id)}
                onQtyChange={v => setDraftMap(m => ({ ...m, [prize.prize_id]: v }))}
                onConfirm={() => handleConfirm(prize.prize_id)}
                onTap={() => handleOpenCard(prize.prize_id)}
                isSelected={selectedPrizeId === prize.prize_id}
                isLocked={isEditLocked}
              />
            ))}
          </div>
        )}
      </div>

      {/* 下部固定フッター */}
      <div className="fixed bottom-0 inset-x-0 bg-bg border-t border-border px-5 py-3">
        <button
          onClick={() => navigate('/tanasupport')}
          className="w-full h-12 bg-surface border border-border text-text text-sm rounded-2xl font-medium active:scale-[0.98] transition-all"
        >
          ← ハブに戻る（自動保存済み）
        </button>
      </div>

      {/* bottom sheet テンキー */}
      {selectedPrizeId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedPrizeId(null)} />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border rounded-t-2xl p-4">
            <p className="text-sm font-bold text-text mb-2 truncate">
              {prizes.find(p => p.prize_id === selectedPrizeId)?.prize_name ?? ''}
            </p>
            <div className="text-4xl font-mono font-bold text-text text-center mb-4 min-h-[3rem]">
              {getDraft(selectedPrizeId) || '—'}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {NUMPAD_KEYS.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleNumKey(k)}
                  disabled={saving}
                  className={`h-14 w-full border rounded-xl text-xl font-bold transition-colors active:scale-95 disabled:opacity-40 ${
                    k === '✓' ? 'bg-accent text-bg border-accent'
                      : k === 'C' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-bg border-border text-text'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            {saving && <p className="text-center text-xs text-muted mt-1">保存中…</p>}
          </div>
        </>
      )}
    </div>
  )
}
