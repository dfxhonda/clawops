// ============================================
// usePatrolForm: 巡回入力フォーム状態管理
// ============================================
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getLastReadingV2, getMachineInfo, saveReadingV2 } from '../services/patrolV2'
import { getDateOptions } from '../utils/format'

// aut) category + outCount → pattern
export function detectPattern(category, outCount) {
  if (category === 'crane') return outCount === 0 ? 'A0' : 'A'
  if (category === 'gacha') return outCount >= 2 ? 'D2' : 'D1'
  if (category === 'other' && outCount >= 3) return 'B'
  if (category === 'other' && outCount === 0) return 'A0'
  return 'A'
}

function makeOut(n) {
  return Array.from({ length: n }, () => ({ meter: '', zan: '', ho: 'ー', prize: '', prize_id: '', cost: '' }))
}
function makeTouchedOut(n) {
  return Array.from({ length: n }, () => ({ meter: false, zan: false, ho: false, prize: false, cost: false }))
}
function makeInitialSection(outCount) {
  return {
    readDate: '',
    inMeter: '', inTouched: false,
    outs: makeOut(outCount),
    touchedOuts: makeTouchedOut(outCount),
    setA: '', setC: '', setL: '', setR: '', setO: '',
    touchedSet: { A: false, C: false, L: false, R: false, O: false },
  }
}

export function usePatrolForm(booth) {
  const [loading, setLoading] = useState(true)
  const [machineInfo, setMachineInfo] = useState(null)
  const [prev, setPrev] = useState(null)      // last reading from DB
  const dateOpts = useMemo(() => getDateOptions(7), [])
  const [readDate, setReadDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const [patrol, setPatrol] = useState(null)   // patrol section state
  const [change, setChange] = useState(null)   // change section state

  // ── 初期ロード ──────────────────────────────────
  useEffect(() => {
    if (!booth?.machine_code) return
    setLoading(true)
    Promise.all([
      getMachineInfo(booth.machine_code),
      getLastReadingV2(booth.booth_code),
    ]).then(([info, lastR]) => {
      const outCount = info?.outCount || 1
      const effectivePlayPrice = booth?.play_price || info?.playPrice || 100
      setMachineInfo({ ...info, playPrice: effectivePlayPrice })
      setPrev(lastR)

      // 初期値セット
      const initP = makeInitialSection(outCount)
      initP.readDate = readDate
      initP.inMeter = lastR?.inMeter != null ? String(lastR.inMeter) : ''

      // OUT初期値: 前回OUT値（グレー表示、未タッチ）
      const prevOuts = [
        { meter: lastR?.outMeter, prize: lastR?.prizeName, prizeId: lastR?.prizeId, cost: lastR?.prizeCost1, zan: null, ho: null },
        { meter: lastR?.outMeter2, prize: lastR?.prizeName2, prizeId: null, cost: lastR?.prizeCost2, zan: null, ho: null },
        { meter: lastR?.outMeter3, prize: lastR?.prizeName3, prizeId: null, cost: lastR?.prizeCost3, zan: null, ho: null },
      ]
      initP.outs = initP.outs.map((o, i) => {
        const p = prevOuts[i]
        const prevZan = i === 0 ? lastR?.stock1 : i === 1 ? lastR?.stock2 : lastR?.stock3
        const prevHo  = i === 0 ? lastR?.restock1 : i === 1 ? lastR?.restock2 : lastR?.restock3
        return {
          ...o,
          meter: p?.meter != null ? String(p.meter) : '',
          zan: prevZan != null ? String((prevZan || 0) + (prevHo || 0)) : '', // 理論残=前回残+前回補
          prize: p?.prize || '',
          prize_id: p?.prizeId || '',
          cost: p?.cost != null ? String(p.cost) : '',
        }
      })
      initP.setA = lastR?.setA || ''
      initP.setC = lastR?.setC || ''
      initP.setL = lastR?.setL || ''
      initP.setR = lastR?.setR || ''
      initP.setO = lastR?.setO || ''

      setPatrol(initP)

      // change は patrol から引き継ぎ
      setChange({ ...JSON.parse(JSON.stringify(initP)), readDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [booth?.booth_code]) // eslint-disable-line react-hooks/exhaustive-deps

  // readDate 変更時に patrol の readDate を更新
  useEffect(() => {
    if (patrol) setPatrol(p => ({ ...p, readDate }))
  }, [readDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Patrol setter ──────────────────────────────
  const setPatrolIn = useCallback((val) => {
    setPatrol(p => ({ ...p, inMeter: val, inTouched: true }))
  }, [])

  // v3 用: 指定フィールドを前回値+未タッチ状態にリセット (据え置きキー対応)
  const resetPatrolInMeter = useCallback(() => {
    setPatrol(p => ({ ...p, inMeter: prev?.inMeter != null ? String(prev.inMeter) : '', inTouched: false }))
  }, [prev])
  const resetPatrolOutMeter = useCallback((i) => {
    const prevMeters = [prev?.outMeter, prev?.outMeter2, prev?.outMeter3]
    setPatrol(p => {
      const outs = p.outs.map((o, idx) => idx === i ? { ...o, meter: prevMeters[idx] != null ? String(prevMeters[idx]) : '' } : o)
      const touchedOuts = p.touchedOuts.map((t, idx) => idx === i ? { ...t, meter: false } : t)
      return { ...p, outs, touchedOuts }
    })
  }, [prev])

  const setPatrolOut = useCallback((i, key, val) => {
    setPatrol(p => {
      const outs = p.outs.map((o, idx) => idx === i ? { ...o, [key]: val } : o)
      const touchedOuts = p.touchedOuts.map((t, idx) => idx === i ? { ...t, [key]: true } : t)
      return { ...p, outs, touchedOuts }
    })
  }, [])

  // 残欄はinputイベントのみtouched（フォーカスは対象外）
  const setPatrolZan = useCallback((i, val) => {
    setPatrol(p => {
      const outs = p.outs.map((o, idx) => idx === i ? { ...o, zan: val } : o)
      const touchedOuts = p.touchedOuts.map((t, idx) => idx === i ? { ...t, zan: true } : t)
      return { ...p, outs, touchedOuts }
    })
  }, [])

  const setPatrolSet = useCallback((key, val) => {
    setPatrol(p => ({ ...p, ['set' + key]: val, touchedSet: { ...p.touchedSet, [key]: true } }))
  }, [])

  // ── Change setter (同構造) ──────────────────────
  const setChangeIn = useCallback((val) => {
    setChange(c => ({ ...c, inMeter: val, inTouched: true }))
  }, [])

  const setChangeOut = useCallback((i, key, val) => {
    setChange(c => {
      const outs = c.outs.map((o, idx) => idx === i ? { ...o, [key]: val } : o)
      const touchedOuts = c.touchedOuts.map((t, idx) => idx === i ? { ...t, [key]: true } : t)
      return { ...c, outs, touchedOuts }
    })
  }, [])

  const setChangeZan = useCallback((i, val) => {
    setChange(c => {
      const outs = c.outs.map((o, idx) => idx === i ? { ...o, zan: val } : o)
      const touchedOuts = c.touchedOuts.map((t, idx) => idx === i ? { ...t, zan: true } : t)
      return { ...c, outs, touchedOuts }
    })
  }, [])

  const setChangeSet = useCallback((key, val) => {
    setChange(c => ({ ...c, ['set' + key]: val, touchedSet: { ...c.touchedSet, [key]: true } }))
  }, [])

  // ── 差分・理論残の計算 ──────────────────────────
  const calc = useMemo(() => {
    if (!patrol || !prev) return null
    const prevIn = prev.inMeter != null ? Number(prev.inMeter) : null
    const inVal = patrol.inTouched && patrol.inMeter ? Number(patrol.inMeter) : prevIn
    const inDiff = inVal != null && prevIn != null ? inVal - prevIn : null

    const prevOuts = [prev.outMeter, prev.outMeter2, prev.outMeter3]
    const prevStocks = [prev.stock1, prev.stock2, prev.stock3]
    const prevRestocks = [prev.restock1, prev.restock2, prev.restock3]

    const outs = patrol.outs.map((o, i) => {
      const prevOut = prevOuts[i] != null ? Number(prevOuts[i]) : null
      const outVal = patrol.touchedOuts[i].meter && o.meter ? Number(o.meter) : prevOut
      const diff = outVal != null && prevOut != null ? outVal - prevOut : null
      const pZ = prevStocks[i] || 0
      const pH = prevRestocks[i] || 0
      const theory = diff != null ? Math.max(0, pZ + pH - (diff > 0 ? diff : 0)) : pZ + pH
      return { prevOut, outVal, diff, theory }
    })

    const inRate = outs[0].diff != null && inDiff != null && inDiff > 0
      ? outs[0].diff / inDiff * 100 : null

    return { prevIn, inVal, inDiff, outs, inRate }
  }, [patrol, prev])

  // 理論残を残欄に自動セット（未タッチなら）
  useEffect(() => {
    if (!calc || !patrol) return
    setPatrol(p => ({
      ...p,
      outs: p.outs.map((o, i) => {
        if (p.touchedOuts[i].zan) return o
        return { ...o, zan: calc.outs[i].theory != null ? String(calc.outs[i].theory) : o.zan }
      }),
    }))
  }, [calc?.outs?.map(o => o.theory).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // change の理論残も自動セット
  const changeCalc = useMemo(() => {
    if (!change || !patrol) return null
    return change.outs.map((o, i) => {
      const baseOut = patrol.outs[i].meter ? Number(patrol.outs[i].meter) : (prev?.outMeter ?? null)
      const changeOut = change.touchedOuts[i].meter && o.meter ? Number(o.meter) : baseOut
      const patrolZan = patrol.outs[i].zan ? Number(patrol.outs[i].zan) : 0
      const patrolHo = patrol.outs[i].ho !== 'ー' && patrol.outs[i].ho ? Number(patrol.outs[i].ho) : 0
      const diff = changeOut != null && baseOut != null ? changeOut - baseOut : null
      const theory = diff != null ? Math.max(0, patrolZan + patrolHo - (diff > 0 ? diff : 0)) : patrolZan + patrolHo
      return { diff, theory }
    })
  }, [change, patrol, prev])

  useEffect(() => {
    if (!changeCalc || !change) return
    setChange(c => ({
      ...c,
      outs: c.outs.map((o, i) => {
        if (c.touchedOuts[i].zan) return o
        return { ...o, zan: changeCalc[i].theory != null ? String(changeCalc[i].theory) : o.zan }
      }),
    }))
  }, [changeCalc?.map(o => o.theory).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 変更タイプ判定 ──────────────────────────────
  const changeType = useMemo(() => {
    if (!patrol || !change) return 'none'
    const prizeChanged = change.outs.some((o, i) =>
      change.touchedOuts[i].prize && o.prize !== patrol.outs[i].prize
    )
    if (prizeChanged) return 'replace'
    const setChanged = ['A','C','L','R','O'].some(k =>
      change.touchedSet[k] && change['set'+k] !== patrol['set'+k]
    )
    if (setChanged) return 'config'
    return 'none'
  }, [patrol, change])

  // ── リセット ────────────────────────────────────
  const resetPatrol = useCallback(() => {
    const outCount = machineInfo?.outCount || 1
    const initP = makeInitialSection(outCount)
    initP.readDate = readDate
    if (prev) {
      initP.inMeter = prev.inMeter != null ? String(prev.inMeter) : ''
      const prevOuts = [
        { meter: prev.outMeter, prize: prev.prizeName, prizeId: prev.prizeId, cost: prev.prizeCost1 },
        { meter: prev.outMeter2, prize: prev.prizeName2, prizeId: null, cost: prev.prizeCost2 },
        { meter: prev.outMeter3, prize: prev.prizeName3, prizeId: null, cost: prev.prizeCost3 },
      ]
      const prevStocks = [prev.stock1, prev.stock2, prev.stock3]
      const prevRestocks = [prev.restock1, prev.restock2, prev.restock3]
      initP.outs = initP.outs.map((o, i) => ({
        ...o,
        meter: prevOuts[i]?.meter != null ? String(prevOuts[i].meter) : '',
        zan: prevStocks[i] != null ? String((prevStocks[i]||0) + (prevRestocks[i]||0)) : '',
        ho: 'ー',
        prize: prevOuts[i]?.prize || '',
        prize_id: prevOuts[i]?.prizeId || '',
        cost: prevOuts[i]?.cost != null ? String(prevOuts[i].cost) : '',
      }))
      initP.setA = prev.setA || ''; initP.setC = prev.setC || ''
      initP.setL = prev.setL || ''; initP.setR = prev.setR || ''
      initP.setO = prev.setO || ''
    }
    setPatrol(initP)
  }, [machineInfo, prev, readDate])

  const resetChange = useCallback(() => {
    if (!patrol) return
    setChange({ ...JSON.parse(JSON.stringify(patrol)), readDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) })
  }, [patrol])

  // patrol → change 同期（changeが未タッチの場合）
  useEffect(() => {
    if (!patrol || !change) return
    setChange(c => ({
      ...c,
      inMeter: c.inTouched ? c.inMeter : patrol.inMeter,
      outs: c.outs.map((o, i) => ({
        ...o,
        meter: c.touchedOuts[i].meter ? o.meter : patrol.outs[i].meter,
        prize: c.touchedOuts[i].prize ? o.prize : patrol.outs[i].prize,
        cost: c.touchedOuts[i].cost ? o.cost : patrol.outs[i].cost,
      })),
      setA: c.touchedSet.A ? c.setA : patrol.setA,
      setC: c.touchedSet.C ? c.setC : patrol.setC,
      setL: c.touchedSet.L ? c.setL : patrol.setL,
      setR: c.touchedSet.R ? c.setR : patrol.setR,
      setO: c.touchedSet.O ? c.setO : patrol.setO,
    }))
  }, [patrol]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 修正モード初期化（既存DBレコードから全フィールドをロード）──
  const loadCorrectionData = useCallback((record) => {
    if (!record || !machineInfo) return
    const oc = machineInfo.outCount || 1
    const outs = [
      { meter: record.out_meter != null ? String(record.out_meter) : '',
        zan: record.prize_stock_count != null ? String(record.prize_stock_count) : '',
        ho: record.prize_restock_count != null ? String(record.prize_restock_count) : 'ー',
        prize: record.prize_name || '', cost: record.prize_cost != null ? String(record.prize_cost) : '' },
      { meter: record.out_meter_2 != null ? String(record.out_meter_2) : '',
        zan: record.stock_2 != null ? String(record.stock_2) : '',
        ho: record.restock_2 != null ? String(record.restock_2) : 'ー',
        prize: record.prize_name_2 || '', cost: record.prize_cost_2 != null ? String(record.prize_cost_2) : '' },
      { meter: record.out_meter_3 != null ? String(record.out_meter_3) : '',
        zan: record.stock_3 != null ? String(record.stock_3) : '',
        ho: record.restock_3 != null ? String(record.restock_3) : 'ー',
        prize: record.prize_name_3 || '', cost: record.prize_cost_3 != null ? String(record.prize_cost_3) : '' },
    ]
    const touchedOuts = Array.from({ length: oc }, () => ({ meter: true, zan: true, ho: true, prize: false, cost: false }))
    setReadDate(record.patrol_date)
    setPatrol(p => ({
      ...p,
      readDate: record.patrol_date,
      inMeter: record.in_meter != null ? String(record.in_meter) : '',
      inTouched: true,
      outs: outs.slice(0, oc),
      touchedOuts,
      setA: record.set_a || '', setC: record.set_c || '',
      setL: record.set_l || '', setR: record.set_r || '',
      setO: record.set_o || '',
    }))
  }, [machineInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 入替変更モード初期化（メーター系空、景品/設定は前回値）──
  const loadReplaceData = useCallback((record) => {
    if (!record || !machineInfo) return
    const oc = machineInfo.outCount || 1
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    const outs = [
      { meter: '', zan: '', ho: 'ー',
        prize: record.prize_name || '', cost: record.prize_cost != null ? String(record.prize_cost) : '' },
      { meter: '', zan: '', ho: 'ー',
        prize: record.prize_name_2 || '', cost: record.prize_cost_2 != null ? String(record.prize_cost_2) : '' },
      { meter: '', zan: '', ho: 'ー',
        prize: record.prize_name_3 || '', cost: record.prize_cost_3 != null ? String(record.prize_cost_3) : '' },
    ]
    const touchedOuts = Array.from({ length: oc }, () => ({ meter: false, zan: false, ho: false, prize: true, cost: true }))
    setReadDate(today)
    setPatrol(p => ({
      ...p,
      readDate: today,
      inMeter: '',
      inTouched: false,
      outs: outs.slice(0, oc),
      touchedOuts,
      setA: record.set_a || '', setC: record.set_c || '',
      setL: record.set_l || '', setR: record.set_r || '',
      setO: record.set_o || '',
    }))
  }, [machineInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 保存 ────────────────────────────────────────
  const save = useCallback(async (staffId, extraData = {}) => {
    if (!patrol || !booth) return { ok: false, message: 'データがありません' }
    if (!patrol.inMeter && calc?.prevIn == null) return { ok: false, message: 'INメーターを入力してください' }

    // 差分を付加して保存用データ構築
    const playPrice = machineInfo?.playPrice || 100
    const patrolData = {
      ...patrol,
      playPrice,
      inDiff: calc?.inDiff,
      outs: patrol.outs.map((o, i) => ({ ...o, diff: calc?.outs[i]?.diff })),
    }
    const changeData = changeType !== 'none' ? {
      ...change,
      playPrice,
      entryType: changeType,
      inDiff: null,
    } : { entryType: 'none' }

    // 全メーター未タッチ → carry_forward として保存
    const noMeter = !patrol.inTouched && !patrol.touchedOuts.some(t => t.meter)
    const entryType = noMeter ? 'carry_forward' : 'patrol'

    try {
      await saveReadingV2({
        boothCode: booth.booth_code,
        patrol: patrolData,
        change: changeData,
        outCount: machineInfo?.outCount || 1,
        staffId,
        entryType,
        photoUrl: extraData.photoUrl || null,
        croppedPhotoUrl: extraData.croppedPhotoUrl || null,
        ocrRawText: extraData.ocrRawText || null,
        ocrAttemptedAt: extraData.ocrAttemptedAt || null,
        inputMethod: extraData.inputMethod || null,
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e.message }
    }
  }, [patrol, change, calc, changeType, booth, machineInfo])

  const outCount = machineInfo?.outCount || 1
  const pattern = machineInfo ? detectPattern(machineInfo.category, outCount) : 'A'

  return {
    loading, machineInfo, prev,
    readDate, setReadDate,
    patrol, change,
    setPatrolIn, setPatrolOut, setPatrolZan, setPatrolSet,
    setChangeIn, setChangeOut, setChangeZan, setChangeSet,
    resetPatrol, resetChange,
    resetPatrolInMeter, resetPatrolOutMeter,
    calc, changeCalc, changeType,
    outCount, pattern,
    save,
    loadCorrectionData, loadReplaceData,
    setPrevOverride: setPrev,
  }
}
