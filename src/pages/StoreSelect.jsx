import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStores, getMachines, clearToken } from '../services/sheets'

export default function StoreSelect() {
  const [stores, setStores] = useState([])
  const [boothCounts, setBoothCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getStores().then(async s => {
      setStores(s)
      const counts = {}
      for (const store of s) {
        const machines = await getMachines(store.store_id)
        counts[store.store_id] = machines.reduce((sum, m) => sum + Number(m.booth_count), 0)
      }
      setBoothCounts(counts)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const icons = { KIK01:'🏪', KOS01:'🏬', MNK01:'🎯' }

  if (loading) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>読み込み中...</div>
  if (error) return (
    <div className="container" style={{paddingTop:40}}>
      <div className="card">
        <p style={{color:'#ea4335'}}>エラー: {error}</p>
        <button className="btn btn-secondary" style={{marginTop:12}}
          onClick={() => { clearToken(); navigate('/login') }}>ログインし直す</button>
      </div>
    </div>
  )

  return (
    <div className="container" style={{paddingTop:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:'bold'}}>店舗を選択</h1>
          <p style={{fontSize:13,color:'#666',marginTop:2}}>{new Date().toLocaleDateString('ja-JP')} の巡回</p>
        </div>
        <button onClick={() => { clearToken(); navigate('/login') }}
          style={{background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:13}}>
          ログアウト
        </button>
      </div>
      {stores.map(store => (
        <button key={store.store_id} className="store-btn"
          onClick={() => navigate(`/machines/${store.store_id}`)}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:32}}>{icons[store.store_code]||'🏪'}</span>
            <div>
              <h3>{store.store_name}</h3>
              <p>{store.store_code} · {boothCounts[store.store_id]||'?'}ブース</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
