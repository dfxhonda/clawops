// ============================================
// 売上分析クエリ (J-REVENUE-A)
// ============================================
import { supabase } from '../lib/supabase'
import * as Sentry from '@sentry/react'
import {
  RevenueByStoreRowSchema,
  RevenueByMachineRowSchema,
  RevenueByPrizeRowSchema,
  KpiSummarySchema,
} from './schemas/revenueQuery'

// JST 日付文字列 YYYY-MM-DD。toISOString 禁止。
function toJstDateStr(date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function resolveDates(period, customStart, customEnd) {
  const today = new Date()
  const todayStr = toJstDateStr(today)

  if (period === 'today') return { start: todayStr, end: todayStr }

  if (period === 'week') {
    const dow = today.getDay() // 0=Sun
    const daysFromMon = dow === 0 ? 6 : dow - 1
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysFromMon)
    return { start: toJstDateStr(monday), end: todayStr }
  }

  if (period === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: toJstDateStr(first), end: todayStr }
  }

  // custom
  return { start: customStart || todayStr, end: customEnd || todayStr }
}

function getPrevDates(period, customStart, customEnd) {
  const curr = resolveDates(period, customStart, customEnd)
  const startDate = new Date(curr.start)
  const endDate = new Date(curr.end)
  const days = Math.round((endDate - startDate) / 86400000) + 1
  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days + 1)
  return { start: toJstDateStr(prevStart), end: toJstDateStr(prevEnd) }
}

async function fetchReadings(start, end) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .gte('patrol_date', start)
    .lte('patrol_date', end)
    .neq('entry_type', 'carry_forward')
  if (error) throw new Error('meter_readings 取得エラー: ' + error.message)
  return data || []
}

function emitZodError(err) {
  Sentry.captureException(err)
  console.error('[revenueQuery] Zod validation error', err)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('revenue:zod-error', { detail: err }))
  }
}

export async function getRevenueByStore(period, start, end) {
  const dates = resolveDates(period, start, end)
  const [readings, storesRes] = await Promise.all([
    fetchReadings(dates.start, dates.end),
    supabase.from('stores').select('store_code, store_name'),
  ])
  const storeNameMap = Object.fromEntries((storesRes.data || []).map(s => [s.store_code, s.store_name]))

  const acc = {}
  for (const r of readings) {
    if (!r.store_code) continue
    if (!acc[r.store_code]) {
      acc[r.store_code] = { store_code: r.store_code, revenue: 0, in_sum: 0, out_sum: 0, machines: new Set() }
    }
    const a = acc[r.store_code]
    a.revenue += r.revenue || 0
    a.in_sum += r.in_diff || 0
    a.out_sum += (r.out_diff_1 || 0) + (r.out_diff_2 || 0) + (r.out_diff_3 || 0)
    if (r.machine_code) a.machines.add(r.machine_code)
  }

  const totalRevenue = Object.values(acc).reduce((s, a) => s + a.revenue, 0)

  const rows = Object.values(acc)
    .map(a => ({
      store_code: a.store_code,
      store_name: storeNameMap[a.store_code] || a.store_code,
      revenue: Math.round(a.revenue),
      share: totalRevenue > 0 ? Math.round((a.revenue / totalRevenue) * 1000) / 10 : 0,
      payout_rate: a.in_sum > 0 ? Math.round((a.out_sum / a.in_sum) * 1000) / 10 : 0,
      machine_count: a.machines.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const parsed = RevenueByStoreRowSchema.array().safeParse(rows)
  if (!parsed.success) emitZodError(parsed.error)
  return parsed.success ? parsed.data : rows
}

export async function getRevenueByMachine(period, start, end) {
  const dates = resolveDates(period, start, end)
  const [readings, storesRes, machinesRes] = await Promise.all([
    fetchReadings(dates.start, dates.end),
    supabase.from('stores').select('store_code, store_name'),
    supabase.from('machines').select('machine_code, machine_name, store_code'),
  ])
  const storeNameMap = Object.fromEntries((storesRes.data || []).map(s => [s.store_code, s.store_name]))
  const machineNameMap = Object.fromEntries((machinesRes.data || []).map(m => [m.machine_code, m.machine_name]))

  const acc = {}
  for (const r of readings) {
    if (!r.machine_code) continue
    if (!acc[r.machine_code]) {
      acc[r.machine_code] = { machine_code: r.machine_code, store_code: r.store_code, revenue: 0, in_sum: 0, out_sum: 0 }
    }
    const a = acc[r.machine_code]
    a.revenue += r.revenue || 0
    a.in_sum += r.in_diff || 0
    a.out_sum += (r.out_diff_1 || 0) + (r.out_diff_2 || 0) + (r.out_diff_3 || 0)
  }

  const rows = Object.values(acc)
    .map(a => ({
      machine_code: a.machine_code,
      store_name: storeNameMap[a.store_code] || a.store_code || '',
      machine_name: machineNameMap[a.machine_code] || null,
      revenue: Math.round(a.revenue),
      payout_rate: a.in_sum > 0 ? Math.round((a.out_sum / a.in_sum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const parsed = RevenueByMachineRowSchema.array().safeParse(rows)
  if (!parsed.success) emitZodError(parsed.error)
  return parsed.success ? parsed.data : rows
}

export async function getRevenueByPrize(period, start, end) {
  const dates = resolveDates(period, start, end)
  const readings = await fetchReadings(dates.start, dates.end)

  const acc = {}
  for (const r of readings) {
    const key = r.prize_id || r.prize_name || '__unknown__'
    if (!acc[key]) {
      acc[key] = { prize_id: r.prize_id || null, prize_name: r.prize_name || null, revenue: 0, prize_cost_total: 0, out_count: 0 }
    }
    const a = acc[key]
    a.revenue += r.revenue || 0
    const unitCost = r.prize_cost || r.prize_cost_1 || 0
    const outCount = r.out_diff_1 || 0
    a.prize_cost_total += unitCost * outCount
    a.out_count += outCount
  }

  const rows = Object.values(acc)
    .map(a => ({
      prize_id: a.prize_id,
      prize_name: a.prize_name,
      revenue: Math.round(a.revenue),
      prize_cost_avg: a.out_count > 0 ? Math.round((a.prize_cost_total / a.out_count) * 10) / 10 : 0,
      profit_margin: a.revenue > 0 ? Math.round(((a.revenue - a.prize_cost_total) / a.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const parsed = RevenueByPrizeRowSchema.array().safeParse(rows)
  if (!parsed.success) emitZodError(parsed.error)
  return parsed.success ? parsed.data : rows
}

export async function getKpiSummary(period, start, end) {
  const dates = resolveDates(period, start, end)
  const prev = getPrevDates(period, start, end)

  const [currReadings, prevReadings, machinesRes] = await Promise.all([
    fetchReadings(dates.start, dates.end),
    fetchReadings(prev.start, prev.end),
    supabase.from('machines').select('machine_code').eq('is_active', true),
  ])

  const totalRevenue = currReadings.reduce((s, r) => s + (r.revenue || 0), 0)
  const prevRevenue = prevReadings.reduce((s, r) => s + (r.revenue || 0), 0)

  const inSum = currReadings.reduce((s, r) => s + (r.in_diff || 0), 0)
  const outSum = currReadings.reduce((s, r) => s + (r.out_diff_1 || 0) + (r.out_diff_2 || 0) + (r.out_diff_3 || 0), 0)
  const payoutRateAvg = inSum > 0 ? (outSum / inSum) * 100 : 0

  const patrolledMachines = new Set(currReadings.filter(r => r.machine_code).map(r => r.machine_code))
  const totalMachines = (machinesRes.data || []).length
  const patrolCompletionRate = totalMachines > 0 ? (patrolledMachines.size / totalMachines) * 100 : 0

  const kpi = {
    revenue: Math.round(totalRevenue),
    prev_revenue: Math.round(prevRevenue),
    machine_count: patrolledMachines.size,
    payout_rate_avg: Math.round(payoutRateAvg * 10) / 10,
    patrol_completion_rate: Math.round(patrolCompletionRate),
  }

  const parsed = KpiSummarySchema.safeParse(kpi)
  if (!parsed.success) emitZodError(parsed.error)
  return parsed.success ? parsed.data : kpi
}
