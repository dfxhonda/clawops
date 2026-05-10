import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

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
