import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getToken, parseNum } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

export default function EditReading() {
  const { boothId } = useParams()
  const navigate = useNavigate()
  const [readings, setReadings] = useState([])
  const [editing, setEditing] = useState(null)
  const [original, setOriginal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadReadings() }, [])

  async function loadReadings() {
    setLoading(true)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('meter_readings!A1:P')}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    )
    const data = await res.json()
    const allRows = data.values || []
    if (!allRows.length) { setLoading(false); return }
    const header = allRows[0].map(h => String(h).trim().toLowerCase())
    const idx = name => header.indexOf(name)
    const rows = allRows.slice(1).map((r,i) => ({
      rowIndex: i+2,
      booth_id: r[idx('booth_id')]||'',
      full_booth_code: r[idx('full_booth_code')]||'',
      read_time: (r[idx('read_time')]||'').slice(0,10),
      in_meter: r[idx('in_meter')]||'',
      out_meter: r[idx('out_meter')]||'',
      prize_restock_count: r[idx('prize_restock_count')]||'',
      prize_stock_count: r[idx('prize_stock_count')]||'',
      prize_name: r[idx('prize_name')]||''
    })).filter(r => String(r.booth_id) === String(boothId)).reverse()
    setReadings(rows)
    setLoading(false)
  }

  function startEdit(r) {
    setOriginal({...r})
    setEditing({...r})
  }

  async function handleSave() {
    setSaving(true)
    // 空欄の場合は元の値を使う（上書きしない）
    const val = (key) => editing[key] !== '' ? editing[key] : original[key]
    const range = `meter_readings!E${editing.rowIndex}:I${editing.rowIndex}`
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { method:'PUT', headers:{ Authorization:`Bearer ${getToken()}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ values:[[
          val('in_meter'), val('out_meter'),
          val('prize_restock_count'), val('prize_stock_count'), val('prize_name')
        ]]})
      }
    )
    setEditing(null)
    setOriginal(null)
    await loadReadings()
    setSaving(false)
  }

  if (loading) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>読み込み中...</div>

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div><h2>データ修正</h2><p style={{fontSize:12,color:'#666'}}>{readings[0]?.full_booth_code}</p></div>
      </div>

      {readings.length===0 && <div className="card" style={{textAlign:'center',color:'#666'}}>データがありません</div>}

      {readings.map(r => (
        <div key={r.rowIndex} className="card">
          {editing?.rowIndex===r.rowIndex ? (
            <div>
              <div style={{fontSize:13,color:'#666',marginBottom:12,fontWeight:'bold'}}>{r.read_time}</div>
              <div style={{background:'#e8f0fe',borderRadius:6,padding:'8px 10px',fontSize:12,color:'#1a73e8',marginBottom:12}}>
                💡 修正したい項目だけ入力。空欄のまま保存すると元の値が維持されます。
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div>
                  <div className="label">INメーター</div>
                  <input className="input" type="number"
                    placeholder={original?.in_meter||''}
                    value={editing.in_meter}
                    onChange={e => setEditing({...editing,in_meter:e.target.value})} />
                </div>
                <div>
                  <div className="label">OUTメーター</div>
                  <input className="input" type="number"
                    placeholder={original?.out_meter||''}
                    value={editing.out_meter}
                    onChange={e => setEditing({...editing,out_meter:e.target.value})} />
                </div>
                <div>
                  <div className="label">景品補充数</div>
                  <input className="input" type="number"
                    placeholder={original?.prize_restock_count||''}
                    value={editing.prize_restock_count}
                    onChange={e => setEditing({...editing,prize_restock_count:e.target.value})} />
                </div>
                <div>
                  <div className="label">景品投入残</div>
                  <input className="input" type="number"
                    placeholder={original?.prize_stock_count||''}
                    value={editing.prize_stock_count}
                    onChange={e => setEditing({...editing,prize_stock_count:e.target.value})} />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="label">景品名</div>
                <input className="input" type="text" style={{textAlign:'left'}}
                  placeholder={original?.prize_name||''}
                  value={editing.prize_name}
                  onChange={e => setEditing({...editing,prize_name:e.target.value})} />
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleSave} disabled={saving}>
                  {saving?'保存中...':'✅ 保存'}
                </button>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => { setEditing(null); setOriginal(null) }}>
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}} onClick={() => startEdit(r)}>
              <div>
                <div style={{fontSize:12,color:'#999',marginBottom:2}}>{r.read_time}</div>
                <div style={{fontWeight:'bold'}}>IN: {parseNum(r.in_meter).toLocaleString()}</div>
                {r.out_meter && <div style={{fontSize:13,color:'#666'}}>OUT: {parseNum(r.out_meter).toLocaleString()}</div>}
                <div style={{fontSize:13,color:'#666',marginTop:2}}>{r.prize_name||'景品名なし'}</div>
              </div>
              <div style={{color:'#1a73e8',fontSize:20}}>✏️</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
