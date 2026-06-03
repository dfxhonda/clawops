// SPEC-LIST-FILTER-SORT-01: テーブル/リスト共通の sortable header。
// columns: [{key, label, className?}], sortKey, sortDir, onSort(key)。
// 各セル全体を tap area (min-h-[44px])、ソート中カラムに ▲/▼、非ソートは ↕。
import { Fragment } from 'react'

export default function SortableTableHeader({
  columns,
  sortKey,
  sortDir,
  onSort,
  className = '',
  cellClassName = '',
  variant = 'tr',  // 'tr' | 'div'
}) {
  if (variant === 'div') {
    return (
      <div role="row" className={`flex ${className}`} data-testid="sortable-header">
        {columns.map(c => (
          <button
            key={c.key}
            type="button"
            role="columnheader"
            onClick={() => onSort?.(c.key)}
            data-testid={`sortable-col-${c.key}`}
            aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={`min-h-[44px] flex items-center justify-between gap-1 px-2 cursor-pointer select-none ${cellClassName} ${c.className || ''}`}
          >
            <span className="truncate">{c.label}</span>
            <Indicator active={sortKey === c.key} dir={sortDir} />
          </button>
        ))}
      </div>
    )
  }
  return (
    <tr className={className} data-testid="sortable-header">
      {columns.map(c => (
        <Fragment key={c.key}>
          <th
            scope="col"
            onClick={() => onSort?.(c.key)}
            data-testid={`sortable-col-${c.key}`}
            aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={`min-h-[44px] cursor-pointer select-none text-left ${cellClassName} ${c.className || ''}`}
          >
            <span className="inline-flex items-center gap-1">
              <span>{c.label}</span>
              <Indicator active={sortKey === c.key} dir={sortDir} />
            </span>
          </th>
        </Fragment>
      ))}
    </tr>
  )
}

function Indicator({ active, dir }) {
  if (!active) return <span aria-hidden className="text-muted/40 text-xs">↕</span>
  return <span aria-hidden className="text-accent text-xs">{dir === 'asc' ? '▲' : '▼'}</span>
}
