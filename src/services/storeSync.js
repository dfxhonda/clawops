// FIX3: booth_code から store_code を逆引き (PatrolBoothInputPage.deriveStoreCode と同ロジック)
function _deriveStoreCode(boothCd) {
  if (!boothCd) return null
  if (/^[A-Z]{3}\d{2}::/.test(boothCd)) return boothCd.split('::')[0]
  const p = boothCd.split('-')
  return p.length >= 2 ? p[0] : null
}

// SPEC-LF1-STORE-LOCAL-CACHE-01: 店舗離脱時の auto-sync オーケストレーション。
// - navigator.onLine + 軽量 connectivity probe で online 判定
// - 未送信 record を Supabase 既存 save 経路に渡して upload
// - 成功で markRecordSynced (LF1 は削除しない、synced=true へ flag のみ更新)
// - 失敗は ERR-XXX log + 未送信のまま、banner で表示継続

import { savePatrolReading } from './patrolCore'
import {
  getUnsyncedRecords,
  markRecordSynced,
  getPatrolRecordsByStore,
  putPatrolRecord,
  setRecordLastErrCode,
} from '../lib/localStore/patrolRecords'
import { logger } from '../lib/logger'

const LOG_ERR_UPLOAD = 'ERR-LF1-SYNC-UPLOAD'
const LOG_ERR_PROBE  = 'ERR-LF1-SYNC-PROBE'

// Per-storeCode in-flight lock: prevents concurrent calls from double-uploading the same unsynced records.
// When 2 callers race (unmount autosync + manual button + Hub autosync), the second returns the same
// in-flight Promise rather than starting a duplicate run. Deleted in finally so subsequent calls start fresh.
const inFlightByStore = new Map()
export function _resetInFlight() { inFlightByStore.clear() }

// 軽量 connectivity probe。navigator.onLine は嘘をつくことがあるので Supabase 系の HEAD で確認。
// fetch 失敗は offline 扱い。
export async function probeOnline({ fetcher = globalThis.fetch, signal } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (!fetcher) return true // SSR / test: 信用する
  try {
    // /version.json は Vercel 上で no-cache 配信されているのでこれを probe に流用。
    const res = await fetcher('/version.json?probe=1', { cache: 'no-store', signal })
    return !!res?.ok
  } catch (err) {
    logger.warn?.(LOG_ERR_PROBE, { message: err?.message })
    return false
  }
}

/**
 * 指定 store の未送信 record を upload。
 * - LF1 は1件ずつ savePatrolReading に渡す。失敗は次の record に進む。
 * - 完了後、(uploaded, failed) を返す。banner の集計再評価は caller 責任。
 * - 同一 storeCode への並行呼び出しは in-flight Promise を共有し二重 INSERT を防ぐ。
 */
export function uploadStoreRecords(storeCode, { staff, skipProbe = false } = {}) {
  if (!storeCode) return Promise.resolve({ uploaded: 0, failed: 0, skipped: 0 })
  if (inFlightByStore.has(storeCode)) return inFlightByStore.get(storeCode)
  const run = _runUploadStore(storeCode, { staff, skipProbe })
    .finally(() => inFlightByStore.delete(storeCode))
  inFlightByStore.set(storeCode, run)
  return run
}

async function _runUploadStore(storeCode, { staff, skipProbe = false } = {}) {
  const records = await getPatrolRecordsByStore(storeCode)
  const unsynced = records.filter(r => !r.synced)
  if (!unsynced.length) return { uploaded: 0, failed: 0, skipped: 0 }

  if (!skipProbe) {
    const ok = await probeOnline()
    if (!ok) {
      logger.warn?.(LOG_ERR_PROBE, { storeCode, skipped: unsynced.length })
      return { uploaded: 0, failed: 0, skipped: unsynced.length }
    }
  }

  let uploaded = 0
  let failed = 0
  for (const r of unsynced) {
    try {
      const res = await savePatrolReading({
        boothCode: r.booth_code,
        storeCode: r.store_code,
        machineCode: r.machine_code,
        inMeter: r.in_meter,
        outMeter: r.out_meter,
        prizeStock: r.prize_stock_count,
        prizeRestock: r.prize_restock_count,
        entryType: r.entry_type ?? 'patrol',
        staffId: staff?.staffId ?? r.created_by ?? null,
        optionalPatch: r.optionalPatch ?? {},
        defaultsFromPrev: r.defaultsFromPrev ?? null,
        // SPEC-LF1-IDEMPOTENT-SYNC-01 D1/D2/D3: replay は queued record 自身の値を渡す。
        patrolDate: r.patrol_date,        // D1: D 日作成→D+k replay でも D 日行になる
        readingId: r.localId,             // D2: 冪等キー。23505 は ok:true skipped:duplicate
        clientTimestamp: r.createdLocally, // D3: 新しい手動入力を古い queued で上書きしない
      })
      if (res?.ok) {
        // ok:true は inserted / updated / skipped(duplicate|stale) 全て「配信済み」→ synced
        await markRecordSynced(r.localId)
        uploaded++
      } else {
        failed++
        // D5: 失敗は Sentry (logger.error) へ。server 不可視な同期失敗を可視化する。
        logger.error?.(LOG_ERR_UPLOAD, {
          localId: r.localId, booth_code: r.booth_code, patrol_date: r.patrol_date,
          errCode: res?.errCode, message: res?.message,
        })
        await setRecordLastErrCode(r.localId, res?.errCode ?? 'unknown').catch(() => {})
      }
    } catch (err) {
      failed++
      logger.error?.(LOG_ERR_UPLOAD, {
        localId: r.localId, booth_code: r.booth_code, patrol_date: r.patrol_date, message: err?.message,
      })
      await setRecordLastErrCode(r.localId, 'exception').catch(() => {})
    }
  }
  // D5: 失敗ありのサマリは logger.error (Sentry)、全成功は info。
  const doneCtx = { storeCode, uploaded, failed, skipped: 0 }
  if (failed > 0) logger.error?.('LF1_UPLOAD_DONE', doneCtx)
  else logger.info?.('LF1_UPLOAD_DONE', doneCtx)
  return { uploaded, failed, skipped: 0 }
}

// 全 store 横断版 (autologout 時 / business-end ボタン用、LF1 は 内部 only の便宜)
export async function uploadAllUnsynced({ staff } = {}) {
  const all = await getUnsyncedRecords()
  if (!all.length) return { uploaded: 0, failed: 0, skipped: 0 }
  const byStore = new Map()
  for (let r of all) {
    // FIX3: store_code:null レコードを booth_code 逆引きで補完してから送信試行。
    // IDB record も補完更新して以降の getPatrolRecordsByStore(storeCode) で取れるようにする。
    // 逆引き不能なら skip 継続 (FIX4 sweep の対象)。
    if (!r.store_code) {
      const derived = _deriveStoreCode(r.booth_code)
      if (!derived) continue
      r = { ...r, store_code: derived }
      await putPatrolRecord(r).catch(() => {})
    }
    if (!byStore.has(r.store_code)) byStore.set(r.store_code, [])
    byStore.get(r.store_code).push(r)
  }
  let uploaded = 0, failed = 0, skipped = 0
  for (const storeCode of byStore.keys()) {
    const res = await uploadStoreRecords(storeCode, { staff })
    uploaded += res.uploaded
    failed   += res.failed
    skipped  += res.skipped
  }
  return { uploaded, failed, skipped }
}

// SPEC-LF1-IDEMPOTENT-SYNC-01 D6: shared trailing-debounce trigger for the app-level
// 'online' + visibilitychange listeners. A burst of events collapses to ONE
// uploadAllUnsynced after debounceMs of quiet. fire-and-forget (never rejects to the caller).
export function makeDebouncedUploadAll({ getStaff, debounceMs = 10000, uploader = uploadAllUnsynced } = {}) {
  let timer = null
  return function trigger() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      Promise.resolve(uploader({ staff: getStaff?.() })).catch(() => {})
    }, debounceMs)
  }
}
