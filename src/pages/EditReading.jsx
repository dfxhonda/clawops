cat > src/pages/EditReading.jsx << 'EOF'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getReadingsByBooth, updateReading, getToken } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

export default function EditReading() {
  const { boothId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [readings, setReadings] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadReadings() }, [])

  async function loadReadings() {
    setLoading(true)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('meter_readings!A2:N')}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    )
    const data = await res.json()
    const rows = (data.values||[])
      .map((r, i) => ({
        rowIndex: i+2, reading_id:r[0], booth_id:r[1],
        full_booth_code:r[2], read_time:r[3]?.slice(0,10),
        in_meter:r[4]||'', out_meter:r[5]||'',
        prize_restock_count:r[6]||'', prize_stock_count:r[7]||'',
        prize_name:r[8]||''
      }))
      .filter(r => String(r.booth_id) === String(boothId))
      .reverse()
    setReadings(rows)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    await updateReading(editing.rowIndex, {
      in_meter: editing.in_meter,
      out_meter: editing.out_meter,
      prize_restock_count: editing.prize_restock_count,
      prize_stock_count: editing.prize_stock_count,
      prize_name: editing.prize_name
    })
    setEditing(null)
    await loadReadings()
    setSaving(false)
  }

  if (loading) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>読み込み中...</div>

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div>
          <h2>データ修正</h2>
          <p style={{fontSize:12,color:'#666'}}>{readings[0]?.full_booth_code}</p>
        </div>
      </div>
      {readings.length === 0 && (
        <div className="card" style={{textAlign:'center',color:'#666'}}>データがありません</div>
      )}
      {readings.map(r => (
        <div key={r.reading_id} className="card">
          {editing?.rowIndex === r.rowIndex ? (
            <div>
              <div style={{fontSize:13,color:'#666',marginBottom:12,fontWeight:'bold'}}>{r.read_time}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div>
                  <div className="label">INメーター</div>
                  <input className="input" type="number"
                    value={editing.in_meter}
                    onChange={e => setEditing({...editing, in_meter: e.target.value})} />
                </div>
                <div>
                  <div className="label">OUTメーター</div>
                  <input className="input" type="number"
                    value={editing.out_meter}
                    onChange={e => setEditing({...editing, out_meter: e.target.value})} />
                </div>
                <div>
                  <div className="label">景品補充数</div>
                  <input className="input" type="number"
                    value={editing.prize_restock_count}
                    onChange={e => setEditing({...editing, prize_restock_count: e.target.value})} />
                </div>
                <div>
                  <div className="label">景品投入残</div>
                  <input className="input" type="number"
                    value={editing.prize_stock_count}
                    onChange={e => setEditing({...editing, prize_stock_count: e.target.value})} />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="label">景品名</div>
                <input className="input" type="text" style={{textAlign:'left'}}
                  value={editing.prize_name}
                  onChange={e => setEditing({...editing, prize_name: e.target.value})} />
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '✅ 保存'}
                </button>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setEditing(null)}>
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}
              onClick={() => setEditing({...r})}>
              <div>
                <div style={{fontSize:12,color:'#999',marginBottom:2}}>{r.read_time}</div>
                <div style={{fontWeight:'bold'}}>IN: {Number(r.in_meter).toLocaleString()}</div>
                {r.out_meter && <div style={{fontSize:13,color:'#666'}}>OUT: {Number(r.out_meter).toLocaleString()}</div>}
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
EOF