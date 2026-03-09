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
  const modes = [
    { key:'input',   icon:'📝', label:'巡回入力' },
    { key:'ranking', icon:'📊', label:'ランキング' },
    { key:'edit',    icon:'✏️', label:'データ修正' },
  ]

  if (loading) return <div style={{paddingTop:40,textAlign:'center',color:'var(--text)'}}>読み込み中...</div>
  if (error) return (
    <div style={{padding:24}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:14}}>
        <p style={{color:'var(--accent2)'}}>エラー: {error}</p>
        <button style={{marginTop:12,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'8px 14px',cursor:'pointer'}}
          onClick={() => { clearToken(); navigate('/login') }}>ログインし直す</button>
      </div>
    </div>
  )

  return (
    <div style={{padding:'24px 14px 40px'}}>
      {/* ヘッダー */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:'bold',color:'var(--text)'}}>ClawOps</h1>
          <p style={{fontSize:13,color:'var(--muted)',marginTop:2}}>{new Date().toLocaleDateString('ja-JP')}</p>
        </div>
        <button onClick={() => { clearToken(); navigate('/login') }}
          style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:13}}>
          ログアウト
        </button>
      </div>

      {/* モード選択 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
        {modes.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{padding:'10px 4px',borderRadius:10,border:'2px solid',
              borderColor: mode===m.key ? 'var(--accent)' : 'var(--border)',
              background: mode===m.key ? 'var(--surface2)' : 'var(--surface)',
              cursor:'pointer',textAlign:'center'}}>
            <div style={{fontSize:20}}>{m.icon}</div>
            <div style={{fontSize:11,fontWeight:'bold',
              color: mode===m.key ? 'var(--accent)' : 'var(--muted)',marginTop:4}}>
              {m.label}
            </div>
          </button>
        ))}
      </div>

      {/* データ検索ボタン（独立） */}
      <button onClick={() => navigate('/datasearch')}
        style={{width:'100%',marginBottom:20,padding:'10px',borderRadius:10,
          border:'2px solid var(--border)',background:'var(--surface)',
          cursor:'pointer',textAlign:'center',display:'flex',
          alignItems:'center',justifyContent:'center',gap:8}}>
        <span style={{fontSize:18}}>🔍</span>
        <span style={{fontSize:13,fontWeight:'bold',color:'var(--accent4)'}}>データ検索・修正</span>
      </button>

      {/* 店舗選択 */}
      <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>店舗を選択</p>
      {stores.map(store => (
        <button key={store.store_id}
          onClick={() => {
            if (mode==='input')   navigate(`/machines/${store.store_id}`, { state: { storeName: store.store_name, storeId: store.store_id } })
            if (mode==='ranking') navigate(`/ranking/${store.store_id}`, { state: { storeName: store.store_name } })
            if (mode==='edit')    navigate(`/machines/${store.store_id}`, { state: { storeName: store.store_name, storeId: store.store_id, editMode: true } })
          }}
          style={{width:'100%',marginBottom:10,background:'var(--surface)',
            border:'1px solid var(--border)',borderRadius:12,padding:14,
            cursor:'pointer',textAlign:'left'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:32}}>{icons[store.store_code]||'🏪'}</span>
            <div>
              <h3 style={{fontSize:16,fontWeight:'bold',color:'var(--text)'}}>{store.store_name}</h3>
              <p style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{store.store_code} · {boothCounts[store.store_id]||'?'}ブース</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
