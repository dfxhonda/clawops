import { openDB } from 'idb'

const DB_NAME = 'clawops_auth'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const KEY_PREFIX = 'clawops_session_'

let dbPromise = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export async function saveSession(staff_id, session) {
  const db = await getDb()
  await db.put(STORE_NAME, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  }, KEY_PREFIX + staff_id)
}

export async function loadSession(staff_id) {
  const db = await getDb()
  const session = await db.get(STORE_NAME, KEY_PREFIX + staff_id)
  if (!session) return null
  if (!session.expires_at || session.expires_at < Date.now() / 1000) return null
  return session
}

export async function clearSession(staff_id) {
  const db = await getDb()
  await db.delete(STORE_NAME, KEY_PREFIX + staff_id)
}

export async function clearAllSessions() {
  const db = await getDb()
  const keys = await db.getAllKeys(STORE_NAME)
  await Promise.all(
    keys.filter(k => String(k).startsWith(KEY_PREFIX)).map(k => db.delete(STORE_NAME, k))
  )
}

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
