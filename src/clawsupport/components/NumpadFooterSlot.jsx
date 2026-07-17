// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F3: numpad footer 開閉の滑らか化。
// h-0 即時トグル → grid-template-rows 0fr/1fr transition (canonical flex 構造を保持: 内側 flex-col で
// NumpadFooterPanel の flex:1 を維持)。開時にアクティブフィールドを scrollIntoView で追従 (numpad に隠れない)。
// フィールド間移動 (open 継続) は再アニメなし = 即応。
import { useEffect, useRef } from 'react'
import { NumpadFooterPanel } from './NumpadField'
import { motionTransition } from '../../constants/motion'

// DIAG-NUMPAD-SLOT-TRANSITION-FIRE-01 (D-071): no-fix 一時計測 gate。
// window.__NUMPAD_LOG__===true か URL ?nplog=1 の時のみ有効 (本番ノイズ/影響ゼロ)。
// ヒロがコンソールで window.__NUMPAD_LOG__=true をセット、または preview を ?nplog=1 で開く。
function isNumpadLogEnabled() {
  if (typeof window === 'undefined') return false
  if (window.__NUMPAD_LOG__ === true) return true
  try {
    return new URLSearchParams(window.location.search).get('nplog') === '1'
  } catch {
    return false
  }
}

export default function NumpadFooterSlot({ currentField, testId = 'numpad-slot' }) {
  const open = !!currentField
  const activeTestId = currentField?.testId
  const slotRef = useRef(null)
  useEffect(() => {
    if (open) currentField?.inputRef?.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [open, activeTestId]) // eslint-disable-line react-hooks/exhaustive-deps

  // DIAG-NUMPAD-SLOT-TRANSITION-FIRE-01 (D-071) F1: 巡回(パッと出る)vs集金(ぬるっと)の差の真因を実機で確定。
  // 外段 Slot div に 4 種 transition event listener を張り、computed gridTemplateRows/transition を採取。
  // gate 無効時は即 return = listener 未登録 (AC2、本番影響 nil)。transition方式/レイアウトは一切変えない。
  useEffect(() => {
    if (!isNumpadLogEnabled()) return
    const el = slotRef.current
    if (!el) return
    const readRows = () => {
      try { return getComputedStyle(el).gridTemplateRows } catch { return '?' }
    }
    // 初回: transition の computed 値が本当に 'none' なのか '...200ms...' なのかを 1 行。
    try {
      const cs = getComputedStyle(el)
      console.log(`[nplog] mount prop=grid-template-rows computed.transition=${cs.transitionProperty}/${cs.transitionDuration}/${cs.transitionTimingFunction} computed.gridTemplateRows=${cs.gridTemplateRows} open=${open} ts=${Date.now()}`)
    } catch { /* noop */ }
    const handler = (e) => {
      console.log(`[nplog] ${e.type} prop=${e.propertyName} elapsed=${e.elapsedTime} computed.gridTemplateRows=${readRows()} open=${open} ts=${Date.now()}`)
    }
    const types = ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']
    types.forEach((t) => el.addEventListener(t, handler))
    // open 切替の requestAnimationFrame 2 回後に実測 gridTemplateRows (px 展開されてるか 0px のままか)。
    let raf1 = 0
    let raf2 = 0
    if (typeof requestAnimationFrame === 'function') {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          console.log(`[nplog] raf2 open=${open} computed.gridTemplateRows=${readRows()} ts=${Date.now()}`)
        })
      })
    }
    return () => {
      types.forEach((t) => el.removeEventListener(t, handler))
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }
  }, [open])

  return (
    <div
      ref={slotRef}
      data-testid={testId}
      className="flex-none shrink-0"
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: motionTransition('grid-template-rows'),
      }}
    >
      <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <NumpadFooterPanel currentField={currentField} />
      </div>
    </div>
  )
}
