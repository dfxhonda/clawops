// ============================================
// サービス統合エクスポート
// 旧 sheets.js からの移行互換を維持
// ============================================

// 認証
export { logout } from './auth'

// ユーティリティ
export { parseNum, clearCache } from './utils'

// メーター読み値
export { getAllMeterReadings, getLastReadingsMap, getStaffMap, saveReading, updateReading } from './readings'

// マスター参照
export { getStores, getMachines, getBooths, findBoothByCode, findMachineById, findStoreById, getLocations } from './masters'

// 在庫
export { getPrizeStocksExtended, getStocksByOwner, addPrizeStock, updatePrizeStock, adjustPrizeStockQuantity } from './inventory'

// 在庫移動・棚卸し
export { MOVEMENT_TYPES, getStockMovements, addStockMovement, transferStock, countStock } from './movements'

// 景品マスター・発注
export { getPrizes, addPrize, getPrizeOrders, markOrderArrived } from './prizes'

// 監査ログ
export { writeAuditLog } from './audit'
