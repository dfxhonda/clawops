// 巡回異常値検出
// calc: { inDiff, outs: [{ diff }], inRate }
// returns: [{ level: 'red'|'yellow', msg: string }], 赤→黄の順

const OUT_LABELS = ['A', 'B', 'C']

export function detectAlerts(calc, outCount) {
  if (!calc) return []
  const alerts = []
  const { inDiff, outs } = calc
  const multiOut = outCount >= 2

  // IN差チェック
  if (inDiff != null) {
    if (inDiff < 0) {
      alerts.push({ level: 'red', msg: 'IN差マイナス: 入力ミスの可能性' })
    } else if (inDiff === 0) {
      alerts.push({ level: 'yellow', msg: 'IN差0: メーター確認' })
    }
  }

  // OUT差・出率チェック (OUT毎)
  ;(outs || []).forEach((o, i) => {
    const prefix = multiOut ? `OUT-${OUT_LABELS[i]}` : 'OUT'

    if (o.diff != null && o.diff < 0) {
      alerts.push({ level: 'red', msg: `${prefix}差マイナス: 入力ミスの可能性` })
    }

    const rate = (inDiff != null && inDiff > 0 && o.diff != null)
      ? (o.diff / inDiff * 100)
      : null

    if (rate != null) {
      if (rate > 50) {
        alerts.push({ level: 'red', msg: `${prefix}出率異常: 50%超 (${rate.toFixed(1)}%)` })
      } else if (rate > 35) {
        alerts.push({ level: 'yellow', msg: `${prefix}出率高め: 35%超 (${rate.toFixed(1)}%)` })
      }
    }
  })

  // 赤を上、黄を下
  return alerts.sort((a, b) => {
    if (a.level === b.level) return 0
    return a.level === 'red' ? -1 : 1
  })
}
