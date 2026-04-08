// ============================================
// useBoothInput: BoothInput ページのビジネスロジック
// データ取得・入力・保存・車在庫管理を分離
// ============================================
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { getBooths, getMachines } from '../services/masters'
import { getLastReadingsMap } from '../services/readings'
import { parseNum } from '../services/utils'
import { getStocksByOwner, getPrizeStocksExtended } from '../services/inventory'
import { transferStock, MOVEMENT_TYPES } from '../services/movements'
import { getDailyBoothStats } from '../services/stats'
import { useAuth } from '../lib/auth/AuthProvider'

// BoothInput は clawops_drafts（配列形式）を使う（MainInput の v2 とは別）
const DRAFT_KEY = 'clawops_drafts'
function getDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '[]') } catch { return [] } }
function saveDraftItem(draft) {
  const drafts = getDrafts()
  const idx = drafts.findIndex(d => String(d.booth_id) === String(draft.booth_id))
  if (idx >= 0) drafts[idx] = { ...drafts[idx], ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

// Enter順序
const FIELD_ORDER = ['in_meter', 'out_meter', 'prize_stock', 'prize_restock', 'set_a', 'set_c', 'set_l', 'set_r', 'set_o', 'prize_name']

export function useBoothInput(machineId, storeInfo) {
  const { staffId: authStaffId } = useAuth()
  const [booths, setBooths] = useState([])
  const [machineName, setMachineName] = useState('')
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(true)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [vehicleStocks, setVehicleStocks] = useState([])
  const [showVehiclePanel, setShowVehiclePanel] = useState(false)
  const [staffId, setStaffIdState] = useState(() => authStaffId || '')
  const [filter, setFilter] = useState('all')
  const [monthlyStatsMap, setMonthlyStatsMap] = useState({})

  // ref管理
  const refsMap = useRef({})
  const getRef = useCallback((boothId, fieldName) => {
    if (!refsMap.current[boothId]) refsMap.current[boothId] = {}
    return (el) => { refsMap.current[boothId][fieldName] = el }
  }, [])

  // ===== データ取得 =====
  useEffect(() => {
    async function load() {
      setLoading(true)
      const bs = await getBooths(machineId)
      setBooths(bs)
      const map = await getLastReadingsMap(bs.map(b => b.booth_code))
      setReadingsMap(map)
      // ドラフト復元
      const drafts = getDrafts()
      const restored = {}
      for (const b of bs) {
        const draft = drafts.find(d => String(d.booth_id) === String(b.booth_code))
        if (draft) {
          restored[b.booth_code] = {
            in_meter: draft.in_meter, out_meter: draft.out_meter,
            prize_restock: draft.prize_restock_count, prize_stock: draft.prize_stock_count,
            prize_name: draft.prize_name,
            set_a: draft.set_a, set_c: draft.set_c, set_l: draft.set_l, set_r: draft.set_r, set_o: draft.set_o,
          }
        }
      }
      setInputs(restored)
      // 車在庫
      const sid = authStaffId
      if (sid) {
        try {
          const vs = await getStocksByOwner('staff', sid)
          setVehicleStocks(vs)
        } catch { /* ignore */ }
      }
      if (storeInfo?.storeId) {
        const machines = await getMachines(storeInfo.storeId)
        const m = machines.find(x => String(x.machine_code) === String(machineId))
        if (m) setMachineName(m.machine_name)
      }
      setLoading(false)

      // 月次統計（非blocking: loadingをブロックしない）
      if (storeInfo?.storeId) {
        try {
          const today = new Date()
          const yr = today.getFullYear()
          const mo = today.getMonth() + 1
          const currFrom = `${yr}-${String(mo).padStart(2, '0')}-01`
          const prevMo = mo === 1 ? 12 : mo - 1
          const prevYr = mo === 1 ? yr - 1 : yr
          const prevFrom = `${prevYr}-${String(prevMo).padStart(2, '0')}-01`
          // new Date(yr, mo-1, 0) = 前月末日（monthは0-indexed, day=0=前月末）
          const prevTo = new Date(yr, mo - 1, 0).toISOString().slice(0, 10)

          const [curr, prev] = await Promise.all([
            getDailyBoothStats({ storeId: storeInfo.storeId, dateFrom: currFrom }),
            getDailyBoothStats({ storeId: storeInfo.storeId, dateFrom: prevFrom, dateTo: prevTo }),
          ])

          const statsMap = {}
          for (const r of curr) {
            if (!statsMap[r.booth_code]) statsMap[r.booth_code] = { curr: { plays: 0, revenue: 0 }, prev: { plays: 0, revenue: 0 } }
            statsMap[r.booth_code].curr.plays   += r.play_count || 0
            statsMap[r.booth_code].curr.revenue += Number(r.revenue) || 0
          }
          for (const r of prev) {
            if (!statsMap[r.booth_code]) statsMap[r.booth_code] = { curr: { plays: 0, revenue: 0 }, prev: { plays: 0, revenue: 0 } }
            statsMap[r.booth_code].prev.plays   += r.play_count || 0
            statsMap[r.booth_code].prev.revenue += Number(r.revenue) || 0
          }
          setMonthlyStatsMap(statsMap)
        } catch { /* ignore */ }
      }
    }
    load()
  }, [machineId])

  // ===== 入力操作 =====
  function setInp(boothId, key, val) {
    setInputs(prev => ({ ...prev, [boothId]: { ...(prev[boothId] || {}), [key]: val } }))
  }

  // フィルタリング
  const isEntered = (b) => !!(inputs[b.booth_code]?.in_meter)
  const inputCount = booths.filter(isEntered).length
  const filteredBooths = filter === 'all' ? booths
    : filter === 'todo' ? booths.filter(b => !isEntered(b))
    : booths.filter(b => isEntered(b))

  // 異常値ブース数（確認モーダル用）
  const anomalyCount = useMemo(() => {
    return booths.filter(b => {
      const inp = inputs[b.booth_code] || {}
      if (!inp.in_meter) return false
      const { latest, last } = readingsMap[b.booth_code] || {}
      const inVal = parseNum(inp.in_meter)
      const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
      const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
      const lastIn   = last?.in_meter   ? parseNum(last.in_meter)   : null
      const lastOut  = last?.out_meter  ? parseNum(last.out_meter)  : null
      const inDiff  = lastIn !== null ? inVal - lastIn : null
      const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null
      const prevInDiff = latestIn !== null && lastIn !== null ? latestIn - lastIn : null
      const payoutRate = outDiff !== null && outDiff >= 0 && inDiff && inDiff > 0
        ? outDiff / inDiff * 100 : null
      return (
        (inDiff !== null && (inDiff < 0 || inDiff > 50000)) ||
        (outDiff !== null && (outDiff < 0 || outDiff > 50000)) ||
        inDiff === 0 ||
        (prevInDiff !== null && prevInDiff > 50 && inDiff !== null && inDiff > prevInDiff * 3) ||
        (payoutRate !== null && (payoutRate >= 30 || payoutRate < 5))
      )
    }).length
  }, [booths, inputs, readingsMap])

  // Enter → 次フィールド（filteredBooths ベース）
  function handleKeyDown(e, boothId, fieldName) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const boothIdx = filteredBooths.findIndex(b => b.booth_code === boothId)
    const fieldIdx = FIELD_ORDER.indexOf(fieldName)
    if (fieldIdx < FIELD_ORDER.length - 1) {
      const nextField = FIELD_ORDER[fieldIdx + 1]
      refsMap.current[boothId]?.[nextField]?.focus()
    } else if (boothIdx < filteredBooths.length - 1) {
      const nextBoothId = filteredBooths[boothIdx + 1].booth_code
      refsMap.current[nextBoothId]?.['in_meter']?.focus()
      refsMap.current[nextBoothId]?.['in_meter']?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // 指定ブースへスクロール（スワイプ切り替え用）
  function scrollToBooth(boothId) {
    const el = refsMap.current[boothId]?.['in_meter']
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ===== 担当者管理 =====
  function setStaffId(id) {
    setStaffIdState(id)
  }
  function clearStaff() {
    setStaffIdState('')
    setVehicleStocks([])
  }

  // ===== 保存 =====
  async function handleSaveAll() {
    let count = 0
    const replenishItems = []
    for (const booth of booths) {
      const inp = inputs[booth.booth_code] || {}
      const { latest } = readingsMap[booth.booth_code] || {}
      const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
      const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
      const finalIn = inp.in_meter || (latestIn !== null ? String(latestIn) : '')
      if (!finalIn) continue
      const finalOut = inp.out_meter || (latestOut !== null ? String(latestOut) : '')
      const restockCount = parseInt(inp.prize_restock) || 0
      const prizeName = inp.prize_name || latest?.prize_name || ''
      saveDraftItem({
        read_date: readDate,
        booth_id: booth.booth_code, full_booth_code: booth.booth_code,
        in_meter: finalIn, out_meter: finalOut,
        prev_in_meter:  latestIn  !== null ? String(latestIn)  : '',
        prev_out_meter: latestOut !== null ? String(latestOut) : '',
        play_price:     booth.play_price || 100,
        prize_restock_count: inp.prize_restock || '',
        prize_stock_count: inp.prize_stock || '',
        prize_name: prizeName,
        note: inp.note || '',
        set_a: inp.set_a || latest?.set_a || '',
        set_c: inp.set_c || latest?.set_c || '',
        set_l: inp.set_l || latest?.set_l || '',
        set_r: inp.set_r || latest?.set_r || '',
        set_o: inp.set_o || latest?.set_o || '',
      })
      count++
      if (restockCount > 0 && staffId && prizeName) {
        replenishItems.push({ boothCode: booth.booth_code, prizeName, quantity: restockCount })
      }
    }
    if (count === 0) {
      return { ok: false, message: 'まだINメーターが入力されていません。\nブースのIN欄に売上メーター値を入力してください。' }
    }

    // 補充分を車在庫から自動引き算
    const failedItems = []
    if (replenishItems.length > 0 && staffId) {
      const allStocks = await getPrizeStocksExtended(true)
      for (const item of replenishItems) {
        const stock = allStocks.find(s => s.owner_type === 'staff' && s.owner_id === staffId && s.prize_name === item.prizeName)
        if (!stock) { failedItems.push({ ...item, error: '車在庫に該当景品なし' }); continue }
        try {
          await transferStock({
            prizeId: stock.prize_id, prizeName: item.prizeName,
            fromOwnerType: 'staff', fromOwnerId: staffId,
            toOwnerType: 'booth', toOwnerId: item.boothCode,
            quantity: item.quantity,
            note: `巡回補充: ${item.prizeName} → ${item.boothCode}`,
            createdBy: staffId,
            movementType: MOVEMENT_TYPES.REPLENISH,
            reason_code: 'REPLENISH',
          })
        } catch (e) {
          failedItems.push({ ...item, error: e.message })
        }
      }
      // 車在庫リフレッシュ
      try {
        const vs = await getStocksByOwner('staff', staffId)
        setVehicleStocks(vs)
      } catch { /* ignore */ }
    }

    return { ok: true, count, failedItems }
  }

  return {
    // データ
    booths, machineName, readingsMap, inputs, vehicleStocks, monthlyStatsMap,
    // 選択・フィルタ
    readDate, setReadDate, filter, setFilter, filteredBooths, inputCount, anomalyCount,
    // UI
    loading, showVehiclePanel, setShowVehiclePanel, staffId,
    // 操作
    setInp, handleKeyDown, handleSaveAll, getRef, setStaffId, clearStaff, scrollToBooth,
  }
}
