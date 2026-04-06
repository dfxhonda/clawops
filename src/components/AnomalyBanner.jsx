// 異常値アラートバナー（表示のみ）
// 判定ロジックは呼び出し元のフック側で完結させること
export default function AnomalyBanner({ inAbnormal, outAbnormal, inZero, inTriple, payoutHigh, payoutLow }) {
  const hasAnomaly = inAbnormal || outAbnormal || inZero || inTriple || payoutHigh || payoutLow
  if (!hasAnomaly) return null
  return (
    <div className="mb-4 bg-accent2/10 border border-accent2/30 rounded-lg px-3 py-2 text-[11px] text-accent2 font-bold">
      ⚠️ 異常値を検出
      {inAbnormal  && <span className="ml-1">· IN異常値</span>}
      {inZero      && <span className="ml-1">· INゼロ</span>}
      {inTriple    && <span className="ml-1">· IN差分3倍</span>}
      {outAbnormal && <span className="ml-1">· OUT異常値</span>}
      {payoutHigh  && <span className="ml-1">· 出率高(≥30%)</span>}
      {payoutLow   && <span className="ml-1">· 出率低(&lt;5%)</span>}
    </div>
  )
}
