import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStocktakeDashboard } from './api'

const RATE_CLASS = (rate) => {
  if (rate == null) return 'text-muted'
  if (rate < 0.10)  return 'text-emerald-400'
  if (rate < 0.30)  return 'text-amber-400'
  return 'text-rose-400 font-bold'
}

const RATE_BG = (rate) => {
  if (rate == null) return ''
  if (rate < 0.10)  return 'bg-emerald-500/5'
  if (rate < 0.30)  return 'bg-amber-500/10'
  return 'bg-rose-500/15'
}

function monthLabel(monthStr) {
  if (!monthStr) return ''
  const d = new Date(monthStr + 'T00:00:00+09:00')
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
}

export default function StocktakeDashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getStocktakeDashboard()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
      読み込み中...
    </div>
  )
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-rose-400 text-sm px-5 text-center">
      {error}
    </div>
  )

  const { staffRows = [], months = [] } = data ?? {}

  return (
    <div className="min-h-screen bg-bg text-text pb-16" data-testid="stocktake-dashboard">
      <div
        className="shrink-0 flex items-center gap-3 px-5 pt-10 pb-5"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}
      >
        <button
          onClick={() => navigate('/admin/stocktake')}
          className="text-muted text-xl leading-none shrink-0"
        >‹</button>
        <p className="text-text text-xl font-bold flex-1">管理能力測定ダッシュボード</p>
      </div>

      {/* 凡例 */}
      <div className="px-5 mb-4 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> &lt;10%: 良好
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 10-30%: 要確認
        </span>
        <span className="flex items-center gap-1 text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> &ge;30%: 乖離大
        </span>
        <span className="flex items-center gap-1 text-muted">
          🚨 一貫方向: 不正疑い
        </span>
      </div>

      {staffRows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-muted text-sm">データがありません</p>
          <p className="text-muted text-xs mt-2">棚卸しが実施されると担当者別集計が表示されます</p>
        </div>
      ) : (
        <div className="px-5 overflow-x-auto">
          <table className="w-full text-xs" data-testid="dashboard-table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 text-muted font-bold whitespace-nowrap">担当者</th>
                {months.map(m => (
                  <th key={m} className="text-center py-2 px-2 text-muted font-bold whitespace-nowrap min-w-[64px]">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="text-center py-2 px-2 text-muted font-bold whitespace-nowrap">トレンド</th>
                <th className="text-center py-2 px-2 text-muted font-bold whitespace-nowrap">パターン</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map(row => (
                <tr key={row.staffId} className="border-b border-border/50">
                  <td className="py-2.5 pr-3 font-medium whitespace-nowrap" data-testid={`staff-name-${row.staffId}`}>
                    {row.name}
                  </td>
                  {months.map(m => {
                    const ms = row.monthStats[m]
                    return (
                      <td
                        key={m}
                        className={`text-center py-2 px-2 rounded ${RATE_BG(ms?.avgRate)}`}
                        data-testid={`cell-${row.staffId}-${m}`}
                      >
                        {ms ? (
                          <span className={RATE_CLASS(ms.avgRate)}>
                            {Math.round(ms.avgRate * 100)}%
                          </span>
                        ) : (
                          <span className="text-border">—</span>
                        )}
                      </td>
                    )
                  })}
                  {/* トレンド */}
                  <td className="text-center py-2 px-2 whitespace-nowrap" data-testid={`trend-${row.staffId}`}>
                    {row.trend === 'improving' && <span className="text-emerald-400">↑ 改善</span>}
                    {row.trend === 'worsening' && <span className="text-rose-400">↓ 悪化</span>}
                    {row.trend === 'stable'    && <span className="text-muted">— 横ばい</span>}
                    {row.trend === null        && <span className="text-border">—</span>}
                  </td>
                  {/* 一貫方向性 */}
                  <td className="text-center py-2 px-2 whitespace-nowrap" data-testid={`pattern-${row.staffId}`}>
                    {row.consistentDir === 'over'  && (
                      <span className="text-rose-400 font-bold text-[11px]" title="常に過多計上">
                        🚨 常過多
                      </span>
                    )}
                    {row.consistentDir === 'under' && (
                      <span className="text-rose-400 font-bold text-[11px]" title="常に過少計上">
                        🚨 常過少
                      </span>
                    )}
                    {!row.consistentDir && <span className="text-border">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 注釈 */}
      <div className="px-5 mt-6 text-[10px] text-muted space-y-1">
        <p>※ 乖離率 = |実数 - 理論値| ÷ 理論値</p>
        <p>※ 一貫方向: 2ヶ月以上連続で同方向（常に過多・常に過少）の場合に🚨を表示</p>
        <p>※ トレンド: 最新月と前月を比較（±2%以内は横ばい）</p>
      </div>
    </div>
  )
}
