// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F3: numpad footer 開閉の滑らか化。
// h-0 即時トグル → grid-template-rows 0fr/1fr transition (canonical flex 構造を保持: 内側 flex-col で
// NumpadFooterPanel の flex:1 を維持)。開時にアクティブフィールドを scrollIntoView で追従 (numpad に隠れない)。
// フィールド間移動 (open 継続) は再アニメなし = 即応。
import { useEffect } from 'react'
import { NumpadFooterPanel } from './NumpadField'
import { motionTransition } from '../../constants/motion'

export default function NumpadFooterSlot({ currentField, testId = 'numpad-slot' }) {
  const open = !!currentField
  const activeTestId = currentField?.testId
  useEffect(() => {
    if (open) currentField?.inputRef?.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [open, activeTestId]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
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
