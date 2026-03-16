import { useEffect, useState, useRef, useCallback } from 'react'
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

// 設定値の定義（5種類）
const SETTINGS = [
  { key: 'set_a', label: 'A', title: 'アシスト回数' },
  { key: 'set_c', label: 'C', title: 'キャッチ時パワー' },
  { key: 'set_l', label: 'L', title: '緩和時パワー' },
  { key: 'set_r', label: 'R', title: '復帰時パワー' },
  { key: 'set_o', label: 'O', title: '固有設定' },
]

// Enter順序: IN → OUT → 残 → 補 → set_a → set_c → set_l → set_r → set_o → 景品名 → (次ブースIN)
const FIELD_ORDER = ['in_meter', 'out_meter', 'prize_stock', 'prize_restock', 'set_a', 'set_c', 'set_l', 'set_r', 'set_o', 'prize_name']

export default function BoothInput() {
  const { machineId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [booths, setBooths] = useState([])
  const [machineName, setMachineName] = useState('')
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(true)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0,10))

  // ref管理: refs[boothId][fieldName] = inputElement
  const refsMap = useRef({})

  const getRef = useCallback((boothId, fieldName) => {
    if (!refsMap.current[boothId]) refsMap.current[boothId] = {}
    return (el) => { refsMap.current[boothId][fieldName] = el }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const bs = await getBooths(machineId)
      setBooths(bs)
      const map = await getLastReadingsMap(bs.map(b => b.booth_id))
      setReadingsMap(map)
      // ドラフト復元
      const drafts = getDrafts()
      const restored = {}
      for (const b of bs) {
        const draft = drafts.find(d => String(d.booth_id) === String(b.booth_id))
        if (draft) {
          restored[b.booth_id] = {
            in_meter: draft.in_meter, out_meter: draft.out_meter,
            prize_restock: draft.prize_restock_count, prize_stock: draft.prize_stock_count,
            prize_name: draft.prize_name,
            set_a: draft.set_a, set_c: draft.set_c, set_l: draft.set_l, set_r: draft.set_r, set_o: draft.set_o,
          }
        }
      }
      setInputs(restored)
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
  }

  // Enterキーで次フィールドへ
  function handleKeyDown(e, boothId, fieldName) {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const boothIdx = booths.findIndex(b => b.booth_id === boothId)
    const fieldIdx = FIELD_ORDER.indexOf(fieldName)

    if (fieldIdx < FIELD_ORDER.length - 1) {
      // 同じブース内の次フィールド
      const nextField = FIELD_ORDER[fieldIdx + 1]
      refsMap.current[boothId]?.[nextField]?.focus()
    } else if (boothIdx < booths.length - 1) {
      // 次ブースのINメーター
      const nextBoothId = booths[boothIdx + 1].booth_id
      refsMap.current[nextBoothId]?.['in_meter']?.focus()
      // 次ブースが見えるようスクロール
      refsMap.current[nextBoothId]?.['in_meter']?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  function handleSaveAll() {
    let count = 0
    for (const booth of booths) {
      const inp = inputs[booth.booth_id] || {}
      const { latest } = readingsMap[booth.booth_id] || {}
      const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
      const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
      const finalIn = inp.in_meter || (latestIn !== null ? String(latestIn) : '')
      if (!finalIn) continue
      const finalOut = inp.out_meter || (latestOut !== null ? String(latestOut) : '')
      saveDraftItem({
        read_date: readDate,
        booth_id: booth.booth_id, full_booth_code: booth.full_booth_code,
        in_meter: finalIn, out_meter: finalOut,
        prize_restock_count: inp.prize_restock || '',
        prize_stock_count: inp.prize_stock || '',
        prize_name: inp.prize_name || latest?.prize_name || '',
        note: inp.note || '',
        set_a: inp.set_a || latest?.set_a || '',
        set_c: inp.set_c || latest?.set_c || '',
        set_l: inp.set_l || latest?.set_l || '',
        set_r: inp.set_r || latest?.set_r || '',
        set_o: inp.set_o || latest?.set_o || '',
      })
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

  const inputCount = booths.filter(b => {
    const inp = inputs[b.booth_id] || {}
    return inp.in_meter && inp.in_meter !== ''
  }).length

  return (
    <div className="max-w-lg mx-auto px-3 pt-3 pb-24">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="text-xl text-muted hover:text-accent">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold truncate">{machineName || '機械'}</h2>
          <p className="text-[11px] text-muted">{state?.storeName} ・{booths.length}ブース</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
            className="bg-surface2 border border-border text-text text-xs px-1.5 py-1 rounded [color-scheme:dark] w-[120px]" />
          <div className="text-center">
            <div className="text-sm font-bold text-accent">{inputCount}/{booths.length}</div>
          </div>
        </div>
      </div>

      {readDate !== new Date().toISOString().slice(0,10) &&
        <div className="text-[10px] text-accent2 font-bold text-center mb-1">⚠️ 過去日付で入力中</div>}

      {/* 全ブース一覧 */}
      <div className="space-y-1.5">
        {booths.map((booth) => (
          <BoothCard
            key={booth.booth_id}
            booth={booth}
            readingsMap={readingsMap}
            inp={inputs[booth.booth_id] || {}}
            setInp={setInp}
            getRef={getRef}
            handleKeyDown={handleKeyDown}
          />
        ))}
      </div>

      {/* 固定フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur border-t border-border px-3 py-2.5 z-50">
        <div className="max-w-lg mx-auto">
          <button onClick={handleSaveAll}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">
            📝 {inputCount > 0 ? `${inputCount}件を下書き保存` : '下書き保存'} → 確認へ
          </button>
        </div>
      </div>
    </div>
  )
}

// 個別ブースカード
function BoothCard({ booth, readingsMap, inp, setInp, getRef, handleKeyDown }) {
  const { latest, last } = readingsMap[booth.booth_id] || {}
  const price = parseNum(booth.play_price || '100')

  const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn = last?.in_meter ? parseNum(last.in_meter) : null
  const lastOut = last?.out_meter ? parseNum(last.out_meter) : null

  const inVal = inp.in_meter ? parseNum(inp.in_meter) : null
  const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null
  const inAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  // 払出 = OUT差分（自動計算）
  const payout = outDiff !== null && outDiff >= 0 ? outDiff : null
  // 出率 = 払出 / IN差分
  const payoutRate = payout !== null && inDiff !== null && inDiff > 0
    ? ((payout / inDiff) * 100).toFixed(1) : null

  const hasInput = inp.in_meter && inp.in_meter !== ''

  const inputCls = "w-full p-2 text-sm text-center rounded border bg-surface2 text-text outline-none focus:border-accent transition-colors"

  return (
    <div className={`bg-surface border rounded-lg overflow-hidden ${hasInput ? 'border-accent/30' : 'border-border'}`}>

      {/* R1: ブース名 + 景品名 + 単価 */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <span className="text-xs font-bold text-accent shrink-0">{booth.booth_code}</span>
        <input
          ref={getRef(booth.booth_id, 'prize_name')}
          className="flex-1 min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-muted/60 truncate"
          type="text"
          placeholder={latest?.prize_name || '景品名'}
          value={inp.prize_name || ''}
          onChange={e => setInp(booth.booth_id, 'prize_name', e.target.value)}
          onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_name')}
        />
        <span className="text-[11px] text-muted shrink-0">¥{price}</span>
      </div>

      {/* R2: IN / OUT 入力 */}
      <div className="flex gap-1.5 px-2.5 pb-1">
        {/* IN */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted">IN</span>
            <span className="text-[10px] text-muted/60">{latestIn !== null ? latestIn.toLocaleString() : '-'}</span>
          </div>
          <input
            ref={getRef(booth.booth_id, 'in_meter')}
            className={`${inputCls} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : inp.in_meter ? 'border-accent/40' : 'border-border'}`}
            type="number" inputMode="numeric"
            placeholder={latestIn !== null ? String(latestIn) : '0'}
            value={inp.in_meter || ''}
            onChange={e => setInp(booth.booth_id, 'in_meter', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'in_meter')}
          />
          {inDiff !== null && (
            <div className={`text-center text-xs font-bold mt-0.5 ${inAbnormal ? 'text-accent2' : 'text-accent'}`}>
              +{inDiff.toLocaleString()} (¥{(inDiff * price).toLocaleString()})
            </div>
          )}
        </div>

        {/* OUT */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted">OUT</span>
            <span className="text-[10px] text-muted/60">{latestOut !== null ? latestOut.toLocaleString() : '-'}</span>
          </div>
          <input
            ref={getRef(booth.booth_id, 'out_meter')}
            className={`${inputCls} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : inp.out_meter ? 'border-accent/40' : 'border-border'}`}
            type="number" inputMode="numeric"
            placeholder={latestOut !== null ? String(latestOut) : '0'}
            value={inp.out_meter || ''}
            onChange={e => setInp(booth.booth_id, 'out_meter', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'out_meter')}
          />
          {outDiff !== null && (
            <div className={`text-center text-xs font-bold mt-0.5 ${outAbnormal ? 'text-accent2' : 'text-accent'}`}>
              +{outDiff.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* R3: 残 / 補 / 設定値5種 / 出率 */}
      <div className="flex items-center gap-1 px-2.5 pb-2">
        {/* 残（景品投入残） */}
        <div className="w-[48px]">
          <div className="text-[9px] text-muted text-center">残</div>
          <input
            ref={getRef(booth.booth_id, 'prize_stock')}
            className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent"
            type="number" inputMode="numeric"
            placeholder={latest?.prize_stock_count || '0'}
            value={inp.prize_stock || ''}
            onChange={e => setInp(booth.booth_id, 'prize_stock', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_stock')}
          />
        </div>

        {/* 補（景品補充数） */}
        <div className="w-[48px]">
          <div className="text-[9px] text-muted text-center">補</div>
          <input
            ref={getRef(booth.booth_id, 'prize_restock')}
            className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent"
            type="number" inputMode="numeric" placeholder="0"
            value={inp.prize_restock || ''}
            onChange={e => setInp(booth.booth_id, 'prize_restock', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_restock')}
          />
        </div>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* 設定値 A/C/L/R/O */}
        {SETTINGS.map(s => (
          <div key={s.key} className="w-[36px]">
            <div className="text-[9px] text-accent4 text-center font-bold">{s.label}</div>
            <input
              ref={getRef(booth.booth_id, s.key)}
              className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
              type={s.key === 'set_o' ? 'text' : 'number'}
              inputMode={s.key === 'set_o' ? 'text' : 'numeric'}
              placeholder={latest?.[s.key] || '-'}
              value={inp[s.key] || ''}
              onChange={e => setInp(booth.booth_id, s.key, e.target.value)}
              onKeyDown={e => handleKeyDown(e, booth.booth_id, s.key)}
              title={s.title}
            />
          </div>
        ))}

        {/* 出率 */}
        {payoutRate !== null && (
          <div className={`ml-auto text-xs font-bold shrink-0 px-1.5 py-0.5 rounded
            ${Number(payoutRate) > 30 ? 'text-accent2 bg-accent2/10' :
              Number(payoutRate) < 5 ? 'text-blue-400 bg-blue-900/20' :
              'text-accent3 bg-accent3/10'}`}>
            {payoutRate}%
          </div>
        )}
      </div>

      {/* 異常値アラート */}
      {(inAbnormal || outAbnormal) && (
        <div className="bg-accent2/10 px-2.5 py-1 text-[10px] text-accent2 border-t border-accent2/20">
          ⚠️ 異常値の可能性（{inAbnormal && 'IN'}{inAbnormal && outAbnormal && '・'}{outAbnormal && 'OUT'}）
        </div>
      )}
    </div>
  )
}
