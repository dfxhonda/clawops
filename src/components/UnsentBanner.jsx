// SPEC-LF1-STORE-LOCAL-CACHE-01: 未送信件数を表示する固定バナー。
// navigation を block しない (常に背景越しタップ可、ボタンも optional)。
// 件数 0 の時は非表示。

import { useUnsentBanner } from '../hooks/useUnsentBanner'

export default function UnsentBanner() {
  const { count, storeCount } = useUnsentBanner()
  if (!count) return null
  return (
    <div
      data-testid="unsent-banner"
      role="status"
      aria-live="polite"
      className="fixed top-1 left-1/2 -translate-x-1/2 z-[110] px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold shadow pointer-events-none"
    >
      未送信 {count}件 / {storeCount}店舗
    </div>
  )
}
