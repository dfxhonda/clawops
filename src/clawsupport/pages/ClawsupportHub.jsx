import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'
import LogoutButton from '../../components/LogoutButton'

function todayLabel() {
  return new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
  })
}

export default function ClawsupportHub() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [stores, setStores] = useState([])
  const [pinnedCodes, setPinnedCodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: storeData }, { data: pinData }] = await Promise.all([
        supabase
          .from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
      ])
      setStores(storeData ?? [])
      setPinnedCodes((pinData ?? []).map(p => p.store_code))
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
    return (
      <StoreCard
        key={store.store_code}
        store={store}
        isPinned={isPinned}
        onSelect={() => navigate(`/clawsupport/store/${store.store_code}`)}
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
        module="clawsupport"
        title="クレサポ"
        variant="compact"
        rightSlot={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{todayLabel()}</span>
            <LogoutButton className="h-10 px-3 text-xs text-muted bg-surface border border-border rounded-xl active:opacity-70" />
          </div>
        }
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

function StoreCard({ store, isPinned, onSelect, onPin }) {
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
      <span className="text-muted text-lg shrink-0">›</span>
    </button>
  )
}
