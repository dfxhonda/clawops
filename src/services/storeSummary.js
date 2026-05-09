import { supabase } from '../lib/supabase'
import { fetchBoothDiffMap } from './boothHistory'

const PAYOUT_THRESHOLD = 0.3

/**
 * Compute store-level summary metrics from machine list.
 * machines: array from getPatrolMachines()
 */
export async function fetchStoreSummary(machines) {
  const boothCodes = []
  const meterUnitPriceMap = {}

  for (const machine of machines) {
    const mup = machine.machine_models?.meter_unit_price ?? 100
    for (const booth of machine.booths ?? []) {
      boothCodes.push(booth.booth_code)
      meterUnitPriceMap[booth.booth_code] = mup
    }
  }

  if (!boothCodes.length) {
    return { totalRevenue: null, totalProfit: null, avgPayoutRate: null, underperformingCount: 0 }
  }

  const todayJST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const [diffMap, { data: todayReadings }] = await Promise.all([
    fetchBoothDiffMap(boothCodes, meterUnitPriceMap),
    supabase
      .from('meter_readings')
      .select('booth_code, payout_rate')
      .in('booth_code', boothCodes)
      .eq('patrol_date', todayJST),
  ])

  let totalRevenue = 0
  let totalProfit = 0
  let hasData = false

  for (const diff of Object.values(diffMap)) {
    if (!diff) continue
    if (diff.revenue != null) { totalRevenue += diff.revenue; hasData = true }
    if (diff.profit != null) totalProfit += diff.profit
  }

  const payoutRates = (todayReadings ?? [])
    .map(r => Number(r.payout_rate))
    .filter(v => !isNaN(v) && v > 0)

  const avgPayoutRate = payoutRates.length
    ? payoutRates.reduce((a, b) => a + b, 0) / payoutRates.length
    : null

  const underperformingCount = payoutRates.filter(r => r < PAYOUT_THRESHOLD).length

  return {
    totalRevenue: hasData ? totalRevenue : null,
    totalProfit:  hasData ? totalProfit  : null,
    avgPayoutRate,
    underperformingCount,
  }
}
