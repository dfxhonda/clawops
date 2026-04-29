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

function _sum(arr, key) {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

function _groupBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

function _buildDetailRows(rows) {
  return rows.map(r => ({
    '日付': r.patrol_date,
    '店舗コード': r.store_code,
    '店舗名': r.stores?.store_name ?? '',
    '機種コード': r.machine_code,
    '機種名': r.machines?.machine_name ?? '',
    'ブースコード': r.full_booth_code,
    'IN差': r.in_diff ?? '',
    'OUT差(A)': r.out_diff_1 ?? '',
    'OUT差(B)': r.out_diff_2 ?? '',
    '単価': r.play_price ?? '',
    '原価(A)': r.prize_cost_1 ?? '',
    '原価(B)': r.prize_cost_2 ?? '',
    '売上': r.revenue ?? '',
    '出率': (r.in_diff > 0)
      ? Math.round(((Number(r.out_diff_1) || 0) + (Number(r.out_diff_2) || 0)) / r.in_diff * 1000) / 10
      : '',
    '景品(A)': r.prize_name ?? '',
    '景品(B)': r.prize_name_2 ?? '',
    '区分': r.entry_type === 'patrol' ? '巡回'
      : r.entry_type === 'replace' ? '入替'
      : r.entry_type === 'carry_forward' ? '据え置き'
      : (r.entry_type ?? ''),
  }))
}

function _buildStoreSummary(rows) {
  const grouped = _groupBy(rows, r => r.store_code)
  const result = []

  for (const [storeCode, storeRows] of grouped) {
    const machineSet = new Set(storeRows.map(r => r.machine_code))
    const nonCF = storeRows.filter(r => r.entry_type !== 'carry_forward')
    const inSum = _sum(storeRows, 'in_diff')
    const outSum = storeRows.reduce((s, r) => s + (Number(r.out_diff_1) || 0) + (Number(r.out_diff_2) || 0), 0)
    const revSum = _sum(nonCF, 'revenue')
    const costSum = storeRows.reduce((s, r) =>
      s + (Number(r.out_diff_1) || 0) * (Number(r.prize_cost_1) || 0)
        + (Number(r.out_diff_2) || 0) * (Number(r.prize_cost_2) || 0), 0)

    const boothRev = {}
    for (const r of nonCF) {
      boothRev[r.full_booth_code] = (boothRev[r.full_booth_code] || 0) + (Number(r.revenue) || 0)
    }
    const sortedBooths = Object.entries(boothRev).sort((a, b) => b[1] - a[1])

    result.push({
      '店舗コード': storeCode,
      '店舗名': storeRows[0].stores?.store_name ?? '',
      '設置台数': machineSet.size,
      '巡回件数': storeRows.length,
      'IN合計': inSum,
      'OUT合計': outSum,
      '売上合計': revSum,
      '原価合計': Math.round(costSum),
      '粗利': Math.round(revSum - costSum),
      '出率': inSum > 0 ? Math.round(outSum / inSum * 1000) / 10 : 0,
      '上位3ブース': sortedBooths.slice(0, 3).map(([c]) => c).join(', '),
      '下位3ブース': sortedBooths.slice(-3).map(([c]) => c).join(', '),
    })
  }

  return result.sort((a, b) => b['売上合計'] - a['売上合計'])
}

function _buildBoothSummary(rows) {
  const grouped = _groupBy(rows, r => r.full_booth_code)
  const allItems = []

  for (const [boothCode, boothRows] of grouped) {
    const nonCF = boothRows.filter(r => r.entry_type !== 'carry_forward')
    const cfRows = boothRows.filter(r => r.entry_type === 'carry_forward')
    const inSum = _sum(boothRows, 'in_diff')
    const outSum = boothRows.reduce((s, r) => s + (Number(r.out_diff_1) || 0) + (Number(r.out_diff_2) || 0), 0)
    const revSum = _sum(nonCF, 'revenue')
    const costSum = boothRows.reduce((s, r) =>
      s + (Number(r.out_diff_1) || 0) * (Number(r.prize_cost_1) || 0)
        + (Number(r.out_diff_2) || 0) * (Number(r.prize_cost_2) || 0), 0)
    const gross = revSum - costSum
    const rate = inSum > 0 ? outSum / inSum : 0

    // フラグ
    const flags = []
    const sorted3 = [...boothRows].sort((a, b) => b.patrol_date.localeCompare(a.patrol_date)).slice(0, 3)
    if (sorted3.length >= 3 && sorted3.every(r => r.entry_type === 'carry_forward')) flags.push('🟡連続据え置き')
    if (gross < 0) flags.push('🔴赤字')

    allItems.push({
      'ブースコード': boothCode,
      '店舗コード': boothRows[0].store_code,
      '店舗名': boothRows[0].stores?.store_name ?? '',
      '機種コード': boothRows[0].machine_code,
      '機種名': boothRows[0].machines?.machine_name ?? '',
      '単価': boothRows[0].play_price ?? '',
      '巡回件数': boothRows.length,
      '据え置回数': cfRows.length,
      'IN計': inSum,
      'OUT計': outSum,
      '売上': revSum,
      '原価計': Math.round(costSum),
      '粗利': Math.round(gross),
      '出率': inSum > 0 ? Math.round(rate * 1000) / 10 : 0,
      'フラグ': flags.join(' '),
    })
  }

  allItems.sort((a, b) => b['売上'] - a['売上'])

  const flagged = allItems.filter(r => r['フラグ'])
  const normal = allItems.filter(r => !r['フラグ'])

  const result = []
  if (flagged.length > 0) {
    result.push({ 'ブースコード': '⚠️ 要注意ブース', '店舗コード': '', '店舗名': '', '機種コード': '', '機種名': '', '単価': '', '巡回件数': '', '据え置回数': '', 'IN計': '', 'OUT計': '', '売上': '', '原価計': '', '粗利': '', '出率': '', 'フラグ': '' })
    result.push(...flagged)
    result.push({ 'ブースコード': '─ 全ブース ─', '店舗コード': '', '店舗名': '', '機種コード': '', '機種名': '', '単価': '', '巡回件数': '', '据え置回数': '', 'IN計': '', 'OUT計': '', '売上': '', '原価計': '', '粗利': '', '出率': '', 'フラグ': '' })
  }
  result.push(...normal)

  return result
}

function _buildPrizeAnalysis(rows, prizes) {
  const prizeMap = new Map((prizes || []).map(p => [p.prize_id, p]))
  const grouped = _groupBy(rows.filter(r => r.prize_id), r => r.prize_id)
  const result = []

  for (const [prizeId, prizeRows] of grouped) {
    const meta = prizeMap.get(prizeId)
    const boothSet = new Set(prizeRows.map(r => r.full_booth_code))
    const useCount = _sum(prizeRows, 'out_diff_1')
    const costSum = prizeRows.reduce((s, r) => s + (Number(r.out_diff_1) || 0) * (Number(r.prize_cost_1) || 0), 0)
    const revSum = _sum(prizeRows.filter(r => r.entry_type !== 'carry_forward'), 'revenue')
    const dates = prizeRows.map(r => r.patrol_date).sort()

    result.push({
      'prize_id': prizeId,
      '景品名': prizeRows[0].prize_name ?? meta?.prize_name ?? '',
      '原価(マスタ)': meta?.original_cost ?? '',
      '使用ブース数': boothSet.size,
      '合計使用数': useCount,
      '合計コスト': Math.round(costSum),
      '景品での売上': Math.round(revSum),
      'コスト比率(%)': revSum > 0 ? Math.round(costSum / revSum * 1000) / 10 : '',
      '使用期間': dates.length > 0 ? `${dates[0]} 〜 ${dates[dates.length - 1]}` : '',
    })
  }

  return result.sort((a, b) => {
    if (a['コスト比率(%)'] === '' && b['コスト比率(%)'] === '') return 0
    if (a['コスト比率(%)'] === '') return 1
    if (b['コスト比率(%)'] === '') return -1
    return a['コスト比率(%)'] - b['コスト比率(%)']
  })
}

function _applyColWidths(ws, widths) {
  ws['!cols'] = widths.map(wch => ({ wch }))
}

export async function exportRound0FullReport(filters) {
  const XLSX = await import('xlsx')

  const { data: rows, error } = await supabase
    .from('meter_readings')
    .select(`
      patrol_date, full_booth_code, store_code, machine_code, play_price,
      in_diff, out_diff_1, out_diff_2,
      prize_id, prize_name, prize_cost_1, prize_name_2, prize_cost_2,
      revenue, entry_type,
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

  const prizeIds = [...new Set(rows.map(r => r.prize_id).filter(Boolean))]
  let prizes = []
  if (prizeIds.length > 0) {
    const { data } = await supabase
      .from('prize_masters')
      .select('prize_id, prize_name, original_cost')
      .in('prize_id', prizeIds)
    prizes = data || []
  }

  const sheet1Data = _buildDetailRows(rows)
  const sheet2Data = _buildStoreSummary(rows)
  const sheet3Data = _buildBoothSummary(rows)
  const sheet4Data = _buildPrizeAnalysis(rows, prizes)

  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data)
  _applyColWidths(ws1, [12, 8, 18, 10, 16, 20, 8, 8, 8, 6, 6, 6, 8, 6, 24, 24, 8])
  XLSX.utils.book_append_sheet(wb, ws1, '巡回明細')

  const ws2 = XLSX.utils.json_to_sheet(sheet2Data)
  _applyColWidths(ws2, [10, 18, 8, 8, 10, 10, 10, 10, 10, 8, 24, 24])
  XLSX.utils.book_append_sheet(wb, ws2, '店舗別月次')

  const ws3 = XLSX.utils.json_to_sheet(sheet3Data)
  _applyColWidths(ws3, [20, 10, 18, 10, 16, 6, 8, 8, 8, 8, 10, 10, 10, 8, 18])
  XLSX.utils.book_append_sheet(wb, ws3, 'ブース別月次')

  const ws4 = XLSX.utils.json_to_sheet(sheet4Data)
  _applyColWidths(ws4, [14, 24, 10, 10, 10, 10, 12, 12, 22])
  XLSX.utils.book_append_sheet(wb, ws4, '景品コスト分析')

  XLSX.writeFile(wb, `round0_full_report_${filters.from}_${filters.to}.xlsx`)
}
