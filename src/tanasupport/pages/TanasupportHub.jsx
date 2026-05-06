import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'
import { getWarehouseLocations } from '../stocktake/api'

export default function TanasupportHub() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [stores, setStores]               = useState([])
  const [warehouses, setWarehouses]       = useState([])
  const [pinnedCodes, setPinnedCodes]     = useState([])
  const [sessionMonths, setSessionMonths] = useState({})
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: storeData }, warehouseData, { data: sessionData }, pinResult] = await Promise.all([
        supabase
          .from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
        getWarehouseLocations(),
        supabase
          .from('stocktake_sessions')
          .select('session_id, month, status')
          .in('status', ['open', 'submitted']),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
      ])

      setStores(storeData ?? [])
      setWarehouses(warehouseData)
      setPinnedCodes((pinResult.data ?? []).map(p => p.store_code))

      // 当月セッション有無をマーク (location_id をキーに持たないので session_id だけ管理)
      const months = {}
      for (const s of sessionData ?? []) {
        months[s.session_id] = s.month
      }
      setSessionMonths(months)
      setLoading(false)
    }
    load()
  }, [staffId])

  const hasOpenSession = Object.keys(sessionMonths).length > 0

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

  function renderStoreCard(store, isPinned) {
    return (
      <StoreCard
        key={store.store_code}
        store={store}
        isPinned={isPinned}
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

      {/* 倉庫セクション（本社倉庫 + 各倉庫） */}
      <div className="px-5 pt-3 pb-1 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted font-bold tracking-wide">倉庫 · カウント入力</span>
          {hasOpenSession && (
            <span className="text-[10px] text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-full">
              {Object.keys(sessionMonths).length}セッション進行中
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {warehouses.map(loc => (
            <WarehouseCard
              key={loc.location_id}
              location={loc}
              onSelect={() => navigate(`/tanasupport/location/${loc.location_id}/stocktake`)}
            />
          ))}
        </div>
      </div>

      <div className="border-b border-border mx-5 my-2 shrink-0" />

      {/* 店舗セクション */}
      <div className="px-5 pb-1 shrink-0">
        <span className="text-xs text-muted font-bold tracking-wide">店舗</span>
      </div>
      <KanaIndex
        items={stores}
        pinnedKeys={pinnedCodes}
        idKey="store_code"
        groupKey="locality_kana"
        renderCard={renderStoreCard}
      />
    </div>
  )
}

function WarehouseCard({ location, onSelect }) {
  const isWarehouse = location.location_type === 'warehouse'
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-2 px-3 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none"
    >
      <span className="text-lg shrink-0">{isWarehouse ? '🏭' : '🏪'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-text text-xs font-bold truncate">{location.location_name}</p>
        <p className="text-muted text-[10px] mt-0.5">{isWarehouse ? '倉庫' : '店舗倉庫'}</p>
      </div>
    </button>
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
      style={{ minHeight: 64 }}
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
