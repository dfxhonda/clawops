import { useEffect } from 'react'
import KanaIndex from './KanaIndex'

/**
 * 店舗選択ボトムシート
 *
 * props:
 *   open       boolean           - 表示/非表示
 *   onClose    () => void        - 閉じるコールバック
 *   stores     StoreItem[]       - { store_code, store_name, locality, locality_kana }
 *   onSelect   (storeCode) => void
 *   title      string            - シートタイトル（省略可）
 */
export default function StoreSelectSheet({ open, onClose, stores = [], onSelect, title = '店舗を選択' }) {
  // 開いているときはボディスクロールを止める
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function handleSelect(storeCode) {
    onSelect(storeCode)
    onClose()
  }

  return (
    <div data-testid="store-select-sheet" className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* シート本体 */}
      <div className="relative flex flex-col bg-bg rounded-t-2xl"
        style={{ maxHeight: '88dvh' }}
      >
        {/* ハンドル + タイトル */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-sm font-bold text-text mt-2">{title}</span>
          <button
            onClick={onClose}
            className="mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-muted active:bg-surface text-base"
          >
            ✕
          </button>
        </div>

        {/* KanaIndex（五十音タブ + スクロールリスト） */}
        <KanaIndex
          items={stores}
          idKey="store_code"
          groupKey="locality_kana"
          showPinned={false}
          renderCard={(store) => (
            <button
              key={store.store_code}
              onClick={() => handleSelect(store.store_code)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
              style={{ minHeight: 56 }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm font-bold truncate">{store.store_name}</p>
                {store.locality && (
                  <p className="text-muted text-xs mt-0.5">{store.locality}</p>
                )}
              </div>
              <span className="text-muted shrink-0">›</span>
            </button>
          )}
        />

        {/* iOS セーフエリア余白 */}
        <div className="shrink-0 h-safe-area-inset-bottom" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}

/**
 * 店舗選択トリガーボタン
 * `<select>` の代替として使う
 *
 * props:
 *   storeName  string | undefined  - 選択済み店舗名
 *   onClick    () => void
 *   className  string              - 追加クラス（省略可）
 */
export function StoreSelectTrigger({ storeName, onClick, className = '', testId = 'store-select-trigger' }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-sm outline-none active:bg-surface2 transition-colors ${className}`}
    >
      <span className={`flex-1 text-left truncate ${storeName ? 'text-text' : 'text-muted'}`}>
        {storeName || '店舗を選択…'}
      </span>
      <span className="text-muted shrink-0 text-xs">▼</span>
    </button>
  )
}
