export default function KpiCard({ label, icon, value, subValue, colorClass }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`font-mono text-xl font-bold ${colorClass ?? 'text-slate-800'}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[11px] text-slate-400">{subValue}</div>
      )}
    </div>
  )
}
