import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMachines, getStores, getBooths, getAllMeterReadings, parseNum } from '../services/sheets'

const typeLabel = {
  BUZZ_CRANE_4:'BUZZ CRANE 4', BUZZ_CRANE_SLIM:'BUZZスリム',
  BUZZ_CRANE_MINI:'BUZZミニ', SESAME_W:'セサミW'
}

export default function MachineList() {
  const { storeId } = useParams()
  const [machines, setMachines] = useState([])
  const [storeName, setStoreName] = useState('')
  const [machineStats, setMachineStats] = useState({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      // 全データを並列で一括取得（キャッシュ活用）
      const [allMachines, stores, allReadings] = await Promise.all([
        getMachines(storeId),
        getStores(),
        getAllMeterReadings()
      ])
      setMachines(allMachines)
      const store = stores.find(x => String(x.store_id) === String(storeId))
      if (store) setStoreName(store.store_name)

      // 全機械のブースを並列取得
      const allBooths = await Promise.all(allMachines.map(m => getBooths(m.machine_id)))

      const stats = {}
      allMachines.forEach((m, i) => {
        const booths = allBooths[i]
        let totalDiff = 0, inputCount = 0
        for (const booth of booths) {
          const br = allReadings.filter(r => String(r.booth_id) === String(booth.booth_id))
          if (br.length >= 2) {
            const prev = parseNum(br[br.length-2].in_meter)
            const curr = parseNum(br[br.length-1].in_meter)
            if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
              totalDiff += curr - prev
              inputCount++
            }
          } else if (br.length === 1) inputCount++
        }
        const lastRead = booths[0] && allReadings.filter(r => String(r.booth_id) === String(booths[0].booth_id)).slice(-1)[0]; stats[m.machine_id] = {
          inputCount, totalBooths: booths.length,
          totalDiff, totalSales: totalDiff * (parseNum(m.default_price) || 100), lastReadTime: lastRead?.read_time?.slice(0,10)||''
        }
      })
      setMachineStats(stats)
      setLoading(false)
    }
    load()
  }, [storeId])

  if (loading) return (
    <div className="container" style={{paddingTop:80,textAlign:'center'}}>
      <p>読み込み中...</p>
    </div>
  )

  const totalSales = Object.values(machineStats).reduce((s, m) => s + (m.totalSales||0), 0)

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div style={{flex:1}}>
          <h2>{storeName}</h2>
          <p style={{fontSize:13,color:'#666'}}>機械を選択してください</p>
        </div>
      </div>

      {totalSales > 0 && (
        <div style={{background:'#1a73e8',color:'white',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:13}}>店舗合計（前回比）</span>
          <span style={{fontSize:20,fontWeight:'bold'}}>¥{totalSales.toLocaleString()}</span>
        </div>
      )}

      {machines.map(m => {
        const stat = machineStats[m.machine_id]
        const done = stat?.inputCount || 0
        const total = stat?.totalBooths || Number(m.booth_count)
        const allDone = done >= total
        const sales = stat?.totalSales || 0
        const diff = stat?.totalDiff || 0
        return (
          <div key={m.machine_id} className="machine-item"
            style={{flexDirection:'column',alignItems:'stretch',cursor:'pointer',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,marginBottom:8,padding:16}}
            onClick={() => navigate(`/booth/${m.machine_id}`, { state: { storeName, storeId } })}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold',fontSize:16,color:'var(--text)'}}>{m.machine_name}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <span className="badge" style={{background:allDone?'#e6f4ea':'#e8f0fe',color:allDone?'#137333':'#1a73e8'}}>
                  {allDone ? `✅ ${stat?.lastReadTime||''}` : `${done}/${total}入力済`}
                </span>

              </div>
            </div>
            {diff > 0 && (
              <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f0f0f0',display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:13,color:'#666'}}>前回差分: +{diff.toLocaleString()}回</span>
                <span style={{fontSize:15,fontWeight:'bold',color:'#1a73e8'}}>¥{sales.toLocaleString()}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
