import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { addStockMovement } from '../../services/movements'
import { deriveOwners, transferQtyError } from './transferLogic'

// J-STOCK-TRANSFER-fix-02: 倉庫↔担当者 在庫移動。
// stock_movements に INSERT するだけ (addStockMovement)。prize_stocks は
// トリガー fn_apply_stock_movement が from-= / to+= で自動更新するため一切直書きしない。
export function useTransfer(direction, warehouseId, staffId) {
  const [prizes, setPrizes] = useState([]) // from側の在庫 { prize_id, prize_name, available }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { from, to, movementType } = deriveOwners(direction, warehouseId, staffId)
  const fromType = from.type
  const fromId = from.id

  const loadPrizes = useCallback(async () => {
    if (!fromId) { setPrizes([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('prize_stocks')
        .select('prize_id, quantity, prize:prize_masters(prize_name)')
        .eq('owner_type', fromType)
        .eq('owner_id', fromId)
        .gt('quantity', 0)
        .order('prize_id')
      if (e) throw e
      setPrizes((data ?? []).map(s => ({
        prize_id: s.prize_id,
        prize_name: s.prize?.prize_name ?? s.prize_id,
        available: s.quantity ?? 0,
      })))
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [fromType, fromId])

  useEffect(() => { loadPrizes() }, [loadPrizes])

  // 在庫移動を実行。bad qty は {code,message} を throw。成功でリスト再読込。
  const transfer = useCallback(async (prizeId, qty, available) => {
    const err = transferQtyError(qty, available)
    if (err) throw err
    const n = parseInt(qty, 10)
    await addStockMovement({
      prize_id: prizeId,
      movement_type: movementType,
      from_owner_type: from.type,
      from_owner_id: from.id,
      to_owner_type: to.type,
      to_owner_id: to.id,
      quantity: n,
      note: `transfer:${movementType}:${from.id}:${to.id}`,
      created_by: staffId,
    })
    await loadPrizes()
  }, [movementType, from.type, from.id, to.type, to.id, staffId, loadPrizes])

  return { prizes, loading, error, movementType, transfer, reload: loadPrizes }
}
