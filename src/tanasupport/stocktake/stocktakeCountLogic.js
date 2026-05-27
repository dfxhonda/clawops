// J-STOCKTAKE-MVP-fix-01: 棚卸し個数入力の純ロジック (DB非依存・テスト容易)
// countsMap = { prize_id: { actual_count } } 形式。getOwnerItemsMap の返り値。

/** 現在の合計に numpad バッチ文字列を足し込む。空/非数は無視。 */
export function addBatch(total, batchStr) {
  const n = parseInt(batchStr, 10)
  if (!Number.isFinite(n)) return total
  return total + n
}

/** 入力済みSKUを末尾へ回す (未入力を上に集める)。元の相対順は保持。 */
export function sortUnenteredFirst(prizes, countsMap) {
  const entered = id => Object.prototype.hasOwnProperty.call(countsMap ?? {}, id)
  const unentered = prizes.filter(p => !entered(p.prize_id))
  const done = prizes.filter(p => entered(p.prize_id))
  return [...unentered, ...done]
}

/** fromIdx より後ろにある最初の未入力SKUの index。無ければ -1。 */
export function nextUnenteredIndex(prizes, countsMap, fromIdx) {
  const entered = id => Object.prototype.hasOwnProperty.call(countsMap ?? {}, id)
  for (let i = fromIdx + 1; i < prizes.length; i++) {
    if (!entered(prizes[i].prize_id)) return i
  }
  return -1
}

/** 全SKU入力済みなら true。景品リストが空なら false (締め対象なし)。 */
export function isAllEntered(prizes, countsMap) {
  if (!prizes || prizes.length === 0) return false
  const entered = id => Object.prototype.hasOwnProperty.call(countsMap ?? {}, id)
  return prizes.every(p => entered(p.prize_id))
}
