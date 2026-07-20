// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): 今日の巡回予定リストの idb 保存 (作業中の一時状態)。
// 日付JST付きで保存し、読み込み時に stored_date が今日と違えば空リスト(=日付が変われば自動破棄)。
// JST日付は toLocaleDateString('sv-SE', Asia/Tokyo)。toISOString 禁止 (UTCずれ)。
import { getDb, STORE_PATROL_ROUTE } from './db'

const ROUTE_ID = 'today'

// 'YYYY-MM-DD' (JST)。sv-SE ロケールは ISO 風 (YYYY-MM-DD) を返す。
export function todayJst() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// items: [{ store_code, store_name, lat, lng }] を現在順で保存。
export async function saveRouteToday(items) {
  const db = await getDb()
  await db.put(STORE_PATROL_ROUTE, { id: ROUTE_ID, stored_date: todayJst(), items: items ?? [] })
}

// 今日のぶんだけ復元。stored_date が今日と違えば空 (自動破棄)。
export async function loadRouteToday() {
  const db = await getDb()
  const rec = await db.get(STORE_PATROL_ROUTE, ROUTE_ID)
  if (!rec || rec.stored_date !== todayJst()) return []
  return rec.items ?? []
}

export async function clearRouteToday() {
  const db = await getDb()
  await db.delete(STORE_PATROL_ROUTE, ROUTE_ID)
}
