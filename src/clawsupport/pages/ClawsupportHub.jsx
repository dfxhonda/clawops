import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Sentry } from '../../lib/sentry'
import { logger } from '../../lib/logger'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import KanaIndex from '../../shared/ui/KanaIndex'
import DateTime from '../../shared/ui/DateTime'
import { uploadAllUnsynced } from '../../services/storeSync'
import { notifyLfChange } from '../../hooks/useUnsentBanner'

export default function ClawsupportHub() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [stores, setStores] = useState([])
  const [pinnedCodes, setPinnedCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [betaMode, setBetaMode] = useState(false)

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
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title="クレサポ"
        variant="compact"
        menuToLauncher
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
  const longPressFiredRef = useRef(false)

  function handlePointerDown() {
    movedRef.current = false
    longPressFiredRef.current = false
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        longPressFiredRef.current = true
        onPin()
      }
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
      onClick={() => {
        if (longPressFiredRef.current) { longPressFiredRef.current = false; return }
        onSelect()
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerUp}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none"
      style={{ minHeight: 88 }}
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
