import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { searchPrizeMasters } from '../../services/prizeMasterSearch'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * 景品名オートコンプリート
 *
 * Props:
 *   value        - 現在のテキスト値（親コントロール）
 *   onChange     - テキスト変更時コールバック (newText: string) => void
 *   onSelect     - 候補選択時コールバック ({ prize_id, prize_name, original_cost }) => void
 *   placeholder  - プレースホルダー文字列
 *   fieldId      - input の id 属性
 *   testId       - input の data-testid 属性
 */
export default function PrizeNameAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  fieldId,
  testId,
}) {
  // query は「ユーザーが今回タイプした文字列」。
  // 親が外部からvalue を書き換えても query は更新しない（prev初期値でフリク防止）
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef(null)
  // SPEC-PATROL-PRIZE-INPUT-IOS-QUIRKS-FIX-01 B1: iOS は id/name に英語 "name" を含むと連絡先
  // フィールドと誤判定し「連絡先を自動入力」バーを出す。id から name トークンを除去した中立
  // id を使う (fieldId は label/focus から未参照なので安全)。name も中立固定。
  const neutralId = String(fieldId || testId || 'pz').replace(/name/gi, 'f')
  // SPEC-PATROL-PRIZE-SUGGEST-UX-02 W1/W3/W4: dropdown を <body> に portal + fixed 配置するための
  // アンカー矩形 (input の下端)。祖先の overflow/transform で row1 がクリップされるのを回避する。
  const [anchor, setAnchor] = useState(null)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setCandidates([])
      setOpen(false)
      return
    }
    let cancelled = false
    searchPrizeMasters(debouncedQuery).then(results => {
      if (cancelled) return
      setCandidates(results)
      setOpen(true)
    })
    return () => { cancelled = true }
  }, [debouncedQuery])

  function handleInputChange(e) {
    const v = e.target.value
    onChange(v)
    setQuery(v)
    if (v.trim().length < 2) {
      setCandidates([])
      setOpen(false)
    }
  }

  function handleSelect(item) {
    onSelect({
      prize_id: item.prize_id,
      prize_name: item.prize_name,
      original_cost: item.original_cost,
    })
    setOpen(false)
    setCandidates([])
    setQuery('')
  }

  function handleKeyDown(e) {
    if (!open || candidates.length === 0) return
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      handleSelect(candidates[0])
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleBlur() {
    // 遅延: mousedown → blur → click の順番でイベント発火するため
    setTimeout(() => setOpen(false), 200)
  }

  // SPEC-PATROL-PRIZE-SUGGEST-UX-02 W1/W3/W4: open 中は input 下端を追跡して portal の fixed 位置を更新。
  useEffect(() => {
    if (!open) { setAnchor(null); return }
    const compute = () => {
      const el = inputRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setAnchor({ top: Math.round(r.bottom + 4), bottom: Math.round(r.bottom) })
    }
    compute()
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    vv?.addEventListener('resize', compute)
    vv?.addEventListener('scroll', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
      vv?.removeEventListener('resize', compute)
      vv?.removeEventListener('scroll', compute)
    }
  }, [open, candidates.length])

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        id={neutralId}
        name="pz_field"
        type="text"
        inputMode="text"
        data-testid={testId}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-label="景品"
        // SPEC-PATROL-PRIZE-INPUT-IOS-QUIRKS-FIX-01 B1: autocomplete=off だけでは iOS の連絡先
        // 推定を止められないため、name/id 中立化 + autoCorrect/Capitalize off + contacts-auto-fill
        // ボタン非表示 CSS (.prize-name-field, index.css) を併用。
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="prize-name-field w-full bg-transparent text-right text-sm text-text outline-none placeholder:text-gray-500"
        style={{ fontSize: 16, WebkitAppearance: 'none' }}
      />
      {open && anchor && typeof document !== 'undefined' && createPortal(
        <ul
          role="listbox"
          data-testid="prize-autocomplete-list"
          // SPEC-PATROL-PRIZE-SUGGEST-01: 表示件数 cap 排除。
          // SPEC-PATROL-PRIZE-SUGGEST-UX-02 W1/W3/W4: <body> portal + fixed で full-width (左右 12px inset,
          //   left-3/right-3) / 祖先の overflow・transform で row1 がクリップされない / max-h = min(45svh,
          //   キーボード上の実利用高) + overscroll-contain でページへのスクロール連鎖を止める。z-[9999] 維持。
          // SPEC-PATROL-PRIZE-INPUT-IOS-QUIRKS-FIX-01 B2: 候補長押し選択で出る iOS callout を抑止
          //   (dropdown 側のみ select-none + touch-callout none、input には付けない)。
          className="prize-suggest-list fixed left-3 right-3 z-[9999] bg-surface border border-border rounded-xl shadow-2xl overflow-y-auto overscroll-contain select-none"
          style={{
            top: anchor.top,
            maxHeight: `min(45svh, ${Math.max(140, ((typeof window !== 'undefined' && window.visualViewport?.height) || (typeof window !== 'undefined' ? window.innerHeight : 600)) - anchor.bottom - 16)}px)`,
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          {candidates.length === 0 ? (
            <li
              data-testid="prize-autocomplete-empty"
              className="px-3 py-2 text-xs text-gray-500"
            >
              該当なし、手入力可
            </li>
          ) : (
            candidates.map((item, i) => {
              // SPEC-PATROL-PRIZE-SUGGEST-UX-02 W5: 表示名が重複する候補には、候補オブジェクト内の
              // データ (納期 latest_order_date、無ければ短縮名) で識別サブ行を出す (追加 fetch なし)。
              const isDup = candidates.filter(c => c.prize_name === item.prize_name).length > 1
              const hint = item.latest_order_date ? `納期 ${item.latest_order_date}` : (item.short_name || null)
              return (
                <li
                  key={item.prize_id}
                  role="option"
                  data-testid={`prize-candidate-${i}`}
                  onMouseDown={() => handleSelect(item)}
                  className="flex items-start justify-between gap-2 px-3 py-2.5 text-sm text-text cursor-pointer hover:bg-accent/10 active:bg-accent/20 border-b border-border last:border-0"
                >
                  <span className="min-w-0 flex-1 text-left">
                    {/* W2: truncate 廃止 → 2行 wrap (line-clamp-2) で全名を可読に */}
                    <span className="font-bold line-clamp-2 break-words">{item.prize_name}</span>
                    {isDup && hint && (
                      <span data-testid={`prize-candidate-hint-${i}`} className="block text-xs text-muted mt-0.5">{hint}</span>
                    )}
                  </span>
                  {item.original_cost != null && (
                    <span className="shrink-0 text-xs font-bold text-amber-400 mt-0.5">@{item.original_cost}</span>
                  )}
                </li>
              )
            })
          )}
        </ul>,
        document.body
      )}
    </div>
  )
}
