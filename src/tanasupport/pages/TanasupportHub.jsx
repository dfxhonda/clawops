import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'

export default function TanasupportHub() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [stores, setStores]               = useState([])
  const [pinnedCodes, setPinnedCodes]     = useState([])
  const [sessionCounts, setSessionCounts] = useState({})
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: storeData }, { data: sessionData }, { data: pinData }] = await Promise.all([
        supabase
          .from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
        supabase
          .from('stocktake_sessions')
          .select('store_code')
          .in('status', ['in_progress', 'submitted']),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
      ])

      setStores(storeData ?? [])
      setPinnedCodes((pinData ?? []).map(p => p.store_code))

      const counts = {}
      for (const s of sessionData ?? []) {
        counts[s.store_code] = (counts[s.store_code] ?? 0) + 1
      }
      setSessionCounts(counts)
      setLoading(false)
    }
    load()
  }, [staffId])

  const handlePin = useCallback(async (storeCode) => {
    const isPinned = pinnedCodes.includes(storeCode)
    if (isPinned) {
      setPinnedCodes(prev => prev.filter(c => c !== storeCode))
      await supabase.from('staff_pinned_stores')
        .delete()
        .eq('staff_id', staffId)
        .eq('store_code', storeCode)
    } else {
      setPinnedCodes(prev => [...prev, storeCode])
      await supabase.from('staff_pinned_stores')
        .upsert({ staff_id: staffId, store_code: storeCode }, { onConflict: 'staff_id,store_code' })
    }
  }, [pinnedCodes, staffId])

  function renderCard(store, isPinned) {
    const cnt = sessionCounts[store.store_code] ?? 0
    return (
      <StoreCard
        key={store.store_code}
        store={store}
        isPinned={isPinned}
        sessionCount={cnt}
        onSelect={() => navigate(`/tanasupport/store/${store.store_code}`)}
        onPin={() => handlePin(store.store_code)}
      />
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="タナサポ"
        variant="compact"
      />

      <KanaIndex
        items={stores}
        pinnedKeys={pinnedCodes}
        idKey="store_code"
        groupKey="locality_kana"
        renderCard={renderCard}
      />
    </div>
  )
}

function StoreCard({ store, isPinned, sessionCount, onSelect, onPin }) {
  const timerRef = useRef(null)
  const movedRef = useRef(false)

  function handlePointerDown() {
    movedRef.current = false
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) onPin()
    }, 500)
  }

  function handlePointerUp() {
    clearTimeout(timerRef.current)
  }

  function handlePointerMove() {
    movedRef.current = true
    clearTimeout(timerRef.current)
  }

  return (
    <button
      onClick={onSelect}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerUp}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none"
      style={{ minHeight: 72 }}
    >
      {isPinned && <span className="text-yellow-400 text-sm shrink-0">★</span>}
      <div className="flex-1 min-w-0">
        <p className="text-text text-base font-bold truncate">{store.store_name}</p>
        {store.locality && (
          <p className="text-muted text-xs mt-0.5">{store.locality}</p>
        )}
      </div>
      {sessionCount > 0 && (
        <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/40 shrink-0">
          棚卸し {sessionCount}件
        </span>
      )}
      <span className="text-muted text-lg shrink-0">›</span>
    </button>
  )
}
