// J-UI-STORE-PICKER-SHEET-01 (司令塔Opus spec): 全画面の店舗ドロップダウン共通ボトムシート。
// 内部で StoreHubSelector パターン (★pinned + 50音 KanaIndex) を流用、巡回ハブと同 UX で学習コストゼロ化。
// trigger button + bottom sheet overlay を 1 component で提供。
//   props:
//     value: 現在選択中 store_code (null = 全店、showAllOption 時のみ意味あり)
//     onChange: (store_code | null) => void
//     showAllOption: boolean (default true)。false の場合は全店行非表示、value null 不可前提。
//     placeholder: trigger に表示する未選択時テキスト (default '店舗を選択')。showAllOption false 時に有効。

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import KanaIndex from '../shared/ui/KanaIndex'

const ALL_KEY = '__ALL__'

export default function StorePickerSheet({ value, onChange, showAllOption = true, placeholder = '店舗を選択' }) {
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

  // 全店 を仮想 item として KanaIndex 先頭 (★ タブ) に挿入
  const itemsForKana = showAllOption
    ? [{ store_code: ALL_KEY, store_name: '全店', locality: null, locality_kana: null, __virtual_all: true }, ...stores]
    : stores
  const pinnedKeys = showAllOption ? [ALL_KEY, ...pinnedCodes] : pinnedCodes

  function renderCard(store) {
    const isAll = store.store_code === ALL_KEY
    const isCurrent = isAll ? value == null : store.store_code === value
    return (
      <button
        key={store.store_code}
        type="button"
        data-testid={`store-picker-item-${store.store_code}`}
        onClick={() => handleSelect(isAll ? null : store.store_code)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left active:scale-[0.98] transition-transform select-none ${
          isCurrent ? 'bg-accent/20 border-accent text-text' : 'bg-surface border-border text-text'
        }`}
        style={{ minHeight: 56 }}
      >
        {isAll && <span className="text-yellow-400 text-base shrink-0">⭐</span>}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold truncate">{store.store_name}</p>
          {store.locality && <p className="text-muted text-xs mt-0.5">{store.locality}</p>}
        </div>
        {isCurrent && <span className="text-accent text-base shrink-0">✓</span>}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        data-testid="store-picker-trigger"
        onClick={() => setOpen(true)}
        className="border border-border rounded-lg px-3 py-2 flex items-center justify-between gap-2 bg-surface text-text min-h-[44px] min-w-[140px]"
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
