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

// Stage 3: 乖離率閾値
const WARN_THRESHOLD  = 0.10
const ALERT_THRESHOLD = 0.30

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

function PrizeCard({ prize, existingCount, sessionId, staffId, ownerType, ownerCode, isLocked }) {
  const saved = existingCount ?? ''
  const [qty, setQty] = useState(saved !== '' ? String(saved) : '')
  const [saving, setSaving] = useState(false)
  const prevSavedRef = useRef(saved)

  useEffect(() => {
    const next = existingCount ?? ''
    if (next !== prevSavedRef.current) {
      prevSavedRef.current = next
      setQty(next !== '' ? String(next) : '')
    }
  }, [existingCount])

  const theoCnt  = prize.theoretical_count ?? 0
  const isFilled = qty !== '' && !isNaN(parseInt(qty, 10))
  const n        = isFilled ? parseInt(qty, 10) : null
  const varRate  = (n != null && theoCnt > 0) ? Math.abs(n - theoCnt) / theoCnt : null
  const diff     = n != null ? n - theoCnt : null

  const handleBlur = useCallback(async () => {
    if (isLocked || qty === '') return
    const parsed = parseInt(qty, 10)
    if (isNaN(parsed) || parsed < 0) return

    const curRate = (theoCnt > 0) ? Math.abs(parsed - theoCnt) / theoCnt : null
    if (curRate != null && curRate >= ALERT_THRESHOLD) {
      const confirmed = window.confirm(
        `理論値から ${Math.round(curRate * 100)}% 乖離しています。\n本当に保存しますか？\n（この操作は記録に残ります）`
      )
      if (!confirmed) {
        setQty(prevSavedRef.current !== '' ? String(prevSavedRef.current) : '')
        return
      }
      writeAuditLog({
        action: 'stocktake_variance_override',
        target_table: 'stocktake_items',
        target_id: `${sessionId}:${prize.prize_id}:${ownerType}:${ownerCode}`,
        detail: `乖離率 ${Math.round(curRate * 100)}% を確認の上で保存`,
        staff_id: staffId,
        after_data: { actual_count: parsed, theoretical_count: theoCnt, variance_rate: curRate },
        reason_code: 'COUNT_DIFF',
      })
    }

    setSaving(true)
    try {
      await upsertItem({
        sessionId,
        prizeId:          prize.prize_id,
        ownerType,
        ownerCode,
        actualCount:      parsed,
        theoreticalCount: theoCnt || null,
        staffId,
      })
      prevSavedRef.current = parsed
    } finally {
      setSaving(false)
    }
  }, [isLocked, qty, theoCnt, sessionId, prize.prize_id, ownerType, ownerCode, staffId])

  return (
    <div
      className={`bg-surface border rounded-xl p-2.5 ${borderClass(isFilled, varRate)}`}
      data-testid={`prize-card-${prize.prize_id}`}
    >
      <p className="text-xs text-text truncate font-medium leading-snug">{prize.prize_name}</p>
      <p className="text-xs text-muted mt-0.5">理論値: {theoCnt}</p>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={qty}
        onChange={e => !isLocked && setQty(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={handleBlur}
        disabled={isLocked}
        style={{ fontSize: 16 }}
        className={`w-full h-9 bg-bg border border-border text-text text-center rounded-lg mt-1.5 outline-none focus:border-accent font-mono font-bold ${
          isLocked ? 'opacity-50 cursor-not-allowed' : ''
        }`}
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
      {saving && <p className="text-[10px] text-muted text-center mt-0.5">保存中</p>}
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

  const isLocked  = session?.status === 'locked'
  const ownerType = 'location'
  const ownerCode = locationId

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

      {isLocked && (
        <div
          className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/30 text-center"
          data-testid="lock-banner"
        >
          <p className="text-rose-400 text-xs font-bold">
            🔒 このセッションはロック済みです — 修正不可
          </p>
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
          <div className="text-center text-muted text-sm py-16">
            この倉庫に景品在庫データがありません
          </div>
        ) : filteredPrizes.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">
            {filter === 'unfilled' ? 'すべて入力済みです ✅' : '該当なし'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredPrizes.map(prize => (
              <PrizeCard
                key={prize.prize_id}
                prize={prize}
                existingCount={itemsMap[prize.prize_id]?.actual_count ?? null}
                sessionId={session.session_id}
                staffId={staffId}
                ownerType={ownerType}
                ownerCode={ownerCode}
                isLocked={isLocked}
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
    </div>
  )
}
