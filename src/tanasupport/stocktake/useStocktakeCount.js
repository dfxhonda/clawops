import { useCallback, useEffect, useState } from 'react'
import {
  getOrCreateMonthSession,
  getLocationPrizes,
  getStaffPrizes,
  getOwnerItemsMap,
  upsertItem,
} from './api'

// J-STOCKTAKE-MVP-fix-01: 棚卸し個数入力のデータ層 (既存 api.js 流用)
// prize_stocks/stock_movements は一切直書きしない。締めの台帳反映は
// DBトリガー (fn_reconcile_stocktake_to_ledger) に委ねる設計。
export function useStocktakeCount(ownerType, ownerCode, staffId) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [prizes, setPrizes] = useState([])
  const [countsMap, setCountsMap] = useState({}) // prize_id -> { actual_count }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const sess = await getOrCreateMonthSession()
        const list = ownerType === 'staff'
          ? await getStaffPrizes(ownerCode)
          : await getLocationPrizes(ownerCode)
        const map = await getOwnerItemsMap(sess.session_id, ownerType, ownerCode)
        if (cancelled) return
        setSession(sess)
        setPrizes(list)
        setCountsMap(map)
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (ownerType && ownerCode) load()
    return () => { cancelled = true }
  }, [ownerType, ownerCode])

  // actual_count 合計を upsert (即時保存)。theoretical は在庫スナップショット。
  const saveCount = useCallback(async (prizeId, total, theoreticalCount) => {
    if (!session) return
    await upsertItem({
      sessionId: session.session_id,
      prizeId,
      ownerType,
      ownerCode,
      actualCount: total,
      theoreticalCount,
      staffId,
    })
    setCountsMap(prev => ({ ...prev, [prizeId]: { actual_count: total } }))
  }, [session, ownerType, ownerCode, staffId])

  return { loading, error, session, prizes, countsMap, saveCount }
}
