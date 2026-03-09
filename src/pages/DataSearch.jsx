import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllMeterReadings, getStores, parseNum, getToken, clearCache } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

export default function DataSearch() {
  const navigate = useNavigate()
  const [allReadings, setAllReadings] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterBooth, setFilterBooth] = useState('')
  const [filterPrize, setFilterPrize] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [edits, setEdits] = useState({})
  const [editingRow, setEditingRow] = useState(null)

  useEffect(() => {
    Promise.all([getAllMeterReadings(true), getStores()]).then(([readings, storeList]) => {
      setAllReadings(readings)
      setStores(storeList)
      setLoading(false)
    })
  }, [])

  const filtered = allReadings
    .map((r, i) => ({ ...r, _idx: i }))
    .filter(r => {
      if (filterStore && !r.full_booth_code?.startsWith(filterStore)) return false
      if (filterBooth && !r.full_booth_code?.toLowerCase().includes(filterBooth.toLowerCase())) return false
      if (filterPrize && !r.prize_name?.toLowerCase().includes(filterPrize.toLowerCase())) return false
      if (filterDateFrom && r.read_time?.slice(0,10) < filterDateFrom) return false
      if (filterDateTo && r.read_time?.slice(0,10) > filterDateTo) return false
      return true
    })
    .slice(-300)

  function startEdit(r) {
    setEditingRow(r._idx)
    if (!edits[r._idx]) {
      setEdits(prev => ({ ...prev, [r._idx]: {
        in_meter: r.in_meter || '',
        out_meter: r.out_meter || '',
        prize_restock_count: r.prize_restock_count || '',
        prize_stock_count: r.prize_stock_count || '',
        prize_name: r.prize_name || '',
        _original: r
      }}))
    }
  }

  function updateEdit(idx, key, val) {
    setEdits(prev => ({ ...prev, [idx]: { ...prev[idx], [key]: val } }))
  }

  function cancelEdit(idx) {
    setEdits(prev => { const n = {...prev}; delete n[idx]; return n })
    setEditingRow(null)
  }

  async function saveAll() {
    const entries = Object.entries(edits)
    if (!entries.length) return
    setSaving(true)
    setSaveMsg('')
    try {
      for (const [idxStr, edit] of entries) {
        const idx = Number(idxStr)
        const orig = edit._original
        const rowIndex = idx + 2
        const range = `meter_readings!E${rowIndex}:I${rowIndex}`
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          { method: 'PUT',
            headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[
              edit.in_meter !== '' ? edit.in_meter : orig.in_meter,
              edit.out_meter !== '' ? edit.out_meter : orig.out_meter,
              edit.prize_restock_count !== '' ? edit.prize_restock_count : orig.prize_restock_count,
              edit.prize_stock_count !== '' ? edit.prize_stock_count : orig.prize_stock_count,
              edit.prize_name !== '' ? edit.prize_name : orig.prize_name,
            ]]})
          }
        )
      }
      clearCache()
      const fresh = await getAllMeterReadings(true)
      setAllReadings(fresh)
      setEdits({})
      setEditingRow(null)
      setSaveMsg(`✅ ${entries.length}件保存しました`)
    } catch(e) {
      setSaveMsg('❌ 保存エラー: ' + e.message)
    }
    setSaving(false)
  }

  const editCount = Object.keys(edits).length

  if (loading) return (
    <div className="container" style={{paddingTop:80,textAlign:'center'}}>
      <p>読み込み中...</p>
      <p style={{fontSize:12,color:'#999',marginTop:8}}>全データを取得しています</p>
    </div>
  )

  return (
    <div className="container" style={{paddingTop:16,paddingBottom:100}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div style={{flex:1}}>
          <h2>データ検索・修正</h2>
          <p style={{fontSize:12,color:'#666'}}>全{allReadings.length}件</p>
        </div>
      </div>

      {saveMsg && (
        <div style={{background: saveMsg.startsWith('✅') ? '#e6f4ea':'#fce8e6',
          borderRadius:8,padding:10,marginBottom:12,
          color: saveMsg.startsWith('✅') ? '#137333':'#c5221f',fontSize:13}}>
          {saveMsg}
        </div>
      )}

      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div>
            <div className="label">店舗</div>
            <select className="input" style={{textAlign:'left'}}
              value={filterStore} onChange={e => setFilterStore(e.target.value)}>
              <option value="">全店舗</option>
              {stores.map(s => (
                <option key={s.store_id} value={s.store_code}>{s.store_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label">ブースコード</div>
            <input className="input" type="text" style={{textAlign:'left'}}
              placeholder="例: M01-B01"
              value={filterBooth} onChange={e => setFilterBooth(e.target.value)} />
          </div>
          <div>
            <div className="label">日付（から）</div>
            <input className="input" type="date" style={{textAlign:'left'}}
              value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div>
            <div className="label">日付（まで）</div>
            <input className="input" type="date" style={{textAlign:'left'}}
              value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
        </div>
        <div style={{marginTop:8}}>
          <div className="label">景品名</div>
          <input className="input" type="text" style={{textAlign:'left'}}
            placeholder="景品名で検索"
            value={filterPrize} onChange={e => setFilterPrize(e.target.value)} />
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <span style={{fontSize:12,color:'#666'}}>{filtered.length}件表示</span>
          <button className="btn btn-secondary" style={{fontSize:12,padding:'4px 10px'}}
            onClick={() => {
              setFilterStore(''); setFilterBooth('')
              setFilterPrize(''); setFilterDateFrom(''); setFilterDateTo('')
            }}>リセット</button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{textAlign:'center',color:'#666',padding:32}}>
          条件に一致するデータがありません
        </div>
      )}

      {filtered.map(r => {
        const isEditing = editingRow === r._idx
        const edit = edits[r._idx]
        const isModified = !!edit
        return (
          <div key={r._idx} className="card" style={{marginBottom:8,
            borderLeft:`4px solid ${isModified?'#1a73e8':'transparent'}`}}>
            {isEditing ? (
              <div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:'bold',fontSize:14}}>{r.full_booth_code}</div>
                    <div style={{fontSize:11,color:'#999'}}>{r.read_time?.slice(0,10)}</div>
                  </div>
                  <span style={{fontSize:11,color:'#1a73e8',background:'#e8f0fe',
                    padding:'2px 8px',borderRadius:10,height:'fit-content'}}>編集中</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <div>
                    <div className="label">INメーター</div>
                    <input className="input" type="number"
                      value={edit?.in_meter||''} placeholder={r.in_meter}
                      onChange={e => updateEdit(r._idx,'in_meter',e.target.value)} />
                  </div>
                  <div>
                    <div className="label">OUTメーター</div>
                    <input className="input" type="number"
                      value={edit?.out_meter||''} placeholder={r.out_meter}
                      onChange={e => updateEdit(r._idx,'out_meter',e.target.value)} />
                  </div>
                  <div>
                    <div className="label">景品補充数</div>
                    <input className="input" type="number"
                      value={edit?.prize_restock_count||''} placeholder={r.prize_restock_count||'0'}
                      onChange={e => updateEdit(r._idx,'prize_restock_count',e.target.value)} />
                  </div>
                  <div>
                    <div className="label">景品投入残</div>
                    <input className="input" type="number"
                      value={edit?.prize_stock_count||''} placeholder={r.prize_stock_count||'0'}
                      onChange={e => updateEdit(r._idx,'prize_stock_count',e.target.value)} />
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <div className="label">景品名</div>
                  <input className="input" type="text" style={{textAlign:'left'}}
                    value={edit?.prize_name||''} placeholder={r.prize_name}
                    onChange={e => updateEdit(r._idx,'prize_name',e.target.value)} />
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-secondary" style={{flex:1,fontSize:13}}
                    onClick={() => setEditingRow(null)}>✓ 完了</button>
                  <button className="btn btn-secondary"
                    style={{flex:1,fontSize:13,color:'#ea4335'}}
                    onClick={() => cancelEdit(r._idx)}>取消</button>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}
                onClick={() => startEdit(r)}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{fontWeight:'bold',fontSize:14}}>{r.full_booth_code}</div>
                    {isModified && <span style={{fontSize:10,color:'#1a73e8',
                      background:'#e8f0fe',padding:'1px 6px',borderRadius:8}}>変更済</span>}
                  </div>
                  <div style={{fontSize:12,color:'#666',marginTop:2}}>
                    {r.read_time?.slice(0,10)} · IN: {parseNum(r.in_meter).toLocaleString()}
                    {r.out_meter?` · OUT: ${parseNum(r.out_meter).toLocaleString()}`:''}
                  </div>
                  <div style={{fontSize:12,color:'#999',marginTop:1}}>{r.prize_name||'景品名なし'}</div>
                </div>
                <div style={{color:'#1a73e8',fontSize:18}}>✏️</div>
              </div>
            )}
          </div>
        )
      })}

      {editCount > 0 && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'12px 16px',
          background:'white',borderTop:'1px solid #e0e0e0',zIndex:100}}>
          <button className="btn btn-primary" style={{width:'100%'}}
            onClick={saveAll} disabled={saving}>
            {saving?'保存中...':`💾 ${editCount}件をまとめて保存`}
          </button>
        </div>
      )}
    </div>
  )
}
