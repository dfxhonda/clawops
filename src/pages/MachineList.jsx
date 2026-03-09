import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMachines, getStores, getBooths, getLastReading } from '../services/sheets'

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
    Promise.all([getMachines(storeId), getStores()]).then(async ([m, s]) => {
      setMachines(m)
      const store = s.find(x => x.store_id == storeId)
      if (store) setStoreName(store.store_name)

      // 各機械の今回差分を集計
      const stats = {}
      for (const machine of m) {
        const booths = await getBooths(machine.machine_id)
        let totalDiff = 0
        let inputCount = 0
        for (const booth of booths) {
          const last = await getLastReading(booth.booth_id)
          if (last?.in_meter && !isNaN(Number(last.in_meter))) {
            // 今日のデータかチェック
            const today = new Date().toISOString().slice(0,10)
            if (last.read_time?.slice(0,10) === today) {
              inputCount++
            }
          }
        }
        stats[machine.machine_id] = { inputCount, totalBooths: booths.length }
      }
      setMachineStats(stats)
      setLoading(false)
    })
  }, [storeId])

  if (loading) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>読み込み中...</div>

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div>
          <h2>{storeName}</h2>
          <p style={{fontSize:13,color:'#666'}}>機械を選択してください</p>
        </div>
      </div>
      {machines.map(m => {
        const stat = machineStats[m.machine_id]
        const done = stat?.inputCount || 0
        const total = stat?.totalBooths || Number(m.booth_count)
        const allDone = done >= total
        return (
          <div key={m.machine_id} className="machine-item"
            style={{opacity: allDone ? 0.6 : 1}}
            onClick={() => navigate(`/booth/${m.machine_id}`, { state: { storeName, storeId } })}>
            <div>
              <div style={{fontWeight:'bold',fontSize:16}}>{m.machine_name}</div>
              <div style={{fontSize:13,color:'#666',marginTop:4}}>{typeLabel[m.machine_type]||m.machine_type}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
              <span className="badge" style={{background: allDone ? '#e6f4ea' : '#e8f0fe', color: allDone ? '#137333' : '#1a73e8'}}>
                {allDone ? '✅ 完了' : `${done}/${total}入力済`}
              </span>
              <span style={{fontSize:12,color:'#999'}}>{m.machine_code}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
