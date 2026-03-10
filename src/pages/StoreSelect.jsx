import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStores, getMachines, clearToken } from '../services/sheets'

const S = {
  page: { padding:'24px 14px 40px', minHeight:'100vh', background:'var(--bg)' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 },
  title: { fontSize:24, fontWeight:'bold', color:'var(--accent)', letterSpacing:2, fontFamily:'var(--fd)' },
  date: { fontSize:12, color:'var(--muted)', marginTop:2 },
  logoutBtn: { background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13 },
  modeGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 },
  modeBtn: (active) => ({
    padding:'14px 8px', borderRadius:12, border:'2px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background: active ? 'var(--surface2)' : 'var(--surface)',
    cursor:'pointer', textAlign:'center', transition:'all .15s'
  }),
  modeIcon: { fontSize:24 },
  modeLabel: (active) => ({
    fontSize:12, fontWeight:'bold', marginTop:6,
    color: active ? 'var(--accent)' : 'var(--muted)'
  }),
  sectionLabel: { fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 },
  storeBtn: {
    width:'100%', marginBottom:10, background:'var(--surface)',
    border:'1px solid var(--border)', borderRadius:12, padding:14,
    cursor:'pointer', textAlign:'left', transition:'opacity .15s'
  },
  storeInner: { display:'flex', alignItems:'center', gap:12 },
  storeName: { fontSize:16, fontWeight:'bold', color:'var(--text)' },
  storeSub: { fontSize:12, color:'var(--muted)', marginTop:2 },
}

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
    { key:'search',  icon:'🔍', label:'データ検索・修正' },
    { key:'ranking', icon:'📊', label:'ランキング' },
  ]

  function handleModeClick(key) {
    if (key === 'search') {
      navigate('/datasearch')
      return
    }
    setMode(key)
  }

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

  const needsStore = mode === 'input' || mode === 'ranking'

  return (
    <div style={S.page}>
      {/* ヘッダー */}
      <div style={S.header}>
        <div>
          <div style={S.title}>CLAWOPS</div>
          <div style={S.date}>{new Date().toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short'})}</div>
        </div>
        <button style={S.logoutBtn} onClick={() => { clearToken(); navigate('/login') }}>
          ログアウト
        </button>
      </div>

      {/* モード選択 */}
      <div style={S.modeGrid}>
        {modes.map(m => (
          <button key={m.key}
            onClick={() => handleModeClick(m.key)}
            style={{
              ...S.modeBtn(mode === m.key && m.key !== 'search'),
              gridColumn: m.key === 'ranking' ? 'span 2' : 'span 1'
            }}>
            <div style={S.modeIcon}>{m.icon}</div>
            <div style={S.modeLabel(mode === m.key && m.key !== 'search')}>{m.label}</div>
          </button>
        ))}
      </div>

      {/* 店舗選択（巡回・ランキング時のみ） */}
      {needsStore && (
        <>
          <div style={S.sectionLabel}>店舗を選択</div>
          {stores.map(store => (
            <button key={store.store_id} style={S.storeBtn}
              onClick={() => handleStoreClick(store)}>
              <div style={S.storeInner}>
                <span style={{fontSize:36}}>{icons[store.store_code]||'🏪'}</span>
                <div>
                  <div style={S.storeName}>{store.store_name}</div>
                  <div style={S.storeSub}>{store.store_code} · {boothCounts[store.store_id]||'?'}ブース</div>
                </div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
