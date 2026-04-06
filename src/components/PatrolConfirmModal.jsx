// 保存確認モーダル（表示のみ）
// 判定ロジックは呼び出し元のフック側で完結させること
export default function PatrolConfirmModal({
  boothCode, inDiff, outDiff, payoutRate, price,
  inAbnormal, inZero, inTriple, outAbnormal, payoutHigh, payoutLow,
  hasAnomaly, onSave, onClose,
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-bg border-t border-border rounded-t-2xl p-5 pb-8 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="text-sm font-bold text-center">保存確認</div>
        <div className="bg-surface2 rounded-xl p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">ブース</span>
            <span className="font-mono text-xs">{boothCode}</span>
          </div>
          {inDiff !== null && (
            <div className="flex justify-between">
              <span className="text-muted">IN差分</span>
              <span className={`font-bold ${inDiff === 0 || inAbnormal || inTriple ? 'text-accent2' : 'text-accent'}`}>
                {inDiff >= 0 ? '+' : ''}{inDiff.toLocaleString()}回　¥{(inDiff * price).toLocaleString()}
              </span>
            </div>
          )}
          {outDiff !== null && (
            <div className="flex justify-between">
              <span className="text-muted">OUT差分</span>
              <span className={`font-bold ${outAbnormal ? 'text-accent2' : 'text-accent'}`}>
                {outDiff >= 0 ? '+' : ''}{outDiff.toLocaleString()}回
              </span>
            </div>
          )}
          {payoutRate !== null && (
            <div className="flex justify-between">
              <span className="text-muted">出率</span>
              <span className={`font-bold ${payoutHigh || payoutLow ? 'text-accent2' : 'text-accent3'}`}>
                {payoutRate.toFixed(1)}%
              </span>
            </div>
          )}
          {hasAnomaly && (
            <div className="mt-1 pt-2 border-t border-border text-accent2 text-xs font-bold">
              ⚠️ 異常値あり —— 確認してから保存してください
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm text-muted active:scale-[0.98]">
            戻る
          </button>
          <button onClick={onSave}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm active:scale-[0.98]">
            保存する
          </button>
        </div>
      </div>
    </div>
  )
}
