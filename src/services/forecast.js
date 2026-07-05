// ============================================
// forecast: 集金サイクル売上着地予測 (SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01)
// データはRPC (fn_forecast_store_list / fn_forecast_store_detail) 経由のみ、
// client側でmeter_readingsを直接集計しない
// ============================================
import { supabase } from '../lib/supabase'

export async function getForecastStoreList() {
  const { data, error } = await supabase.rpc('fn_forecast_store_list')
  if (error) throw error
  return data ?? []
}

export async function getForecastStoreDetail(storeCode) {
  const { data, error } = await supabase.rpc('fn_forecast_store_detail', { p_store_code: storeCode })
  if (error) throw error
  return data ?? null
}

export async function saveForecastSettings(storeCode, { cycleStartDate, nextCollectionDate }, updatedBy) {
  const patch = {
    store_code: storeCode,
    next_collection_date: nextCollectionDate || null,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  }
  if (cycleStartDate !== undefined) patch.cycle_start_date = cycleStartDate || null
  const { data, error } = await supabase
    .from('store_forecast_settings')
    .upsert(patch, { onConflict: 'store_code' })
    .select()
    .single()
  if (error) throw error
  return data
}
