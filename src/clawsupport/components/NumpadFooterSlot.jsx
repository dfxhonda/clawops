// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F3: numpad footer 開閉の滑らか化。
// SPEC-MOTION-W1_7-NUMPAD-SLOT-MAXHEIGHT-01 (D-078): 旧 grid 行トラック方式 (fr 補間) → max-height 0↔70svh 方式へ置換。
//   理由: 行トラックの fr 補間は iOS Safari / Chromium 双方で intrinsic sizing の不確実性 (Chromium #759665 系) を
//   抱え、Playwright-WebKit 健全 = iOS Safari 健全の保証にならない (D-077)。footer 高さは内容非依存で固定 (gate_1 実査:
//   NumpadFooterPanel は flex:1 + 固定10キーグリッド、meters 枚数差は footer 高さに不干渉) のため fr 補間は不要。
//   max-height 0↔上限値の数値間 transition は全ブラウザで枯れて確実。70svh は実寸(≈286px)を必ず超える固定上限
//   (中身の自然高さで停止するのでモデル差ロバスト、svh 採用で dvh 禁止ルール遵守)。
// 内側 flex-col で NumpadFooterPanel の flex:1 を維持。開時にアクティブフィールドを scrollIntoView で追従。
// フィールド間移動 (open 継続) は再アニメなし = 即応。
import { useEffect, useRef } from 'react'
import { NumpadFooterPanel } from './NumpadField'
import { motionTransition } from '../../constants/motion'

// numpad footer の展開上限 (実寸を必ず超える固定値。中身の自然高さで止まる)。
const NUMPAD_SLOT_MAX_HEIGHT = '70svh'

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

  // DIAG-NUMPAD-SLOT-TRANSITION-FIRE-01 (D-071) F1 / D-078 C4: numpad 開閉の transition を実機で採取。
  // 外段 Slot div に 4 種 transition event listener を張り、computed maxHeight/transition を採取。
  // gate 無効時は即 return = listener 未登録 (本番影響 nil)。transition方式/レイアウトは計測では変えない。
  useEffect(() => {
    if (!isNumpadLogEnabled()) return
    const el = slotRef.current
    if (!el) return
    const readMaxHeight = () => {
      try { return getComputedStyle(el).maxHeight } catch { return '?' }
    }
    // 初回: transition の computed 値が本当に 'none' なのか '...200ms...' なのかを 1 行。
    try {
      const cs = getComputedStyle(el)
      console.log(`[nplog] mount prop=max-height computed.transition=${cs.transitionProperty}/${cs.transitionDuration}/${cs.transitionTimingFunction} computed.maxHeight=${cs.maxHeight} open=${open} ts=${Date.now()}`)
    } catch { /* noop */ }
    const handler = (e) => {
      console.log(`[nplog] ${e.type} prop=${e.propertyName} elapsed=${e.elapsedTime} computed.maxHeight=${readMaxHeight()} open=${open} ts=${Date.now()}`)
    }
    const types = ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']
    types.forEach((t) => el.addEventListener(t, handler))
    // open 切替の requestAnimationFrame 2 回後に実測 maxHeight (px 展開されてるか 0px のままか)。
    let raf1 = 0
    let raf2 = 0
    if (typeof requestAnimationFrame === 'function') {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          console.log(`[nplog] raf2 open=${open} computed.maxHeight=${readMaxHeight()} ts=${Date.now()}`)
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
        maxHeight: open ? NUMPAD_SLOT_MAX_HEIGHT : '0',
        overflow: 'hidden',
        transition: motionTransition('max-height'),
      }}
    >
      <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <NumpadFooterPanel currentField={currentField} />
      </div>
    </div>
  )
}
