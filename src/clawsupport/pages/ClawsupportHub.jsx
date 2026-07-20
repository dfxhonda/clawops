import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Sentry } from '../../lib/sentry'
import { logger } from '../../lib/logger'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'
import DateTime from '../../shared/ui/DateTime'
import StoreCard from '../../shared/ui/StoreCard' // SPEC-PATROL-ROUTE-STORECARD-UNIFY-01 (D-107): 共有カードへ切り出し
import { uploadAllUnsynced } from '../../services/storeSync'
import { notifyLfChange } from '../../hooks/useUnsentBanner'

export default function ClawsupportHub() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [stores, setStores] = useState([])
  const [pinnedCodes, setPinnedCodes] = useState([])
  const [storeMetaMap, setStoreMetaMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [betaMode, setBetaMode] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: storeData },
        { data: pinData },
        { data: rpcRows },
      ] = await Promise.all([
        supabase
          .from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
        supabase.rpc('store_patrol_progress'),
      ])

      const metaMap = {}
      for (const row of (rpcRows ?? [])) {
        metaMap[row.store_code] = {
          lastDate: row.last_patrol_date ?? null,
          done: row.done_booths ?? 0,
          total: row.total_booths ?? 0,
        }
      }

      setStores(storeData ?? [])
      setPinnedCodes((pinData ?? []).map(p => p.store_code))
      setStoreMetaMap(metaMap)
      setLoading(false)
    }
    load()
  }, [staffId])

  // FIX_B: Hub 表示のたびに uploadAllUnsynced を fire-and-forget 実行。
  // iOS タブkillで markRecordSynced 未実行のままになった record を Hub 起動時に再送信する。
  useEffect(() => {
    if (!staffId) return
    uploadAllUnsynced({ staff: { staffId } })
      .then(res => {
        if (res.uploaded > 0 || res.failed > 0) notifyLfChange()
      })
      .catch(err => logger.warn?.('ERR-LF1-HUB-SYNC', { message: err?.message }))
  }, [staffId])

  // SPEC-PATROL-BOOTHUI-3FIXES-01 fix1: re-fetch progress badge on sync events
  useEffect(() => {
    async function refreshProgress() {
      const { data: rpcRows } = await supabase.rpc('store_patrol_progress')
      const metaMap = {}
      for (const row of (rpcRows ?? [])) {
        metaMap[row.store_code] = {
          lastDate: row.last_patrol_date ?? null,
          done: row.done_booths ?? 0,
          total: row.total_booths ?? 0,
        }
      }
      setStoreMetaMap(metaMap)
    }
    window.addEventListener('clawops-lf1-changed', refreshProgress)
    return () => window.removeEventListener('clawops-lf1-changed', refreshProgress)
  }, [])

  const handlePin = useCallback(async (storeCode) => {
    if (!staffId) {
      console.error('[handlePin] staffId null, skip save', { storeCode })
      return
    }
    const isPinned = pinnedCodes.includes(storeCode)
    Sentry.addBreadcrumb({ category: 'user', message: `pin_toggle:${storeCode}`, data: { isPinned }, level: 'info' })
    // 楽観的更新 (即★反映、知覚遅延ゼロ)
    setPinnedCodes(prev => isPinned ? prev.filter(c => c !== storeCode) : [...prev, storeCode])
    try {
      // keepalive:true で iOS back swipe 後もリクエスト完走させる
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY
      const base = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      const headers = {
        apikey: key,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      }
      if (isPinned) {
        const res = await fetch(
          `${base}/rest/v1/staff_pinned_stores?staff_id=eq.${encodeURIComponent(staffId)}&store_code=eq.${encodeURIComponent(storeCode)}`,
          { method: 'DELETE', headers, keepalive: true }
        )
        if (!res.ok) throw new Error(`delete ${res.status}`)
      } else {
        const res = await fetch(
          `${base}/rest/v1/staff_pinned_stores`,
          {
            method: 'POST',
            headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({ staff_id: staffId, store_code: storeCode }),
            keepalive: true,
          }
        )
        if (!res.ok) throw new Error(`upsert ${res.status}`)
      }
    } catch (err) {
      // LOG-SPEC-01 logger 経由で Sentry に到達させる (FIX2)
      logger.error('handlePin_save_failed', err)
      // 保存失敗時は楽観的更新をロールバック
      setPinnedCodes(prev => isPinned ? [...prev, storeCode] : prev.filter(c => c !== storeCode))
    }
  }, [pinnedCodes, staffId])

  function renderCard(store, isPinned) {
    return (
      <StoreCard
        key={store.store_code}
        store={store}
        isPinned={isPinned}
        meta={storeMetaMap[store.store_code] ?? null}
        onSelect={() => {
          Sentry.addBreadcrumb({ category: 'navigation', message: `store_select:${store.store_code}`, level: 'info' })
          navigate(betaMode ? `/clawsupport/beta/store/${store.store_code}` : `/clawsupport/store/${store.store_code}`)
        }}
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
    <div className="h-svh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title="クレサポ"
        variant="compact"
        rightSlot={<DateTime value={new Date()} format="date" />}
      />

      {/* J-PATROL-OCR-BETA-TOGGLE-HIDE-FIX-03: OCRベータ切替トグル非表示 (コード温存、通常モード固定)
      <div className="shrink-0 px-4 py-2 flex items-center justify-between border-b border-border">
        <span className="text-xs text-muted">巡回モード</span>
        <button
          onClick={() => setBetaMode(v => !v)}
          className={`text-xs px-3 py-1 rounded-full border font-bold transition-colors ${
            betaMode
              ? 'bg-amber-500/20 text-amber-400 border-amber-400/40'
              : 'bg-surface text-muted border-border'
          }`}
        >
          {betaMode ? '巡回ベータ(OCR有) ✓' : '巡回ベータ(OCR有)'}
        </button>
      </div>
      */}

      {/* SPEC-PATROL-ROUTE-BUILDER-01 (D-106): 今日の巡回ルート作成への導線 (既存店舗カード順序は不変) */}
      <div className="shrink-0 px-4 py-2 border-b border-border">
        <button
          type="button"
          data-testid="hub-patrol-route-link"
          onClick={() => navigate('/clawsupport/route')}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface border border-border active:scale-[0.98] transition-transform text-left"
        >
          <span className="text-lg shrink-0">🗺️</span>
          <span className="flex-1 text-sm font-bold">今日の巡回ルート作成</span>
          <span className="text-muted text-xl shrink-0">›</span>
        </button>
      </div>

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
