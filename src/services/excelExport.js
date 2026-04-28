import { supabase } from '../lib/supabase'

export async function exportPatrolDetailSheet(filters) {
  const XLSX = await import('xlsx')

  const { data: rows, error } = await supabase
    .from('meter_readings')
    .select(`
      patrol_date, full_booth_code, store_code, machine_code,
      in_diff, out_diff_1, prize_name, prize_cost_1, revenue, entry_type, play_price,
      stores!store_code(store_name),
      machines!machine_code(machine_name)
    `)
    .gte('patrol_date', filters.from)
    .lte('patrol_date', filters.to)
    .not('patrol_date', 'is', null)
    .order('patrol_date', { ascending: true })
    .order('full_booth_code', { ascending: true })

  if (error) throw new Error('データ取得エラー: ' + error.message)
  if (!rows || rows.length === 0) throw new Error('対象期間のデータがありません')

  const sheetData = rows.map(r => ({
    '日付': r.patrol_date,
    '店舗コード': r.store_code,
    '店舗名': r.stores?.store_name ?? '',
    '機種コード': r.machine_code,
    '機種名': r.machines?.machine_name ?? '',
    'ブースコード': r.full_booth_code,
    'IN差': r.in_diff ?? '',
    'OUT差': r.out_diff_1 ?? '',
    '単価': r.play_price ?? '',
    '原価': r.prize_cost_1 ?? '',
    '売上': r.revenue ?? '',
    '出率': (r.in_diff != null && r.in_diff > 0 && r.out_diff_1 != null)
      ? Math.round((r.out_diff_1 / r.in_diff) * 1000) / 10
      : '',
    '景品': r.prize_name ?? '',
    '区分': r.entry_type === 'patrol' ? '巡回'
      : r.entry_type === 'replace' ? '入替'
      : r.entry_type === 'carry_forward' ? '据え置き'
      : (r.entry_type ?? ''),
  }))

  const ws = XLSX.utils.json_to_sheet(sheetData)

  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 16 },
    { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 },
    { wch: 8 }, { wch: 6 }, { wch: 24 }, { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '巡回明細')
  const filename = `round0_export_${filters.from}_${filters.to}.xlsx`
  XLSX.writeFile(wb, filename)
}
