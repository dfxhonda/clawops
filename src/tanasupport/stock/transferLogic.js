// J-STOCK-TRANSFER-fix-02: 倉庫↔担当者 在庫移動の純ロジック (DB非依存)

/**
 * 移動方向から from/to オーナーと movement_type を導出。
 * direction: 'out'=持ち出し(倉庫→担当者) / 'in'=帰庫(担当者→倉庫)
 */
export function deriveOwners(direction, warehouseId, staffId) {
  if (direction === 'out') {
    return {
      from: { type: 'location', id: warehouseId },
      to: { type: 'staff', id: staffId },
      movementType: 'transfer_out',
    }
  }
  return {
    from: { type: 'staff', id: staffId },
    to: { type: 'location', id: warehouseId },
    movementType: 'transfer_in',
  }
}

/** 個数バリデーション。問題なければ null、あれば {code,message}。 */
export function transferQtyError(qty, available) {
  const n = parseInt(qty, 10)
  if (!Number.isFinite(n) || n <= 0) {
    return { code: 'ERR-STOCK-008', message: '個数を入力してください' }
  }
  if (n > available) {
    return { code: 'ERR-STOCK-009', message: `在庫不足: 現在 ${available} 個` }
  }
  return null
}
