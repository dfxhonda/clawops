// SPEC-LF1-STORE-LOCAL-CACHE-01: 巡回 record の IndexedDB CRUD + synced フラグ管理。
// ARCH R1: 1 booth = 1 transaction (atomic、auto-rollback on crash) を putRecord で保証。
// ARCH R4: LF1 では削除しない、synced flag のみ更新 (lifecycle は LF2)。

import { getDb, STORE_PATROL_RECORDS, STORE_STORE_META } from './db'
import { logger } from '../logger'

const LOG_ERR_WRITE   = 'ERR-LF1-IDB-WRITE'
const LOG_ERR_READ    = 'ERR-LF1-IDB-READ'
const LOG_ERR_QUOTA   = 'ERR-LF1-IDB-QUOTA'

function syncedKey(b) { return b ? 'true' : 'false' }

/**
 * 1 booth 1 record の atomic put。
 * record shape (LF1 で取り扱う最小 subset):
 *  - localId       (uuid, IDB key)
 *  - booth_code    (text)
 *  - store_code    (text)
 *  - patrol_date   (text YYYY-MM-DD)
 *  - in_meter / out_meter / out_meter_2 / out_meter_3 (number|null)
 *  - prize_stock_count / prize_restock_count (number|null)
 *  - entry_type    ('patrol'|'replace'|'collection')
 *  - source        ('manual'|'ocr'|...)
 *  - input_method  ('manual'|'ocr')
 *  - prize_name / prize_cost / set_* (任意)
 *  - synced        (boolean)
 *  - syncedKey     (syncedKey(synced))
 *  - createdLocally(ISO timestamp)
 *
 * 失敗時は ERR-LF1-IDB-WRITE で logger + 例外 throw (上位がユーザー警告を出す)。
 */
export async function putPatrolRecord(record) {
  try {
    const db = await getDb()
    const now = new Date().toISOString()
    const localId = record.localId ?? (crypto.randomUUID?.() ?? `lf-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const synced = record.synced ?? false
    const merged = {
      ...record,
      localId,
      synced,
      syncedKey: syncedKey(synced),
      createdLocally: record.createdLocally ?? now,
      updatedLocally: now,
    }
    const tx = db.transaction(STORE_PATROL_RECORDS, 'readwrite')
    await tx.store.put(merged)
    await tx.done
    return merged
  } catch (err) {
    const tag = err?.name === 'QuotaExceededError' ? LOG_ERR_QUOTA : LOG_ERR_WRITE
    logger.error?.(tag, { boothCode: record?.booth_code, message: err?.message })
    throw new IdbWriteError(tag, err)
  }
}

export class IdbWriteError extends Error {
  constructor(code, cause) {
    super(cause?.message ?? code)
    this.code = code
    this.cause = cause
  }
}

export async function getPatrolRecordsByStore(storeCode) {
  if (!storeCode) return []
  try {
    const db = await getDb()
    return await db.getAllFromIndex(STORE_PATROL_RECORDS, 'byStoreCode', storeCode)
  } catch (err) {
    logger.error?.(LOG_ERR_READ, { storeCode, message: err?.message })
    return []
  }
}

export async function getPatrolRecordsByBooth(boothCode) {
  if (!boothCode) return []
  try {
    const db = await getDb()
    return await db.getAllFromIndex(STORE_PATROL_RECORDS, 'byBoothCode', boothCode)
  } catch (err) {
    logger.error?.(LOG_ERR_READ, { boothCode, message: err?.message })
    return []
  }
}

export async function getUnsyncedRecords() {
  try {
    const db = await getDb()
    return await db.getAllFromIndex(STORE_PATROL_RECORDS, 'bySynced', syncedKey(false))
  } catch (err) {
    logger.error?.(LOG_ERR_READ, { message: err?.message })
    return []
  }
}

/**
 * SPEC-LF1-HISTORY-FIX-01: server baseline (synced=true) rows を IDB に書き込む。
 * idempotent: localId = reading_id を採用するため再 fetch しても同じ row は overwrite される。
 * 既存 synced=false (ローカル編集) には触れない。
 *
 * 1 store の全 rows を 1 トランザクションで処理 (ARCH R1 transaction 原則の延長)。
 */
export async function putBaselineRows(rows) {
  if (!rows || !rows.length) return 0
  // SPEC-LF1-HISTORY-FIX-03 C3 guard: index key 必須フィールド (store_code) が欠落した row を
  // 検知してログ。IDB index byStoreCode で entry が作られず、getPatrolRecordsByStore が
  // silent に 0 件返却する (= 全列 '−' バグ) のを未然に検知する。
  // DIAG-LF1-HISTORY-RUNTIME-01 で実際に発生した症状の再発防止策。
  const missingStoreCode = rows.filter(r => r && r.store_code == null).length
  if (missingStoreCode > 0) {
    logger.warn?.('ERR-LF1-IDB-INDEX-MISSING', {
      phase: 'baseline',
      missingStoreCode,
      total: rows.length,
      hint: 'HISTORY_SELECT に store_code が含まれていない可能性、IDB byStoreCode index 落ちで history 全列 - になる',
    })
  }
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_PATROL_RECORDS, 'readwrite')
    const nowIso = new Date().toISOString()
    let count = 0
    for (const row of rows) {
      const localId = row.reading_id ?? `baseline-${row.booth_code}-${row.patrol_date}`
      await tx.store.put({
        ...row,
        localId,
        synced: true,
        syncedKey: syncedKey(true),
        syncedAt: nowIso,
        baselineRefreshedAt: nowIso,
      })
      count++
    }
    await tx.done
    return count
  } catch (err) {
    const tag = err?.name === 'QuotaExceededError' ? LOG_ERR_QUOTA : LOG_ERR_WRITE
    logger.error?.(tag, { phase: 'baseline', count: rows.length, message: err?.message })
    throw new IdbWriteError(tag, err)
  }
}

export async function markRecordSynced(localId) {
  if (!localId) return null
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_PATROL_RECORDS, 'readwrite')
    const existing = await tx.store.get(localId)
    if (!existing) { await tx.done; return null }
    const next = {
      ...existing,
      synced: true,
      syncedKey: syncedKey(true),
      syncedAt: new Date().toISOString(),
    }
    await tx.store.put(next)
    await tx.done
    return next
  } catch (err) {
    logger.error?.(LOG_ERR_WRITE, { localId, message: err?.message })
    return null
  }
}

// 未送信件数 + 関与 store 数 を集計してバナーに渡す。
export async function getUnsyncedSummary() {
  const unsynced = await getUnsyncedRecords()
  const storeSet = new Set()
  for (const r of unsynced) if (r.store_code) storeSet.add(r.store_code)
  return { count: unsynced.length, storeCount: storeSet.size, records: unsynced }
}

/**
 * FIX4: store_code:null の未送信レコードを掃除。
 * - booth_code から逆引き可能なら store_code を補完して残す。
 * - 逆引き不能 (= 真の孤児) なら IDB から削除。
 * useUnsentBanner 初期化時に1回実行することで既存幽霊レコードを自動消滅させる。
 */
function _deriveStoreCode(boothCd) {
  if (!boothCd) return null
  if (/^[A-Z]{3}\d{2}::/.test(boothCd)) return boothCd.split('::')[0]
  const p = boothCd.split('-')
  return p.length >= 2 ? p[0] : null
}

export async function deleteOrphanedNullStoreRecords() {
  try {
    const db = await getDb()
    const all = await db.getAllFromIndex(STORE_PATROL_RECORDS, 'bySynced', syncedKey(false))
    const nullStoreRecords = all.filter(r => r.store_code == null)
    if (!nullStoreRecords.length) return 0
    const tx = db.transaction(STORE_PATROL_RECORDS, 'readwrite')
    let deleted = 0
    let patched = 0
    for (const r of nullStoreRecords) {
      const derived = _deriveStoreCode(r.booth_code)
      if (derived) {
        await tx.store.put({ ...r, store_code: derived })
        patched++
      } else {
        await tx.store.delete(r.localId)
        deleted++
      }
    }
    await tx.done
    if (deleted > 0 || patched > 0) {
      logger.warn?.('ERR-LF1-ORPHAN-SWEEP', { deleted, patched })
    }
    return deleted
  } catch (err) {
    logger.error?.(LOG_ERR_WRITE, { phase: 'orphan_sweep', message: err?.message })
    return 0
  }
}

/**
 * SPEC-LF1-UNSENT-RECONCILE-FIX-01 FIX_A:
 * iOS Safari タブkillで markRecordSynced が未実行になったレコードを reconcile。
 * refreshBaselineAndRender 後に呼ぶことで、次回ページロード時に自動回復する。
 *
 * CRITICAL GUARD: booth_code+patrol_date+entry_type の一致だけで mark しない。
 * in_meter/out_meter/prize_stock_count/prize_restock_count が全て一致した場合のみ mark。
 * 不一致 = ローカル未反映の編集が残っている → mark せず unsynced のまま re-upload 対象にする。
 */
export async function reconcileSyncedByBaseline(baselineRows) {
  if (!baselineRows || !baselineRows.length) return 0
  const unsynced = await getUnsyncedRecords()
  if (!unsynced.length) return 0

  // (booth_code, patrol_date, entry_type) → baseline rows[]
  const baselineMap = new Map()
  for (const row of baselineRows) {
    const k = `${row.booth_code}__${row.patrol_date}__${row.entry_type ?? 'patrol'}`
    if (!baselineMap.has(k)) baselineMap.set(k, [])
    baselineMap.get(k).push(row)
  }

  let reconciled = 0
  for (const local of unsynced) {
    const k = `${local.booth_code}__${local.patrol_date}__${local.entry_type ?? 'patrol'}`
    const candidates = baselineMap.get(k)
    if (!candidates) continue
    // CRITICAL: core values must match to avoid swallowing unsynced local edits
    const matched = candidates.some(b =>
      Number(b.in_meter)            === Number(local.in_meter)            &&
      Number(b.out_meter)           === Number(local.out_meter)           &&
      Number(b.prize_stock_count)   === Number(local.prize_stock_count)   &&
      Number(b.prize_restock_count) === Number(local.prize_restock_count)
    )
    if (!matched) continue
    const result = await markRecordSynced(local.localId)
    if (result) {
      reconciled++
      logger.info?.('LF1_RECONCILE_SYNCED', { boothCode: local.booth_code, localId: local.localId })
    }
  }
  if (reconciled > 0) logger.info?.('LF1_RECONCILE_DONE', { reconciled })
  return reconciled
}


// store メタ (storeName / machines / prefetchedAt) を保存。prefetch / load 共通。
export async function putStoreMeta(storeCode, meta) {
  if (!storeCode) return
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_STORE_META, 'readwrite')
    await tx.store.put({ store_code: storeCode, ...meta, updatedAt: new Date().toISOString() })
    await tx.done
  } catch (err) {
    logger.error?.(LOG_ERR_WRITE, { storeCode, message: err?.message })
  }
}

export async function getStoreMeta(storeCode) {
  if (!storeCode) return null
  try {
    const db = await getDb()
    return await db.get(STORE_STORE_META, storeCode)
  } catch (err) {
    logger.error?.(LOG_ERR_READ, { storeCode, message: err?.message })
    return null
  }
}
