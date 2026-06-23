// J-STOCK-STORE-SELECT-01 2026-05-30 司令塔Opus spec
// /stock 入口に店舗選択を追加、staff/leader/manager/admin 全ロールアクセス可、
// staff role の場合 staff_stores で自担当店舗のみ表示。
// 巡回ハブv5 (TanasupportHub) の StoreHubSelector パターンを流用、2-stage:
//   step='select' → 店舗カード一覧 (★ピン+50音タブ)
//   step='menu'   → 機能カード (入荷チェック/棚卸/発注追跡/出庫記録) に store_id 付き

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'

function loadRecent(staffId) {
  try { return JSON.parse(localStorage.getItem(`stock_recent_${staffId}`) || '[]') } catch { return [] }
}

function saveRecent(staffId, storeCode) {
  const key = `stock_recent_${staffId}`
  const prev = loadRecent(staffId)
  const next = [storeCode, ...prev.filter(c => c !== storeCode)].slice(0, 5)
  localStorage.setItem(key, JSON.stringify(next))
}

export default function StockHubPage() {
  const navigate = useNavigate()
  const { staffId, staffRole } = useAuth()

  const [stores, setStores]           = useState([])
  const [pinnedCodes, setPinnedCodes] = useState([])
  const [allowedSet, setAllowedSet]   = useState(null) // null=全店 / Set=staff_stores のみ
  const [recentCodes, setRecent]      = useState([])
  const [arrivalsCount, setArrivals]  = useState(0)
  const [sessionCount, setSessions]   = useState(0)
  const [loading, setLoading]         = useState(true)

  const [step, setStep]               = useState('select') // 'select' | 'menu'
  const [selectedStore, setSelectedStore] = useState(null)

  useEffect(() => {
    async function load() {
      const [
        { data: storeData },
        { count: sc },
        { count: ac },
        pinResult,
        staffStoresResult,
      ] = await Promise.all([
        supabase.from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
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
        (staffRole === 'staff' && staffId)
          ? supabase.from('staff_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: null }),
      ])
      setStores(storeData ?? [])
      setSessions(sc ?? 0)
      setArrivals(ac ?? 0)
      setPinnedCodes((pinResult.data ?? []).map(p => p.store_code))
      // staff role: staff_stores で絞る。leader/manager/admin: 全店
      if (staffStoresResult.data) {
        setAllowedSet(new Set(staffStoresResult.data.map(r => r.store_code)))
      } else {
        setAllowedSet(null)
      }
      setLoading(false)
    }
    load()
  }, [staffId, staffRole])

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
    const s = stores.find(x => x.store_code === storeCode)
    if (!s) return
    if (staffId) {
      saveRecent(staffId, storeCode)
      setRecent(loadRecent(staffId))
    }
    setSelectedStore(s)
    setStep('menu')
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

  // role=staff のみ staff_stores で絞る、他ロールは全店
  const visibleStores = allowedSet
    ? stores.filter(s => allowedSet.has(s.store_code))
    : stores

  const pinnedSet = new Set(pinnedCodes)
  const pinnedStores = visibleStores.filter(s => pinnedSet.has(s.store_code))
  const recentStores = recentCodes
    .filter(c => !pinnedSet.has(c))
    .map(c => visibleStores.find(s => s.store_code === c))
    .filter(Boolean)

  // step='menu' → 機能カード (店舗選択後)
  if (step === 'menu' && selectedStore) {
    return (
      <div data-testid="stock-hub-menu" className="h-dvh flex flex-col bg-bg text-text">
        <PageHeader
          module="tanasupport"
          title={selectedStore.store_name}
          variant="compact"
          onBack={() => { setStep('select'); setSelectedStore(null) }}
        />
        <div className="px-4 py-2 shrink-0 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setStep('select'); setSelectedStore(null) }}
            data-testid="stock-hub-change-store"
            className="text-xs text-accent underline"
          >
            ← 店舗を変更
          </button>
          <span className="text-xs text-muted">{selectedStore.store_code}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          <TaskTile
            emoji="🚚"
            title="入荷チェック"
            sub="入荷品の受取確認"
            borderColor="#f43f5e"
            badge={arrivalsCount > 0 ? arrivalsCount : null}
            badgeBg="bg-rose-500"
            onClick={() => navigate(`/stock/arrival?store_id=${encodeURIComponent(selectedStore.store_code)}`)}
            testid="stock-hub-card-arrival"
          />
          <TaskTile
            emoji="📋"
            title="棚卸し"
            sub="棚卸しセッション管理"
            borderColor="#10b981"
            badge={sessionCount > 0 ? sessionCount : null}
            badgeBg="bg-emerald-500"
            onClick={() => navigate(`/stock/stocktake?store_id=${encodeURIComponent(selectedStore.store_code)}`)}
            testid="stock-hub-card-stocktake"
          />
          <TaskTile
            emoji="📦"
            title="発注追跡"
            sub="発注履歴を確認"
            borderColor="var(--color-border, #e5e7eb)"
            badge={null}
            onClick={() => navigate(`/stock/orders?store_id=${encodeURIComponent(selectedStore.store_code)}`)}
            testid="stock-hub-card-orders"
          />
          <TaskTile
            emoji="📤"
            title="出庫記録"
            sub="担当持出・他店送付・出庫調整"
            borderColor="#f59e0b"
            badge={null}
            onClick={() => navigate(`/stock/out?store_id=${encodeURIComponent(selectedStore.store_code)}`)}
            testid="stock-hub-card-out"
          />
          {/* J-STOCK-OCR-COUNT-TEST-01: 常時表示テストカード (DB 保存なし、store_id 不要) */}
          <TaskTile
            emoji="🔬"
            title="OCRカウントテスト"
            sub="景品個数OCRの精度確認 (テスト版)"
            borderColor="#8b5cf6"
            badge={null}
            onClick={() => navigate('/stock/ocr-count-test')}
            testid="stock-hub-card-ocr-count-test"
          />
        </div>
      </div>
    )
  }

  // step='select' → 店舗選択
  return (
    <div data-testid="stock-hub-select" className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="タナサポ 店舗選択"
        variant="compact"
        onBack={() => navigate('/launcher')}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        {/* J-STOCK-OCR-COUNT-TEST-01 fix-01: spec '常時表示 (store_id 不要)' に従い、
            step='select' (店舗選択前) にも同タイルを最上部に配置。
            step='menu' (店舗選択後) 側にも追加済 (重複表示は意図、店舗選択前後どちらの動線からも到達可能)。 */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <TaskTile
            emoji="🔬"
            title="OCRカウントテスト"
            sub="景品個数OCRの精度確認 (テスト版)"
            borderColor="#8b5cf6"
            badge={null}
            onClick={() => navigate('/stock/ocr-count-test')}
            testid="stock-hub-card-ocr-count-test-select"
          />
        </div>

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

        <div className="px-4 pt-3 pb-1 shrink-0">
          <p className="text-[10px] text-muted font-bold tracking-wider">
            {allowedSet ? `担当店舗 (${visibleStores.length}店)` : `全店 (${visibleStores.length}店)`}
          </p>
        </div>
        <KanaIndex
          items={visibleStores}
          pinnedKeys={pinnedCodes}
          idKey="store_code"
          groupKey="locality_kana"
          showPinned={false}
          renderCard={renderStoreCard}
        />

        {visibleStores.length === 0 && (
          <p className="text-center text-muted text-sm py-12">
            {allowedSet
              ? '担当店舗が割当されていません (staff_stores)。管理者に問い合わせてください。'
              : '店舗データがありません'}
          </p>
        )}
      </div>
    </div>
  )
}

function TaskTile({ emoji, title, sub, borderColor, badge, badgeBg, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none min-h-[88px]"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      <span className="text-2xl shrink-0" style={{ minWidth: 44, textAlign: 'center' }}>{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-text text-base font-bold">{title}</p>
        <p className="text-sm mt-0.5" style={{ color: borderColor }}>{sub}</p>
      </div>
      {badge != null
        ? <span className={`shrink-0 ${badgeBg} text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[24px] text-center`}>{badge}</span>
        : <span className="text-muted text-xl shrink-0">›</span>
      }
    </button>
  )
}

function StoreCard({ store, isPinned, onSelect, onPin }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 px-3 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
      >
        <span className="text-lg shrink-0">{isPinned ? '★' : '🏪'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-text text-sm font-bold truncate">{store.store_name}</p>
          {store.locality && <p className="text-muted text-[10px] mt-0.5 truncate">{store.locality}</p>}
        </div>
        <span className="text-muted text-base shrink-0">›</span>
      </button>
      <button
        type="button"
        onClick={onPin}
        aria-label={isPinned ? 'ピン解除' : 'ピン留め'}
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg active:bg-surface2"
      >
        {isPinned ? '⭐' : '☆'}
      </button>
    </div>
  )
}
