import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getToken, parseNum } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

export default function EditReading() {
  const { boothId } = useParams()
  const navigate = useNavigate()
  const [readings, setReadings] = useState([])
  const [editing, setEditing] = useState(null)
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
    if (allRows.length === 0) { setLoading(false); return }

    const header = allRows[0].map(h => String(h).trim().toLowerCase())
    const idx = name => header.indexOf(name)
    const iBoothId = idx('booth_id')
    const iFullCode = idx('full_booth_code')
    const iReadTime = idx('read_time')
    const iInMeter = idx('in_meter')
    const iOutMeter = idx('out_meter')
    const iRestock = idx('prize_restock_count')
    const iStock = idx('prize_stock_count')
    const iPrizeName = idx('prize_name')

    const rows = allRows.slice(1)
      .map((r, i) => ({
        rowIndex: i + 2,
        booth_id: r[iBoothId] || '',
        full_booth_code: r[iFullCode] || '',
        read_time: (r[iReadTime] || '').slice(0, 10),
        in_meter: r[iInMeter] || '',
        out_meter: r[iOutMeter] || '',
        prize_restock_count: r[iRestock] || '',
        prize_stock_count: r[iStock] || '',
        prize_name: r[iPrizeName] || ''
      }))
      .filter(r => String(r.booth_id) === String(boothId))
      .reverse()

    setReadings(rows)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const range = `meter_readings!E${editing.rowIndex}:I${editing.rowIndex}`
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[
          editing.in_meter, editing.out_meter,
          editing.prize_restock_count, editing.prize_stock_count, editing.prize_name
        ]] })
      }
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

      {readings.length === 0 && (
        <div className="card" style={{textAlign:'center',color:'#666'}}>データがありません</div>
      )}

      {readings.map(r => (
        <div key={r.rowIndex} className="card">
          {editing?.rowIndex === r.rowIndex ? (
            <div>
              <div style={{fontSize:13,color:'#666',marginBottom:12,fontWeight:'bold'}}>{r.read_time}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div>
                  <div className="label">INメーター</div>
                  <input className="input" type="number" value={editing.in_meter}
                    onChange={e => setEditing({...editing, in_meter:e.target.value})} />
                </div>
                <div>
                  <div className="label">OUTメーター</div>
                  <input className="input" type="number" value={editing.out_meter}
                    onChange={e => setEditing({...editing, out_meter:e.target.value})} />
                </div>
                <div>
                  <div className="label">景品補充数</div>
                  <input className="input" type="number" value={editing.prize_restock_count}
                    onChange={e => setEditing({...editing, prize_restock_count:e.target.value})} />
                </div>
                <div>
                  <div className="label">景品投入残</div>
                  <input className="input" type="number" value={editing.prize_stock_count}
                    onChange={e => setEditing({...editing, prize_stock_count:e.target.value})} />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="label">景品名</div>
                <input className="input" type="text" style={{textAlign:'left'}} value={editing.prize_name}
                  onChange={e => setEditing({...editing, prize_name:e.target.value})} />
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
