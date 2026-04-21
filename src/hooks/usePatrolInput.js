// ============================================
// usePatrolInput: PatrolInput ページのビジネスロジック
// 機械内全ブース対応・前日付/当日付 2セクション
// ============================================
import { useEffect, useState } from 'react'
import { getBooths, findMachineById, findStoreById } from '../services/masters'
import { getLastReadingsMap, saveReading } from '../services/readings'
import { parseNum } from '../services/utils'
import { getDailyBoothStats } from '../services/stats'

// 入力途中の自動保存（セッション内復元用）
const PATROL_DRAFT_KEY = 'clawops_patrol_v2'
function getPatrolDrafts() { try { return JSON.parse(sessionStorage.getItem(PATROL_DRAFT_KEY) || '{}') } catch { return {} } }
function savePatrolDraft(boothId, data) {
  const d = getPatrolDrafts(); d[boothId] = data
  sessionStorage.setItem(PATROL_DRAFT_KEY, JSON.stringify(d))
}
function clearPatrolDraft(boothId) {
  const d = getPatrolDrafts(); delete d[boothId]
  sessionStorage.setItem(PATROL_DRAFT_KEY, JSON.stringify(d))
}

// DraftList（一括送信）用ドラフト
const DLIST_KEY = 'clawops_drafts'
function getDraftList() { try { return JSON.parse(sessionStorage.getItem(DLIST_KEY) || '[]') } catch { return [] } }
function saveToDraftList(draft) {
  const drafts = getDraftList()
  const idx = drafts.findIndex(d => String(d.booth_id) === String(draft.booth_id))
  if (idx >= 0) drafts[idx] = { ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DLIST_KEY, JSON.stringify(drafts))
}

export const STATUS_OPTIONS = [
  { key: 'ok',          label: '正常',   icon: '✅', color: 'text-accent3 border-accent3' },
  { key: 'prize_low',   label: '景品少', icon: '⚠️', color: 'text-accent border-accent' },
  { key: 'prize_empty', label: '景品切', icon: '🚨', color: 'text-accent2 border-accent2' },
  { key: 'malfunction', label: '故障',   icon: '🔧', color: 'text-accent2 border-accent2' },
  { key: 'dirty',       label: '清掃要', icon: '🧹', color: 'text-accent4 border-accent4' },
]

export function usePatrolInput(initialBooth, navigateToPatrol) {
  const [booths, setBooths] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})    // keyed by booth_code
  const [savedSet, setSavedSet] = useState(() => new Set())
  const [machineName, setMachineName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeCode, setStoreCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monthlyStatsMap, setMonthlyStatsMap] = useState({})

  const todayDate = new Date().toISOString().slice(0, 10)
  const [prevDayDate, setPrevDayDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
  })

  useEffect(() => {
    if (!initialBooth) { navigateToPatrol?.(); return }
    async function load() {
      setLoading(true)
      let sc = null
      try {
        const machine = await findMachineById(initialBooth.machine_code)
        if (machine) {
          setMachineName(machine.machine_name)
          sc = machine.store_code
          setStoreCode(sc)
          const store = await findStoreById(machine.store_code)
          if (store) setStoreName(store.store_name)
        }

        const bs = await getBooths(initialBooth.machine_code)
        setBooths(bs)
        const startIdx = bs.findIndex(b => b.booth_code === initialBooth.booth_code)
        setCurrentIndex(startIdx >= 0 ? startIdx : 0)

        const map = await getLastReadingsMap(bs.map(b => b.booth_code))
        setReadingsMap(map)

        // ドラフト復元
        const drafts = getPatrolDrafts()
        const restored = {}
        for (const b of bs) {
          if (drafts[b.booth_code]) restored[b.booth_code] = drafts[b.booth_code]
        }
        setInputs(restored)
      } catch (e) {
        console.error('usePatrolInput load error:', e)
      } finally {
        setLoading(false)
      }

      // 月次統計（非blocking）
      if (sc) {
        try {
          const d = new Date()
          const yr = d.getFullYear(), mo = d.getMonth() + 1
          const currFrom = `${yr}-${String(mo).padStart(2,'0')}-01`
          const pm = mo === 1 ? 12 : mo - 1, py = mo === 1 ? yr - 1 : yr
          const [curr, prev] = await Promise.all([
            getDailyBoothStats({ storeId: sc, dateFrom: currFrom }),
            getDailyBoothStats({ storeId: sc, dateFrom: `${py}-${String(pm).padStart(2,'0')}-01`, dateTo: new Date(yr, mo - 1, 0).toISOString().slice(0, 10) }),
          ])
          const sm = {}
          for (const r of curr) {
            if (!sm[r.booth_code]) sm[r.booth_code] = { curr: { revenue: 0, plays: 0, outTotal: 0 }, prev: { revenue: 0, plays: 0, outTotal: 0 } }
            sm[r.booth_code].curr.revenue += Number(r.revenue || 0)
            sm[r.booth_code].curr.plays   += r.play_count || 0
            sm[r.booth_code].curr.outTotal += r.prize_out_count || 0
          }
          for (const r of prev) {
            if (!sm[r.booth_code]) sm[r.booth_code] = { curr: { revenue: 0, plays: 0, outTotal: 0 }, prev: { revenue: 0, plays: 0, outTotal: 0 } }
            sm[r.booth_code].prev.revenue += Number(r.revenue || 0)
            sm[r.booth_code].prev.plays   += r.play_count || 0
            sm[r.booth_code].prev.outTotal += r.prize_out_count || 0
          }
          for (const code of Object.keys(sm)) {
            const c = sm[code].curr, p = sm[code].prev
            c.payoutRate = c.plays > 0 ? Math.round(c.outTotal / c.plays * 100) : null
            p.payoutRate = p.plays > 0 ? Math.round(p.outTotal / p.plays * 100) : null
          }
          setMonthlyStatsMap(sm)
        } catch { /* ignore */ }
      }
    }
    load()
  }, [initialBooth?.booth_code])

  const currentBooth = booths[currentIndex] || null
  const currentInp = currentBooth ? (inputs[currentBooth.booth_code] || {}) : {}

  // 前日付セクション用 setter
  function setInp(key, val) {
    if (!currentBooth) return
    setInputs(prev => {
      const next = { ...prev, [currentBooth.booth_code]: { ...(prev[currentBooth.booth_code] || {}), [key]: val } }
      savePatrolDraft(currentBooth.booth_code, next[currentBooth.booth_code])
      return next
    })
  }

  // 当日付変更セクション用 setter（type: '_meterReplace'|'_prizeChange'|'_settingsChange'）
  function setInpChange(type, key, val) {
    if (!currentBooth) return
    setInputs(prev => {
      const booth = prev[currentBooth.booth_code] || {}
      const next = { ...prev, [currentBooth.booth_code]: { ...booth, [type]: { ...(booth[type] || {}), [key]: val } } }
      savePatrolDraft(currentBooth.booth_code, next[currentBooth.booth_code])
      return next
    })
  }

  function toggleChange(type) {
    if (!currentBooth) return
    setInputs(prev => {
      const booth = prev[currentBooth.booth_code] || {}
      const cur = booth[type] || {}
      const next = { ...prev, [currentBooth.booth_code]: { ...booth, [type]: { ...cur, enabled: !cur.enabled } } }
      savePatrolDraft(currentBooth.booth_code, next[currentBooth.booth_code])
      return next
    })
  }

  function switchBooth(direction) {
    setCurrentIndex(prev =>
      direction === 'next' ? Math.min(prev + 1, booths.length - 1) : Math.max(prev - 1, 0)
    )
  }

  // 現在ブースのメーター差分計算
  const { latest, last } = currentBooth ? (readingsMap[currentBooth.booth_code] || {}) : {}
  const price     = parseNum(currentBooth?.play_price || '100')
  const latestIn  = latest?.in_meter  ? parseNum(latest.in_meter)  : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn    = last?.in_meter    ? parseNum(last.in_meter)    : null
  const lastOut   = last?.out_meter   ? parseNum(last.out_meter)   : null

  const inVal  = currentInp.in_meter  ? parseNum(currentInp.in_meter)  : null
  const outVal = currentInp.out_meter ? parseNum(currentInp.out_meter) : null
  const inDiff  = inVal  !== null && lastIn  !== null ? inVal  - lastIn  : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null

  const inAbnormal  = inDiff  !== null && (inDiff  < 0 || inDiff  > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)
  const prevInDiff  = latestIn !== null && lastIn !== null ? latestIn - lastIn : null
  const inZero   = inDiff !== null && inDiff === 0
  const inTriple = prevInDiff !== null && prevInDiff > 50 && inDiff !== null && inDiff > prevInDiff * 3

  const payoutRate = outDiff !== null && outDiff >= 0 && inDiff !== null && inDiff > 0
    ? outDiff / inDiff * 100 : null
  const payoutHigh = payoutRate !== null && payoutRate >= 30
  const payoutLow  = payoutRate !== null && payoutRate < 5

  // 当日付差分計算（前日付入力値 or latestIn を基準とする）
  const todayBaseIn  = inVal  !== null ? inVal  : latestIn
  const todayBaseOut = outVal !== null ? outVal : latestOut
  const todayInVal   = currentInp.today_in_meter  ? parseNum(currentInp.today_in_meter)  : null
  const todayOutVal  = currentInp.today_out_meter ? parseNum(currentInp.today_out_meter) : null
  const todayInDiff  = todayInVal  !== null && todayBaseIn  !== null ? todayInVal  - todayBaseIn  : null
  const todayOutDiff = todayOutVal !== null && todayBaseOut !== null ? todayOutVal - todayBaseOut : null
  const todayInAbnormal  = todayInDiff  !== null && (todayInDiff  < 0 || todayInDiff  > 50000)
  const todayOutAbnormal = todayOutDiff !== null && (todayOutDiff < 0 || todayOutDiff > 50000)
  const todayInZero      = todayInDiff  !== null && todayInDiff  === 0
  const todayPayoutRate  = todayOutDiff !== null && todayOutDiff >= 0 && todayInDiff !== null && todayInDiff > 0
    ? todayOutDiff / todayInDiff * 100 : null
  const todayPayoutHigh  = todayPayoutRate !== null && todayPayoutRate >= 30
  const todayPayoutLow   = todayPayoutRate !== null && todayPayoutRate < 5

  const savedCount = savedSet.size

  // ===== 保存 =====
  async function handleSave() {
    if (!currentBooth) return { ok: false, message: 'ブースが選択されていません' }
    const inp = inputs[currentBooth.booth_code] || {}
    const finalIn  = inp.in_meter  || (latestIn  !== null ? String(latestIn)  : '')
    const finalOut = inp.out_meter || (latestOut !== null ? String(latestOut) : '')
    if (!finalIn) return { ok: false, message: 'INメーターを入力してください' }

    const prizeName = inp.prize_name || latest?.prize_name || ''
    const statusLabel = STATUS_OPTIONS.find(s => s.key === (inp.machineStatus || 'ok'))?.label || ''
    const noteWithStatus = (inp.machineStatus || 'ok') !== 'ok'
      ? `[${statusLabel}] ${inp.note || ''}`.trim()
      : (inp.note || '')

    // 前日付読み → DraftList に追加
    saveToDraftList({
      read_date: prevDayDate,
      booth_id: currentBooth.booth_code, full_booth_code: currentBooth.booth_code,
      in_meter: finalIn, out_meter: finalOut,
      prev_in_meter:  lastIn  !== null ? String(lastIn)  : '',
      prev_out_meter: lastOut !== null ? String(lastOut) : '',
      play_price: price,
      prize_restock_count: inp.prize_restock || '',
      prize_stock_count:   inp.prize_stock   || '',
      prize_name: prizeName,
      note: noteWithStatus, machine_status: inp.machineStatus || 'ok',
      set_a: inp.set_a || latest?.set_a || '', set_c: inp.set_c || latest?.set_c || '',
      set_l: inp.set_l || latest?.set_l || '', set_r: inp.set_r || latest?.set_r || '',
      set_o: inp.set_o || latest?.set_o || '',
      input_method: inp.inputMethod || 'manual',
      ocr_confidence: inp.ocrConfidence || null,
    })

    // 当日付メーター読み → DraftList に追加（入力がある場合のみ）
    if (inp.today_in_meter) {
      const todayPrizeName = inp.today_prize_name || prizeName
      const todayStatusLabel = STATUS_OPTIONS.find(s => s.key === (inp.today_machineStatus || 'ok'))?.label || ''
      const todayNote = (inp.today_machineStatus || 'ok') !== 'ok'
        ? `[${todayStatusLabel}] ${inp.today_note || ''}`.trim()
        : (inp.today_note || '')
      saveToDraftList({
        read_date: todayDate,
        booth_id: currentBooth.booth_code, full_booth_code: currentBooth.booth_code,
        in_meter: inp.today_in_meter,
        out_meter: inp.today_out_meter || finalIn,
        prev_in_meter: finalIn, prev_out_meter: finalOut,
        play_price: price,
        prize_restock_count: inp.today_prize_restock || '',
        prize_stock_count:   inp.today_prize_stock   || '',
        prize_name: todayPrizeName,
        note: todayNote, machine_status: inp.today_machineStatus || 'ok',
        set_a: inp.today_set_a || inp.set_a || latest?.set_a || '',
        set_c: inp.today_set_c || inp.set_c || latest?.set_c || '',
        set_l: inp.today_set_l || inp.set_l || latest?.set_l || '',
        set_r: inp.today_set_r || inp.set_r || latest?.set_r || '',
        set_o: inp.today_set_o || inp.set_o || latest?.set_o || '',
        input_method: inp.today_inputMethod || 'manual',
        ocr_confidence: inp.today_ocrConfidence || null,
      })
    }

    setSavedSet(prev => new Set([...prev, currentBooth.booth_code]))
    clearPatrolDraft(currentBooth.booth_code)
    return { ok: true }
  }

  const draftCount = getDraftList().length

  return {
    loading, machineName, storeName,
    booths, currentIndex, setCurrentIndex, currentBooth,
    readingsMap, inputs, monthlyStatsMap,
    prevDayDate, setPrevDayDate, todayDate,
    // 現在ブース計算値
    currentInp, price, latest, last,
    latestIn, latestOut, lastIn, lastOut,
    inDiff, outDiff, inAbnormal, outAbnormal,
    inZero, inTriple, payoutRate, payoutHigh, payoutLow,
    // 当日付計算値
    todayInDiff, todayOutDiff, todayInAbnormal, todayOutAbnormal,
    todayInZero, todayPayoutRate, todayPayoutHigh, todayPayoutLow,
    // 操作
    setInp, switchBooth, handleSave,
    // 状態
    savedSet, savedCount, draftCount,
  }
}
