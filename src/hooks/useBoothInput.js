// ============================================
// useBoothInput: BoothInput ページのビジネスロジック
// データ取得・入力・保存・車在庫管理を分離
// ============================================
import { useEffect, useState, useRef, useCallback } from 'react'
import { getBooths, getMachines } from '../services/masters'
import { getLastReadingsMap } from '../services/readings'
import { parseNum } from '../services/utils'
import { getStocksByOwner, adjustPrizeStockQuantity, getPrizeStocksExtended } from '../services/inventory'
import { addStockMovement, MOVEMENT_TYPES } from '../services/movements'
import { getStaffId } from '../lib/auth/session'

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
  const [booths, setBooths] = useState([])
  const [machineName, setMachineName] = useState('')
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(true)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [vehicleStocks, setVehicleStocks] = useState([])
  const [showVehiclePanel, setShowVehiclePanel] = useState(false)
  const [staffId, setStaffIdState] = useState(() => getStaffId() || '')
  const [filter, setFilter] = useState('all')

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
      // 車在庫
      const sid = getStaffId()
      if (sid) {
        try {
          const vs = await getStocksByOwner('staff', sid)
          setVehicleStocks(vs)
        } catch { /* ignore */ }
      }
      if (storeInfo?.storeId) {
        const machines = await getMachines(storeInfo.storeId)
        const m = machines.find(x => String(x.machine_id) === String(machineId))
        if (m) setMachineName(m.machine_name)
      }
      setLoading(false)
    }
    load()
  }, [machineId])

  // ===== 入力操作 =====
  function setInp(boothId, key, val) {
    setInputs(prev => ({ ...prev, [boothId]: { ...(prev[boothId] || {}), [key]: val } }))
  }

  // フィルタリング
  const isEntered = (b) => !!(inputs[b.booth_id]?.in_meter)
  const inputCount = booths.filter(isEntered).length
  const filteredBooths = filter === 'all' ? booths
    : filter === 'todo' ? booths.filter(b => !isEntered(b))
    : booths.filter(b => isEntered(b))

  // Enter → 次フィールド（filteredBooths ベース）
  function handleKeyDown(e, boothId, fieldName) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const boothIdx = filteredBooths.findIndex(b => b.booth_id === boothId)
    const fieldIdx = FIELD_ORDER.indexOf(fieldName)
    if (fieldIdx < FIELD_ORDER.length - 1) {
      const nextField = FIELD_ORDER[fieldIdx + 1]
      refsMap.current[boothId]?.[nextField]?.focus()
    } else if (boothIdx < filteredBooths.length - 1) {
      const nextBoothId = filteredBooths[boothIdx + 1].booth_id
      refsMap.current[nextBoothId]?.['in_meter']?.focus()
      refsMap.current[nextBoothId]?.['in_meter']?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
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
      const inp = inputs[booth.booth_id] || {}
      const { latest } = readingsMap[booth.booth_id] || {}
      const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
      const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
      const finalIn = inp.in_meter || (latestIn !== null ? String(latestIn) : '')
      if (!finalIn) continue
      const finalOut = inp.out_meter || (latestOut !== null ? String(latestOut) : '')
      const restockCount = parseInt(inp.prize_restock) || 0
      const prizeName = inp.prize_name || latest?.prize_name || ''
      saveDraftItem({
        read_date: readDate,
        booth_id: booth.booth_id, full_booth_code: booth.full_booth_code,
        in_meter: finalIn, out_meter: finalOut,
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
        replenishItems.push({ boothCode: booth.full_booth_code, prizeName, quantity: restockCount })
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
          await addStockMovement({
            prize_id: stock.prize_id, movement_type: MOVEMENT_TYPES.REPLENISH,
            from_owner_type: 'staff', from_owner_id: staffId,
            to_owner_type: 'booth', to_owner_id: item.boothCode,
            quantity: item.quantity, note: `巡回補充: ${item.prizeName} → ${item.boothCode}`,
            created_by: staffId
          })
          await adjustPrizeStockQuantity(stock.stock_id, -item.quantity, staffId)
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
    booths, machineName, readingsMap, inputs, vehicleStocks,
    // 選択・フィルタ
    readDate, setReadDate, filter, setFilter, filteredBooths, inputCount,
    // UI
    loading, showVehiclePanel, setShowVehiclePanel, staffId,
    // 操作
    setInp, handleKeyDown, handleSaveAll, getRef, setStaffId, clearStaff,
  }
}
