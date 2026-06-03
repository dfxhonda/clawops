// SPEC-LIST-FILTER-SORT-01: リスト共通の filter dropdown bar。
// UI-CHARTER-V2 [A] 入力密度系: text-xs h-8 border rounded、native <select>。
// filters: [{ key, label, options: [{value, label}] }]
// values:  { [key]: value }
// onChange(key, value)
// 'リセット' は 1 つでも default 値以外なら表示。default 値は options[0].value (慣例: 'all')。
export default function ListFilterBar({
  filters,
  values,
  onChange,
  onReset,
  className = '',
  defaultValueOf,
}) {
  if (!Array.isArray(filters) || filters.length === 0) return null
  const isDefault = (f) => {
    const d = defaultValueOf ? defaultValueOf(f.key) : (f.options?.[0]?.value ?? 'all')
    return (values?.[f.key] ?? d) === d
  }
  const anyNonDefault = filters.some(f => !isDefault(f))

  return (
    <div
      data-testid="list-filter-bar"
      className={`flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-bg ${className}`}
    >
      {filters.map(f => (
        <label key={f.key} className="flex items-center gap-1 text-xs text-muted">
          <span>{f.label}</span>
          <select
            data-testid={`filter-${f.key}`}
            value={values?.[f.key] ?? (defaultValueOf ? defaultValueOf(f.key) : (f.options?.[0]?.value ?? 'all'))}
            onChange={e => onChange?.(f.key, e.target.value)}
            className="h-8 text-xs px-2 rounded border border-border bg-surface text-text"
            style={{ fontSize: 16 }}
          >
            {(f.options ?? []).map(o => (
              <option key={String(o.value)} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      ))}
      {anyNonDefault && (
        <button
          type="button"
          data-testid="filter-reset"
          onClick={() => onReset?.()}
          className="ml-1 text-xs text-accent underline min-h-[32px] px-1"
        >
          リセット
        </button>
      )}
    </div>
  )
}
