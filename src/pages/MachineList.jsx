import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMachines, getStores } from '../services/sheets'

const typeLabel = {
  BUZZ_CRANE_4:'BUZZ CRANE 4', BUZZ_CRANE_SLIM:'BUZZスリム',
  BUZZ_CRANE_MINI:'BUZZミニ', SESAME_W:'セサミW'
}

export default function MachineList() {
  const { storeId } = useParams()
  const [machines, setMachines] = useState([])
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getMachines(storeId), getStores()]).then(([m, s]) => {
      setMachines(m)
      const store = s.find(x => x.store_id == storeId)
      if (store) setStoreName(store.store_name)
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
      {machines.map(m => (
        <div key={m.machine_id} className="machine-item"
          onClick={() => navigate(`/booth/${m.machine_id}`, { state: { storeName, storeId } })}>
          <div>
            <div style={{fontWeight:'bold',fontSize:16}}>{m.machine_name}</div>
            <div style={{fontSize:13,color:'#666',marginTop:4}}>{typeLabel[m.machine_type]||m.machine_type}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
            <span className="badge">{m.booth_count}ブース</span>
            <span style={{fontSize:12,color:'#999'}}>{m.machine_code}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
