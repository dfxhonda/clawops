export default function StoreRankingLow({ stores, onTap }) {
  if (!stores || stores.length === 0) {
    return <div className="text-xs text-slate-400">データなし</div>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {stores.map((s, i) => (
        <button
          key={s.store_code}
          onClick={() => onTap?.(s.store_code)}
          className="w-full text-left bg-white rounded-xl shadow-sm px-3 py-2 flex items-center gap-2"
        >
          <span className="text-base">{i === 0 ? '🔴' : i === 1 ? '🟠' : '🟡'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-800 truncate">{s.store_name || s.store_code}</div>
            <div className="text-[11px] text-slate-400">{s.booth_count}ブース</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-sm font-bold text-slate-700">
              ¥{s.revenue.toLocaleString()}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
