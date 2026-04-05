// ============================================
// 在庫管理 (prize_stocks)
// ============================================
import { supabase } from '../lib/supabase'
import { getCache, setCache, clearCache } from './utils'
import { writeAuditLog } from './audit'

export async function getPrizeStocksExtended(forceRefresh = false) {
  if (!forceRefresh && getCache('prize_stocks_ext')) return getCache('prize_stocks_ext')
  const pageSize = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('prize_stocks')
      .select('*, prize_masters(prize_name)')
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) { console.error('prize_stocks取得エラー:', error.message); return [] }
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const result = all.map(r => ({
    stock_id: r.stock_id, prize_id: r.prize_id,
    prize_name: r.prize_masters?.prize_name || '',
    owner_type: r.owner_type || '', owner_id: r.owner_id || '',
    quantity: r.quantity ?? 0,
    tags: r.tags || '',
    updated_at: r.updated_at || '', updated_by: r.updated_by || '',
    last_counted_at: r.last_counted_at || '', last_counted_by: r.last_counted_by || '',
    created_at: r.created_at || '',
  }))
  setCache('prize_stocks_ext', result)
  return result
}

export async function getStocksByOwner(ownerType, ownerId) {
  const all = await getPrizeStocksExtended()
  return all.filter(s => s.owner_type === ownerType && s.owner_id === ownerId)
}

export async function addPrizeStock(stock) {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('prize_stocks').insert({
    prize_id: stock.prize_id || null,
    owner_type: stock.owner_type || '',
    owner_id: stock.owner_id || '',
    quantity: stock.quantity ?? 0,
    tags: stock.tags || null,
    updated_by: stock.updated_by || null,
    created_at: now, updated_at: now,
  }).select('stock_id').single()
  if (error) throw new Error('在庫追加エラー: ' + error.message)
  clearCache()
  return data.stock_id
}

export async function updatePrizeStock(stockId, stock) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('prize_stocks').update({
    quantity: stock.quantity ?? 0,
    owner_type: stock.owner_type || undefined,
    owner_id: stock.owner_id || undefined,
    tags: stock.tags || undefined,
    updated_at: now,
    updated_by: stock.updated_by || null,
  }).eq('stock_id', stockId)
  if (error) throw new Error('在庫更新エラー: ' + error.message)
  clearCache()
}

export async function adjustPrizeStockQuantity(stockId, delta, updatedBy = '') {
  const all = await getPrizeStocksExtended(true)
  const stock = all.find(s => s.stock_id === stockId)
  if (!stock) throw new Error('Stock not found: ' + stockId)
  const newQty = stock.quantity + delta
  if (newQty < 0) throw new Error(`在庫不足: 現在${stock.quantity}個、要求${Math.abs(delta)}個 (${stock.prize_name || stockId})`)
  await updatePrizeStock(stockId, { ...stock, quantity: newQty, updated_by: updatedBy })

  // 監査ログ
  writeAuditLog({
    action: 'stock_adjust',
    target_table: 'prize_stocks',
    target_id: stockId,
    detail: `数量変更: ${stock.quantity} → ${newQty} (差分: ${delta > 0 ? '+' : ''}${delta})`,
    staff_id: updatedBy,
  })

  return newQty
}
