// SPEC-LF1-STORE-LOCAL-CACHE-01: IndexedDB の raw records から PatrolStorePage 描画用の
// diffMap (booth_code → 10-visit summary) + todayMap (今日入力済 booth) を導出するピュア関数。
// SPEC-02 の 10-visit array logic を再利用するため computeBoothDiffSummary に raw rows を渡す。

import { computeBoothDiffSummary } from '../../services/boothHistory'

function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// raw records (UPSERT 単位の meter_readings 等価レコード) を booth_code 単位にグループ化、
// patrol_date DESC + (created_at / updatedLocally / createdLocally) DESC でソート、
// 最大 11 行を computeBoothDiffSummary に渡して summary を作る。
//
// SPEC-LF1-HISTORY-FIX-01:
//   dedupe by (booth_code, patrol_date) — 同 patrol_date に server baseline (synced=true) と
//   local edit (synced=false) が並存する場合、local wins (AC-08)。
//   booth ごと 11 行までに切り詰めて computeBoothDiffSummary に渡す。
export function computeLocalStoreView(records, { meterUnitPriceMap = {}, today = todayJST() } = {}) {
  const byBooth = new Map()
  for (const r of (records ?? [])) {
    if (!r?.booth_code) continue
    const arr = byBooth.get(r.booth_code) ?? []
    arr.push(r)
    byBooth.set(r.booth_code, arr)
  }
  const diffMap = {}
  const todayMap = {}
  for (const [bc, arr] of byBooth.entries()) {
    // SPEC-LF1-HISTORY-FIX-01 dedupe: same patrol_date 内で local (synced=false) を優先。
    const byDate = new Map()
    for (const r of arr) {
      const ex = byDate.get(r.patrol_date)
      const localPref = !r.synced && (ex ? ex.synced : false)
      if (!ex || localPref) byDate.set(r.patrol_date, r)
    }
    const deduped = Array.from(byDate.values()).sort((a, b) => {
      const pd = (b.patrol_date ?? '').localeCompare(a.patrol_date ?? '')
      if (pd !== 0) return pd
      const at = (b.created_at ?? b.updatedLocally ?? b.createdLocally ?? '').localeCompare(
        a.created_at ?? a.updatedLocally ?? a.createdLocally ?? ''
      )
      return at
    })
    const top11 = deduped.slice(0, 11)
    const summary = computeBoothDiffSummary(top11, meterUnitPriceMap[bc] ?? 100)
    if (summary) diffMap[bc] = summary
    // today バッジ: patrol_date === today JST の record があるか (dedup 後)
    const todayRow = deduped.find(r => r.patrol_date === today)
    if (todayRow) {
      todayMap[bc] = {
        readingId: todayRow.reading_id ?? todayRow.localId ?? null,
        readTime: todayRow.read_time ?? todayRow.updatedLocally ?? null,
      }
    }
  }
  return { diffMap, todayMap }
}
