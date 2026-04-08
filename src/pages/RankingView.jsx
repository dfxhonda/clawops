import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getMachines, getBooths } from '../services/masters'
import { getAllMeterReadings } from '../services/readings'
import { parseNum } from '../services/utils'
import LogoutButton from '../components/LogoutButton'

export default function RankingView() {
  const { storeId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [boothStats, setBoothStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('prev')

  useEffect(() => { loadStats() }, [storeId])

  async function loadStats() {
    setLoading(true)
    const [machines, allReadings] = await Promise.all([getMachines(storeId), getAllMeterReadings()])
    const allBooths = await Promise.all(machines.map(m => getBooths(m.machine_code)))
    const stats = []
    machines.forEach((m, mi) => {
      allBooths[mi].forEach(b => {
        const br = allReadings.filter(r => String(r.booth_id) === String(b.booth_code))
        const price = parseNum(b.play_price||'100')
        let prevDiff = 0, prevSales = 0, prevNoData = true
        if (br.length >= 2) {
          const prev = parseNum(br[br.length-2].in_meter)
          const curr = parseNum(br[br.length-1].in_meter)
          if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
            prevDiff = curr - prev; prevSales = prevDiff * price; prevNoData = false
          }
        }
        let totalDiff = 0, totalSales = 0, totalNoData = true
        if (br.length >= 2) {
          const first = parseNum(br[0].in_meter)
          const last = parseNum(br[br.length-1].in_meter)
          if (!isNaN(first) && !isNaN(last) && last >= first) {
            totalDiff = last - first; totalSales = totalDiff * price; totalNoData = false
          }
        }
        stats.push({
          booth_code: b.booth_code, machine_name: m.machine_name,
          prize_name: br.length ? (br[br.length-1].prize_name||'-') : '-',
          since_date: br.length ? br[0].read_time?.slice(0,10) : '-',
          prevDiff, prevSales, prevNoData, totalDiff, totalSales, totalNoData,
        })
      })
    })
    setBoothStats(stats)
    setLoading(false)
  }

  const isPrev = mode === 'prev'
  const getDiff = b => isPrev ? b.prevDiff : b.totalDiff
  const getSales = b => isPrev ? b.prevSales : b.totalSales
  const getNoData = b => isPrev ? b.prevNoData : b.totalNoData

  const withData = boothStats.filter(b => !getNoData(b))
  const sorted = [...withData].sort((a,b) => getSales(b) - getSales(a))
  const top3 = sorted.slice(0,3)
  const worst3 = [...sorted].reverse().slice(0,3)
  const totalSales = withData.reduce((s,b) => s + getSales(b), 0)
  const sinceDate = boothStats.length ? boothStats[0].since_date : '-'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">集計中...</p>
      </div>
    </div>
  )

  const medals = ['🥇','🥈','🥉']
  const medalBorders = ['border-l-yellow-400','border-l-gray-400','border-l-amber-700']

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{state?.storeName}</h2>
            <p className="text-xs text-muted">売上ランキング</p>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10">

      {/* モード切替 */}
      <div className="flex bg-surface2 rounded-xl p-1 mb-4">
        {[['prev','📊 前回比'],['total','💰 集金後累計']].map(([val,label]) => (
          <button key={val} onClick={() => setMode(val)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all
              ${mode===val ? 'bg-surface text-accent shadow-sm' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 合計 */}
      <div className="bg-blue-600 text-white rounded-xl px-4 py-3 mb-4 text-center">
        <div className="text-xs opacity-80">{isPrev ? '店舗合計（前回比）' : `集金後累計（${sinceDate}〜）`}</div>
        <div className="text-3xl font-bold">¥{totalSales.toLocaleString()}</div>
        <div className="text-[11px] opacity-70 mt-1">{withData.length}ブース集計済 / 全{boothStats.length}ブース</div>
      </div>

      {/* TOP3 */}
      {top3.length > 0 && (
        <div className="mb-4">
          <h3 className="text-base font-bold text-green-400 mb-2">🏆 TOP3</h3>
          <div className="space-y-2">
            {top3.map((b,i) => (
              <div key={b.booth_code} className={`bg-surface border border-border rounded-xl p-3.5 border-l-4 ${medalBorders[i]}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">{medals[i]} {b.booth_code}</div>
                    <div className="text-xs text-muted mt-0.5">{b.machine_name} · {b.prize_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-400 text-lg">¥{getSales(b).toLocaleString()}</div>
                    <div className="text-xs text-muted">+{getDiff(b).toLocaleString()}回</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WORST3 */}
      {worst3.length > 0 && (
        <div className="mb-4">
          <h3 className="text-base font-bold text-accent2 mb-2">⚠️ WORST3（入替候補）</h3>
          <div className="space-y-2">
            {worst3.map(b => (
              <div key={b.booth_code} className="bg-surface border border-border rounded-xl p-3.5 border-l-4 border-l-accent2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">{b.booth_code}</div>
                    <div className="text-xs text-muted mt-0.5">{b.machine_name} · {b.prize_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent2">¥{getSales(b).toLocaleString()}</div>
                    <div className="text-xs text-muted">+{getDiff(b).toLocaleString()}回</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全ブース */}
      <h3 className="text-base font-bold mb-2">📋 全ブース（機械順）</h3>
      <div className="space-y-1.5">
        {boothStats.map(b => (
          <div key={b.booth_code} className={`bg-surface border border-border rounded-xl px-4 py-2.5 ${getNoData(b)?'opacity-50':''}`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-sm">{b.booth_code}</div>
                <div className="text-xs text-muted">{b.prize_name}</div>
              </div>
              <div className="text-right">
                {getNoData(b)
                  ? <div className="text-xs text-muted">データ不足</div>
                  : <>
                    <div className="font-bold">¥{getSales(b).toLocaleString()}</div>
                    <div className="text-xs text-muted">+{getDiff(b).toLocaleString()}回</div>
                  </>
                }
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>{/* スクロール領域終了 */}
    </div>
  )
}
