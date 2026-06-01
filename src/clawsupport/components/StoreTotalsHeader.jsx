// J-PATROL-IN-DAILY-fix-03/05 ad-hoc: 巡回 / 管理者編集モード の店舗ハブ最上行で共用するヘッダ。
// 2 行構成: (1) 進捗バッジ/モードトグル + ラベル、(2) 任意の左側スロット + 全店舗合計値。
// MachineRow / MachineRowExpandedBoothList と同一の w-52 grid + gap-x-1.5 で列 x 位置完全一致。
// SPEC-PATROL-VIEW-MODE-SWITCH-01: mode (IN/OUT/STOCK) を受けて列ラベル/値を切替。
// onModeChange が渡されたら上段左に 3 ボタントグルを描画 (店舗単位 state は親が保持)。

import { useMemo } from 'react'
import { VIEW_MODES, VIEW_MODE_ORDER, aggregateSummaries, formatCell } from './patrolViewModes'

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
  const cols = (VIEW_MODES[mode] ?? VIEW_MODES.IN).cols
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
          {cols.map(c => (
            <div key={c.key} data-testid={`store-label-${c.key}`}>{c.label}</div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-1.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">{leftSlot2}</div>
        <div className="shrink-0 grid grid-cols-4 gap-x-1.5 text-right leading-tight w-52">
          {cols.map(c => (
            <div
              key={c.key}
              data-testid={`store-value-${c.key}`}
              className={`font-mono text-sm font-bold ${c.today ? 'text-green-300' : 'text-text'}`}
            >
              {formatCell(totals[c.key], c.type)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
