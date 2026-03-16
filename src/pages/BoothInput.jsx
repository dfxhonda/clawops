import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getBooths, getMachines, getLastReadingsMap, parseNum } from '../services/sheets'

const DRAFT_KEY = 'clawops_drafts'
function getDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'[]') } catch { return [] } }
function saveDraftItem(draft) {
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
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0,10))
  const [expanded, setExpanded] = useState({}) // 展開中のブースID

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

  function setInp(boothId, key, val) {
    setInputs(prev => ({ ...prev, [boothId]: { ...(prev[boothId]||{}), [key]: val } }))
    // 入力があれば保存済みフラグをリセット
    setSaved(prev => ({ ...prev, [boothId]: false }))
  }

  function toggleExpand(boothId) {
    setExpanded(prev => ({ ...prev, [boothId]: !prev[boothId] }))
  }

  function handleSaveAll() {
    let count = 0
    for (const booth of booths) {
      const inp = inputs[booth.booth_id] || {}
      const { latest } = readingsMap[booth.booth_id] || {}
      const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
      const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
      const finalIn = inp.in_meter || (latestIn !== null ? String(latestIn) : '')
      if (!finalIn) continue // INメーターが無ければスキップ
      const finalOut = inp.out_meter || (latestOut !== null ? String(latestOut) : '')
      saveDraftItem({
        read_date: readDate,
        booth_id: booth.booth_id, full_booth_code: booth.full_booth_code,
        in_meter: finalIn, out_meter: finalOut,
        prize_restock_count: inp.prize_restock||'', prize_stock_count: inp.prize_stock||'',
        prize_name: inp.prize_name || latest?.prize_name || '', note: inp.note||''
      })
      setSaved(prev => ({ ...prev, [booth.booth_id]: true }))
      count++
    }
    if (count === 0) { alert('INメーターが入力されていません'); return }
    navigate('/drafts', { state: { storeName: state?.storeName, storeId: state?.storeId } })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">前回データを取得しています...</p>
      </div>
    </div>
  )

  const savedCount = Object.values(saved).filter(Boolean).length
  const inputCount = booths.filter(b => {
    const inp = inputs[b.booth_id] || {}
    return inp.in_meter && inp.in_meter !== ''
  }).length

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => navigate(-1)} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{machineName || '機械'}</h2>
          <p className="text-xs text-muted">{state?.storeName} ・{booths.length}ブース</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-accent">{inputCount}/{booths.length}</div>
          <div className="text-[10px] text-muted">入力済</div>
        </div>
      </div>

      {/* 入力日付 */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface rounded-lg border border-border">
        <span className="text-xs text-muted">📅</span>
        <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
          className="flex-1 bg-surface2 border border-border text-text text-sm px-2 py-1 rounded-md [color-scheme:dark]" />
        {readDate !== new Date().toISOString().slice(0,10) &&
          <span className="text-[10px] text-accent2 font-bold">過去日付</span>}
      </div>

      {/* 全ブース一括表示 */}
      <div className="space-y-2">
        {booths.map((booth) => {
          const { latest, last } = readingsMap[booth.booth_id] || {}
          const inp = inputs[booth.booth_id] || {}
          const price = parseNum(booth.play_price||'100')
          const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
          const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
          const lastIn = last?.in_meter ? parseNum(last.in_meter) : null
          const inVal = inp.in_meter !== '' && inp.in_meter !== undefined ? parseNum(inp.in_meter) : null
          const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
          const inAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)
          const isSaved = saved[booth.booth_id]
          const isExpanded = expanded[booth.booth_id]

          return (
            <div key={booth.booth_id}
              className={`bg-surface border rounded-xl overflow-hidden transition-colors
                ${isSaved ? 'border-green-700/50' : 'border-border'}`}>

              {/* コンパクトヘッダー行 */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0
                    ${isSaved ? 'bg-green-900/40 text-green-400' : 'bg-surface3 text-muted'}`}>
                    {booth.booth_code?.replace('B','')}
                  </span>
                  <span className="text-sm font-bold truncate">{booth.full_booth_code}</span>
                </div>
                {/* 前回IN表示 */}
                <span className="text-[11px] text-muted shrink-0">
                  前回 {latestIn !== null ? latestIn.toLocaleString() : '-'}
                </span>
                {isSaved && <span className="text-green-400 text-sm shrink-0">✓</span>}
              </div>

              {/* INメーター入力（常に表示） */}
              <div className="px-3 pb-2">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      className={`w-full p-2.5 text-base text-center rounded-lg border-2 bg-surface2 text-text outline-none transition-colors
                        ${inAbnormal ? 'border-accent2 bg-accent2/10' : inp.in_meter ? 'border-accent/50' : 'border-border focus:border-accent'}`}
                      type="number"
                      inputMode="numeric"
                      placeholder={latestIn!==null ? String(latestIn) : 'INメーター'}
                      value={inp.in_meter||''}
                      onChange={e => setInp(booth.booth_id, 'in_meter', e.target.value)}
                    />
                  </div>
                  {/* 差分結果 */}
                  {inDiff !== null && (
                    <div className={`text-right shrink-0 min-w-[100px]
                      ${inAbnormal ? 'text-accent2' : 'text-accent'}`}>
                      <div className="text-lg font-bold leading-tight">
                        {inDiff >= 0 ? '+' : ''}{inDiff.toLocaleString()}
                      </div>
                      <div className="text-[11px]">¥{(inDiff * price).toLocaleString()}</div>
                    </div>
                  )}
                </div>
                {inAbnormal && (
                  <div className="text-[11px] text-accent2 mt-1">⚠️ 異常値の可能性があります</div>
                )}
              </div>

              {/* 展開エリア（OUT・景品など） */}
              <button
                onClick={() => toggleExpand(booth.booth_id)}
                className="w-full px-3 py-1.5 text-[11px] text-muted hover:text-text border-t border-border/50 flex items-center justify-center gap-1 transition-colors"
              >
                {isExpanded ? '△ 閉じる' : '▽ OUT・景品・メモ'}
                {(inp.out_meter || inp.prize_name || inp.prize_restock || inp.prize_stock) &&
                  <span className="text-blue-400 ml-1">●</span>}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-surface2/30">
                  {/* OUTメーター */}
                  <div className="mb-2">
                    <div className="text-[11px] text-muted mb-0.5">
                      OUTメーター
                      <span className="text-[10px] text-muted ml-1">前回 {latestOut !== null ? latestOut.toLocaleString() : '-'}</span>
                    </div>
                    <input
                      className="w-full p-2 text-sm text-center rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"
                      type="number" inputMode="numeric"
                      placeholder={latestOut !== null ? String(latestOut) : '0'}
                      value={inp.out_meter||''}
                      onChange={e => setInp(booth.booth_id, 'out_meter', e.target.value)}
                    />
                  </div>

                  {/* 景品数 */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="text-[11px] text-muted mb-0.5">景品補充数</div>
                      <input className="w-full p-2 text-sm text-center rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"
                        type="number" inputMode="numeric" placeholder="0"
                        value={inp.prize_restock||''} onChange={e => setInp(booth.booth_id, 'prize_restock', e.target.value)} />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted mb-0.5">景品投入残</div>
                      <input className="w-full p-2 text-sm text-center rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"
                        type="number" inputMode="numeric" placeholder="0"
                        value={inp.prize_stock||''} onChange={e => setInp(booth.booth_id, 'prize_stock', e.target.value)} />
                    </div>
                  </div>

                  {/* 景品名 */}
                  <div className="mb-2">
                    <div className="text-[11px] text-muted mb-0.5">景品名</div>
                    <input className="w-full p-2 text-sm text-left rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"
                      type="text"
                      placeholder={latest?.prize_name || '景品名'}
                      value={inp.prize_name||''}
                      onChange={e => setInp(booth.booth_id, 'prize_name', e.target.value)} />
                  </div>

                  {/* メモ */}
                  <div>
                    <div className="text-[11px] text-muted mb-0.5">メモ</div>
                    <input className="w-full p-2 text-sm text-left rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"
                      type="text" placeholder="特記事項"
                      value={inp.note||''}
                      onChange={e => setInp(booth.booth_id, 'note', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 固定フッター：一括保存ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur border-t border-border px-4 py-3 z-50">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSaveAll}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>📝 {inputCount > 0 ? `${inputCount}件を下書き保存` : '下書き保存'} → 確認へ</span>
          </button>
        </div>
      </div>
    </div>
  )
}
