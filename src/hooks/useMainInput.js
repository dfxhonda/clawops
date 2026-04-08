// ============================================
// useMainInput: MainInput ページのビジネスロジック
// データ取得・入力管理・保存・集計を分離
// ============================================
import { useEffect, useState, useRef, useCallback } from 'react'
import { getStores, getMachines, getBooths } from '../services/masters'
import { getLastReadingsMap, getAllMeterReadings, saveReading } from '../services/readings'
import { parseNum } from '../services/utils'
import { getDrafts, setDrafts, clearDraftBooths, saveDraftBooth } from './useDrafts'

export function useMainInput() {
  // マスタデータ
  const [stores, setStores] = useState([])
  const [machines, setMachines] = useState([])
  const [booths, setBooths] = useState([])
  const [readingsMap, setReadingsMap] = useState({})
  const [allReadings, setAllReadings] = useState([])

  // 選択状態
  const [storeId, setStoreId] = useState(null)
  const [machineId, setMachineId] = useState(null)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0, 10))

  // 入力データ
  const [inputs, setInputs] = useState({})

  // UI状態
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedSettings, setExpandedSettings] = useState({})

  // refs（キーボードナビゲーション）
  const refsMap = useRef({})
  const getRef = useCallback((boothId, field) => {
    if (!refsMap.current[boothId]) refsMap.current[boothId] = {}
    return (el) => { refsMap.current[boothId][field] = el }
  }, [])

  // ===== データ取得 =====

  // 初回ロード: 店舗一覧
  useEffect(() => {
    getStores().then(s => {
      setStores(s)
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [])

  // 店舗変更 → 機械一覧取得
  useEffect(() => {
    if (!storeId) return
    setMachines([])
    setBooths([])
    getMachines(storeId).then(ms => {
      setMachines(ms)
      if (ms.length > 0) setMachineId(ms[0].machine_code)
      else setMachineId(null)
    })
    getAllMeterReadings().then(r => setAllReadings(r))
  }, [storeId])

  // 機械変更 → ブース + 最新読み取り取得
  useEffect(() => {
    if (!machineId) return
    setBooths([])
    async function load() {
      const bs = await getBooths(machineId)
      setBooths(bs)
      const map = await getLastReadingsMap(bs.map(b => b.booth_code))
      setReadingsMap(map)
      // ドラフト復元
      const drafts = getDrafts()
      const restored = {}
      for (const b of bs) {
        if (drafts[b.booth_code]) restored[b.booth_code] = drafts[b.booth_code]
      }
      setInputs(restored)
    }
    load()
  }, [machineId])

  // ===== 入力操作 =====

  function setInp(boothId, key, val) {
    setInputs(prev => {
      const next = { ...prev, [boothId]: { ...(prev[boothId] || {}), [key]: val } }
      saveDraftBooth(boothId, next[boothId])
      return next
    })
  }

  // Enter → 次フィールド
  const FIELD_ORDER = ['in_meter', 'out_meter', 'prize_stock', 'prize_restock']
  function handleKeyDown(e, boothId, field) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const bIdx = booths.findIndex(b => b.booth_code === boothId)
    const fIdx = FIELD_ORDER.indexOf(field)
    if (fIdx < FIELD_ORDER.length - 1) {
      const next = FIELD_ORDER[fIdx + 1]
      refsMap.current[boothId]?.[next]?.focus()
    } else if (bIdx < booths.length - 1) {
      const nextBooth = booths[bIdx + 1].booth_code
      refsMap.current[nextBooth]?.['in_meter']?.focus()
      refsMap.current[nextBooth]?.['in_meter']?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // ===== 保存 =====

  async function handleSave() {
    const toSave = []
    for (const booth of booths) {
      const inp = inputs[booth.booth_code] || {}
      const { latest } = readingsMap[booth.booth_code] || {}
      if (!inp.in_meter) continue
      toSave.push({
        read_date: readDate,
        booth_id: booth.booth_code,
        full_booth_code: booth.booth_code,
        in_meter: inp.in_meter,
        out_meter: inp.out_meter || '',
        prize_restock_count: inp.prize_restock || '',
        prize_stock_count: inp.prize_stock || '',
        prize_name: inp.prize_name || latest?.prize_name || '',
        note: '',
        set_a: inp.set_a || latest?.set_a || '',
        set_c: inp.set_c || latest?.set_c || '',
        set_l: inp.set_l || latest?.set_l || '',
        set_r: inp.set_r || latest?.set_r || '',
        set_o: inp.set_o || latest?.set_o || '',
      })
    }
    if (toSave.length === 0) {
      return { ok: false, message: 'まだINメーターが入力されていません。ブースのIN欄に売上メーター値を入力してください。' }
    }
    setSaving(true)
    try {
      for (const r of toSave) await saveReading(r)
      clearDraftBooths(toSave.map(r => r.booth_id))
      setInputs(prev => {
        const next = { ...prev }
        for (const r of toSave) delete next[r.booth_id]
        return next
      })
      // readings更新
      const fresh = await getAllMeterReadings(true)
      setAllReadings(fresh)
      const map = await getLastReadingsMap(booths.map(b => b.booth_code))
      setReadingsMap(map)
      setSaving(false)
      return { ok: true, count: toSave.length }
    } catch (e) {
      setSaving(false)
      return { ok: false, message: '保存に失敗しました。通信状態を確認してリトライしてください。(' + e.message + ')' }
    }
  }

  // ===== 集計 =====

  const currentMachine = machines.find(m => m.machine_code === machineId)
  const defaultPrice = currentMachine ? parseNum(currentMachine.default_price) || 100 : 100

  function calcBoothStats(booth) {
    const inp = inputs[booth.booth_code] || {}
    const { latest, last } = readingsMap[booth.booth_code] || {}
    const price = parseNum(booth.play_price || defaultPrice)
    const prevIn = latest?.in_meter ? parseNum(latest.in_meter) : null
    const prevOut = latest?.out_meter ? parseNum(latest.out_meter) : null
    const inVal = inp.in_meter ? parseNum(inp.in_meter) : null
    const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
    const inDiff = inVal !== null && prevIn !== null ? inVal - prevIn : null
    const outDiff = outVal !== null && prevOut !== null ? outVal - prevOut : null
    const sales = inDiff !== null && inDiff >= 0 ? inDiff * price : null
    const payoutRate = outDiff !== null && inDiff !== null && inDiff > 0
      ? ((outDiff / inDiff) * 100).toFixed(1) : null
    return { price, prevIn, prevOut, inVal, outVal, inDiff, outDiff, sales, payoutRate }
  }

  function getMachineSubtotal() {
    let totalSales = 0, prevTotalSales = 0, count = 0
    for (const booth of booths) {
      const s = calcBoothStats(booth)
      if (s.sales !== null && s.sales >= 0) { totalSales += s.sales; count++ }
      const { latest, last } = readingsMap[booth.booth_code] || {}
      if (latest && last) {
        const d = parseNum(latest.in_meter) - parseNum(last.in_meter)
        if (!isNaN(d) && d >= 0) prevTotalSales += d * s.price
      }
    }
    return { totalSales, prevTotalSales, diff: totalSales - prevTotalSales, count }
  }

  // 機械切替（スワイプ）
  function switchMachine(direction) {
    const idx = machines.findIndex(m => m.machine_code === machineId)
    if (direction === 'next' && idx < machines.length - 1) setMachineId(machines[idx + 1].machine_code)
    if (direction === 'prev' && idx > 0) setMachineId(machines[idx - 1].machine_code)
  }

  const inputCount = booths.filter(b => inputs[b.booth_code]?.in_meter).length
  const machineSub = getMachineSubtotal()
  const currentStore = stores.find(s => s.store_code === storeId)

  return {
    // データ
    stores, machines, booths, readingsMap, inputs,
    // 選択
    storeId, setStoreId, machineId, setMachineId, readDate, setReadDate,
    // UI状態
    loading, saving, expandedSettings, setExpandedSettings,
    // 操作
    setInp, handleKeyDown, handleSave, getRef, switchMachine,
    // 集計
    calcBoothStats, machineSub, inputCount, currentMachine, currentStore, defaultPrice,
  }
}
