// ============================================
// usePatrolInput: PatrolInput ページのビジネスロジック
// 単一ブース入力のデータ取得・保存
// ============================================
import { useEffect, useState } from 'react'
import { findMachineById, findStoreById } from '../services/masters'
import { getLastReadingsMap } from '../services/readings'
import { parseNum } from '../services/utils'

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

  // フォーム入力
  const [inMeter, setInMeter] = useState('')
  const [outMeter, setOutMeter] = useState('')
  const [prizeRestock, setPrizeRestock] = useState('')
  const [prizeStock, setPrizeStock] = useState('')
  const [prizeName, setPrizeName] = useState('')
  const [note, setNote] = useState('')
  const [machineStatus, setMachineStatus] = useState('ok')

  useEffect(() => {
    if (!booth) { navigateToPatrol?.(); return }
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
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [booth?.booth_id])

  // メーター差分計算
  const { latest, last } = readingsMap[booth?.booth_id] || {}
  const price = parseNum(booth?.play_price || '100')
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
    if (!finalIn) return { ok: false, message: 'INメーターを入力してください' }
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
    latest, last,
    // 景品
    prizeRestock, setPrizeRestock, prizeStock, setPrizeStock, prizeName, setPrizeName,
    // その他
    note, setNote, machineStatus, setMachineStatus,
    // 操作
    handleSave, draftCount,
  }
}
