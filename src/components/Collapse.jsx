// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F2: 汎用 Collapse。
// grid-template-rows 0fr <-> 1fr で高さ auto を滑らかに (height:auto 問題回避のモダン標準)。
// 中身は常時 mount (条件レンダー廃止で DOM 瞬間挿入を断つ = タップ誤爆対策)。
// 閉時は inert + aria-hidden でフォーカス/タブ到達を防ぐ。table td 内でも使える (div ラップ)。
import { motionTransition } from '../constants/motion'

export default function Collapse({ open, children, onTransitionEnd, className = '', testId }) {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: motionTransition('grid-template-rows'),
      }}
      onTransitionEnd={onTransitionEnd}
    >
      <div
        data-testid={testId ? `${testId}-inner` : undefined}
        style={{ minHeight: 0, overflow: 'hidden' }}
        inert={!open}
        aria-hidden={open ? undefined : true}
      >
        {children}
      </div>
    </div>
  )
}
