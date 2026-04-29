export default function AlertList({ alerts, onTap }) {
  if (alerts.length === 0) {
    return (
      <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
        ✅ アラートなし、平和
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {alerts.map((a, i) => (
        <button
          key={i}
          onClick={() => onTap?.(a.booth_code)}
          className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
            a.severity === 'rose'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          {a.message}
        </button>
      ))}
    </div>
  )
}
