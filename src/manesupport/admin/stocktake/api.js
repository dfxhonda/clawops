// M2 Stage 1: 管理側 API を新スキーマにアダプタ
// 旧 store_code/session_name ベースは廃止

import { supabase } from '../../../lib/supabase'

const DFX_ORG_ID = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'

export async function getAllSessions(organizationId = DFX_ORG_ID) {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('session_id, month, status, created_at, locked_at')
    .eq('organization_id', organizationId)
    .order('month', { ascending: false })
    .limit(24)
  if (error) throw error
  return data ?? []
}

export async function getSessionDetail(sessionId) {
  const [sessionRes, itemsRes] = await Promise.all([
    supabase.from('stocktake_sessions').select('*').eq('session_id', sessionId).single(),
    supabase
      .from('stocktake_items')
      .select('*, prize:prize_masters(prize_name)')
      .eq('session_id', sessionId)
      .order('owner_type')
      .order('owner_code'),
  ])
  if (sessionRes.error) throw sessionRes.error
  if (itemsRes.error)   throw itemsRes.error
  return {
    session: sessionRes.data,
    items: (itemsRes.data ?? []).map(i => ({
      ...i,
      prize_name: i.prize?.prize_name ?? i.prize_id,
    })),
  }
}

export async function approveSession(sessionId) {
  const { error } = await supabase
    .from('stocktake_sessions')
    .update({ status: 'approved' })
    .eq('session_id', sessionId)
  if (error) throw error
}

export async function lockSession(sessionId) {
  const { error } = await supabase
    .from('stocktake_sessions')
    .update({ status: 'locked', locked_at: new Date().toISOString() })
    .eq('session_id', sessionId)
  if (error) throw error
}

// ────────────────────────────────────────────────────────────────
// Stage 3: 管理能力測定ダッシュボード
// ────────────────────────────────────────────────────────────────

export async function getStocktakeDashboard(organizationId = DFX_ORG_ID) {
  const sessions = await getAllSessions(organizationId)
  const recent = sessions.slice(0, 6)
  if (recent.length === 0) return { sessions: recent, staffRows: [], months: [] }

  const sessionIds = recent.map(s => s.session_id)

  const { data: items, error: itemsErr } = await supabase
    .from('stocktake_items')
    .select('session_id, recorded_by, actual_count, theoretical_count, variance_rate')
    .in('session_id', sessionIds)
    .not('recorded_by', 'is', null)
    .not('theoretical_count', 'is', null)
    .gt('theoretical_count', 0)
  if (itemsErr) throw itemsErr

  const staffIds = [...new Set((items ?? []).map(i => i.recorded_by))]
  let staffData = []
  if (staffIds.length > 0) {
    const { data: sd } = await supabase
      .from('staff')
      .select('staff_id, name')
      .in('staff_id', staffIds)
    staffData = sd ?? []
  }

  return buildDashboardMatrix(recent, items ?? [], staffData)
}

function buildDashboardMatrix(sessions, items, staffData) {
  const staffNameMap = {}
  for (const s of staffData) staffNameMap[s.staff_id] = s.name

  const sessionMonthMap = {}
  for (const s of sessions) sessionMonthMap[s.session_id] = s.month

  const raw = {}
  for (const item of items) {
    if (!item.recorded_by) continue
    const month = sessionMonthMap[item.session_id]
    if (!month) continue
    const sid = item.recorded_by
    if (!raw[sid]) raw[sid] = {}
    if (!raw[sid][month]) raw[sid][month] = { sum: 0, count: 0, over: 0, under: 0 }
    const rate = item.variance_rate != null ? Number(item.variance_rate) : 0
    raw[sid][month].sum += rate
    raw[sid][month].count += 1
    if (item.actual_count > item.theoretical_count)      raw[sid][month].over++
    else if (item.actual_count < item.theoretical_count) raw[sid][month].under++
  }

  const months = sessions.map(s => s.month)

  const staffRows = Object.entries(raw).map(([staffId, monthData]) => {
    const monthStats = {}
    for (const month of months) {
      const d = monthData[month]
      if (!d || d.count === 0) continue
      monthStats[month] = {
        avgRate:   d.sum / d.count,
        direction: d.over > d.under ? 'over' : d.under > d.over ? 'under' : 'mixed',
        count:     d.count,
      }
    }

    const activeMths = months.filter(m => monthStats[m])
    let consistentDir = null
    if (activeMths.length >= 2) {
      const dirs = activeMths.map(m => monthStats[m].direction)
      if (dirs.every(d => d === 'over'))  consistentDir = 'over'
      if (dirs.every(d => d === 'under')) consistentDir = 'under'
    }

    let trend = null
    if (activeMths.length >= 2) {
      const latest = monthStats[activeMths[0]].avgRate
      const prev   = monthStats[activeMths[1]].avgRate
      if      (latest < prev - 0.02) trend = 'improving'
      else if (latest > prev + 0.02) trend = 'worsening'
      else trend = 'stable'
    }

    return { staffId, name: staffNameMap[staffId] || staffId, monthStats, consistentDir, trend }
  })

  staffRows.sort((a, b) => {
    const rA = a.monthStats[months[0]]?.avgRate ?? -1
    const rB = b.monthStats[months[0]]?.avgRate ?? -1
    return rB - rA
  })

  return { sessions, staffRows, months }
}
