/**
 * 期間選択コンポーネント
 * Props: { dateFrom, dateTo, onFromChange, onToChange }
 */
export default function DateRangePicker({ dateFrom, dateTo, onFromChange, onToChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={dateFrom}
        onChange={e => onFromChange(e.target.value)}
        className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]"
      />
      <span className="text-muted text-xs shrink-0">〜</span>
      <input
        type="date"
        value={dateTo}
        onChange={e => onToChange(e.target.value)}
        className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]"
      />
    </div>
  )
}
