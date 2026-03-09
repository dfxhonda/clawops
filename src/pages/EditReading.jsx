import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getToken } from '../services/sheets'

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
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('meter_readings!A2:N')}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    )
    const data = await res.json()
    const rows = (data.values||[])
      .map((r, i) => ({ rowIndex: i+2, reading_id:r[0], booth_id:r[1],
        full_booth_code:r[2], read_time:r[3], in_meter:r[4], out_meter:r[5],
        prize_restock:r[6], prize_stock:r[7], prize_name:r[8] }))
      .filter(r => String(r.booth_id) === String(boothId))
      .reverse()
    setReadings(rows)
    setLoading(false)
  }

  async function handleSave(row) {
    setSaving(true)
    const range = `meter_readings!E${row.rowIndex}:I${row.rowIndex}`
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[row.in_meter, row.out_meter, row.prize_restock, row.prize_stock, row.prize_name]] }) }
    )
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
      {readings.map(r => (
        <div key={r.reading_id} className="card">
          {editing?.rowIndex === r.rowIndex ? (
            <div>
              <div style={{fontSize:13,color:'#666',marginBottom:8}}>{r.read_time?.slice(0,10)}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div>
                  <div className="label">INメーター</div>
                  <input className="input" type="number" value={editing.in_meter||''}
                    onChange={e => setEditing({...editing, in_meter: e.target.value})} />
                </div>
                <div>
                  <div className="label">OUTメーター</div>
                  <input className="input" type="number" value={editing.out_meter||''}
                    onChange={e => setEditing({...editing, out_meter: e.target.value})} />
                </div>
              </div>
              <div className="label">景品名</div>
              <input className="input" type="text" style={{textAlign:'left',marginBottom:8}}
                value={editing.prize_name||''}
                onChange={e => setEditing({...editing, prize_name: e.target.value})} />
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={() => handleSave(editing)} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
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
                <div style={{fontSize:13,color:'#666'}}>{r.read_time?.slice(0,10)}</div>
                <div style={{fontWeight:'bold'}}>IN: {Number(r.in_meter).toLocaleString()}</div>
                <div style={{fontSize:13,color:'#666'}}>{r.prize_name||'-'}</div>
              </div>
              <div style={{color:'#1a73e8',fontSize:13}}>✏️ 編集</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
