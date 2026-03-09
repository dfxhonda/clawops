import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMachines, getStores, getBooths, getAllMeterReadings } from '../services/sheets'

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
    Promise.all([getMachines(storeId), getStores(), getAllMeterReadings()]).then(async ([m, s, allReadings]) => {
      setMachines(m)
      const store = s.find(x => x.store_id == storeId)
      if (store) setStoreName(store.store_name)

      const stats = {}
      for (const machine of m) {
        const booths = await getBooths(machine.machine_id)
        let totalDiff = 0
        let inputCount = 0
        for (const booth of booths) {
          const br = allReadings.filter(r => String(r.booth_id) === String(booth.booth_id))
          if (br.length >= 2) {
            const prev = Number(br[br.length-2].in_meter)
            const curr = Number(br[br.length-1].in_meter)
            if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
              totalDiff += curr - prev
              inputCount++
            }
          } else if (br.length === 1) {
            inputCount++
          }
        }
        stats[machine.machine_id] = {
          inputCount, totalBooths: booths.length,
          totalDiff, totalSales: totalDiff * 100
        }
      }
      setMachineStats(stats)
      setLoading(false)
    })
  }, [storeId])

  if (loading) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>読み込み中...</div>

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
            style={{flexDirection:'column',alignItems:'stretch',cursor:'pointer'}}
            onClick={() => navigate(`/booth/${m.machine_id}`, { state: { storeName, storeId } })}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold',fontSize:16}}>{m.machine_name}</div>
                <div style={{fontSize:13,color:'#666',marginTop:2}}>{typeLabel[m.machine_type]||m.machine_type}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <span className="badge"
                  style={{background:allDone?'#e6f4ea':'#e8f0fe', color:allDone?'#137333':'#1a73e8'}}>
                  {allDone ? '✅ 完了' : `${done}/${total}入力済`}
                </span>
                <span style={{fontSize:12,color:'#999'}}>{m.machine_code}</span>
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
