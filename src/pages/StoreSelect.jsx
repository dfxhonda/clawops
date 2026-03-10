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
  ]

  function handleStoreClick(store) {
    if (mode === 'input')   navigate(`/machines/${store.store_id}`, { state: { storeName: store.store_name, storeId: store.store_id } })
    if (mode === 'ranking') navigate(`/ranking/${store.store_id}`, { state: { storeName: store.store_name } })
  }

  if (loading) return (
    <div style={{paddingTop:80, textAlign:'center', color:'var(--text)'}}>読み込み中...</div>
  )
  if (error) return (
    <div style={{padding:24}}>
      <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14}}>
        <p style={{color:'var(--accent2)'}}>エラー: {error}</p>
        <button style={{marginTop:12, background:'var(--surface2)', border:'1px solid var(--border)',
          color:'var(--text)', borderRadius:8, padding:'8px 14px', cursor:'pointer'}}
          onClick={() => { clearToken(); navigate('/login') }}>ログインし直す</button>
      </div>
    </div>
  )

  return (
    <div style={{padding:'24px 14px 40px', minHeight:'100vh'}}>

      {/* ヘッダー */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <div>
          <div style={{fontSize:24, fontWeight:'bold', color:'var(--accent)',
            letterSpacing:2, fontFamily:'var(--fd)'}}>CLAWOPS</div>
          <div style={{fontSize:12, color:'var(--muted)', marginTop:2}}>
            {new Date().toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short'})}
          </div>
        </div>
        <button style={{background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13}}
          onClick={() => { clearToken(); navigate('/login') }}>
          ログアウト
        </button>
      </div>

      {/* モード選択：巡回・ランキング */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
        {modes.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{
              padding:'14px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
              border: mode === m.key ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: mode === m.key ? 'var(--surface3)' : 'var(--surface)',
              boxShadow: mode === m.key ? '0 0 0 1px var(--accent), inset 0 0 12px rgba(240,192,64,0.08)' : 'none',
              transition:'all .2s'
            }}>
            <div style={{fontSize:26, filter: mode === m.key ? 'none' : 'grayscale(0.4) opacity(0.7)'}}>{m.icon}</div>
            <div style={{
              fontSize:12, fontWeight:'bold', marginTop:6,
              color: mode === m.key ? 'var(--accent)' : 'var(--muted)',
              letterSpacing: mode === m.key ? '0.5px' : '0'
            }}>{m.label}</div>
            {mode === m.key && <div style={{width:20,height:2,background:'var(--accent)',borderRadius:2,margin:'6px auto 0'}} />}
          </button>
        ))}
      </div>

      {/* データ検索・修正ボタン（独立） */}
      <button onClick={() => navigate('/datasearch')}
        style={{
          width:'100%', marginBottom:24, padding:'12px 8px',
          borderRadius:12, border:'1px solid var(--border)',
          background:'var(--surface)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          transition:'all .15s'
        }}>
        <span style={{fontSize:18}}>🔍</span>
        <span style={{fontSize:12, fontWeight:'bold', color:'var(--accent4)'}}>データ検索・修正</span>
      </button>

      {/* 店舗選択 */}
      <div style={{fontSize:11, color:'var(--muted)', textTransform:'uppercase',
        letterSpacing:1, marginBottom:8}}>店舗を選択</div>
      {stores.map(store => (
        <button key={store.store_id}
          style={{
            width:'100%', marginBottom:10, background:'var(--surface)',
            border:'1px solid var(--border)', borderRadius:12, padding:14,
            cursor:'pointer', textAlign:'left'
          }}
          onClick={() => handleStoreClick(store)}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <span style={{fontSize:36}}>{icons[store.store_code]||'🏪'}</span>
            <div>
              <div style={{fontSize:16, fontWeight:'bold', color:'var(--text)'}}>{store.store_name}</div>
              <div style={{fontSize:12, color:'var(--muted)', marginTop:2}}>
                {store.store_code} · {boothCounts[store.store_id]||'?'}ブース
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
