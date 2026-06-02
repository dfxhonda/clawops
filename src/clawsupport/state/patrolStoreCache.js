// SPEC-PATROL-SAVE-LATENCY-FIX-01:
// PatrolStorePage の machines / todayMap / diffMap / storeName を module-level Map で保持。
// 巡回ブース入力画面から navigation で戻った時、PatrolStorePage が remount しても
// このキャッシュからハイドレートして 4 RT 再 fetch を回避する。
// 保存成功時は対象 booth の summary だけ patch (single-booth refetch、1 RT)。

const cache = new Map() // storeCode → { storeName, machines, todayMap, diffMap, ts }

export function getStoreCache(storeCode) {
  if (!storeCode) return null
  return cache.get(storeCode) ?? null
}

export function setStoreCache(storeCode, { storeName, machines, todayMap, diffMap }) {
  if (!storeCode) return
  cache.set(storeCode, {
    storeName,
    machines,
    todayMap,
    diffMap,
    ts: Date.now(),
  })
}

// AC-03 / AC-04 / AC-05: 保存した booth_code の summary を差し替え、他 booth は無変更で
// 全店舗集計 (StoreTotalsHeader) と best/worst ランクが再計算される。
export function patchBoothSummary(storeCode, boothCode, summary) {
  if (!storeCode || !boothCode) return
  const entry = cache.get(storeCode)
  if (!entry) return
  const nextDiff = { ...entry.diffMap, [boothCode]: summary }
  cache.set(storeCode, { ...entry, diffMap: nextDiff, ts: Date.now() })
}

export function patchBoothTodayMap(storeCode, boothCode, today) {
  if (!storeCode || !boothCode) return
  const entry = cache.get(storeCode)
  if (!entry) return
  const nextTodayMap = { ...entry.todayMap, [boothCode]: today }
  cache.set(storeCode, { ...entry, todayMap: nextTodayMap, ts: Date.now() })
}

export function invalidateStoreCache(storeCode) {
  if (!storeCode) { cache.clear(); return }
  cache.delete(storeCode)
}

// テスト用 (module-level state を直接覗く)
export function _peekCache() {
  return cache
}
