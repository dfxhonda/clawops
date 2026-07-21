// SPEC-PATROL-ROUTE-BUILDER-01 (D-106) + SPEC-PATROL-ROUTE-STORECARD-UNIFY-01 (D-107):
// 今日の巡回ルート作成。現地取得→lat/lngあり店に直線距離表示→予定に追加→dnd-kitドラッグ/AIおすすめ順→
// Googleマップ経由地URL丸投げでナビ開始。予定は idb (patrol_route_today, 日付JST) にローカル保存(今日のみ)。
// D-107: 店選択をクレサポ本体と同じ KanaIndex + 共有 StoreCard (★カナインデックス) に統一、右メタに距離併存。
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useGeolocation } from '../../shared/hooks/useGeolocation'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'
import StoreCard from '../../shared/ui/StoreCard'
import { logger } from '../../lib/logger'
import { buildMapsDirUrl } from '../../utils/geo'
import { annotateStores, sortByDistance, recommendOrder } from '../lib/patrolRouteLogic'
import { saveRouteToday, loadRouteToday } from '../../lib/localStore/patrolRoute'

function fmtDist(km) {
  if (km == null) return null
  return `${(Math.round(km * 10) / 10).toFixed(1)}km`
}

export default function PatrolRoutePage() {
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const { getLocation } = useGeolocation()

  const [stores, setStores] = useState([])
  const [origin, setOrigin] = useState(null) // { lat, lng, accuracy } | null
  const [locating, setLocating] = useState(false)
  const [route, setRoute] = useState([])     // 順序付き予定 [{ store_code, store_name, lat, lng }]
  const [loading, setLoading] = useState(true)
  const [pinnedCodes, setPinnedCodes] = useState([]) // ★ (staff_pinned_stores 共有)
  const [metaMap, setMetaMap] = useState({})         // 巡回状況 (store_patrol_progress)

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor))

  // 稼働店の座標/カナ + ★ + 巡回状況を取得、idb から今日の予定を復元
  useEffect(() => {
    let alive = true
    async function load() {
      const [storesRes, saved, pinsRes, progRes] = await Promise.all([
        supabase.from('stores').select('store_code, store_name, lat, lng, locality_kana').eq('is_active', true),
        loadRouteToday(),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
        supabase.rpc('store_patrol_progress'),
      ])
      if (!alive) return
      if (storesRes.error) logger.warn?.('ERR-ROUTE-STORES-FETCH', { message: storesRes.error.message })
      setStores(storesRes.data ?? [])
      setRoute(saved ?? [])
      setPinnedCodes((pinsRes.data ?? []).map(p => p.store_code))
      const mm = {}
      for (const row of (progRes.data ?? [])) {
        mm[row.store_code] = { lastDate: row.last_patrol_date ?? null, done: row.done_booths ?? 0, total: row.total_booths ?? 0 }
      }
      setMetaMap(mm)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [staffId])

  // 予定が変わるたび idb 保存 (作業中の一時状態)
  useEffect(() => {
    if (loading) return
    saveRouteToday(route).catch(e => logger.warn?.('ERR-ROUTE-SAVE', { message: e?.message }))
  }, [route, loading])

  async function handleLocate() {
    setLocating(true)
    try {
      const loc = await getLocation()
      setOrigin(loc && loc.lat != null ? loc : null)
    } finally {
      setLocating(false)
    }
  }

  // ★トグル (クレサポ本体と同じ staff_pinned_stores を共有。楽観更新+失敗ロールバック)
  async function handlePin(storeCode) {
    if (!staffId) return
    const isPinned = pinnedCodes.includes(storeCode)
    setPinnedCodes(prev => isPinned ? prev.filter(c => c !== storeCode) : [...prev, storeCode])
    try {
      if (isPinned) {
        await supabase.from('staff_pinned_stores').delete().eq('staff_id', staffId).eq('store_code', storeCode)
      } else {
        await supabase.from('staff_pinned_stores').upsert({ staff_id: staffId, store_code: storeCode })
      }
    } catch (e) {
      logger.warn?.('ERR-ROUTE-PIN', { message: e?.message })
      setPinnedCodes(prev => isPinned ? [...prev, storeCode] : prev.filter(c => c !== storeCode))
    }
  }

  const routeCodes = useMemo(() => new Set(route.map(r => r.store_code)), [route])

  // 追加候補: 予定未追加の店を距離注釈+近い順。KanaIndex はフィルタのみで並び不変=距離順維持。
  const candidates = useMemo(
    () => sortByDistance(annotateStores(stores.filter(s => !routeCodes.has(s.store_code)), origin)),
    [stores, origin, routeCodes],
  )

  const annotatedRoute = useMemo(() => annotateStores(route, origin), [route, origin])

  function addStore(s) {
    if (s.lat == null || s.lng == null) return
    setRoute(prev => prev.some(r => r.store_code === s.store_code)
      ? prev
      : [...prev, { store_code: s.store_code, store_name: s.store_name, lat: s.lat, lng: s.lng }])
  }
  function removeStore(code) {
    setRoute(prev => prev.filter(r => r.store_code !== code))
  }
  function handleRecommend() {
    setRoute(prev => recommendOrder(prev, origin).map(r => ({ store_code: r.store_code, store_name: r.store_name, lat: r.lat, lng: r.lng })))
  }
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setRoute(prev => {
      const oldIdx = prev.findIndex(r => r.store_code === active.id)
      const newIdx = prev.findIndex(r => r.store_code === over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }
  function handleStartNavi() {
    const url = buildMapsDirUrl(origin, route)
    if (!url) return
    window.open(url, '_blank', 'noopener')
  }

  // KanaIndex renderCard(item, isPinned): 共有 StoreCard に距離ラベルを併存で渡す。
  const renderCard = (item, isPinned) => (
    <StoreCard
      key={item.store_code}
      store={item}
      isPinned={isPinned}
      meta={metaMap[item.store_code] ?? null}
      distanceLabel={item.hasCoords ? (fmtDist(item.distanceKm) ?? '距離は現在地取得後') : '座標未登録'}
      onSelect={() => addStore(item)}
      onPin={() => handlePin(item.store_code)}
    />
  )

  return (
    <div className="h-svh flex flex-col bg-bg text-text">
      <PageHeader module="clawsupport" title="今日の巡回ルート" variant="compact" onBack={() => navigate('/clawsupport')} />

      {/* 現地取得 */}
      <div className="shrink-0 px-4 py-2 border-b border-border flex items-center gap-2">
        <button
          type="button"
          data-testid="route-locate"
          onClick={handleLocate}
          disabled={locating}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {locating ? '取得中…' : '📍 現在地を取得'}
        </button>
        <span className="text-xs text-muted">
          {origin ? `現在地取得済 (±${Math.round(origin.accuracy ?? 0)}m)` : '未取得 (距離表示・近い順に必要)'}
        </span>
      </div>

      {/* 今日の巡回予定 (ドラッグ並べ替え) */}
      <div className="shrink-0 max-h-[42vh] overflow-y-auto px-4 pt-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-bold">今日の巡回予定（{route.length}）</h2>
          <button
            type="button"
            data-testid="route-recommend"
            onClick={handleRecommend}
            disabled={route.length < 2 || !origin}
            className="text-xs px-2.5 py-1 rounded border border-border bg-surface disabled:opacity-40"
          >
            🤖 AIおすすめ順
          </button>
          <button
            type="button"
            data-testid="route-start-navi"
            onClick={handleStartNavi}
            disabled={route.length === 0}
            className="ml-auto text-xs px-3 py-1.5 rounded bg-emerald-600 text-white font-bold disabled:opacity-40"
          >
            🚗 案内スタート
          </button>
        </div>
        {route.length === 0 ? (
          <p className="text-xs text-muted py-3">下の一覧から店を追加してください</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={route.map(r => r.store_code)} strategy={verticalListSortingStrategy}>
              {annotatedRoute.map((r, i) => (
                <SortableRouteItem key={r.store_code} r={r} index={i} onRemove={() => removeStore(r.store_code)} distLabel={fmtDist(r.distanceKm)} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 店選択 (クレサポ本体と同じ ★カナインデックス。各タブ内は距離順維持) */}
      <div className="shrink-0 px-4 pt-2">
        <h2 className="text-sm font-bold">店を追加</h2>
      </div>
      {loading ? (
        <p className="text-xs text-muted px-5 py-3">読み込み中…</p>
      ) : (
        <KanaIndex
          items={candidates}
          pinnedKeys={pinnedCodes}
          idKey="store_code"
          groupKey="locality_kana"
          renderCard={renderCard}
        />
      )}
    </div>
  )
}

function SortableRouteItem({ r, index, onRemove, distLabel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.store_code })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }
  return (
    <div ref={setNodeRef} style={style} data-testid={`route-item-${r.store_code}`} className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-surface border border-border">
      <span {...attributes} {...listeners} className="cursor-grab text-muted text-lg touch-none select-none" data-testid={`route-drag-${r.store_code}`}>⠿</span>
      <span className="text-xs text-muted w-5 tabular-nums">{index + 1}</span>
      <span className="flex-1 text-sm truncate">{r.store_name}</span>
      {distLabel && <span className="text-xs text-muted tabular-nums">{distLabel}</span>}
      <button type="button" data-testid={`route-remove-${r.store_code}`} onClick={onRemove} className="text-xs text-red-400 px-2 py-1">×</button>
    </div>
  )
}
