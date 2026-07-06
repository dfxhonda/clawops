// SPEC-LF1-STORE-LOCAL-CACHE-01: 未送信 record の件数 + 関与 store 数を購読する hook。
// patchEvent ベース (custom event) で IndexedDB 書き込み後に再集計する。

import { useCallback, useEffect, useRef, useState } from 'react'
import { getUnsyncedSummary, deleteOrphanedNullStoreRecords } from '../lib/localStore/patrolRecords'

const EVENT_NAME = 'clawops-lf1-changed'

export function notifyLfChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }
}

export function useUnsentBanner() {
  // SPEC-LF1-IDEMPOTENT-SYNC-01 D7: records も公開しバナー詳細 (端末側診断) で使う。
  const [summary, setSummary] = useState({ count: 0, storeCount: 0, records: [] })

  const recompute = useCallback(async () => {
    const s = await getUnsyncedSummary()
    setSummary({ count: s.count, storeCount: s.storeCount, records: s.records ?? [] })
  }, [])

  const sweptRef = useRef(false)

  useEffect(() => {
    // FIX4: 初回マウント時に store_code:null 幽霊レコードを掃除してから集計
    if (!sweptRef.current) {
      sweptRef.current = true
      deleteOrphanedNullStoreRecords().then(() => recompute())
    } else {
      recompute()
    }
    function handler() { recompute() }
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, handler)
      return () => window.removeEventListener(EVENT_NAME, handler)
    }
  }, [recompute])

  return { ...summary, refresh: recompute }
}
