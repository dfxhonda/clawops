import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '../../stores/dashboardStore'
import KpiCard from '../components/KpiCard'
import AlertList from '../components/AlertList'
import StoreRankingLow from '../components/StoreRankingLow'
import RateHeatmap from '../components/RateHeatmap'

function groupBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

function sum(arr, key) {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

function computeAlerts(monthReadings, heatmapReadings, avgRate, today) {
  const alerts = []

  // A) 出率異常 (heatmap 14日分)
  const boothGroups = groupBy(heatmapReadings, r => r.full_booth_code)
  const boothRates = []
  for (const [boothCode, rows] of boothGroups) {
    const inS = sum(rows, 'in_diff')
    const outS = rows.reduce((s, r) => s + (Number(r.out_diff) || 0) + (Number(r.out_diff_2) || 0), 0)
    boothRates.push({ booth_code: boothCode, rate: inS > 0 ? outS / inS : 0, in_total: inS })
  }
  const threshold = avgRate * 2
  const rateAlerts = boothRates
    .filter(b => b.rate >= threshold && b.in_total >= 50)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5)
  for (const b of rateAlerts) {
    alerts.push({
      booth_code: b.booth_code,
      severity: 'rose',
      message: `🔴 ${b.booth_code} 出率${(b.rate * 100).toFixed(1)}% (平均の${(b.rate / avgRate).toFixed(1)}倍)`,
    })
  }

  // B) 売上急減 (月次データ 直近7日 vs 前7日)
  const todayDate = new Date(today)
  const week1End = today
  const week1Start = new Date(todayDate.getTime() - 6 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const week2End = new Date(todayDate.getTime() - 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const week2Start = new Date(todayDate.getTime() - 13 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const boothMonthGroups = groupBy(monthReadings, r => r.full_booth_code)
  for (const [boothCode, rows] of boothMonthGroups) {
    const nonCF = rows.filter(r => r.entry_type !== 'carry_forward')
    const cur = sum(nonCF.filter(r => r.patrol_date >= week1Start && r.patrol_date <= week1End), 'revenue')
    const prev = sum(nonCF.filter(r => r.patrol_date >= week2Start && r.patrol_date <= week2End), 'revenue')
    if (prev >= 5000) {
      const dropRate = (cur - prev) / prev
      if (dropRate <= -0.5) {
        alerts.push({
          booth_code: boothCode,
          severity: 'amber',
          message: `🟡 ${boothCode} 売上 ¥${prev.toLocaleString()}→¥${cur.toLocaleString()} (${Math.round(dropRate * 100)}%)`,
        })
      }
    }
  }

  // C) 連続据え置き3回
  for (const [boothCode, rows] of boothMonthGroups) {
    const sorted3 = [...rows].sort((a, b) => b.created_at?.localeCompare(a.created_at) || 0).slice(0, 3)
    if (sorted3.length >= 3 && sorted3.every(r => r.entry_type === 'carry_forward')) {
      alerts.push({
        booth_code: boothCode,
        severity: 'amber',
        message: `🟡 ${boothCode} 連続据え置き3回 最終${sorted3[0].patrol_date}`,
      })
    }
  }

  return alerts
}

function buildHeatmapData(heatmapReadings) {
  const data = {}
  for (const r of heatmapReadings) {
    if (!data[r.machine_code]) data[r.machine_code] = {}
    if (!data[r.machine_code][r.patrol_date]) {
      data[r.machine_code][r.patrol_date] = { inSum: 0, outSum: 0 }
    }
    data[r.machine_code][r.patrol_date].inSum += Number(r.in_diff) || 0
    data[r.machine_code][r.patrol_date].outSum += (Number(r.out_diff) || 0) + (Number(r.out_diff_2) || 0)
  }
  for (const mc of Object.keys(data)) {
    for (const d of Object.keys(data[mc])) {
      const { inSum, outSum } = data[mc][d]
      data[mc][d].rate = inSum > 0 ? outSum / inSum : null
    }
  }
  return data
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-3 space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-slate-200 rounded-xl" />
      ))}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  )
}

export default function DashboardTop() {
  const navigate = useNavigate()
  const { data, loading, error, getOrFetch, invalidate } = useDashboardStore()

  useEffect(() => {
    getOrFetch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const computed = useMemo(() => {
    if (!data) return null
    const { monthReadings, heatmapReadings, allMachines, today, monthStart } = data

    const nonCF = monthReadings.filter(r => r.entry_type !== 'carry_forward')
    const inSum = monthReadings.reduce((s, r) => s + (Number(r.in_diff) || 0), 0)
    const outSum = monthReadings.reduce((s, r) => s + (Number(r.out_diff) || 0) + (Number(r.out_diff_2) || 0), 0)
    const monthRevenue = sum(nonCF, 'revenue')
    const avgRate = inSum > 0 ? outSum / inSum : 0

    // 経過日数
    const start = new Date(monthStart)
    const end = new Date(today)
    const elapsedDays = Math.max(1, Math.round((end - start) / 86400000) + 1)

    // 機械稼働率
    const activeMachineCodes = new Set(
      monthReadings.filter(r => Number(r.in_diff) > 0).map(r => r.machine_code)
    )

    // 出率カラー
    let rateColor = 'text-rose-600'
    if (avgRate >= 0.5 && avgRate <= 0.65) rateColor = 'text-emerald-600'
    else if ((avgRate >= 0.4 && avgRate < 0.5) || (avgRate > 0.65 && avgRate <= 0.75)) rateColor = 'text-amber-600'

    // KPI
    const kpis = {
      monthRevenue,
      inSum,
      avgRate,
      elapsedDays,
      rateColor,
      utilizationRate: allMachines.length > 0 ? activeMachineCodes.size / allMachines.length : 0,
      activeMachines: activeMachineCodes.size,
      totalMachines: allMachines.length,
    }

    // アラート
    const alerts = computeAlerts(monthReadings, heatmapReadings, avgRate, today)

    // 下位店舗
    const storeGroups = groupBy(monthReadings, r => r.store_code)
    const storeRevenue = []
    for (const [code, rows] of storeGroups) {
      const rev = sum(rows.filter(r => r.entry_type !== 'carry_forward'), 'revenue')
      storeRevenue.push({
        store_code: code,
        store_name: rows[0].booths?.machines?.stores?.store_name ?? code,
        revenue: rev,
        booth_count: new Set(rows.map(r => r.full_booth_code)).size,
      })
    }
    storeRevenue.sort((a, b) => a.revenue - b.revenue)
    const lowRank = storeRevenue.slice(0, 3)

    // ヒートマップ
    const heatmapData = buildHeatmapData(heatmapReadings)
    const machineNameMap = new Map(
      monthReadings.map(r => [r.machine_code, r.booths?.machines?.machine_name || r.machine_code])
    )
    const heatmapMachines = [...new Set(heatmapReadings.map(r => r.machine_code))]
      .sort()
      .map(mc => ({ machine_code: mc, machine_name: machineNameMap.get(mc) || mc }))

    return { kpis, alerts, lowRank, heatmapData, heatmapMachines, today }
  }, [data])

  if (loading && !data) return <Skeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 p-4">
        <div className="text-rose-600 text-sm">{error}</div>
        <button
          onClick={() => { invalidate(); getOrFetch() }}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm"
        >
          再試行
        </button>
      </div>
    )
  }

  if (!computed) return <Skeleton />

  const { kpis, alerts, lowRank, heatmapData, heatmapMachines, today } = computed

  function navigateToBooth(boothCode) {
    navigate(`/patrol/input?boothCode=${boothCode}`)
  }

  function navigateToStore(storeCode) {
    navigate(`/patrol/input?storeCode=${storeCode}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur px-3 pt-3 pb-2 flex items-center gap-2 border-b border-slate-200">
        <button onClick={() => navigate(-1)} className="text-slate-500 text-sm">‹</button>
        <h1 className="flex-1 font-bold text-base text-slate-800">経営者ビュー</h1>
        <button
          onClick={() => { invalidate(); getOrFetch() }}
          className="text-slate-400 text-sm px-2"
          title="再取得"
        >
          🔄
        </button>
      </div>

      {/* アラート */}
      <section className="px-3 pt-3">
        <AlertList alerts={alerts} onTap={navigateToBooth} />
      </section>

      {/* KPI 4枚 */}
      <section className="px-3 pt-3 grid grid-cols-2 gap-3">
        <KpiCard
          label="今月売上"
          icon="💰"
          value={`¥${kpis.monthRevenue.toLocaleString()}`}
          subValue={`${kpis.elapsedDays}日経過`}
        />
        <KpiCard
          label="平均出率"
          icon="🎯"
          value={`${(kpis.avgRate * 100).toFixed(1)}%`}
          subValue={kpis.avgRate >= 0.5 && kpis.avgRate <= 0.65 ? '✅ 理想範囲' : kpis.avgRate >= 0.4 ? '⚠️ 要注意' : '🚨 範囲外'}
          colorClass={kpis.rateColor}
        />
        <KpiCard
          label="今月プレイ数"
          icon="🎮"
          value={`${kpis.inSum.toLocaleString()}回`}
          subValue={`1日平均 ${Math.round(kpis.inSum / kpis.elapsedDays).toLocaleString()}`}
        />
        <KpiCard
          label="機械稼働率"
          icon="⚙️"
          value={`${(kpis.utilizationRate * 100).toFixed(0)}%`}
          subValue={`${kpis.activeMachines}/${kpis.totalMachines}台`}
        />
      </section>

      {/* 下位店舗 */}
      {lowRank.length > 0 && (
        <section className="px-3 pt-4">
          <h2 className="text-sm font-bold text-slate-700 mb-2">下位店舗 ⚠️</h2>
          <StoreRankingLow stores={lowRank} onTap={navigateToStore} />
        </section>
      )}

      {/* ヒートマップ */}
      <section className="px-3 pt-4">
        <h2 className="text-sm font-bold text-slate-700 mb-2">出率ヒートマップ (直近14日)</h2>
        <div className="overflow-x-auto bg-white rounded-lg p-2">
          <RateHeatmap data={heatmapData} machines={heatmapMachines} today={today} />
        </div>
        <div className="flex gap-3 mt-1.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />50-65%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />40-50% / 65-75%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-400" />範囲外</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-100" />なし</span>
        </div>
      </section>
    </div>
  )
}
