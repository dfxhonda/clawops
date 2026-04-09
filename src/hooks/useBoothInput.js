// ============================================
// useBoothInput: BoothInput ページのビジネスロジック
// データ取得・入力・保存・車在庫管理を分離
// ============================================
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { getBooths, getMachines } from '../services/masters'
import { getLastReadingsMap, saveReading } from '../services/readings'
import { parseNum } from '../services/utils'
import { getStocksByOwner, getPrizeStocksExtended } from '../services/inventory'
import { transferStock, MOVEMENT_TYPES } from '../services/movements'
import { getDailyBoothStats } from '../services/stats'
import { useAuth } from '../lib/auth/AuthProvider'

const PATROL_DRAFT_KEY = 'clawops_patrol_drafts'
function getPatrolDrafts() { try { return JSON.parse(sessionStorage.getItem(PATROL_DRAFT_KEY) || '{}') } catch { return {} } }
function savePatrolDraft(boothId, data) {
  const d = getPatrolDrafts(); d[boothId] = data
  sessionStorage.setItem(PATROL_DRAFT_KEY, JSON.stringify(d))
}
function clearPatrolDrafts(boothIds) {
  const d = getPatrolDrafts()
  for (const id of boothIds) delete d[id]
  sessionStorage.setItem(PATROL_DRAFT_KEY, JSON.stringify(d))
}

const FIELD_ORDER = ['in_meter', 'out_meter', 'prize_stock', 'prize_restock', 'prize_name']

export function useBoothInput(machineId, storeInfo) {
  const { staffId: authStaffId } = useAuth()
  const [booths, setBooths] = useState([])
  const [machineName, setMachineName] = useState('')
  const [readingsMap, setReadingsMap] = useState({})
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(true)
  const [vehicleStocks, setVehicleStocks] = useState([])
  const [showVehiclePanel, setShowVehiclePanel] = useState(false)
  const [monthlyStatsMap, setMonthlyStatsMap] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)

  const todayDate = new Date().toISOString().slice(0, 10)
  const [prevDayDate, setPrevDayDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
  })

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
      setCurrentIndex(0)
      const map = await getLastReadingsMap(bs.map(b => b.booth_code))
      setReadingsMap(map)
      // ドラフト復元
      const drafts = getPatrolDrafts()
      const restored = {}
      for (const b of bs) {
        if (drafts[b.booth_code]) restored[b.booth_code] = drafts[b.booth_code]
      }
      setInputs(restored)
      // 車在庫
      if (authStaffId) {
        try { setVehicleStocks(await getStocksByOwner('staff', authStaffId)) } catch { /* ignore */ }
      }
      if (storeInfo?.storeId) {
        const machines = await getMachines(storeInfo.storeId)
        const m = machines.find(x => String(x.machine_code) === String(machineId))
        if (m) setMachineName(m.machine_name)
      }
      setLoading(false)
      // 月次統計（非blocking）
      if (storeInfo?.storeId) {
        try {
          const d = new Date()
          const yr = d.getFullYear(), mo = d.getMonth() + 1
          const currFrom = `${yr}-${String(mo).padStart(2, '0')}-01`
          const pm = mo === 1 ? 12 : mo - 1, py = mo === 1 ? yr - 1 : yr
          const prevFrom = `${py}-${String(pm).padStart(2, '0')}-01`
          const prevTo = new Date(yr, mo - 1, 0).toISOString().slice(0, 10)
          const [curr, prev] = await Promise.all([
            getDailyBoothStats({ storeId: storeInfo.storeId, dateFrom: currFrom }),
            getDailyBoothStats({ storeId: storeInfo.storeId, dateFrom: prevFrom, dateTo: prevTo }),
          ])
          const sm = {}
          for (const r of curr) {
            if (!sm[r.booth_code]) sm[r.booth_code] = { curr: { revenue: 0 }, prev: { revenue: 0 } }
            sm[r.booth_code].curr.revenue += Number(r.revenue) || 0
          }
          for (const r of prev) {
            if (!sm[r.booth_code]) sm[r.booth_code] = { curr: { revenue: 0 }, prev: { revenue: 0 } }
            sm[r.booth_code].prev.revenue += Number(r.revenue) || 0
          }
          setMonthlyStatsMap(sm)
        } catch { /* ignore */ }
      }
    }
    load()
  }, [machineId])

  // ===== 入力操作 =====

  // 前日付セクション用
  function setInp(boothId, key, val) {
    setInputs(prev => {
      const next = { ...prev, [boothId]: { ...(prev[boothId] || {}), [key]: val } }
      savePatrolDraft(boothId, next[boothId])
      return next
    })
  }

  // 当日付変更セクション用（type: '_meterReplace' | '_prizeChange' | '_settingsChange'）
  function setInpChange(boothId, type, key, val) {
    setInputs(prev => {
      const booth = prev[boothId] || {}
      const next = { ...prev, [boothId]: { ...booth, [type]: { ...(booth[type] || {}), [key]: val } } }
      savePatrolDraft(boothId, next[boothId])
      return next
    })
  }

  // 変更セクションのON/OFF切替
  function toggleChange(boothId, type) {
    setInputs(prev => {
      const booth = prev[boothId] || {}
      const cur = booth[type] || {}
      const next = { ...prev, [boothId]: { ...booth, [type]: { ...cur, enabled: !cur.enabled } } }
      savePatrolDraft(boothId, next[boothId])
      return next
    })
  }

  // ブース切り替え
  function switchBooth(direction) {
    setCurrentIndex(prev =>
      direction === 'next' ? Math.min(prev + 1, booths.length - 1) : Math.max(prev - 1, 0)
    )
  }

  // Enter → 次フィールド（現在のブース内）
  function handleKeyDown(e, boothId, fieldName) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const fi = FIELD_ORDER.indexOf(fieldName)
    if (fi >= 0 && fi < FIELD_ORDER.length - 1) {
      refsMap.current[boothId]?.[FIELD_ORDER[fi + 1]]?.focus()
    }
  }

  // ===== 集計 =====

  const inputCount = booths.filter(b => inputs[b.booth_code]?.in_meter).length

  const changeCount = useMemo(() => booths.reduce((sum, b) => {
    const inp = inputs[b.booth_code] || {}
    let c = 0
    if (inp._meterReplace?.enabled && inp._meterReplace.in_meter) c++
    if (inp._prizeChange?.enabled && inp._prizeChange.prize_name) c++
    if (inp._settingsChange?.enabled &&
        (inp._settingsChange.set_a || inp._settingsChange.set_c || inp._settingsChange.set_l ||
         inp._settingsChange.set_r || inp._settingsChange.set_o)) c++
    return sum + c
  }, 0), [booths, inputs])

  const anomalyCount = useMemo(() => booths.filter(b => {
    const inp = inputs[b.booth_code] || {}
    if (!inp.in_meter) return false
    const { latest, last } = readingsMap[b.booth_code] || {}
    const inVal = parseNum(inp.in_meter)
    const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
    const lastIn   = last?.in_meter   ? parseNum(last.in_meter)   : null
    const lastOut  = last?.out_meter  ? parseNum(last.out_meter)  : null
    const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
    const inDiff  = lastIn  !== null ? inVal - lastIn : null
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
  }).length, [booths, inputs, readingsMap])

  // ===== 保存（直接DB保存） =====

  async function handleSaveAll() {
    const toSave = []
    const replenishItems = []

    for (const booth of booths) {
      const inp = inputs[booth.booth_code] || {}
      const { latest } = readingsMap[booth.booth_code] || {}
      const latestIn  = latest?.in_meter  ? parseNum(latest.in_meter)  : null
      const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
      const prizeName = inp.prize_name || latest?.prize_name || ''

      // 前日付メーター読み（明示的に入力したブースのみ）
      if (inp.in_meter) {
        toSave.push({
          _type: 'prev',
          read_date: prevDayDate,
          booth_id: booth.booth_code, full_booth_code: booth.booth_code,
          in_meter: inp.in_meter,
          out_meter: inp.out_meter || (latestOut !== null ? String(latestOut) : ''),
          prev_in_meter:  latestIn  !== null ? String(latestIn)  : '',
          prev_out_meter: latestOut !== null ? String(latestOut) : '',
          play_price: booth.play_price || 100,
          prize_restock_count: inp.prize_restock || '',
          prize_stock_count:   inp.prize_stock   || '',
          prize_name: prizeName,
          set_a: inp.set_a || latest?.set_a || '',
          set_c: inp.set_c || latest?.set_c || '',
          set_l: inp.set_l || latest?.set_l || '',
          set_r: inp.set_r || latest?.set_r || '',
          set_o: inp.set_o || latest?.set_o || '',
          source: 'patrol',
        })
        const rc = parseInt(inp.prize_restock) || 0
        if (rc > 0 && authStaffId && prizeName) {
          replenishItems.push({ boothCode: booth.booth_code, prizeName, quantity: rc })
        }
      }

      // メーター取り替え（当日付）
      const mr = inp._meterReplace
      if (mr?.enabled && mr.in_meter) {
        toSave.push({
          _type: 'meter_replace',
          read_date: todayDate,
          booth_id: booth.booth_code, full_booth_code: booth.booth_code,
          in_meter: mr.in_meter, out_meter: mr.out_meter || '',
          prize_name: prizeName, source: 'meter_replace',
        })
      }

      // 景品変更（当日付）
      const pc = inp._prizeChange
      if (pc?.enabled && pc.prize_name) {
        toSave.push({
          _type: 'prize_change',
          read_date: todayDate,
          booth_id: booth.booth_code, full_booth_code: booth.booth_code,
          in_meter:  latestIn  !== null ? String(latestIn)  : '',
          out_meter: latestOut !== null ? String(latestOut) : '',
          prize_name: pc.prize_name,
          prize_stock_count:   pc.prize_stock   || '',
          prize_restock_count: pc.prize_restock || '',
          source: 'prize_change',
        })
      }

      // 設定変更（当日付）
      const sc = inp._settingsChange
      if (sc?.enabled && (sc.set_a || sc.set_c || sc.set_l || sc.set_r || sc.set_o)) {
        toSave.push({
          _type: 'settings_change',
          read_date: todayDate,
          booth_id: booth.booth_code, full_booth_code: booth.booth_code,
          in_meter:  latestIn  !== null ? String(latestIn)  : '',
          out_meter: latestOut !== null ? String(latestOut) : '',
          prize_name: prizeName,
          set_a: sc.set_a || '', set_c: sc.set_c || '',
          set_l: sc.set_l || '', set_r: sc.set_r || '', set_o: sc.set_o || '',
          source: 'settings_change',
        })
      }
    }

    if (toSave.filter(x => x._type === 'prev').length === 0) {
      return { ok: false, message: 'まだINメーターが入力されていません。\nブースのIN欄に売上メーター値を入力してください。' }
    }

    const savedPrev = []
    try {
      for (const r of toSave) {
        await saveReading(r)
        if (r._type === 'prev') savedPrev.push(r)
      }

      // 補充分を車在庫から自動引き算
      const failedItems = []
      if (replenishItems.length > 0 && authStaffId) {
        const allStocks = await getPrizeStocksExtended(true)
        for (const item of replenishItems) {
          const stock = allStocks.find(s =>
            s.owner_type === 'staff' && s.owner_id === authStaffId && s.prize_name === item.prizeName
          )
          if (!stock) { failedItems.push({ ...item, error: '車在庫に該当景品なし' }); continue }
          try {
            await transferStock({
              prizeId: stock.prize_id, prizeName: item.prizeName,
              fromOwnerType: 'staff', fromOwnerId: authStaffId,
              toOwnerType: 'booth', toOwnerId: item.boothCode,
              quantity: item.quantity,
              note: `巡回補充: ${item.prizeName} → ${item.boothCode}`,
              createdBy: authStaffId, movementType: MOVEMENT_TYPES.REPLENISH, reason_code: 'REPLENISH',
            })
          } catch (e) { failedItems.push({ ...item, error: e.message }) }
        }
        try { setVehicleStocks(await getStocksByOwner('staff', authStaffId)) } catch { /* ignore */ }
      }

      clearPatrolDrafts(booths.map(b => b.booth_code))
      setInputs({})
      return { ok: true, totalCount: toSave.length, prevCount: savedPrev.length, savedDrafts: savedPrev, failedItems }
    } catch (e) {
      return { ok: false, message: '保存に失敗しました。通信状態を確認してリトライしてください。(' + e.message + ')' }
    }
  }

  return {
    // データ
    booths, machineName, readingsMap, inputs, vehicleStocks, monthlyStatsMap,
    // 日付
    prevDayDate, setPrevDayDate, todayDate,
    // UI状態
    loading, showVehiclePanel, setShowVehiclePanel,
    // ブース切り替え
    currentIndex, setCurrentIndex, currentBooth: booths[currentIndex] || null,
    // 集計
    inputCount, changeCount, anomalyCount,
    // 操作
    setInp, setInpChange, toggleChange, handleKeyDown, handleSaveAll, getRef, switchBooth,
  }
}
