// ============================================
// useInventoryDashboard: 棚卸しダッシュボードの取得・集計フック
// 画面から Promise.all + 集計ロジックを外に出す
// ============================================
import { useState, useEffect, useCallback } from 'react'
import { getLocations } from '../../../services/masters'
import { getPrizeStocksExtended } from '../../../services/inventory'
import { getStockMovements } from '../../../services/movements'
import { calcInventoryStats } from '../../../services/calc'

/**
 * @returns {{ stats: object|null, loading: boolean, error: string|null }}
 */
export function useInventoryDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [trigger, setTrigger] = useState(0)

  const reload = useCallback(() => {
    setError(null)
    setLoading(true)
    setTrigger(t => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setError(null)
        setLoading(true)
        const [locations, stocks, movements] = await Promise.all([
          getLocations(),
          getPrizeStocksExtended(),
          getStockMovements(),
        ])
        if (cancelled) return
        setStats(calcInventoryStats({ locations, stocks, movements }))
      } catch (err) {
        if (!cancelled) setError(err.message || '読み込みに失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [trigger])

  return { stats, loading, error, reload }
}
