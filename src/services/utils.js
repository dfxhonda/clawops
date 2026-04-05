// ============================================
// ユーティリティ関数
// ============================================

export function parseNum(v) {
  if (v === undefined || v === null || v === '') return NaN
  return Number(String(v).replace(/,/g, ''))
}

// インメモリキャッシュ
const cache = {}
export function getCache(key) { return cache[key] }
export function setCache(key, val) { cache[key] = val }
export function clearCache() { Object.keys(cache).forEach(k => delete cache[k]) }

export function isOldEnough(readTime) {
  if (!readTime) return false
  const d = new Date(readTime)
  if (isNaN(d)) return false
  return d < new Date(Date.now() - 24 * 60 * 60 * 1000)
}

export const SUPPLIER_MAP = {
  SGP: '景品フォーム', PCH: 'ピーチトイ', SDY: 'エスディーワイ',
  INF: 'インフィニティ', AXS: 'アクシズ', LNS: 'LINE仕入先', MCR: 'メルカリ',
}

export function supName(id) { return SUPPLIER_MAP[id] || id || '' }
