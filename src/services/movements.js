// ============================================
// 在庫移動・棚卸し (stock_movements)
// ============================================
import { supabase } from '../lib/supabase'
import { getCache, setCache, clearCache } from './utils'
import { getPrizeStocksExtended, addPrizeStock, updatePrizeStock } from './inventory'
import { writeAuditLog } from './audit'

export const MOVEMENT_TYPES = {
  TRANSFER: 'transfer',
  ARRIVAL: 'arrival',
  REPLENISH: 'replenish',
  COUNT: 'count',
  ADJUST: 'adjust',
}

export async function getStockMovements(forceRefresh = false) {
  if (!forceRefresh && getCache('stock_movements')) return getCache('stock_movements')
  const pageSize = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) { console.error('stock_movements取得エラー:', error.message); return [] }
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const result = all.map(r => ({
    movement_id: r.movement_id, prize_id: r.prize_id || '', movement_type: r.movement_type || '',
    from_owner_type: r.from_owner_type || '', from_owner_id: r.from_owner_id || '',
    to_owner_type: r.to_owner_type || '', to_owner_id: r.to_owner_id || '',
    quantity: r.quantity ?? 0, note: r.note || '',
    reason: r.reason || '', adjustment_reason: r.adjustment_reason || '',
    tracking_number: r.tracking_number || '',
    created_at: r.created_at || '', created_by: r.created_by || '',
  }))
  setCache('stock_movements', result)
  return result
}

export async function addStockMovement(mv) {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('stock_movements').insert({
    prize_id: mv.prize_id || null,
    movement_type: mv.movement_type,
    from_owner_type: mv.from_owner_type || null,
    from_owner_id: mv.from_owner_id || null,
    to_owner_type: mv.to_owner_type || '',
    to_owner_id: mv.to_owner_id || '',
    quantity: mv.quantity || 0,
    note: mv.note || null,
    reason: mv.reason || null,
    adjustment_reason: mv.adjustment_reason || null,
    created_at: now, created_by: mv.created_by || null,
  }).select('movement_id').single()
  if (error) throw new Error('移動履歴追加エラー: ' + error.message)
  clearCache()
  return data.movement_id
}

export async function transferStock({ prizeId, prizeName, fromOwnerType, fromOwnerId, toOwnerType, toOwnerId, quantity, note, createdBy, reason }) {
  const qty = parseInt(quantity)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error(`無効な数量: ${quantity}`)
  quantity = qty
  const all = await getPrizeStocksExtended(true)

  if (fromOwnerType && fromOwnerId) {
    const fromStocks = all.filter(s => s.prize_id === prizeId && s.owner_type === fromOwnerType && s.owner_id === fromOwnerId)
    if (fromStocks.length === 0) throw new Error(`移動元在庫が見つかりません: ${prizeName || prizeId} (${fromOwnerType}/${fromOwnerId})`)
    const fromStock = fromStocks[0]
    if (fromStock.quantity < quantity) throw new Error(`在庫不足: ${prizeName || prizeId} 現在${fromStock.quantity}個、移動要求${quantity}個`)
    await updatePrizeStock(fromStock.stock_id, { ...fromStock, quantity: fromStock.quantity - quantity, updated_by: createdBy })
  }

  const toStocks = all.filter(s => s.prize_id === prizeId && s.owner_type === toOwnerType && s.owner_id === toOwnerId)
  const toStock = toStocks[0] || null
  if (toStock) {
    await updatePrizeStock(toStock.stock_id, { ...toStock, quantity: toStock.quantity + quantity, updated_by: createdBy })
  } else {
    await addPrizeStock({ prize_id: prizeId, quantity, owner_type: toOwnerType, owner_id: toOwnerId, updated_by: createdBy })
  }

  const movementType = fromOwnerType ? MOVEMENT_TYPES.TRANSFER : MOVEMENT_TYPES.ARRIVAL

  // 監査ログ
  writeAuditLog({
    action: 'stock_transfer',
    target_table: 'stock_movements',
    detail: `${prizeName || prizeId} x${quantity}: ${fromOwnerType}/${fromOwnerId} → ${toOwnerType}/${toOwnerId}${reason ? ` 理由: ${reason}` : ''}`,
    staff_id: createdBy,
    before_data: { from: `${fromOwnerType}/${fromOwnerId}`, to: `${toOwnerType}/${toOwnerId}` },
    after_data: { prize_id: prizeId, quantity },
    reason: reason || undefined,
  })

  return addStockMovement({
    prize_id: prizeId, movement_type: movementType,
    from_owner_type: fromOwnerType||'', from_owner_id: fromOwnerId||'',
    to_owner_type: toOwnerType, to_owner_id: toOwnerId,
    quantity, note: note||'', created_by: createdBy||''
  })
}

export async function countStock({ prizeId, prizeName, ownerType, ownerId, actualQuantity, note, createdBy, reason }) {
  const qty = parseInt(actualQuantity)
  if (!Number.isFinite(qty) || qty < 0) throw new Error(`無効な数量: ${actualQuantity}`)
  actualQuantity = qty
  const all = await getPrizeStocksExtended(true)
  const stocks = all.filter(s => s.prize_id === prizeId && s.owner_type === ownerType && s.owner_id === ownerId)
  const stock = stocks[0] || null

  const currentQty = stock ? stock.quantity : 0
  const diff = actualQuantity - currentQty

  const now = new Date().toISOString()
  if (stock) {
    const { error: upErr } = await supabase.from('prize_stocks').update({
      quantity: actualQuantity,
      last_counted_at: now, last_counted_by: createdBy || null,
      updated_at: now, updated_by: createdBy || null,
    }).eq('stock_id', stock.stock_id)
    if (upErr) throw new Error('棚卸し更新エラー: ' + upErr.message)
    clearCache()
  } else {
    await addPrizeStock({ prize_id: prizeId, quantity: actualQuantity, owner_type: ownerType, owner_id: ownerId, updated_by: createdBy })
  }

  // 監査ログ
  writeAuditLog({
    action: diff !== 0 ? 'stock_count_adjust' : 'stock_count_match',
    target_table: 'prize_stocks',
    target_id: stock?.stock_id || '',
    detail: `棚卸し: ${prizeName || prizeId} 理論値${currentQty} → 実数${actualQuantity}${diff !== 0 ? ` (差異${diff > 0 ? '+' : ''}${diff})` : ' (一致)'}${reason ? ` 理由: ${reason}` : ''}`,
    staff_id: createdBy,
    before_data: { quantity: currentQty, prize_id: prizeId, owner_type: ownerType, owner_id: ownerId },
    after_data: { quantity: actualQuantity, diff },
    reason: reason || undefined,
  })

  await addStockMovement({
    prize_id: prizeId, movement_type: diff !== 0 ? MOVEMENT_TYPES.ADJUST : MOVEMENT_TYPES.COUNT,
    from_owner_type: ownerType, from_owner_id: ownerId,
    to_owner_type: ownerType, to_owner_id: ownerId,
    quantity: diff,
    adjustment_reason: diff !== 0 ? '棚卸し差分' : '棚卸し一致',
    note: note || `棚卸し: 理論値${currentQty} → 実数${actualQuantity}${diff !== 0 ? ` (差異${diff > 0 ? '+' : ''}${diff})` : ' (一致)'}`,
    created_by: createdBy||''
  })

  return { previousQuantity: currentQty, actualQuantity, diff }
}
