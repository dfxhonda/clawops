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
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0,10))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const bs = await getBooths(machineId)
      setBooths(bs)
      const map = await getLastReadingsMap(bs.map(b => b.booth_id))
      setReadingsMap(map)
      const drafts = getDrafts()
      const restored = {}, restoredSaved = {}
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">前回データを取得しています...</p>
      </div>
    </div>
  )

  const booth = booths[current]
  if (!booth) return null

  const { latest, last } = readingsMap[booth.booth_id] || {}
  const inp = inputs[booth.booth_id] || {}
  const price = parseNum(booth.play_price||'100')

  const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn = last?.in_meter ? parseNum(last.in_meter) : null
  const lastOut = last?.out_meter ? parseNum(last.out_meter) : null

  const inVal = inp.in_meter !== '' && inp.in_meter !== undefined ? parseNum(inp.in_meter) : null
  const outVal = inp.out_meter !== '' && inp.out_meter !== undefined ? parseNum(inp.out_meter) : null

  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null
  const inAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  function setInp(key, val) {
    setInputs(prev => ({ ...prev, [booth.booth_id]: { ...(prev[booth.booth_id]||{}), [key]: val } }))
  }

  function handleSave() {
    const finalIn = inp.in_meter || (latestIn !== null ? String(latestIn) : '')
    if (!finalIn) { alert('INメーターを入力してください'); return }
    const finalOut = inp.out_meter || (latestOut !== null ? String(latestOut) : '')
    saveDraft({ read_date: readDate,
      booth_id: booth.booth_id, full_booth_code: booth.full_booth_code,
      in_meter: finalIn, out_meter: finalOut,
      prize_restock_count: inp.prize_restock||'', prize_stock_count: inp.prize_stock||'',
      prize_name: inp.prize_name || latest?.prize_name || '', note: inp.note||''
    })
    setSaved(prev => ({ ...prev, [booth.booth_id]: true }))
    if (current < booths.length-1) setCurrent(c => c+1)
    else navigate('/drafts', { state: { storeName: state?.storeName, storeId: state?.storeId } })
  }

  const draftCount = getDrafts().length

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-10">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{state?.storeName}</h2>
          <p className="text-xs text-muted">{machineName} · {booth.full_booth_code}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm text-muted">{current+1}/{booths.length}</span>
          {draftCount > 0 && (
            <span className="text-[11px] text-blue-400 cursor-pointer" onClick={() => navigate('/drafts')}>
              下書き{draftCount}件
            </span>
          )}
        </div>
      </div>

      {/* 入力日付 */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface rounded-lg border border-border">
        <span className="text-xs text-muted">📅 入力日付</span>
        <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
          className="flex-1 bg-surface2 border border-border text-text text-sm px-2 py-1 rounded-md [color-scheme:dark]" />
        {readDate !== new Date().toISOString().slice(0,10) &&
          <span className="text-[10px] text-accent2 font-bold">過去日付</span>}
      </div>

      {/* プログレスドット */}
      <div className="flex gap-1 mb-4">
        {booths.map((b,i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i<=current||saved[b.booth_id] ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        {/* 前回値 */}
        {latest && (
          <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm">
            <div className="text-muted text-xs mb-1">📋 前回値（最新）</div>
            <div>IN: <strong>{latestIn!==null?latestIn.toLocaleString():'-'}</strong>　OUT: <strong>{latestOut!==null?latestOut.toLocaleString():'-'}</strong></div>
            {latest.prize_name && <div className="mt-1">景品: {latest.prize_name}</div>}
            <div className="text-muted text-[11px] mt-1">{latest.read_time?.slice(0,10)}</div>
          </div>
        )}

        {/* 差分基準 */}
        {last && last !== latest && (
          <div className="bg-surface3 rounded-lg px-3 py-2 mb-4 text-xs text-accent">
            差分基準: IN {lastIn!==null?lastIn.toLocaleString():'-'} ({last.read_time?.slice(0,10)})
          </div>
        )}
        {!last && (
          <div className="bg-accent/10 rounded-lg px-3 py-2 mb-4 text-xs text-accent">
            ⚠️ 差分計算できる過去データがありません（2日前以前のレコードなし）
          </div>
        )}

        {/* INメーター */}
        <div className="mb-4">
          <div className="text-xs text-muted mb-1">
            INメーター *
            {!inp.in_meter && latestIn !== null && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
          </div>
          <input
            className={`w-full p-3 text-lg text-center rounded-lg border-2 bg-surface2 text-text outline-none transition-colors
              ${inAbnormal ? 'border-accent2 bg-accent2/10' : 'border-border focus:border-accent'}`}
            type="number"
            placeholder={latestIn!==null?String(latestIn):'0000000'}
            value={inp.in_meter||''}
            onChange={e => setInp('in_meter', e.target.value)}
          />
          {inDiff !== null && (
            <div className={`mt-1.5 text-center text-2xl font-bold p-2 rounded-lg
              ${inAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
              差分: {inDiff>=0?'+':''}{inDiff.toLocaleString()}回 / ¥{(inDiff*price).toLocaleString()}
              {inAbnormal && <div className="text-xs mt-1">⚠️ 異常値の可能性</div>}
            </div>
          )}
        </div>

        {/* OUTメーター */}
        <div className="mb-4">
          <div className="text-xs text-muted mb-1">
            OUTメーター
            {!inp.out_meter && latestOut !== null && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
          </div>
          <input
            className={`w-full p-3 text-lg text-center rounded-lg border-2 bg-surface2 text-text outline-none transition-colors
              ${outAbnormal ? 'border-accent2 bg-accent2/10' : 'border-border focus:border-accent'}`}
            type="number"
            placeholder={latestOut!==null?String(latestOut):'0000000'}
            value={inp.out_meter||''}
            onChange={e => setInp('out_meter', e.target.value)}
          />
          {outDiff !== null && (
            <div className={`mt-1.5 text-center text-2xl font-bold p-2 rounded-lg
              ${outAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
              差分: {outDiff>=0?'+':''}{outDiff.toLocaleString()}回
              {outAbnormal && <div className="text-xs mt-1">⚠️ 異常値の可能性</div>}
            </div>
          )}
        </div>

        {/* 景品数 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <div className="text-xs text-muted mb-1">景品補充数</div>
            <input className="w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent" type="number" placeholder="0"
              value={inp.prize_restock||''} onChange={e => setInp('prize_restock', e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">景品投入残</div>
            <input className="w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent" type="number" placeholder="0"
              value={inp.prize_stock||''} onChange={e => setInp('prize_stock', e.target.value)} />
          </div>
        </div>

        {/* 景品名 */}
        <div className="mb-4">
          <div className="text-xs text-muted mb-1">
            景品名
            {!inp.prize_name && latest?.prize_name && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
          </div>
          <input className="w-full p-3 text-base text-left rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent" type="text"
            placeholder={latest?.prize_name||'景品名を入力'}
            value={inp.prize_name||''}
            onChange={e => setInp('prize_name', e.target.value)} />
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mb-2"
        >
          {saved[booth.booth_id]?'✅ ':''}
          {current < booths.length-1 ? '下書き保存して次へ →' : '📝 下書き一覧へ'}
        </button>
        {current > 0 && (
          <button
            onClick={() => setCurrent(c => c-1)}
            className="w-full bg-surface2 border border-border text-text font-medium py-3 rounded-xl hover:border-accent/30 transition-colors"
          >
            ← 前のブースに戻る
          </button>
        )}
      </div>
    </div>
  )
}
