// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068) F1: 分析ページ滞在計測フック。
// mount で views=1、離脱時 (unmount または visibilitychange=hidden、先に来た方1回) に滞在秒を送信。
// 失敗は service 側で silent。未ログイン/staff 不明は送信しない。
import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { trackPageUsage } from '../services/pageUsage'
import { USAGE_DWELL_CLIP_SECONDS } from '../constants/pageKeys'

/** 滞在秒を [0, 600] に丸める (放置タブ対策)。 */
export function clampDwellSeconds(sec) {
  const n = Math.floor(Number(sec) || 0)
  return Math.min(USAGE_DWELL_CLIP_SECONDS, Math.max(0, n))
}

export function useTrackPageUsage(pageKey) {
  const { staffId } = useAuth()
  useEffect(() => {
    if (!staffId || !pageKey) return
    const mountedAt = Date.now()
    let sent = false

    trackPageUsage({ staffId, pageKey, addViews: 1, addSeconds: 0 }) // 閲覧1回

    const sendDwell = () => {
      if (sent) return
      sent = true
      const sec = clampDwellSeconds((Date.now() - mountedAt) / 1000)
      if (sec > 0) trackPageUsage({ staffId, pageKey, addViews: 0, addSeconds: sec })
    }
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') sendDwell() }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)

    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
      sendDwell() // 離脱
    }
  }, [staffId, pageKey])
}
