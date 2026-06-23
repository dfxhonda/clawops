// SPEC-PATROL-HISTORY-HEATMAP-01: 10列横スクロール、F4 ワースト赤テキスト、F5 entry_type 背景色。
// ブース行はランク色付け対象外。今回列 (NEWEST) のみ text-green-300 (ワースト上書き優先)。
import { useMemo, useRef, useEffect } from 'react'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  formatCell,
  sourceArrayFor,
  computeWorstBoothMap,
} from './patrolViewModes'

// F5: entry_type ごとの背景色 (既存 BoothHistoryTable の replace 色 #5dade2 に合わせた水色系)
const ENTRY_BG = {
  replace: 'bg-blue-900/40',
  config:  'bg-green-900/30',
}

function BoothScrollCells({ arr, entryTypes, boothWorst, boothCode, modeDef }) {
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [])
  return (
    <div className="shrink-0 overflow-x-auto w-52" ref={scrollRef}>
      <div className="grid grid-cols-10 gap-x-1.5 text-right leading-tight w-[360px] tabular-nums">
        {Array.from({ length: COLUMN_COUNT }, (_, i) => {
          const worstColor = boothWorst?.[i] ?? null
          const textColor = worstColor ?? (i === NEWEST ? 'text-green-300' : 'text-text')
          const bgClass = ENTRY_BG[entryTypes?.[i]] ?? ''
          return (
            <div
              key={i}
              data-testid={`booth-cell-${boothCode}-${i}`}
              className={`font-mono text-sm font-bold ${textColor} ${bgClass}`}
            >
              {formatCell(arr[i], modeDef.type)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MachineRowExpandedBoothList({ booths, todayMap, diffMap, onBoothClick, mode = 'IN' }) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN

  // F4: 全 booth diffMap からワースト3件計算 (diffMap は store-wide)
  const worstMap = useMemo(() => computeWorstBoothMap(diffMap, mode), [diffMap, mode])

  return (
    <div className="mt-1 space-y-1" data-testid="machine-expanded-booth-list">
      {booths.map(booth => {
        const done = !!todayMap?.[booth.booth_code]
        const d = diffMap[booth.booth_code] ?? null
        const arr = sourceArrayFor(d, mode)
        const entryTypes = d?.entryTypes ?? []
        const boothWorst = worstMap[booth.booth_code] ?? null
        return (
          <button
            key={booth.booth_code}
            data-testid={`booth-row-${booth.booth_code}`}
            onClick={() => onBoothClick(booth)}
            className="w-full flex items-center gap-2 px-4 py-1 rounded-xl bg-surface/40 border border-border/40 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex-1 min-w-0 pl-4">
              <p className="text-text text-sm">
                └ B{String(booth.booth_number).padStart(2, '0')}
                {done && <span className="ml-1 text-emerald-400/70">✓</span>}
              </p>
            </div>
            <BoothScrollCells
              arr={arr}
              entryTypes={entryTypes}
              boothWorst={boothWorst}
              boothCode={booth.booth_code}
              modeDef={modeDef}
            />
          </button>
        )
      })}
    </div>
  )
}
