import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getBooths, getMachines, getLastReadingsMap, parseNum } from '../services/sheets'

const DRAFT_KEY = 'clawops_drafts'
function getDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'[]') } catch { return [] } }
function saveDraft(draft) {
  const drafts = getDrafts()
  const idx = drafts.findIndex(d => String(d.booth_id) === String(draft.booth_id))
  if (idx >= 0) drafts[idx] = { ...drafts[idx], ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

export default function BoothInput() {
  const { machineId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [booths, setBooths] = useState([])
  const [machineName, setMachineName] = useState('')
  const [current, setCurrent] = useState(0)
  const [lastReadings, setLastReadings] = useState({})
  const [inputs, setInputs] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const bs = await getBooths(machineId)
      setBooths(bs)
      // 一括取得（APIリクエスト1回）
      const map = await getLastReadingsMap(bs.map(b => b.booth_id))
      setLastReadings(map)
      // 下書き復元
      const drafts = getDrafts()
      const restored = {}
      const restoredSaved = {}
      for (const b of bs) {
        const draft = drafts.find(d => String(d.booth_id) === String(b.booth_id))
        if (draft) {
          restored[b.booth_id] = { in_meter:draft.in_meter, out_meter:draft.out_meter,
            prize_restock:draft.prize_restock_count, prize_stock:draft.prize_stock_count,
            prize_name:draft.prize_name }
          restoredSaved[b.booth_id] = true
        }
      }
      setInputs(restored)
      setSaved(restoredSaved)
      if (state?.storeId) {
        const machines = await getMachines(state.storeId)
        const m = machines.find(x => String(x.machine_id) === String(machineId))
        if (m) setMachineName(m.machine_name)
      }
      setLoading(false)
    }
    load()
  }, [machineId])

  if (loading) return (
    <div className="container" style={{paddingTop:80,textAlign:'center'}}>
      <p>読み込み中...</p>
      <p style={{fontSize:12,color:'#999',marginTop:8}}>前回データを取得しています</p>
    </div>
  )

  const booth = booths[current]
  if (!booth) return null

  const last = lastReadings[booth.booth_id]
  const inp = inputs[booth.booth_id] || {}
  const price = parseNum(booth.play_price||'100')
  const lastIn = last?.in_meter ? parseNum(last.in_meter) : null
  const lastOut = last?.out_meter ? parseNum(last.out_meter) : null

  const inVal = inp.in_meter !== '' && inp.in_meter !== undefined ? parseNum(inp.in_meter) : lastIn
  const outVal = inp.out_meter !== '' && inp.out_meter !== undefined ? parseNum(inp.out_meter) : lastOut
  const usingLastIn = !inp.in_meter && lastIn !== null
  const usingLastOut = !inp.out_meter && lastOut !== null

  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null
  const inAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  function setInp(key, val) {
    setInputs(prev => ({ ...prev, [booth.booth_id]: { ...(prev[booth.booth_id]||{}), [key]: val } }))
  }

  function handleSave() {
    const finalIn = inp.in_meter || (lastIn !== null ? String(lastIn) : '')
    if (!finalIn) { alert('INメーターを入力してください'); return }
    const finalOut = inp.out_meter || (lastOut !== null ? String(lastOut) : '')
    saveDraft({
      booth_id: booth.booth_id, full_booth_code: booth.full_booth_code,
      in_meter: finalIn, out_meter: finalOut,
      prize_restock_count: inp.prize_restock||'', prize_stock_count: inp.prize_stock||'',
      prize_name: inp.prize_name || last?.prize_name || '', note: inp.note||''
    })
    setSaved(prev => ({ ...prev, [booth.booth_id]: true }))
    if (current < booths.length-1) {
      setCurrent(c => c+1)
    } else {
      // 最終ブース → 下書き一覧へ
      navigate('/drafts', { state: { storeName: state?.storeName, storeId: state?.storeId } })
    }
  }

  const draftCount = getDrafts().length

  return (
    <div className="container" style={{paddingTop:16}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div style={{flex:1}}>
          <h2>{state?.storeName}</h2>
          <p style={{fontSize:12,color:'#666'}}>{machineName} · {booth.full_booth_code}</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
          <span style={{fontSize:13,color:'#666'}}>{current+1}/{booths.length}</span>
          {draftCount > 0 && (
            <span style={{fontSize:11,color:'#1a73e8',cursor:'pointer'}} onClick={() => navigate('/drafts')}>
              下書き{draftCount}件
            </span>
          )}
        </div>
      </div>

      <div className="progress">
        {booths.map((b,i) => (
          <div key={i} className={`progress-dot ${i<=current||saved[b.booth_id]?'active':''}`} />
        ))}
      </div>

      <div className="card">
        {last && (
          <div style={{background:'#f8f9fa',borderRadius:8,padding:12,marginBottom:16,fontSize:13}}>
            <div style={{color:'#666',marginBottom:4}}>📋 前回値</div>
            <div>IN: <strong>{lastIn!==null?lastIn.toLocaleString():'-'}</strong>　OUT: <strong>{lastOut!==null?lastOut.toLocaleString():'-'}</strong></div>
            {last.prize_name && <div style={{marginTop:4}}>景品: {last.prize_name}</div>}
            <div style={{color:'#999',marginTop:4,fontSize:11}}>{last.read_time?.slice(0,10)}</div>
          </div>
        )}

        <div style={{marginBottom:16}}>
          <div className="label">INメーター *
            {usingLastIn && <span style={{fontSize:11,color:'#f29900',marginLeft:6}}>※未入力時は前回値で保存</span>}
          </div>
          <input className={`input ${inAbnormal?'error':''}`} type="number"
            placeholder={lastIn!==null?String(lastIn):'0000000'}
            value={inp.in_meter||''}
            onChange={e => setInp('in_meter', e.target.value)} />
          {inDiff !== null && inDiff !== 0 && (
            <div className={`diff ${inAbnormal?'warning':'normal'}`} style={{marginTop:6}}>
              差分: {inDiff>=0?'+':''}{inDiff.toLocaleString()}回 / ¥{(inDiff*price).toLocaleString()}
              {inAbnormal && <div style={{fontSize:12,marginTop:2}}>⚠️ 異常値の可能性</div>}
            </div>
          )}
        </div>

        <div style={{marginBottom:16}}>
          <div className="label">OUTメーター
            {usingLastOut && <span style={{fontSize:11,color:'#f29900',marginLeft:6}}>※未入力時は前回値で保存</span>}
          </div>
          <input className={`input ${outAbnormal?'error':''}`} type="number"
            placeholder={lastOut!==null?String(lastOut):'0000000'}
            value={inp.out_meter||''}
            onChange={e => setInp('out_meter', e.target.value)} />
          {outDiff !== null && outDiff !== 0 && (
            <div className={`diff ${outAbnormal?'warning':'normal'}`} style={{marginTop:6}}>
              差分: {outDiff>=0?'+':''}{outDiff.toLocaleString()}回
              {outAbnormal && <div style={{fontSize:12,marginTop:2}}>⚠️ 異常値の可能性</div>}
            </div>
          )}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          <div>
            <div className="label">景品補充数</div>
            <input className="input" type="number" placeholder="0"
              value={inp.prize_restock||''} onChange={e => setInp('prize_restock', e.target.value)} />
          </div>
          <div>
            <div className="label">景品投入残</div>
            <input className="input" type="number" placeholder="0"
              value={inp.prize_stock||''} onChange={e => setInp('prize_stock', e.target.value)} />
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <div className="label">景品名
            {!inp.prize_name && last?.prize_name && <span style={{fontSize:11,color:'#f29900',marginLeft:6}}>※未入力時は前回値で保存</span>}
          </div>
          <input className="input" type="text" style={{textAlign:'left'}}
            placeholder={last?.prize_name||'景品名を入力'}
            value={inp.prize_name||''}
            onChange={e => setInp('prize_name', e.target.value)} />
        </div>

        <button className="btn btn-primary" onClick={handleSave}>
          {saved[booth.booth_id]?'✅ ':''}
          {current < booths.length-1 ? '下書き保存して次へ →' : '📝 下書き一覧へ'}
        </button>
        {current > 0 && (
          <button className="btn btn-secondary" onClick={() => setCurrent(c => c-1)}>← 前のブースに戻る</button>
        )}
      </div>
    </div>
  )
}
