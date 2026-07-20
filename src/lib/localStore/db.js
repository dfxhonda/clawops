// SPEC-LF1-STORE-LOCAL-CACHE-01 (ARCH-LOCAL-FIRST-SYNC-V1 phase LF1):
// IndexedDB の thin wrapper。idb 8.x の openDB / transaction を最小限ラップして、
// patrol_records / store_meta の 2 object store を提供する。
//
// 設計判断:
// - DB 名: 'clawops_lf'  (LF1 phase の cache。LF2 で別 store 追加予定)
// - version 1 から開始。スキーマ拡張は version up + upgrade callback で migrate。
// - 1 booth 1 トランザクション原則は呼び出し側 (patrolRecords.js) が tx を保証する。

import { openDB } from 'idb'

export const DB_NAME = 'clawops_lf'
// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): v2 で patrol_route_today ストア追加。
export const DB_VERSION = 2

// object stores
export const STORE_PATROL_RECORDS = 'patrol_records' // 巡回 1 booth 1 record (in_meter 等)
export const STORE_STORE_META     = 'store_meta'     // 店舗メタ (storeCode -> { storeName, machines, prefetchedAt })
export const STORE_PATROL_ROUTE   = 'patrol_route_today' // 今日の巡回予定 (作業中の一時状態。日付JST付き1レコード)

let dbPromise = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PATROL_RECORDS)) {
          // key = localId (uuid) で put 可能。indexed by booth_code / store_code / synced。
          const ps = db.createObjectStore(STORE_PATROL_RECORDS, { keyPath: 'localId' })
          ps.createIndex('byBoothCode', 'booth_code', { unique: false })
          ps.createIndex('byStoreCode', 'store_code', { unique: false })
          // synced は 'true'|'false' 文字列。IndexedDB は boolean を index key にできないため文字列化。
          ps.createIndex('bySynced',    'syncedKey',  { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_STORE_META)) {
          db.createObjectStore(STORE_STORE_META, { keyPath: 'store_code' })
        }
        // D-106: 今日の巡回予定 (単一レコード keyPath 'id'。中身に stored_date(JST) と items)。
        if (!db.objectStoreNames.contains(STORE_PATROL_ROUTE)) {
          db.createObjectStore(STORE_PATROL_ROUTE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// テスト用。in-memory DB をリセットする (vitest 各 test で beforeEach から呼ぶ)。
export async function _resetDb() {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
  }
  dbPromise = null
  if (typeof globalThis.indexedDB?.deleteDatabase === 'function') {
    await new Promise(resolve => {
      const req = globalThis.indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = resolve
      req.onerror = resolve
      req.onblocked = resolve
    })
  }
}
