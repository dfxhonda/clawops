import { supabase } from '../../lib/supabase'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import { logger } from '../../lib/logger'
import { ERR } from '../../lib/errorCodes'

export async function bulkInsertMeterReadings({ validatedRows, staffId }) {
  if (!DFX_ORG_ID) {
    return { ok: false, errCode: ERR.AUTH_001, message: 'organization_id 未設定' }
  }
  if (!validatedRows?.length) {
    return { ok: false, errCode: ERR.IMPORT_002, message: '取込行ゼロ' }
  }

  const now = new Date().toISOString()
  const payload = validatedRows.map(r => ({
    reading_id:          crypto.randomUUID(),
    booth_id:            r.boothCode,
    booth_code:          r.boothCode,
    full_booth_code:     r.boothCode,
    patrol_date:         r.patrolDate,
    read_time:           now,
    entry_type:          'patrol',
    source:              'import',
    input_method:        'manual',
    in_meter:            r.inMeter,
    out_meter:           r.outMeter,
    prize_stock_count:   r.prizeStockCount,
    prize_restock_count: r.prizeRestockCount,
    prize_name:          r.prizeName,
    prize_id:            r.prizeId,
    prize_cost:          r.prizeCost,
    set_a:               r.setA,
    set_c:               r.setC,
    set_l:               r.setL,
    set_r:               r.setR,
    set_o:               r.setO,
    note:                r.note,
    organization_id:     DFX_ORG_ID,
    created_by:          staffId ?? null,
  }))

  logger.info('bulk_import_attempt', { total: payload.length, staffId })

  const { data, error } = await supabase
    .from('meter_readings')
    .insert(payload)
    .select('reading_id')

  if (error) {
    logger.error(ERR.IMPORT_003, { message: error.message, total: payload.length })
    return { ok: false, errCode: ERR.IMPORT_003, message: `一括取込エラー: ${error.message}` }
  }

  const dates = [...new Set(payload.map(r => r.patrol_date))].sort()
  await supabase.from('operation_logs').insert({
    action:          'bulk_import',
    target_table:    'meter_readings',
    target_id:       null,
    before_data:     null,
    after_data:      { total_rows: payload.length, patrol_dates: dates },
    staff_id:        staffId ?? null,
    organization_id: DFX_ORG_ID,
    detail:          '/admin/bulk-import',
  })

  logger.info('bulk_import_success', { total: data?.length, staffId })
  return { ok: true, insertedCount: data?.length ?? payload.length }
}
