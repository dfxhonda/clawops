// J-PATROL-IN-DAILY-fix-03/05 ad-hoc: 巡回 / 管理者編集モード の店舗ハブ最上行で共用するヘッダ。
// 2 行構成: (1) 進捗バッジ/モードトグル + ラベル、(2) 任意の左側スロット + 全店舗合計値。
// MachineRow / MachineRowExpandedBoothList と同一の w-52 grid + gap-x-1.5 で列 x 位置完全一致。
//
// SPEC-PATROL-VIEW-MODE-SWITCH-02: mode (IN/DAILY/OUT) で値配列を切替、列ラベルは固定 4 前 / 3 前 / 前回 / 今回。
// onModeChange が渡されたら上段左に 3 ボタントグル (IN/日売/OUT) を描画。

import { useMemo } from 'react'
import {
  VIEW_MODES,
  VIEW_MODE_ORDER,
  COLUMN_HEADERS,
  COLUMN_COUNT,
  aggregateSummaries,
  formatCell,
} from './patrolViewModes'

const NEWEST = 3

export function computeStoreTotals(diffMap, mode = 'IN') {
  return aggregateSummaries(Object.values(diffMap || {}), mode)
}

function ModeToggle({ mode, onModeChange }) {
  return (
    <div
      role="tablist"
      data-testid="patrol-view-mode-toggle"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 p-0.5"
    >
      {VIEW_MODE_ORDER.map(m => {
        const active = m === mode
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`patrol-view-mode-btn-${m}`}
            onClick={() => onModeChange(m)}
            className={`min-h-[36px] px-2.5 rounded text-xs font-bold leading-tight ${
              active ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'
            }`}
          >
            {VIEW_MODES[m].label}
          </button>
        )
      })}
    </div>
  )
}

export default function StoreTotalsHeader({
  diffMap, leftSlot = null, leftSlot2 = null,
  mode = 'IN', onModeChange = null,
}) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const totals = useMemo(() => computeStoreTotals(diffMap || {}, mode), [diffMap, mode])
  const showToggle = typeof onModeChange === 'function'
  return (
    <div data-testid="store-totals-header" className="shrink-0 border-b border-border">
      <div className="px-4 py-1 flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {leftSlot}
          {showToggle && <ModeToggle mode={mode} onModeChange={onModeChange} />}
        </div>
        <div className="shrink-0 grid grid-cols-4 gap-x-1.5 text-[10px] text-right leading-tight text-muted w-52">
          {COLUMN_HEADERS.map((label, i) => (
            <div key={i} data-testid={`store-label-${i}`}>{label}</div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-1.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">{leftSlot2}</div>
        <div className="shrink-0 grid grid-cols-4 gap-x-1.5 text-right leading-tight w-52">
          {Array.from({ length: COLUMN_COUNT }, (_, i) => (
            <div
              key={i}
              data-testid={`store-value-${i}`}
              className={`font-mono text-sm font-bold ${i === NEWEST ? 'text-green-300' : 'text-text'}`}
            >
              {formatCell(totals[i], modeDef.type)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
