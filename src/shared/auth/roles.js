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

export const LAUNCHER_TILES = [
  {
    key: 'clawsupport',
    label: 'クレサポ',
    emoji: '🎯',
    desc: '巡回・集金・補充',
    path: '/patrol/overview',
    requiredModules: ['patrol'],
  },
  {
    key: 'tanasupport',
    label: 'タナサポ',
    emoji: '📦',
    desc: '入荷チェック・棚卸し・発注',
    path: '/stock/dashboard',
    requiredModules: ['arrivals'],
  },
  {
    key: 'manesupport',
    label: '管理運営',
    emoji: '⚙️',
    desc: 'スタッフ・マスタ・統計',
    path: '/admin',
    requiredModules: ['admin'],
  },
]

export function canAccess(role, moduleKey) {
  if (!role) return false
  if (role === ROLES.ADMIN) return true
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false
}

export function getVisibleTiles(role) {
  return LAUNCHER_TILES.filter(tile =>
    tile.requiredModules.some(m => canAccess(role, m))
  )
}
