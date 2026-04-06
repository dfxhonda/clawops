/**
 * 集計サマリカード
 * Props: { label, count, color? }
 * color: Tailwind text クラス（例: "text-accent", "text-accent2"）
 */
export default function MetricCard({ label, count, color = 'text-accent' }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-[11px] text-muted mt-0.5">{label}</div>
    </div>
  )
}
