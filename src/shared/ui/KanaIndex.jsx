import { useMemo, useRef, useState } from 'react'

const KANA_GROUPS = {
  'あ': /^[アイウエオ]/,
  'か': /^[カキクケコガギグゲゴ]/,
  'さ': /^[サシスセソザジズゼゾ]/,
  'た': /^[タチツテトダヂヅデド]/,
  'な': /^[ナニヌネノ]/,
  'は': /^[ハヒフヘホバビブベボパピプペポ]/,
  'ま': /^[マミムメモ]/,
  'や': /^[ヤユヨ]/,
  'ら': /^[ラリルレロ]/,
  'わ': /^[ワヰヱヲン]/,
}

const KANA_ORDER = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

function toKatakana(str) {
  return (str || '').replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

function getKanaTab(kana) {
  const k = toKatakana(kana || '')
  for (const [tab, regex] of Object.entries(KANA_GROUPS)) {
    if (regex.test(k)) return tab
  }
  return null
}

// items: 任意のオブジェクト配列
// idKey: アイテムの識別キー (例: 'store_code')
// groupKey: 50音グループキー (例: 'locality_kana')
// pinnedKeys: ★に表示するidの配列
// showPinned: false にすると★タブを非表示（デフォルト true）
// renderCard(item, isPinned): カードJSX
// listClassName: リスト本体の余白等を呼び出し元(親)が決めるための追加class (D-122 B案: スペーシング責務は親)。
//   既定は空文字列 = 渡さない呼び出し元は現状と完全に同一 (回帰ゼロ、AC6)。
export default function KanaIndex({ items = [], pinnedKeys = [], idKey = 'store_code', groupKey = 'locality_kana', showPinned = true, renderCard, listClassName = '' }) {
  const [activeTab, setActiveTab] = useState(showPinned ? '★' : null)

  const pinnedSet = useMemo(() => new Set(pinnedKeys), [pinnedKeys])

  const availableTabs = useMemo(() => {
    const used = new Set(items.map(i => getKanaTab(i[groupKey])).filter(Boolean))
    const tabs = [...(showPinned ? ['★'] : []), ...KANA_ORDER.filter(t => used.has(t))]
    const hasOther = items.some(i => !getKanaTab(i[groupKey]))
    if (hasOther) tabs.push('他')
    return tabs
  }, [items, groupKey, showPinned])

  // activeTab が null（showPinned=false の初期状態）なら最初のタブを使う
  const resolvedTab = activeTab ?? availableTabs[0] ?? null

  const displayItems = useMemo(() => {
    if (resolvedTab === '★') return items.filter(i => pinnedSet.has(i[idKey]))
    if (resolvedTab === '他') return items.filter(i => !getKanaTab(i[groupKey]))
    const regex = KANA_GROUPS[resolvedTab]
    return regex ? items.filter(i => regex.test(toKatakana(i[groupKey] || ''))) : []
  }, [resolvedTab, items, pinnedSet, idKey, groupKey])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* タブバー */}
      <div
        className="flex gap-1 px-5 py-2 shrink-0 border-b border-border"
        style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        {availableTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-w-[36px] h-10 px-2 rounded-lg text-lg font-bold shrink-0 transition-colors ${
              resolvedTab === tab ? 'bg-accent text-bg' : 'bg-surface text-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* リスト (余白は listClassName で親が決める。既定''=現状不変) */}
      <div className={`flex-1 overflow-y-auto px-5 py-3 space-y-2${listClassName ? ' ' + listClassName : ''}`}>
        {resolvedTab === '★' && displayItems.length === 0 ? (
          <p className="text-center text-muted text-lg py-8">長押しで★登録</p>
        ) : displayItems.length === 0 ? (
          <p className="text-center text-muted text-lg py-8">該当なし</p>
        ) : (
          displayItems.map(item => renderCard(item, pinnedSet.has(item[idKey])))
        )}
      </div>
    </div>
  )
}
