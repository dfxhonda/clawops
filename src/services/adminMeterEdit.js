import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

const ADMIN_HISTORY_SELECT =
  'reading_id, booth_code, patrol_date, read_time, created_at, entry_type, ' +
  'in_meter, out_meter, out_meter_2, out_meter_3, ' +
  'prize_name, prize_cost, prize_stock_count, prize_restock_count, ' +
  'set_a, set_c, set_l, set_r, set_o'

function _sumOut(row) {
  return (
    Number(row.out_meter ?? 0) +
    Number(row.out_meter_2 ?? 0) +
    Number(row.out_meter_3 ?? 0)
  )
}

function _computeDiffs(ascRows) {
  return ascRows.map((row, i) => {
    const prev = i > 0 ? ascRows[i - 1] : null
    const inDiff =
      prev != null && row.in_meter != null && prev.in_meter != null
        ? Number(row.in_meter) - Number(prev.in_meter)
        : null
    const outDiff = prev != null ? _sumOut(row) - _sumOut(prev) : null
    return { ...row, in_diff: inDiff, out_diff: outDiff }
  })
}

export async function fetchAdminBoothHistory(boothCode, limit = 30) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select(ADMIN_HISTORY_SELECT)
    .eq('booth_code', boothCode)
    .order('patrol_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (error) return []
  const asc = [...(data ?? [])].reverse()
  const withDiffs = _computeDiffs(asc)
  return withDiffs.slice(-limit).reverse()
}

const FULL_SELECT =
  'reading_id, booth_code, patrol_date, read_time, created_at, updated_at, entry_type, ' +
  'in_meter, out_meter, out_meter_2, out_meter_3, ' +
  'prize_name, prize_cost, prize_stock_count, prize_restock_count, ' +
  'set_a, set_c, set_l, set_r, set_o, note, ' +
  'created_by, updated_by, organization_id'

export async function getFullReading(readingId) {
  const { data, error } = await supabase
    .from('meter_readings')
    .select(FULL_SELECT)
    .eq('reading_id', readingId)
    .single()
  if (error) throw error
  return data
}

export async function updateMeterReading({ readingId, lockTimestamp, patch, staffId, boothCode }) {
  const { data, error } = await supabase
    .from('meter_readings')
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: staffId })
    .eq('reading_id', readingId)
    .eq('updated_at', lockTimestamp)
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new Error('CONFLICT')
  return data[0]
}

export async function deleteMeterReading({ readingId, lockTimestamp, before, staffId, boothCode }) {
  const { data: deleted, error } = await supabase
    .from('meter_readings')
    .delete()
    .eq('reading_id', readingId)
    .eq('updated_at', lockTimestamp)
    .select()
  if (error) throw error
  if (!deleted || deleted.length === 0) throw new Error('CONFLICT')
  await insertAuditLog({
    action: 'admin_delete_meter_reading',
    targetId: readingId,
    before,
    after: null,
    staffId,
    boothCode,
  })
}

export async function insertAuditLog({ action, targetId, before, after, staffId, boothCode }) {
  await supabase.from('audit_logs').insert({
    action,
    target_table: 'meter_readings',
    target_id: targetId,
    before_data: before,
    after_data: after,
    staff_id: staffId,
    organization_id: DFX_ORG_ID,
    detail: `/admin/booth-edit/${boothCode}`,
  })
}

export async function insertPastDateReading({ boothCode, patrolDate, staffId }) {
  const readingId = crypto.randomUUID()
  const { data, error } = await supabase
    .from('meter_readings')
    .insert({
      reading_id: readingId,
      booth_id: boothCode,
      booth_code: boothCode,
      patrol_date: patrolDate,
      entry_type: 'patrol',
      in_meter: null,
      out_meter: null,
      out_meter_2: null,
      out_meter_3: null,
      prize_restock_count: 0,
      prize_stock_count: null,
      organization_id: DFX_ORG_ID,
      created_by: staffId,
      updated_by: staffId,
    })
    .select()
  if (error) throw error
  return data[0]
}
