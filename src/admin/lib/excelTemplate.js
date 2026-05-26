import { supabase } from '../../lib/supabase'

export async function generateExcelTemplate({ storeCode, storeName, machines }) {
  const XLSX = await import('xlsx')

  const boothCodes = machines.flatMap(m => m.booths.map(b => b.booth_code))

  let prevMap = {}
  if (boothCodes.length > 0) {
    const { data: prevRows } = await supabase
      .from('meter_readings')
      .select(
        'booth_code, in_meter, out_meter, prize_stock_count, prize_restock_count, ' +
        'prize_name, prize_id, prize_cost, set_a, set_c, set_l, set_r, set_o'
      )
      .in('booth_code', boothCodes)
      .order('patrol_date', { ascending: false })
      .order('created_at', { ascending: false })
    for (const row of (prevRows ?? [])) {
      if (!prevMap[row.booth_code]) prevMap[row.booth_code] = row
    }
  }

  const rows = []
  for (const machine of machines) {
    for (const booth of machine.booths) {
      const p = prevMap[booth.booth_code] ?? {}
      rows.push({
        'ブースコード':   booth.booth_code,
        '機種名':         machine.machine_name ?? '',
        'ブース番号':     booth.booth_number ?? '',
        '巡回日':         new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }),
        'IN':             p.in_meter            ?? '',
        'OUT':            p.out_meter           ?? '',
        '残':             p.prize_stock_count   ?? '',
        '補':             p.prize_restock_count ?? 0,
        '景品名':         p.prize_name          ?? '',
        '景品ID':         p.prize_id            ?? '',
        '単価':           p.prize_cost          ?? '',
        '設定A':          p.set_a               ?? '',
        '設定C':          p.set_c               ?? '',
        '設定L':          p.set_l               ?? '',
        '設定R':          p.set_r               ?? '',
        'メモ設定':       p.set_o               ?? '',
        'ノート':         '',
      })
    }
  }

  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(rows)
  ws1['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 8 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 22 }, { wch: 16 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'データ入力')

  const legend = [
    { '列名': 'ブースコード',  '説明': '変更不可。取込時のキーです。',    '必須': ''   },
    { '列名': '機種名',        '説明': '参考表示。変更不可。',              '必須': ''   },
    { '列名': 'ブース番号',    '説明': '参考表示。変更不可。',              '必須': ''   },
    { '列名': '巡回日',        '説明': 'YYYY-MM-DD形式で入力',              '必須': '必須' },
    { '列名': 'IN',            '説明': 'INメーター（整数）',                '必須': '必須' },
    { '列名': 'OUT',           '説明': 'OUTメーター（整数）',               '必須': '必須' },
    { '列名': '残',            '説明': '景品在庫数（省略時=0）',             '必須': ''   },
    { '列名': '補',            '説明': '景品補充数（省略時=0）',             '必須': ''   },
    { '列名': '景品名',        '説明': '景品名（前回値継承）',               '必須': ''   },
    { '列名': '景品ID',        '説明': '参考表示。変更不可。',               '必須': ''   },
    { '列名': '単価',          '説明': '景品原価',                           '必須': ''   },
    { '列名': '設定A/C/L/R',  '説明': '設定値',                             '必須': ''   },
    { '列名': 'メモ設定',      '説明': '設定メモ',                           '必須': ''   },
    { '列名': 'ノート',        '説明': '自由記入欄',                         '必須': ''   },
  ]
  const ws2 = XLSX.utils.json_to_sheet(legend)
  ws2['!cols'] = [{ wch: 16 }, { wch: 42 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws2, '凡例')

  const info = [
    { '項目': '店舗コード', '値': storeCode },
    { '項目': '店舗名',     '値': storeName },
    { '項目': 'ブース数',   '値': rows.length },
    { '項目': '取得日時',   '値': new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) },
  ]
  const ws3 = XLSX.utils.json_to_sheet(info)
  ws3['!cols'] = [{ wch: 12 }, { wch: 32 }]
  XLSX.utils.book_append_sheet(wb, ws3, '店舗情報')

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '')
  XLSX.writeFile(wb, `${storeCode}_取込雛形_${today}.xlsx`)
}
