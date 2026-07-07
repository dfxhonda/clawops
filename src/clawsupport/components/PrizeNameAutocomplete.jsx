import { useState, useEffect, useRef } from 'react'
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
      {open && (
        <ul
          role="listbox"
          data-testid="prize-autocomplete-list"
          // SPEC-PATROL-PRIZE-SUGGEST-01: 表示件数の物理 cap を排除して max-h-[400px] + overflow-y-auto に。
          // 角丸との両立のため overflow-y-auto 単独 (overflow-hidden 廃止)、ul 自体に rounded-xl + border 維持。
          // SPEC-PATROL-PRIZE-INPUT-IOS-QUIRKS-FIX-01 B2: 候補テキストが長押し選択可能だと iOS の
          // 「選択/すべてを選択/ペースト」callout が候補を覆う。dropdown 側 (input ではない) を
          // 選択不可 + touch-callout none にして callout を抑止する。
          className="prize-suggest-list absolute right-0 top-full z-[9999] w-72 bg-surface border border-border rounded-xl shadow-2xl mt-1 max-h-[400px] overflow-y-auto select-none"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {candidates.length === 0 ? (
            <li
              data-testid="prize-autocomplete-empty"
              className="px-3 py-2 text-xs text-gray-500"
            >
              該当なし、手入力可
            </li>
          ) : (
            candidates.map((item, i) => (
              <li
                key={item.prize_id}
                role="option"
                data-testid={`prize-candidate-${i}`}
                onMouseDown={() => handleSelect(item)}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-text cursor-pointer hover:bg-accent/10 active:bg-accent/20 border-b border-border last:border-0"
              >
                <span className="min-w-0 truncate">
                  <span className="font-bold">{item.prize_name}</span>
                  {item.prize_name_kana && (
                    <span className="ml-2 text-xs text-gray-500">{item.prize_name_kana}</span>
                  )}
                </span>
                {item.original_cost != null && (
                  <span className="shrink-0 text-xs font-bold text-amber-400">@{item.original_cost}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
