// SPEC-LF1-STORE-LOCAL-CACHE-01: IndexedDB の raw records から PatrolStorePage 描画用の
// diffMap (booth_code → 4-visit summary) + todayMap (今日入力済 booth) を導出するピュア関数。
// SPEC-02 の 4-visit array logic を再利用するため computeBoothDiffSummary に raw rows を渡す。

import { computeBoothDiffSummary } from '../../services/boothHistory'

function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// raw records (UPSERT 単位の meter_readings 等価レコード) を booth_code 単位にグループ化、
// patrol_date DESC + (created_at / updatedLocally / createdLocally) DESC でソート、
// 最大 5 行を computeBoothDiffSummary に渡して summary を作る。
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
    arr.sort((a, b) => {
      const pd = (b.patrol_date ?? '').localeCompare(a.patrol_date ?? '')
      if (pd !== 0) return pd
      const at = (b.created_at ?? b.updatedLocally ?? b.createdLocally ?? '').localeCompare(
        a.created_at ?? a.updatedLocally ?? a.createdLocally ?? ''
      )
      return at
    })
    const top5 = arr.slice(0, 5)
    const summary = computeBoothDiffSummary(top5, meterUnitPriceMap[bc] ?? 100)
    if (summary) diffMap[bc] = summary
    // today バッジ: patrol_date === today JST の record があるか
    const todayRow = arr.find(r => r.patrol_date === today)
    if (todayRow) {
      todayMap[bc] = {
        readingId: todayRow.reading_id ?? todayRow.localId ?? null,
        readTime: todayRow.read_time ?? todayRow.updatedLocally ?? null,
      }
    }
  }
  return { diffMap, todayMap }
}
