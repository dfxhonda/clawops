// SPEC-PATROL-ROUTE-STORECARD-UNIFY-01 (D-107): ClawsupportHub から切り出した共有店舗カード (A案=1コンポーネント両用)。
// 長押し500msで onPin(★トグル)、タップで onSelect。右メタ = 最終巡回日 + done/total バッジ。
// distanceLabel (任意) を渡すと右メタに距離を併存表示 (未渡しなら非表示=既存挙動不変)。
import { useRef } from 'react'

export default function StoreCard({ store, isPinned, onSelect, onPin, meta, distanceLabel }) {
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

  // Compute right meta: lastDateLabel, doneLabel, badgeColor
  let lastDateLabel = null
  let doneLabel = null
  let badgeColor = 'text-muted border-border'

  if (meta) {
    const { lastDate, done, total } = meta
    if (lastDate) {
      const [, m, d] = lastDate.split('-').map(Number)
      lastDateLabel = `最終 ${m}/${d}`
      if (total > 0) {
        doneLabel = `${done}/${total}`
        if (done >= total) badgeColor = 'text-emerald-400 border-emerald-400/40'
        else if (done > 0) badgeColor = 'text-amber-400 border-amber-400/40'
        else badgeColor = 'text-muted border-border'
      }
    } else if (total > 0) {
      // No patrol in last 60 days: show –/total in muted
      doneLabel = `–/${total}`
      badgeColor = 'text-muted border-border'
    }
  }

  // SPEC-PATROL-ROUTE-STORECARD-RIGHTMETA-01 (D-113): distanceLabel は店名行(左側)へ移動したので、
  // 右メタ列は最終日+進捗バッジの最大2段のみ。hasRightMeta 判定から distanceLabel を除外
  // (distanceLabel だけ存在するケースでも右メタ列は出さない = D-107以前のクレサポ本体と同構造)。
  const hasRightMeta = lastDateLabel !== null || doneLabel !== null

  return (
    <button
      data-testid={`store-card-${store.store_code}`}
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
      {isPinned && <span className="text-yellow-400 text-lg shrink-0">★</span>}
      {/* SPEC-PATROL-ROUTE-STORECARD-RIGHTMETA-01 (D-113): distanceLabel を店名行の右(左寄せ小青)に併置。
          小さめ text-xs ゆえ text-xl の店名行より背が低く行高は増えない(distanceLabel 有無でカード高不変)。
          店名は truncate、距離は shrink-0 で潰れない。distanceLabel 未渡し(クレサポ本体)は span 非描画=従来通り。 */}
      <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
        <p className="text-text text-xl font-bold truncate min-w-0">{store.store_name}</p>
        {distanceLabel && (
          <span data-testid="store-card-distance" className="shrink-0 text-xs font-bold text-blue-300 whitespace-nowrap">{distanceLabel}</span>
        )}
      </div>
      {hasRightMeta && (
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          {lastDateLabel && (
            <span className="text-xs text-muted whitespace-nowrap">{lastDateLabel}</span>
          )}
          {doneLabel && (
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeColor}`}>
              {doneLabel}
            </span>
          )}
        </div>
      )}
      <span className="text-muted text-xl shrink-0">›</span>
    </button>
  )
}
