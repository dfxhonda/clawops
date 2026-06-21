// 既存ロール名 (staff.role / JWT user_metadata.role と一致させる)
export const ROLES = {
  ADMIN:   'admin',
  MANAGER: 'manager',
  PATROL:  'patrol',
  STAFF:   'staff',
}

// モジュールキー → 許可ロール
export const MODULE_ACCESS = {
  patrol:    ['admin', 'manager', 'patrol', 'staff'],
  collection:['admin', 'manager'],
  sales:     ['admin', 'manager'],
  arrivals:  ['admin', 'manager'],
  stocktake: ['admin', 'manager'],
  orders:    ['admin', 'manager'],
  admin:     ['admin'],
}

/** ランチャー・モジュールタイル（ロールで表示切替） */
export const LAUNCHER_MODULE_TILES = [
  {
    key: 'clawsupport',
    label: 'クレサポ',
    emoji: '📊',
    desc: '巡回・店舗メーター入力',
    path: '/clawsupport',
    requiredModules: ['patrol'],
  },
  {
    key: 'tanasupport',
    label: 'タナサポ',
    emoji: '📦',
    desc: '棚卸し・入荷チェック',
    // J-STOCK-LAUNCHER-REDIRECT-01 (5/31): /tanasupport → /stock に変更
    // J-STOCK-LAUNCHER-REDIRECT-02 (6/1): /stock → /stock/stocktake に変更し、
    // StocktakeTargetPage (倉庫/担当 2 タブ) に直行。
    path: '/stock/stocktake',
    requiredModules: ['stocktake'],
  },
  {
    key: 'manesupport',
    label: 'マネサポ',
    emoji: '⚙️',
    desc: '管理・分析',
    path: '/admin',
    requiredModules: ['admin'],
  },
]

/** 未実装モジュール（全ロールで disabled 表示） */
export const LAUNCHER_COMING_SOON_TILES = [
  {
    key: 'm3_sales',
    label: '売上集計',
    emoji: '📈',
    desc: 'M3 · Coming Soon',
  },
  {
    key: 'm4_master',
    label: 'マスタ参照',
    emoji: '📚',
    desc: 'M4 · Coming Soon',
  },
]

export function canAccess(role, moduleKey) {
  if (!role) return false
  if (role === ROLES.ADMIN) return true
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false
}

export function getModuleTilesForRole(role) {
  return LAUNCHER_MODULE_TILES.filter(tile =>
    tile.requiredModules.some(m => canAccess(role, m))
  )
}
