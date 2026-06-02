// SPEC-LF1-STORE-LOCAL-CACHE-01: 未送信 record の件数 + 関与 store 数を購読する hook。
// patchEvent ベース (custom event) で IndexedDB 書き込み後に再集計する。

import { useCallback, useEffect, useState } from 'react'
import { getUnsyncedSummary } from '../lib/localStore/patrolRecords'

const EVENT_NAME = 'clawops-lf1-changed'

export function notifyLfChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }
}

export function useUnsentBanner() {
  const [summary, setSummary] = useState({ count: 0, storeCount: 0 })

  const recompute = useCallback(async () => {
    const s = await getUnsyncedSummary()
    setSummary({ count: s.count, storeCount: s.storeCount })
  }, [])

  useEffect(() => {
    recompute()
    function handler() { recompute() }
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, handler)
      return () => window.removeEventListener(EVENT_NAME, handler)
    }
  }, [recompute])

  return summary
}
