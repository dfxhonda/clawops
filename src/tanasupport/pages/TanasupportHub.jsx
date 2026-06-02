import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'
import { getWarehouseLocations } from '../stocktake/api'

function loadRecent(staffId) {
  try { return JSON.parse(localStorage.getItem(`tana_recent_${staffId}`) || '[]') } catch { return [] }
}

function saveRecent(staffId, storeCode) {
  const key = `tana_recent_${staffId}`
  const prev = loadRecent(staffId)
  const next = [storeCode, ...prev.filter(c => c !== storeCode)].slice(0, 5)
  localStorage.setItem(key, JSON.stringify(next))
}

export default function TanasupportHub() {
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const [tab, setTab] = useState('sakugyou')
  const [stores, setStores]           = useState([])
  const [warehouses, setWarehouses]   = useState([])
  const [pinnedCodes, setPinnedCodes] = useState([])
  const [arrivalsCount, setArrivals]  = useState(0)
  const [sessionCount, setSessions]   = useState(0)
  const [recentCodes, setRecent]      = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: storeData },
        warehouseData,
        { count: sc },
        { count: ac },
        pinResult,
      ] = await Promise.all([
        supabase.from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
        getWarehouseLocations(),
        supabase.from('stocktake_sessions')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'submitted']),
        supabase.from('prize_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'arrived')
          .eq('is_fully_received', false),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
      ])
      setStores(storeData ?? [])
      setWarehouses(warehouseData)
      setSessions(sc ?? 0)
      setArrivals(ac ?? 0)
      setPinnedCodes((pinResult.data ?? []).map(p => p.store_code))
      setLoading(false)
    }
    load()
  }, [staffId])

  useEffect(() => {
    if (staffId) setRecent(loadRecent(staffId))
  }, [staffId])

  const handlePin = useCallback(async (storeCode) => {
    const isPinned = pinnedCodes.includes(storeCode)
    if (isPinned) {
      setPinnedCodes(prev => prev.filter(c => c !== storeCode))
      await supabase.from('staff_pinned_stores').delete().eq('staff_id', staffId).eq('store_code', storeCode)
    } else {
      setPinnedCodes(prev => [...prev, storeCode])
      await supabase.from('staff_pinned_stores').upsert({ staff_id: staffId, store_code: storeCode }, { onConflict: 'staff_id,store_code' })
    }
  }, [pinnedCodes, staffId])

  function handleSelectStore(storeCode) {
    if (staffId) {
      saveRecent(staffId, storeCode)
      setRecent(loadRecent(staffId))
    }
    navigate(`/tanasupport/store/${storeCode}`)
  }

  function renderStoreCard(store, isPinned) {
    return (
      <StoreCard
        key={store.store_code}
        store={store}
        isPinned={isPinned}
        onSelect={() => handleSelectStore(store.store_code)}
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

  const pinnedSet = new Set(pinnedCodes)
  const pinnedStores = stores.filter(s => pinnedSet.has(s.store_code))
  const recentStores = recentCodes
    .filter(c => !pinnedSet.has(c))
    .map(c => stores.find(s => s.store_code === c))
    .filter(Boolean)

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="タナサポ"
        variant="compact"
        menuToLauncher
      />

      {/* tab bar */}
      <div className="sticky top-0 z-10 bg-bg shrink-0 flex gap-1 px-4 py-2 border-b border-border">
        {[['sakugyou', '作業'], ['basho', '場所']].map(([key, label]) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              tab === key ? 'bg-accent text-white' : 'bg-surface text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 作業タブ */}
      {tab === 'sakugyou' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          <TaskTile
            emoji="🚚"
            title="入荷チェック"
            sub="入荷品の受取確認"
            borderColor="#f43f5e"
            badge={arrivalsCount > 0 ? arrivalsCount : null}
            badgeBg="bg-rose-500"
            onClick={() => navigate('/stock/arrival')}
          />
          <TaskTile
            emoji="📋"
            title="棚卸し"
            sub="棚卸しセッション管理"
            borderColor="#10b981"
            badge={sessionCount > 0 ? sessionCount : null}
            badgeBg="bg-emerald-500"
            onClick={() => navigate('/tanasupport/stocktake')}
          />
          <TaskTile
            emoji="📦"
            title="発注追跡"
            sub="発注履歴を確認"
            borderColor="var(--color-border, #e5e7eb)"
            badge={null}
            onClick={() => navigate('/tanasupport/orders')}
          />
          <TaskTile
            emoji="📤"
            title="出庫記録"
            sub="担当持出・他店送付・出庫調整"
            borderColor="#f59e0b"
            badge={null}
            onClick={() => navigate('/stock/out')}
          />
          {/* SPEC-STOCK-UI-FIX-01: 景品案内 TaskTile は LocationHubPage.jsx へ移設 (DIAG-STOCK-UI-02
              で TanasupportHub 自体が Launcher 動線から到達不能と確定したため)。本ハブも全体的に
              到達不能だが、整理目的で本タイルのみ削除。他タイルは将来動線復帰時の参考用に残置。 */}
          {/* J-STOCK-OCR-COUNT-TEST-01-fix-02 (ヒロ Discord 棚卸しOCRテストまだ見えない):
              spec scope.modify は StockHubPage だけだったが、Launcher → 棚卸 タイル の遷移先は
              /tanasupport (本 TanasupportHub) で /stock (StockHubPage) は通らない。
              spec acceptance a1 '/stock のメニュー' を満たすには本ハブにも同タイル追加が必要。 */}
          <TaskTile
            emoji="🔬"
            title="OCRカウントテスト"
            sub="景品個数OCRの精度確認 (テスト版)"
            borderColor="#8b5cf6"
            badge={null}
            onClick={() => navigate('/stock/ocr-count-test')}
          />
        </div>
      )}

      {/* 場所タブ */}
      {tab === 'basho' && (
        <>
          {/* ★ ピン留め */}
          {pinnedStores.length > 0 && (
            <div className="px-4 pt-3 pb-1 shrink-0">
              <p className="text-[10px] text-muted font-bold tracking-wider mb-1.5">★ ピン留め</p>
              <div className="flex flex-col gap-2">
                {pinnedStores.map(s => (
                  <StoreCard key={s.store_code} store={s} isPinned={true}
                    onSelect={() => handleSelectStore(s.store_code)}
                    onPin={() => handlePin(s.store_code)} />
                ))}
              </div>
            </div>
          )}

          {/* 最近使った */}
          {recentStores.length > 0 && (
            <div className="px-4 pt-3 pb-1 shrink-0">
              <p className="text-[10px] text-muted font-bold tracking-wider mb-1.5">最近使った</p>
              <div className="flex flex-col gap-2">
                {recentStores.map(s => (
                  <StoreCard key={s.store_code} store={s} isPinned={false}
                    onSelect={() => handleSelectStore(s.store_code)}
                    onPin={() => handlePin(s.store_code)} />
                ))}
              </div>
            </div>
          )}

          {/* 倉庫 */}
          <div className="px-4 pt-3 pb-1 shrink-0">
            <p className="text-[10px] text-muted font-bold tracking-wider mb-1.5">倉庫</p>
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

          {/* 全店 */}
          <div className="px-4 pt-3 pb-1 shrink-0">
            <p className="text-[10px] text-muted font-bold tracking-wider">全店</p>
          </div>
          <KanaIndex
            items={stores}
            pinnedKeys={pinnedCodes}
            idKey="store_code"
            groupKey="locality_kana"
            showPinned={false}
            renderCard={renderStoreCard}
          />
        </>
      )}
    </div>
  )
}

function TaskTile({ emoji, title, sub, borderColor, badge, badgeBg, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      <span className="text-xl shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-text text-sm font-bold">{title}</p>
        <p className="text-xs mt-0.5" style={{ color: borderColor }}>{sub}</p>
      </div>
      {badge != null
        ? <span className={`shrink-0 ${badgeBg} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center`}>{badge}</span>
        : <span className="text-muted text-lg shrink-0">›</span>
      }
    </button>
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
