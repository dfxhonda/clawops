import { supabase } from '../../lib/supabase'

export async function fetchDashboardData() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const monthStart = today.slice(0, 7) + '-01'
  const last14daysStart = new Date(Date.now() - 14 * 86400000)
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const [
    { data: monthReadings, error: e1 },
    { data: heatmapReadings, error: e2 },
    { data: allMachines, error: e3 },
  ] = await Promise.all([
    supabase
      .from('meter_readings')
      .select(`
        reading_id, full_booth_code, store_code, machine_code,
        patrol_date, entry_type, in_diff, out_diff_1, out_diff_2,
        revenue, prize_id, prize_cost_1, created_at,
        stores!store_code(store_code, store_name),
        machines!machine_code(machine_code, machine_name)
      `)
      .gte('patrol_date', monthStart)
      .lte('patrol_date', today)
      .order('patrol_date', { ascending: false }),
    supabase
      .from('meter_readings')
      .select('full_booth_code, patrol_date, machine_code, in_diff, out_diff_1, out_diff_2')
      .gte('patrol_date', last14daysStart)
      .lte('patrol_date', today),
    supabase
      .from('machines')
      .select('machine_code, store_code')
      .eq('is_active', true),
  ])

  if (e1) throw new Error('月次データ取得エラー: ' + e1.message)
  if (e2) throw new Error('ヒートマップデータ取得エラー: ' + e2.message)
  if (e3) throw new Error('機械データ取得エラー: ' + e3.message)

  return {
    monthReadings: monthReadings || [],
    heatmapReadings: heatmapReadings || [],
    allMachines: allMachines || [],
    today,
    monthStart,
    last14daysStart,
  }
}
