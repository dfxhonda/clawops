// ============================================
// usePatrolInput: PatrolInput ページのビジネスロジック
// 単一ブース入力のデータ取得・保存
// ============================================
import { useEffect, useState } from 'react'
import { findMachineById, findStoreById } from '../services/masters'
import { getLastReadingsMap } from '../services/readings'
import { parseNum } from '../services/utils'
import { getDailyBoothStats } from '../services/stats'

const DRAFT_KEY = 'clawops_drafts'
function getDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '[]') } catch { return [] } }
function saveDraft(draft) {
  const drafts = getDrafts()
  const idx = drafts.findIndex(d => String(d.booth_id) === String(draft.booth_id))
  if (idx >= 0) drafts[idx] = { ...drafts[idx], ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

export const STATUS_OPTIONS = [
  { key: 'ok', label: '正常', icon: '✅', color: 'text-accent3 border-accent3' },
  { key: 'prize_low', label: '景品少', icon: '⚠️', color: 'text-accent border-accent' },
  { key: 'prize_empty', label: '景品切れ', icon: '🚨', color: 'text-accent2 border-accent2' },
  { key: 'malfunction', label: '故障', icon: '🔧', color: 'text-accent2 border-accent2' },
  { key: 'dirty', label: '清掃要', icon: '🧹', color: 'text-accent4 border-accent4' },
]

export function usePatrolInput(booth, navigateToPatrol) {
  const [loading, setLoading] = useState(true)
  const [readingsMap, setReadingsMap] = useState({})
  const [machineName, setMachineName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saved, setSaved] = useState(false)
  const [monthlyStats, setMonthlyStats] = useState(null)

  // フォーム入力
  const [inMeter, setInMeter] = useState('')
  const [outMeter, setOutMeter] = useState('')
  const [prizeRestock, setPrizeRestock] = useState('')
  const [prizeStock, setPrizeStock] = useState('')
  const [prizeName, setPrizeName] = useState('')
  const [note, setNote] = useState('')
  const [machineStatus, setMachineStatus] = useState('ok')
  // 設定値
  const [setA, setSetA] = useState('')
  const [setC, setSetC] = useState('')
  const [setL, setSetL] = useState('')
  const [setR, setSetR] = useState('')
  const [setO, setSetO] = useState('')

  useEffect(() => {
    if (!booth) { navigateToPatrol?.(); return }
    async function load() {
      setLoading(true)
      const map = await getLastReadingsMap([booth.booth_code])
      setReadingsMap(map)
      const draft = getDrafts().find(d => String(d.booth_id) === String(booth.booth_code))
      if (draft) {
        setInMeter(draft.in_meter || ''); setOutMeter(draft.out_meter || '')
        setPrizeRestock(draft.prize_restock_count || ''); setPrizeStock(draft.prize_stock_count || '')
        setPrizeName(draft.prize_name || ''); setNote(draft.note || '')
        if (draft.machine_status) setMachineStatus(draft.machine_status)
        setSetA(draft.set_a || ''); setSetC(draft.set_c || '')
        setSetL(draft.set_l || ''); setSetR(draft.set_r || ''); setSetO(draft.set_o || '')
      }
      let storeCode = null
      try {
        const machine = await findMachineById(booth.machine_code)
        if (machine) {
          setMachineName(machine.machine_name)
          storeCode = machine.store_code
          const store = await findStoreById(machine.store_code)
          if (store) setStoreName(store.store_name)
        }
      } catch { /* ignore */ }
      setLoading(false)

      // 月次統計（非blocking: loadingをブロックしない）
      if (storeCode && booth.booth_code) {
        try {
          const today = new Date()
          const yr = today.getFullYear()
          const mo = today.getMonth() + 1
          const currFrom = `${yr}-${String(mo).padStart(2, '0')}-01`
          const prevMo = mo === 1 ? 12 : mo - 1
          const prevYr = mo === 1 ? yr - 1 : yr
          const prevFrom = `${prevYr}-${String(prevMo).padStart(2, '0')}-01`
          const prevTo = new Date(yr, mo - 1, 0).toISOString().slice(0, 10)

          const [curr, prev] = await Promise.all([
            getDailyBoothStats({ storeId: storeCode, dateFrom: currFrom }),
            getDailyBoothStats({ storeId: storeCode, dateFrom: prevFrom, dateTo: prevTo }),
          ])

          const bCode = booth.booth_code
          const aggCurr = curr
            .filter(r => r.booth_code === bCode)
            .reduce((a, r) => ({
              plays: a.plays + (r.play_count || 0),
              revenue: a.revenue + Number(r.revenue || 0),
              outTotal: a.outTotal + (r.prize_out_count || 0),
            }), { plays: 0, revenue: 0, outTotal: 0 })
          const aggPrev = prev
            .filter(r => r.booth_code === bCode)
            .reduce((a, r) => ({
              plays: a.plays + (r.play_count || 0),
              revenue: a.revenue + Number(r.revenue || 0),
              outTotal: a.outTotal + (r.prize_out_count || 0),
            }), { plays: 0, revenue: 0, outTotal: 0 })

          const currPayout = aggCurr.plays > 0 ? Math.round(aggCurr.outTotal / aggCurr.plays * 100) : null
          const prevPayout = aggPrev.plays > 0 ? Math.round(aggPrev.outTotal / aggPrev.plays * 100) : null

          setMonthlyStats({
            curr: { ...aggCurr, payoutRate: currPayout },
            prev: { ...aggPrev, payoutRate: prevPayout },
          })
        } catch { /* ignore */ }
      }
    }
    load()
  }, [booth?.booth_code])

  // メーター差分計算
  const { latest, last } = readingsMap[booth?.booth_code] || {}
  const price = parseNum(booth?.play_price || '100')
  const latestIn  = latest?.in_meter  ? parseNum(latest.in_meter)  : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn    = last?.in_meter    ? parseNum(last.in_meter)    : null
  const lastOut   = last?.out_meter   ? parseNum(last.out_meter)   : null
  const inVal  = inMeter  !== '' ? parseNum(inMeter)  : null
  const outVal = outMeter !== '' ? parseNum(outMeter) : null
  const inDiff  = inVal  !== null && lastIn  !== null ? inVal  - lastIn  : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null

  // 基本異常値（範囲外）
  const inAbnormal  = inDiff  !== null && (inDiff  < 0 || inDiff  > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  // 追加異常値
  const prevInDiff = latestIn !== null && lastIn !== null ? latestIn - lastIn : null
  const inZero     = inDiff !== null && inDiff === 0
  const inTriple   = prevInDiff !== null && prevInDiff > 50 && inDiff !== null && inDiff > prevInDiff * 3

  // 出率
  const payoutRate = outDiff !== null && outDiff >= 0 && inDiff !== null && inDiff > 0
    ? outDiff / inDiff * 100 : null
  const payoutHigh = payoutRate !== null && payoutRate >= 30
  const payoutLow  = payoutRate !== null && payoutRate < 5

  function handleSave() {
    const finalIn = inMeter || (latestIn !== null ? String(latestIn) : '')
    if (!finalIn) return { ok: false, message: 'INメーターを入力してください' }
    const finalOut = outMeter || (latestOut !== null ? String(latestOut) : '')
    const statusLabel = STATUS_OPTIONS.find(s => s.key === machineStatus)?.label || ''
    const noteWithStatus = machineStatus !== 'ok' ? `[${statusLabel}] ${note}`.trim() : note
    saveDraft({
      read_date: readDate, booth_id: booth.booth_code, full_booth_code: booth.booth_code,
      in_meter: finalIn, out_meter: finalOut,
      prev_in_meter:  lastIn  !== null ? String(lastIn)  : '',
      prev_out_meter: lastOut !== null ? String(lastOut) : '',
      play_price: price,
      prize_restock_count: prizeRestock, prize_stock_count: prizeStock,
      prize_name: prizeName || latest?.prize_name || '', note: noteWithStatus, machine_status: machineStatus,
      set_a: setA || latest?.set_a || '',
      set_c: setC || latest?.set_c || '',
      set_l: setL || latest?.set_l || '',
      set_r: setR || latest?.set_r || '',
      set_o: setO || latest?.set_o || '',
    })
    setSaved(true)
    return { ok: true }
  }

  const draftCount = getDrafts().length

  return {
    // 状態
    loading, saved, machineName, storeName,
    readDate, setReadDate,
    // メーター
    inMeter, setInMeter, outMeter, setOutMeter,
    latestIn, latestOut, lastIn, lastOut, inDiff, outDiff, inAbnormal, outAbnormal, price,
    // 追加異常値
    inZero, inTriple, prevInDiff, payoutRate, payoutHigh, payoutLow,
    latest, last,
    // 景品
    prizeRestock, setPrizeRestock, prizeStock, setPrizeStock, prizeName, setPrizeName,
    // 設定値
    setA, setSetA, setC, setSetC, setL, setSetL, setR, setSetR, setO, setSetO,
    // その他
    note, setNote, machineStatus, setMachineStatus,
    // 月次統計
    monthlyStats,
    // 操作
    handleSave, draftCount,
  }
}
