// ============================================
// useInventoryDashboard: 棚卸しダッシュボードの取得・集計フック
// 画面から Promise.all + 集計ロジックを外に出す
// ============================================
import { useState, useEffect } from 'react'
import { getLocations, getPrizeStocksExtended, getStockMovements } from '../../../services/sheets'
import { calcInventoryStats } from '../../../services/calc'

/**
 * @returns {{ stats: object|null, loading: boolean, error: string|null }}
 */
export function useInventoryDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
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
  }, [])

  return { stats, loading, error }
}
