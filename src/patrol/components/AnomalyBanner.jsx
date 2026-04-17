// 異常値アラートバナー（表示のみ）
// 判定ロジックは呼び出し元のフック側で完結させること
const ANOMALY_ITEMS = [
  { key: 'inAbnormal',  label: 'IN異常値',    desc: 'メーターが前回より減少または5万超。数値を再確認してください' },
  { key: 'inZero',      label: 'INゼロ',       desc: '前回と同じ値です。稼働していない可能性があります' },
  { key: 'inTriple',    label: 'IN差分3倍',    desc: '前回比3倍以上の差分です。数値を再確認してください' },
  { key: 'outAbnormal', label: 'OUT異常値',   desc: '払出が前回より減少または5万超。数値を再確認してください' },
  { key: 'payoutHigh',  label: '出率高(≥30%)', desc: '景品が出すぎています。クレーン設定を確認してください' },
  { key: 'payoutLow',   label: '出率低(<5%)',  desc: '景品がほぼ出ていません。機械の状態を確認してください' },
]

export default function AnomalyBanner({ inAbnormal, outAbnormal, inZero, inTriple, payoutHigh, payoutLow }) {
  const flags = { inAbnormal, outAbnormal, inZero, inTriple, payoutHigh, payoutLow }
  const active = ANOMALY_ITEMS.filter(item => flags[item.key])
  if (active.length === 0) return null
  return (
    <div className="mb-4 bg-accent2/10 border border-accent2/30 rounded-lg px-3 py-2.5">
      <div className="text-[11px] text-accent2 font-bold mb-2">⚠️ 異常値を検出</div>
      <ul className="space-y-1.5">
        {active.map(item => (
          <li key={item.key} className="text-[11px]">
            <span className="text-accent2 font-bold">· {item.label}</span>
            <span className="text-muted ml-1">— {item.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
