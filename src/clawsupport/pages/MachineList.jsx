import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getStores } from '../../services/masters'
import { getPatrolMachines } from '../../services/patrol'
import { fetchReadingsByBoothIds } from '../../services/readings'
import { parseNum } from '../../services/utils'
import { getPublishedModelIds } from '../../services/manuals'

export default function MachineList() {
  const { storeId } = useParams()
  const [machines, setMachines] = useState([])
  const [storeName, setStoreName] = useState('')
  const [machineStats, setMachineStats] = useState({})
  const [publishedModelIds, setPublishedModelIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      // getPatrolMachines は booths 込みで1クエリ。N+1の getBooths 呼び出しを排除
      const [allMachines, stores, pubIds] = await Promise.all([
        getPatrolMachines(storeId), getStores(), getPublishedModelIds()
      ])
      setMachines(allMachines)
      setPublishedModelIds(pubIds)
      const store = stores.find(x => String(x.store_code) === String(storeId))
      if (store) setStoreName(store.store_name)

      // 全ブースコードを収集してターゲット読み値クエリ（全件キャッシュ不使用）
      const allBoothCodes = allMachines.flatMap(m => (m.booths || []).map(b => b.booth_code))
      const allReadings = await fetchReadingsByBoothIds(allBoothCodes)

      const defaultPrice = m => parseNum(m.machine_models?.[0]?.meter_unit_price || '100')
      const stats = {}
      for (const m of allMachines) {
        const booths = m.booths || []
        let totalDiff = 0, inputCount = 0
        for (const booth of booths) {
          const br = allReadings.filter(r => String(r.booth_id) === String(booth.booth_code))
          if (br.length >= 2) {
            const prev = parseNum(br[br.length - 2].in_meter)
            const curr = parseNum(br[br.length - 1].in_meter)
            if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
              totalDiff += curr - prev
              inputCount++
            }
          } else if (br.length === 1) inputCount++
        }
        const lastRead = booths[0]
          ? allReadings.filter(r => String(r.booth_id) === String(booths[0].booth_code)).slice(-1)[0]
          : null
        stats[m.machine_code] = {
          inputCount, totalBooths: booths.length,
          totalDiff, totalSales: totalDiff * defaultPrice(m),
          lastReadTime: lastRead?.read_time?.slice(0, 10) || '',
        }
      }
      setMachineStats(stats)
      setLoading(false)
    }
    load()
  }, [storeId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">機械情報を読み込み中...</p>
      </div>
    </div>
  )

  const totalSales = Object.values(machineStats).reduce((s, m) => s + (m.totalSales||0), 0)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{storeName}</h2>
          <p className="text-xs text-muted">機械を選択してください</p>
        </div>
      </div>

      {/* 店舗合計 */}
      {totalSales > 0 && (
        <div className="bg-blue-600 text-white rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
          <span className="text-sm">店舗合計（前回比）</span>
          <span className="text-xl font-bold">¥{totalSales.toLocaleString()}</span>
        </div>
      )}

      {/* 機械リスト */}
      <div className="space-y-2">
        {machines.map(m => {
          const stat = machineStats[m.machine_code]
          const done = stat?.inputCount || 0
          const total = stat?.totalBooths || (m.booths?.length ?? 0)
          const allDone = done >= total
          const sales = stat?.totalSales || 0
          const diff = stat?.totalDiff || 0
          return (
            <div key={m.machine_code} className="flex items-stretch gap-2">
              <button
                className="flex-1 bg-surface border border-border rounded-xl p-4 text-left hover:border-accent/40 transition-colors active:scale-[0.98]"
                onClick={() => navigate(`/booth/${m.machine_code}`, { state: { storeName, storeId } })}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-base">{m.machine_name}</div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${allDone ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {allDone ? `✅ ${stat?.lastReadTime||''}` : `${done}/${total}入力済`}
                  </span>
                </div>
                {diff > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-border flex justify-between">
                    <span className="text-sm text-muted">前回差分: +{diff.toLocaleString()}回</span>
                    <span className="text-base font-bold text-blue-400">¥{sales.toLocaleString()}</span>
                  </div>
                )}
              </button>
              {publishedModelIds.has(m.model_id) && (
                <button
                  className="bg-surface border border-border rounded-xl px-3 text-xl hover:border-accent/40 transition-colors active:scale-[0.98]"
                  onClick={() => navigate(`/manual/${m.model_id}`)}
                  title="マニュアルを見る"
                >
                  📖
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
