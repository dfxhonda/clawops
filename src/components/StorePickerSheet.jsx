// J-UI-STORE-PICKER-SHEET-01 (司令塔Opus spec): 全画面の店舗ドロップダウン共通ボトムシート。
// 内部で StoreHubSelector パターン (★pinned + 50音 KanaIndex) を流用、巡回ハブと同 UX で学習コストゼロ化。
// trigger button + bottom sheet overlay を 1 component で提供。
//   props:
//     value: 現在選択中 store_code (null = 全店、showAllOption 時のみ意味あり)
//     onChange: (store_code | null) => void
//     showAllOption: boolean (default true)。false の場合は全店行非表示、value null 不可前提。
//     placeholder: trigger に表示する未選択時テキスト (default '店舗を選択')。showAllOption false 時に有効。
//     disabled: boolean (default false)。true の場合 trigger は非活性、シート開かない。

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { Sentry } from '../lib/sentry'
import { logger } from '../lib/logger'
import { useAuth } from '../hooks/useAuth'
import KanaIndex from '../shared/ui/KanaIndex'

const ALL_KEY = '__ALL__'

export default function StorePickerSheet({ value, onChange, showAllOption = true, placeholder = '店舗を選択', disabled = false }) {
  const { staffId } = useAuth()
  const [open, setOpen] = useState(false)
  const [stores, setStores] = useState([])
  const [pinnedCodes, setPinnedCodes] = useState([])

  useEffect(() => {
    let cancel = false
    async function load() {
      const [{ data: storeData }, { data: pinData }] = await Promise.all([
        supabase.from('stores')
          .select('store_code, store_name, locality, locality_kana')
          .eq('is_active', true)
          .order('locality_kana', { nullsLast: true }),
        staffId
          ? supabase.from('staff_pinned_stores').select('store_code').eq('staff_id', staffId)
          : Promise.resolve({ data: [] }),
      ])
      if (cancel) return
      setStores(storeData ?? [])
      setPinnedCodes((pinData ?? []).map(p => p.store_code))
    }
    load()
    return () => { cancel = true }
  }, [staffId])

  const selectedStore = stores.find(s => s.store_code === value)
  const triggerLabel = value == null
    ? (showAllOption ? '全店' : placeholder)
    : (selectedStore?.store_name ?? value)

  function handleSelect(storeCode) {
    onChange(storeCode)
    setOpen(false)
  }

  // Mirror ClawsupportHub L52-96 optimistic REST pattern
  const handlePin = useCallback(async (storeCode) => {
    if (!staffId) return
    const isPinned = pinnedCodes.includes(storeCode)
    Sentry.addBreadcrumb({ category: 'user', message: `pin_toggle:${storeCode}`, data: { isPinned }, level: 'info' })
    setPinnedCodes(prev => isPinned ? prev.filter(c => c !== storeCode) : [...prev, storeCode])
    try {
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
      logger.error('handlePin_save_failed', err)
      setPinnedCodes(prev => isPinned ? [...prev, storeCode] : prev.filter(c => c !== storeCode))
    }
  }, [pinnedCodes, staffId])

  // 全店 を仮想 item として KanaIndex 先頭 (★ タブ) に挿入
  const itemsForKana = showAllOption
    ? [{ store_code: ALL_KEY, store_name: '全店', locality: null, locality_kana: null, __virtual_all: true }, ...stores]
    : stores
  const pinnedKeys = showAllOption ? [ALL_KEY, ...pinnedCodes] : pinnedCodes

  function renderCard(store, isPinned) {
    const isAll = store.store_code === ALL_KEY
    const isCurrent = isAll ? value == null : store.store_code === value
    if (isAll) {
      return (
        <button
          key={store.store_code}
          type="button"
          data-testid={`store-picker-item-${store.store_code}`}
          onClick={() => handleSelect(null)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left active:scale-[0.98] transition-transform select-none ${
            isCurrent ? 'bg-accent/20 border-accent text-text' : 'bg-surface border-border text-text'
          }`}
          style={{ minHeight: 56 }}
        >
          <span className="text-yellow-400 text-base shrink-0">⭐</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{store.store_name}</p>
          </div>
          {isCurrent && <span className="text-accent text-base shrink-0">✓</span>}
        </button>
      )
    }
    return (
      <StoreCardInSheet
        key={store.store_code}
        store={store}
        isCurrent={isCurrent}
        isPinned={isPinned}
        onSelect={() => handleSelect(store.store_code)}
        onPin={() => handlePin(store.store_code)}
      />
    )
  }

  return (
    <>
      <button
        type="button"
        data-testid="store-picker-trigger"
        onClick={() => { if (!disabled) setOpen(true) }}
        disabled={disabled}
        className={`border border-border rounded-lg px-3 py-2 flex items-center justify-between gap-2 bg-surface text-text min-h-[44px] min-w-[140px]${disabled ? ' opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="text-sm truncate">{triggerLabel}</span>
        <span className="text-muted text-xs shrink-0" aria-hidden>▼</span>
      </button>
      {open && createPortal(
        <div
          data-testid="store-picker-sheet"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-bg rounded-t-2xl flex flex-col border-t border-border"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-base font-bold text-text">店舗を選択</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-testid="store-picker-close"
                className="text-muted text-2xl leading-none px-2"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <KanaIndex
                items={itemsForKana}
                pinnedKeys={pinnedKeys}
                idKey="store_code"
                groupKey="locality_kana"
                renderCard={renderCard}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Mirror ClawsupportHub L158-206 StoreCard long-press pattern
function StoreCardInSheet({ store, isCurrent, isPinned, onSelect, onPin }) {
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
      type="button"
      data-testid={`store-picker-item-${store.store_code}`}
      onClick={() => {
        if (longPressFiredRef.current) { longPressFiredRef.current = false; return }
        onSelect()
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerUp}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left active:scale-[0.98] transition-transform select-none ${
        isCurrent ? 'bg-accent/20 border-accent text-text' : 'bg-surface border-border text-text'
      }`}
      style={{ minHeight: 56 }}
    >
      {isPinned && <span className="text-yellow-400 text-sm shrink-0">★</span>}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold truncate">{store.store_name}</p>
        {store.locality && <p className="text-muted text-xs mt-0.5">{store.locality}</p>}
      </div>
      {isCurrent && <span className="text-accent text-base shrink-0">✓</span>}
    </button>
  )
}
