// ============================================
// patrolStockCalc: 巡回入力の在庫/メーター純計算ロジック
// PatrolBoothInputPage から切り出し、恒久的にテスト可能にする。
// ど安定ver(景品在庫)に関わるため変更時は必ずテストを通すこと。
// ============================================

// OCR等で得たメーター配列を in_meter / out_meter 列にマップする。
// IN系は先頭一致優先、OUT系は outOrder の優先順で最初の有効値。
export function mapMetersToColumns(meters) {
  const list = Array.isArray(meters) ? meters : []
  const inTypes = ['in', 'yen1000_in', 'yen500_in', 'yen100_in', 'in_a', 'in_b', 'change_in']
  const cols = { in_meter: null, out_meter: null }
  for (const t of inTypes) {
    const m = list.find(x => x.type === t && x.value != null)
    if (m) { cols.in_meter = parseInt(m.value, 10); break }
  }
  const outOrder = ['out_a', 'out', 'capsule_out', 'prize_out', 'out_b', 'out_c', 'change_out']
  const outs = list
    .filter(m => /out/i.test(m.type) && m.value != null)
    .sort((a, b) => outOrder.indexOf(a.type) - outOrder.indexOf(b.type))
  if (outs[0]) cols.out_meter = parseInt(outs[0].value, 10)
  return cols
}

// 理論在庫 = 前回在庫 + 前回補充 − OUT差(今回OUT − 前回OUT)。
// 払い出し=OUT差(1個=1カウント)。前回在庫が無ければ null。
// 別日巡回で「残数に前回補充を足し込み、OUTをリアルタイムに引いた」在庫を出すために使う。
export function theoreticalStock(prevStock, prevRestock, prevOut, curOut) {
  if (prevStock == null) return null
  const base = Number(prevStock) + Number(prevRestock ?? 0)
  const diff = (curOut !== '' && curOut != null && prevOut != null) ? Number(curOut) - Number(prevOut) : 0
  return base - diff
}
