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

      const stats = {}
      for (const machine of m) {
        const booths = await getBooths(machine.machine_id)
        let totalDiff = 0
        let inputCount = 0
        let totalBooths = booths.length

        for (const booth of booths) {
          // 全履歴を取得して前回と今回を比較
          const readings = await getAllReadings(booth.booth_id)
          if (readings.length >= 2) {
            const prev = readings[readings.length - 2]
            const curr = readings[readings.length - 1]
            const prevIn = Number(prev.in_meter)
            const currIn = Number(curr.in_meter)
            if (!isNaN(prevIn) && !isNaN(currIn) && currIn >= prevIn) {
              totalDiff += currIn - prevIn
              inputCount++
            }
          } else if (readings.length === 1) {
            inputCount++
          }
        }

        stats[machine.machine_id] = {
          inputCount,
          totalBooths,
          totalDiff,
          totalSales: totalDiff * 100
        }
      }
      setMachineStats(stats)
      setLoading(false)
    })
  }, [storeId])

  if (loading) return (
    <div className="container" style={{paddingTop:40,textAlign:'center'}}>
      <p>読み込み中...</p>
      <p style={{fontSize:12,color:'#999',marginTop:8}}>売上データ集計中</p>
    </div>
  )

  const totalSales = Object.values(machineStats).reduce((sum, s) => sum + (s.totalSales||0), 0)

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
          <span style={{fontSize:13}}>店舗合計売上（前回比）</span>
          <span style={{fontSize:20,fontWeight:'bold'}}>¥{totalSales.toLocaleString()}</span>
        </div>
      )}

      {machines.map(m => {
        const stat = machineStats[m.machine_id]
        const done = stat?.inputCount || 0
        const total = stat?.totalBooths || Number(m.booth_count)
        const allDone = done >= total
        const diff = stat?.totalDiff || 0
        const sales = stat?.totalSales || 0

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
                  style={{background: allDone ? '#e6f4ea' : '#e8f0fe', color: allDone ? '#137333' : '#1a73e8'}}>
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

// 全履歴取得（sheetsから直接）
async function getAllReadings(boothId) {
  const { getToken } = await import('../services/sheets')
  const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('meter_readings!A2:N')}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  )
  const data = await res.json()
  const rows = data.values || []
  return rows
    .filter(r => String(r[1]) === String(boothId))
    .map(r => ({ in_meter: r[4], out_meter: r[5], read_time: r[3] }))
}
