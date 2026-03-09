cat > src/pages/DraftList.jsx << 'EOF'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveReading } from '../services/sheets'

const DRAFT_KEY = 'clawops_drafts'

export function getDrafts() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '[]') } catch { return [] }
}
export function saveDraft(draft) {
  const drafts = getDrafts()
  const idx = drafts.findIndex(d => d.booth_id === draft.booth_id)
  if (idx >= 0) drafts[idx] = { ...drafts[idx], ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}
export function clearDrafts() {
  sessionStorage.removeItem(DRAFT_KEY)
}
export function getDraftCount() {
  return getDrafts().length
}

export default function DraftList() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDrafts(getDrafts())
  }, [])

  function handleEdit(draft) {
    setEditing({ ...draft })
  }

  function handleEditSave() {
    saveDraft(editing)
    setDrafts(getDrafts())
    setEditing(null)
  }

  function handleDelete(booth_id) {
    const updated = getDrafts().filter(d => d.booth_id !== booth_id)
    sessionStorage.setItem('clawops_drafts', JSON.stringify(updated))
    setDrafts(updated)
  }

  async function handleSaveAll() {
    if (!drafts.length) return
    setSaving(true)
    try {
      for (const d of drafts) {
        await saveReading(d)
      }
      clearDrafts()
      setDrafts([])
      setSaved(true)
    } catch(e) {
      alert('保存エラー: ' + e.message)
    }
    setSaving(false)
  }

  if (saved) return (
    <div className="container" style={{paddingTop:80,textAlign:'center'}}>
      <div style={{fontSize:64,marginBottom:16}}>✅</div>
      <h2 style={{fontSize:24,fontWeight:'bold',marginBottom:8}}>一括保存完了！</h2>
      <p style={{color:'#666',marginBottom:32}}>{drafts.length}件のデータを保存しました</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>トップに戻る</button>
    </div>
  )

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div style={{flex:1}}>
          <h2>下書き一覧</h2>
          <p style={{fontSize:13,color:'#666'}}>{drafts.length}件の未保存データ</p>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="card" style={{textAlign:'center',color:'#666',padding:32}}>
          <div style={{fontSize:32,marginBottom:8}}>📝</div>
          <p>下書きデータがありません</p>
          <p style={{fontSize:12,marginTop:4}}>巡回入力モードで入力すると<br/>ここに下書きが溜まります</p>
        </div>
      ) : (
        <>
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}
            style={{marginBottom:16}}>
            {saving ? '保存中...' : `✅ ${drafts.length}件を一括保存`}
          </button>

          {editing ? (
            <div className="card" style={{border:'2px solid #1a73e8'}}>
              <div style={{fontWeight:'bold',marginBottom:12}}>{editing.full_booth_code} を編集</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div>
                  <div className="label">INメーター</div>
                  <input className="input" type="number" value={editing.in_meter||''}
                    onChange={e => setEditing({...editing, in_meter:e.target.value})} />
                </div>
                <div>
                  <div className="label">OUTメーター</div>
                  <input className="input" type="number" value={editing.out_meter||''}
                    onChange={e => setEditing({...editing, out_meter:e.target.value})} />
                </div>
                <div>
                  <div className="label">景品補充数</div>
                  <input className="input" type="number" value={editing.prize_restock_count||''}
                    onChange={e => setEditing({...editing, prize_restock_count:e.target.value})} />
                </div>
                <div>
                  <div className="label">景品投入残</div>
                  <input className="input" type="number" value={editing.prize_stock_count||''}
                    onChange={e => setEditing({...editing, prize_stock_count:e.target.value})} />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="label">景品名</div>
                <input className="input" type="text" style={{textAlign:'left'}}
                  value={editing.prize_name||''}
                  onChange={e => setEditing({...editing, prize_name:e.target.value})} />
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleEditSave}>保存</button>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setEditing(null)}>キャンセル</button>
              </div>
            </div>
          ) : null}

          {drafts.map(d => (
            <div key={d.booth_id} className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{flex:1}} onClick={() => handleEdit(d)}>
                  <div style={{fontWeight:'bold',fontSize:15}}>{d.full_booth_code}</div>
                  <div style={{fontSize:13,color:'#333',marginTop:4}}>
                    IN: <strong>{Number(d.in_meter).toLocaleString()}</strong>
                    {d.out_meter ? `　OUT: ${Number(d.out_meter).toLocaleString()}` : ''}
                  </div>
                  {d.prize_name && <div style={{fontSize:12,color:'#666',marginTop:2}}>景品: {d.prize_name}</div>}
                  <div style={{fontSize:11,color:'#999',marginTop:2}}>{d.updated_at?.slice(0,16).replace('T',' ')}</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button onClick={() => handleEdit(d)}
                    style={{background:'none',border:'none',fontSize:18,cursor:'pointer'}}>✏️</button>
                  <button onClick={() => handleDelete(d.booth_id)}
                    style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#ea4335'}}>🗑️</button>
                </div>
              </div>
            </div>
          ))}

          <button className="btn btn-secondary" onClick={() => { clearDrafts(); setDrafts([]) }}
            style={{marginTop:8,color:'#ea4335'}}>
            🗑️ 全下書きを削除
          </button>
        </>
      )}
    </div>
  )
}
EOF