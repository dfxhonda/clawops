import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStores, getMachines, clearToken } from '../services/sheets'

export default function StoreSelect() {
  const [stores, setStores] = useState([])
  const [boothCounts, setBoothCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('input')
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

  const modes = [
    { key: 'input', label: '📝 巡回入力', desc: 'メーター値を入力' },
    { key: 'ranking', label: '📊 売上ランキング', desc: 'TOP3 / WORST3' },
    { key: 'edit', label: '✏️ データ修正', desc: '入力済みデータの編集' },
  ]

  return (
    <div className="container" style={{paddingTop:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:'bold'}}>ClawOps</h1>
          <p style={{fontSize:13,color:'#666',marginTop:2}}>{new Date().toLocaleDateString('ja-JP')}</p>
        </div>
        <button onClick={() => { clearToken(); navigate('/login') }}
          style={{background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:13}}>
          ログアウト
        </button>
      </div>

      {/* モード選択 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20}}>
        {modes.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{padding:'10px 4px',borderRadius:10,border:'2px solid',
              borderColor: mode===m.key ? '#1a73e8' : '#e0e0e0',
              background: mode===m.key ? '#e8f0fe' : 'white',
              cursor:'pointer',textAlign:'center'}}>
            <div style={{fontSize:18}}>{m.label.split(' ')[0]}</div>
            <div style={{fontSize:11,fontWeight:'bold',color: mode===m.key ? '#1a73e8' : '#333',marginTop:4}}>
              {m.label.split(' ')[1]}
            </div>
          </button>
        ))}
      </div>

      {/* 店舗一覧 */}
      <p style={{fontSize:12,color:'#666',marginBottom:8}}>店舗を選択</p>
      {stores.map(store => (
        <button key={store.store_id} className="store-btn"
          onClick={() => {
            if (mode === 'input') navigate(`/machines/${store.store_id}`, { state: { storeName: store.store_name, storeId: store.store_id } })
            if (mode === 'ranking') navigate(`/ranking/${store.store_id}`, { state: { storeName: store.store_name } })
            if (mode === 'edit') navigate(`/machines/${store.store_id}`, { state: { storeName: store.store_name, storeId: store.store_id, editMode: true } })
          }}>
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
