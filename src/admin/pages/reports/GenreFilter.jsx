// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3
const GENRES = [
  { key: 'all',     label: '全部' },
  { key: 'crane',   label: 'クレーン' },
  { key: 'gacha',   label: 'ガチャ' },
  { key: 'changer', label: '両替機' },
  { key: 'other',   label: 'その他' },
]

export default function GenreFilter({ value, onChange, disabled = false, disabledReason = null }) {
  return (
    <div data-testid="genre-filter" className="mb-3">
      {disabled && disabledReason && (
        <p className="text-[10px] text-muted mb-1">{disabledReason}</p>
      )}
      <div className="flex gap-1 flex-wrap">
        {GENRES.map(g => (
          <button
            key={g.key}
            onClick={() => !disabled && onChange(g.key)}
            disabled={disabled}
            data-testid={`genre-${g.key}`}
            className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              value === g.key
                ? 'bg-accent text-white'
                : 'bg-surface/40 text-muted'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  )
}
