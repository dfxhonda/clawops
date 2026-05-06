import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import {
  getOrCreateMonthSession,
  getLocationPrizes,
  getOwnerItemsMap,
  upsertItem,
} from './api'

// location の場合は /tanasupport/location/:locationId/stocktake で遷移

function PrizeCard({ prize, existingCount, sessionId, staffId, ownerType, ownerCode }) {
  const saved = existingCount ?? ''
  const [qty, setQty] = useState(saved !== '' ? String(saved) : '')
  const [saving, setSaving] = useState(false)
  const prevSavedRef = useRef(saved)

  // セッション切り替え時に既存値を同期
  useEffect(() => {
    const next = existingCount ?? ''
    if (next !== prevSavedRef.current) {
      prevSavedRef.current = next
      setQty(next !== '' ? String(next) : '')
    }
  }, [existingCount])

  const handleBlur = useCallback(async () => {
    if (qty === '') return
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 0) return
    setSaving(true)
    try {
      await upsertItem({
        sessionId,
        prizeId:          prize.prize_id,
        ownerType,
        ownerCode,
        actualCount:      n,
        theoreticalCount: prize.theoretical_count ?? null,
        staffId,
      })
      prevSavedRef.current = n
    } finally {
      setSaving(false)
    }
  }, [qty, sessionId, prize, ownerType, ownerCode, staffId])

  const isFilled  = qty !== '' && !isNaN(parseInt(qty, 10))
  const theoCnt   = prize.theoretical_count ?? 0
  const diff      = isFilled ? parseInt(qty, 10) - theoCnt : null

  return (
    <div
      className={`bg-surface border rounded-xl p-2.5 ${isFilled ? 'border-emerald-500/30' : 'border-border'}`}
      data-testid={`prize-card-${prize.prize_id}`}
    >
      <p className="text-xs text-text truncate font-medium leading-snug">{prize.prize_name}</p>
      <p className="text-xs text-muted mt-0.5">理論値: {theoCnt}</p>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={qty}
        onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={handleBlur}
        style={{ fontSize: 16 }}
        className="w-full h-9 bg-bg border border-border text-text text-center rounded-lg mt-1.5 outline-none focus:border-accent font-mono font-bold"
        data-testid={`prize-input-${prize.prize_id}`}
      />
      {diff != null && (
        <p className={`text-xs mt-1 text-center font-bold ${
          diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-amber-400' : 'text-rose-400'
        }`}>
          {diff === 0 ? '✓' : diff > 0 ? `+${diff}` : diff}
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
