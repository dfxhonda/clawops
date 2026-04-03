import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getLastReadingsMap, findMachineById, findStoreById, parseNum } from '../services/sheets'

const DRAFT_KEY = 'clawops_drafts'
function getDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'[]') } catch { return [] } }
function saveDraft(draft) {
  const drafts = getDrafts()
  const idx = drafts.findIndex(d => String(d.booth_id) === String(draft.booth_id))
  if (idx >= 0) drafts[idx] = { ...drafts[idx], ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

const STATUS_OPTIONS = [
  { key: 'ok', label: '正常', icon: '✅', color: 'text-accent3 border-accent3' },
  { key: 'prize_low', label: '景品少', icon: '⚠️', color: 'text-accent border-accent' },
  { key: 'prize_empty', label: '景品切れ', icon: '🚨', color: 'text-accent2 border-accent2' },
  { key: 'malfunction', label: '故障', icon: '🔧', color: 'text-accent2 border-accent2' },
  { key: 'dirty', label: '清掃要', icon: '🧹', color: 'text-accent4 border-accent4' },
]

export default function PatrolInput() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const booth = state?.booth

  const [loading, setLoading] = useState(true)
  const [readingsMap, setReadingsMap] = useState({})
  const [machineName, setMachineName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0,10))
  const [saved, setSaved] = useState(false)

  const [inMeter, setInMeter] = useState('')
  const [outMeter, setOutMeter] = useState('')
  const [prizeRestock, setPrizeRestock] = useState('')
  const [prizeStock, setPrizeStock] = useState('')
  const [prizeName, setPrizeName] = useState('')
  const [note, setNote] = useState('')
  const [machineStatus, setMachineStatus] = useState('ok')

  useEffect(() => {
    if (!booth) { navigate('/patrol'); return }
    async function load() {
      setLoading(true)
      const map = await getLastReadingsMap([booth.booth_id])
      setReadingsMap(map)
      const draft = getDrafts().find(d => String(d.booth_id) === String(booth.booth_id))
      if (draft) {
        setInMeter(draft.in_meter || ''); setOutMeter(draft.out_meter || '')
        setPrizeRestock(draft.prize_restock_count || ''); setPrizeStock(draft.prize_stock_count || '')
        setPrizeName(draft.prize_name || ''); setNote(draft.note || '')
        if (draft.machine_status) setMachineStatus(draft.machine_status)
      }
      try {
        const machine = await findMachineById(booth.machine_id)
        if (machine) {
          setMachineName(machine.machine_name)
          const store = await findStoreById(machine.store_id)
          if (store) setStoreName(store.store_name)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [booth?.booth_id])

  if (!booth) return null

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">前回データを取得しています...</p>
      </div>
    </div>
  )

  const { latest, last } = readingsMap[booth.booth_id] || {}
  const price = parseNum(booth.play_price||'100')
  const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn = last?.in_meter ? parseNum(last.in_meter) : null
  const lastOut = last?.out_meter ? parseNum(last.out_meter) : null
  const inVal = inMeter !== '' ? parseNum(inMeter) : null
  const outVal = outMeter !== '' ? parseNum(outMeter) : null
  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null
  const inAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  function handleSave() {
    const finalIn = inMeter || (latestIn !== null ? String(latestIn) : '')
    if (!finalIn) { alert('INメーターを入力してください'); return }
    const finalOut = outMeter || (latestOut !== null ? String(latestOut) : '')
    const statusLabel = STATUS_OPTIONS.find(s => s.key === machineStatus)?.label || ''
    const noteWithStatus = machineStatus !== 'ok' ? `[${statusLabel}] ${note}`.trim() : note
    saveDraft({
      read_date: readDate, booth_id: booth.booth_id, full_booth_code: booth.full_booth_code,
      in_meter: finalIn, out_meter: finalOut,
      prize_restock_count: prizeRestock, prize_stock_count: prizeStock,
      prize_name: prizeName || latest?.prize_name || '', note: noteWithStatus, machine_status: machineStatus,
    })
    setSaved(true)
  }

  const draftCount = getDrafts().length
  const inputCls = "w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/patrol')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-accent">{booth.full_booth_code}</h2>
            <p className="text-xs text-muted">{storeName && `${storeName} · `}{machineName || booth.booth_code}</p>
          </div>
          <button onClick={() => { sessionStorage.clear(); navigate('/login') }}
            className="text-[10px] text-muted hover:text-accent2">ログアウト</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10">

      {/* 保存完了 */}
      {saved ? (
        <div className="bg-surface border border-border rounded-xl text-center p-8">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-accent3 font-bold text-lg mb-2">下書き保存完了</h3>
          <p className="text-muted text-sm mb-6">{booth.full_booth_code} のデータを保存しました</p>
          <button onClick={() => navigate('/patrol')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mb-2">
            📷 次のブースをスキャン
          </button>
          <button onClick={() => navigate('/')}
            className="w-full bg-surface2 border border-border text-text font-medium py-3 rounded-xl">
            ホームに戻る
          </button>
        </div>
      ) : (
        <>
          {/* 入力日付 */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface rounded-lg border border-border">
            <span className="text-xs text-muted">📅 入力日付</span>
            <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
              className="flex-1 bg-surface2 border border-border text-text text-sm px-2 py-1 rounded-md [color-scheme:dark]" />
            {readDate !== new Date().toISOString().slice(0,10) &&
              <span className="text-[10px] text-accent2 font-bold">過去日付</span>}
          </div>

          {/* 機械状態 */}
          <div className="bg-surface border border-border rounded-xl p-3.5 mb-3">
            <div className="text-xs text-muted mb-2">機械状態</div>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s.key} onClick={() => setMachineStatus(s.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all
                    ${machineStatus === s.key ? `${s.color} bg-surface3` : 'border-border text-muted bg-surface'}`}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
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
            {last && last !== latest && (
              <div className="bg-surface3 rounded-lg px-3 py-2 mb-4 text-xs text-accent">
                差分基準: IN {lastIn!==null?lastIn.toLocaleString():'-'} ({last.read_time?.slice(0,10)})
              </div>
            )}
            {!last && (
              <div className="bg-accent/10 rounded-lg px-3 py-2 mb-4 text-xs text-accent">
                ⚠️ 差分計算できる過去データがありません
              </div>
            )}

            {/* INメーター */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-1">
                INメーター *
                {!inMeter && latestIn !== null && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
              </div>
              <input className={`${inputCls} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`} type="number"
                placeholder={latestIn!==null?String(latestIn):'0000000'} value={inMeter} onChange={e => setInMeter(e.target.value)} />
              {inDiff !== null && (
                <div className={`mt-1.5 text-center text-2xl font-bold p-2 rounded-lg ${inAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                  差分: {inDiff>=0?'+':''}{inDiff.toLocaleString()}回 / ¥{(inDiff*price).toLocaleString()}
                  {inAbnormal && <div className="text-xs mt-1">⚠️ 異常値の可能性</div>}
                </div>
              )}
            </div>

            {/* OUTメーター */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-1">
                OUTメーター
                {!outMeter && latestOut !== null && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
              </div>
              <input className={`${inputCls} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`} type="number"
                placeholder={latestOut!==null?String(latestOut):'0000000'} value={outMeter} onChange={e => setOutMeter(e.target.value)} />
              {outDiff !== null && (
                <div className={`mt-1.5 text-center text-2xl font-bold p-2 rounded-lg ${outAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                  差分: {outDiff>=0?'+':''}{outDiff.toLocaleString()}回
                  {outAbnormal && <div className="text-xs mt-1">⚠️ 異常値の可能性</div>}
                </div>
              )}
            </div>

            {/* 景品 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <div className="text-xs text-muted mb-1">景品補充数</div>
                <input className={inputCls} type="number" placeholder="0" value={prizeRestock} onChange={e => setPrizeRestock(e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-1">景品投入残</div>
                <input className={inputCls} type="number" placeholder="0" value={prizeStock} onChange={e => setPrizeStock(e.target.value)} />
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs text-muted mb-1">
                景品名
                {!prizeName && latest?.prize_name && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
              </div>
              <input className={inputCls + ' !text-left !text-base'} type="text"
                placeholder={latest?.prize_name||'景品名を入力'} value={prizeName} onChange={e => setPrizeName(e.target.value)} />
            </div>

            {/* メモ */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-1">メモ・備考</div>
              <textarea className={inputCls + ' !text-left !text-sm resize-y min-h-12'} rows={2}
                placeholder="特記事項があれば入力" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <button onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors">
              📝 下書き保存 → 次のスキャンへ
            </button>
          </div>
        </>
      )}
      </div>{/* スクロール領域終了 */}
    </div>
  )
}
