import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStores, getMachines, getBooths } from '../../services/masters'
import { getAllMeterReadings } from '../../services/readings'
import { parseNum } from '../../services/utils'
import LogoutButton from '../../components/LogoutButton'
import { useAuth } from '../../hooks/useAuth'

export default function Dashboard() {
  const navigate = useNavigate()
  const { staffRole, staffStoreCode } = useAuth()
  const isFieldStaff = staffRole === 'staff' || staffRole === 'patrol'
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState(null)
  const [rankings, setRankings] = useState([])
  const [storeSummary, setStoreSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStores().then(s => {
      setStores(s)
      if (isFieldStaff && staffStoreCode) setStoreId(staffStoreCode)
      else if (s.length > 0) setStoreId(s[0].store_code)
      setLoading(false)
    })
  }, [isFieldStaff, staffStoreCode])

  useEffect(() => {
    if (!storeId) return
    async function load() {
      const [machines, allReadings] = await Promise.all([
        getMachines(storeId), getAllMeterReadings()
      ])
      const allBooths = await Promise.all(machines.map(m => getBooths(m.machine_code)))

      let totalSales = 0, totalPrev = 0, boothRankings = [], inputCount = 0, totalBooths = 0

      machines.forEach((m, mi) => {
        const mBooths = allBooths[mi]
        const price = parseNum(m.default_price) || 100
        totalBooths += mBooths.length

        for (const booth of mBooths) {
          const br = allReadings
            .filter(r => String(r.booth_id) === String(booth.booth_code))
            .sort((a, b) => {
              const da = a.patrol_date || a.read_time
              const db = b.patrol_date || b.read_time
              return da < db ? -1 : da > db ? 1 : 0
            })
          if (br.length >= 2) {
            const curr = parseNum(br[br.length-1].in_meter)
            const prev = parseNum(br[br.length-2].in_meter)
            const outCurr = parseNum(br[br.length-1].out_meter)
            const outPrev = parseNum(br[br.length-2].out_meter)
            if (!isNaN(curr) && !isNaN(prev) && curr >= prev) {
              const diff = curr - prev
              const sales = diff * price
              totalSales += sales
              inputCount++
              const outDiff = (!isNaN(outCurr) && !isNaN(outPrev)) ? outCurr - outPrev : 0
              const rate = diff > 0 ? ((outDiff / diff) * 100).toFixed(1) : '0'
              boothRankings.push({
                code: booth.booth_code,
                prize: br[br.length-1].prize_name || '',
                machine: m.machine_name,
                sales, diff, rate,
              })
            }
          }
          // 前々回との差分
          if (br.length >= 3) {
            const p2 = parseNum(br[br.length-3].in_meter)
            const p1 = parseNum(br[br.length-2].in_meter)
            if (!isNaN(p2) && !isNaN(p1) && p1 >= p2) {
              totalPrev += (p1 - p2) * price
            }
          }
        }
      })

      boothRankings.sort((a, b) => b.sales - a.sales)
      setRankings(boothRankings.slice(0, 10))
      setStoreSummary({ totalSales, totalPrev, diff: totalSales - totalPrev, inputCount, totalBooths })
    }
    load()
  }, [storeId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
    </div>
  )

  return (
    <div className="min-h-screen pb-4">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted hover:text-accent">←</button>
          <div className="flex-1 text-base font-bold">ダッシュボード</div>
          <LogoutButton to="/admin/menu" />
        </div>
      </div>

      {/* 店舗セレクター */}
      <div className="px-3 py-2">
        {isFieldStaff ? (
          <div className="text-xs font-semibold text-muted py-1">
            {stores.find(s => s.store_code === storeId)?.store_name || '—'}
          </div>
        ) : (
          <select
            value={storeId || ''}
            onChange={e => setStoreId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm outline-none focus:border-accent [color-scheme:dark]"
          >
            {stores.map(s => (
              <option key={s.store_code} value={s.store_code}>{s.store_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* サマリーカード */}
      {storeSummary && (
        <div className="grid grid-cols-2 gap-2 px-3 mb-3">
          <div className="bg-surface border border-border rounded-xl p-3">
            <div className="text-[11px] text-muted">今回売上</div>
            <div className="text-2xl font-extrabold text-text mt-1">¥{storeSummary.totalSales.toLocaleString()}</div>
            {storeSummary.diff !== 0 && (
              <div className={`text-xs mt-1 font-bold ${storeSummary.diff > 0 ? 'text-green-400' : 'text-accent2'}`}>
                {storeSummary.diff > 0 ? '↑' : '↓'} ¥{Math.abs(storeSummary.diff).toLocaleString()} vs前回
              </div>
            )}
          </div>
          <div className="bg-surface border border-border rounded-xl p-3">
            <div className="text-[11px] text-muted">入力状況</div>
            <div className="text-2xl font-extrabold text-text mt-1">
              {storeSummary.inputCount}/{storeSummary.totalBooths}
            </div>
            <div className="text-xs text-blue-400 mt-1 font-bold">
              {storeSummary.totalBooths > 0 ? Math.round(storeSummary.inputCount / storeSummary.totalBooths * 100) : 0}% 完了
            </div>
          </div>
        </div>
      )}

      {/* ランキング */}
      <div className="px-3">
        <div className="text-[11px] text-muted font-bold uppercase tracking-wider mb-2">売上ランキング</div>
        <div className="space-y-1.5">
          {rankings.map((r, i) => (
            <div key={i} className="flex items-center bg-surface border border-border rounded-lg p-3">
              <div className={`text-lg font-extrabold w-8 text-center
                ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-muted/40'}`}>
                {i + 1}
              </div>
              <div className="flex-1 ml-2 min-w-0">
                <div className="text-sm font-semibold truncate">{r.code}</div>
                <div className="text-[11px] text-muted truncate">{r.prize || r.machine} / 出率{r.rate}%</div>
              </div>
              <div className="text-sm font-bold text-green-400 ml-2 shrink-0">¥{r.sales.toLocaleString()}</div>
            </div>
          ))}
          {rankings.length === 0 && (
            <div className="text-center text-muted py-8 text-sm">データがありません</div>
          )}
        </div>
      </div>
    </div>
  )
}
