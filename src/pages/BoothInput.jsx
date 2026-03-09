import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getBooths, getLastReading, getMachines, saveReading } from '../services/sheets'

export default function BoothInput() {
  const { machineId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [booths, setBooths] = useState([])
  const [machineName, setMachineName] = useState('')
  const [current, setCurrent] = useState(0)
  const [lastReadings, setLastReadings] = useState({})
  const [inputs, setInputs] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState({})

  useEffect(() => {
    getBooths(machineId).then(async bs => {
      setBooths(bs)
      const readings = {}
      for (const b of bs) {
        readings[b.booth_id] = await getLastReading(b.booth_id)
      }
      setLastReadings(readings)
    })
    if (state?.storeId) {
      getMachines(state.storeId).then(machines => {
        const m = machines.find(x => String(x.machine_id) === String(machineId))
        if (m) setMachineName(m.machine_name)
      })
    }
  }, [machineId])

  const booth = booths[current]
  if (!booth) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>読み込み中...</div>

  const last = lastReadings[booth.booth_id]
  const inp = inputs[booth.booth_id] || {}
  const inVal = inp.in_meter ? Number(inp.in_meter) : null
  const lastIn = last?.in_meter && !isNaN(Number(last.in_meter)) ? Number(last.in_meter) : null
  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const isAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)

  function setInp(key, val) {
    setInputs(prev => ({ ...prev, [booth.booth_id]: { ...(prev[booth.booth_id]||{}), [key]: val } }))
  }

  async function handleSave() {
    if (!inp.in_meter) { alert('INメーターを入力してください'); return }
    setSaving(true)
    try {
      await saveReading({
        booth_id: booth.booth_id,
        full_booth_code: booth.full_booth_code,
        in_meter: inp.in_meter,
        out_meter: inp.out_meter || '',
        prize_restock_count: inp.prize_restock || '',
        prize_stock_count: inp.prize_stock || '',
        prize_name: inp.prize_name || last?.prize_name || '',
        note: inp.note || ''
      })
      setSaved(prev => ({ ...prev, [booth.booth_id]: true }))
      if (current < booths.length - 1) {
        setCurrent(c => c + 1)
      } else {
        navigate('/complete', { state: { storeName: state?.storeName, storeId: state?.storeId } })
      }
    } catch(e) { alert('保存エラー: ' + e.message) }
    setSaving(false)
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div style={{flex:1}}>
          <h2>{state?.storeName}</h2>
          <p style={{fontSize:12,color:'#666'}}>{machineName} · {booth.full_booth_code}</p>
        </div>
        <span style={{fontSize:13,color:'#666'}}>{current+1}/{booths.length}</span>
      </div>
      <div className="progress">
        {booths.map((b,i) => (
          <div key={i} className={`progress-dot ${i <= current || saved[b.booth_id] ? 'active' : ''}`} />
        ))}
      </div>
      <div className="card">
        {last && (
          <div style={{background:'#f8f9fa',borderRadius:8,padding:12,marginBottom:16,fontSize:13}}>
            <div style={{color:'#666',marginBottom:4}}>📋 前回値</div>
            <div>
              IN: <strong>{lastIn !== null ? lastIn.toLocaleString() : '-'}</strong>　
              OUT: <strong>{last.out_meter && !isNaN(Number(last.out_meter)) ? Number(last.out_meter).toLocaleString() : '-'}</strong>
            </div>
            {last.prize_name && <div style={{marginTop:4}}>景品: {last.prize_name}</div>}
            <div style={{color:'#999',marginTop:4,fontSize:11}}>{last.read_time?.slice(0,10)}</div>
          </div>
        )}
        <div style={{marginBottom:16}}>
          <div className="label">INメーター *</div>
          <input className={`input ${isAbnormal?'error':''}`} type="number"
            placeholder={lastIn !== null ? String(lastIn) : '0000000'}
            value={inp.in_meter||''}
            onChange={e => setInp('in_meter', e.target.value)} />
          {inDiff !== null && (
            <div className={`diff ${isAbnormal?'warning':'normal'}`} style={{marginTop:8}}>
              差分: +{inDiff.toLocaleString()}回 / ¥{(inDiff*(Number(booth.play_price)||100)).toLocaleString()}
              {isAbnormal && <div style={{fontSize:12,marginTop:4}}>⚠️ 異常値の可能性</div>}
            </div>
          )}
        </div>
        <div style={{marginBottom:16}}>
          <div className="label">OUTメーター</div>
          <input className="input" type="number"
            placeholder={last?.out_meter||'0000000'}
            value={inp.out_meter||''}
            onChange={e => setInp('out_meter', e.target.value)} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          <div>
            <div className="label">景品補充数</div>
            <input className="input" type="number" placeholder="0"
              value={inp.prize_restock||''}
              onChange={e => setInp('prize_restock', e.target.value)} />
          </div>
          <div>
            <div className="label">景品投入残</div>
            <input className="input" type="number" placeholder="0"
              value={inp.prize_stock||''}
              onChange={e => setInp('prize_stock', e.target.value)} />
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div className="label">景品名</div>
          <input className="input" type="text" style={{textAlign:'left'}}
            placeholder={last?.prize_name||'景品名を入力'}
            value={inp.prize_name||''}
            onChange={e => setInp('prize_name', e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : current < booths.length-1 ? '保存して次へ →' : '✅ 保存して完了'}
        </button>
        {current > 0 && (
          <button className="btn btn-secondary" onClick={() => setCurrent(c => c-1)}>
            ← 前のブースに戻る
          </button>
        )}
      </div>
    </div>
  )
}
