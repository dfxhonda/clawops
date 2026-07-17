// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068): 分析ハブ タイルの利用実績ソート (純関数、vitest 可能)。
import { USAGE_SECONDS_PER_CLICK } from '../constants/pageKeys'

/** score = view_count + total_seconds / USAGE_SECONDS_PER_CLICK。stats なしは 0。 */
export function usageScore(stat) {
  return (Number(stat?.view_count) || 0) + (Number(stat?.total_seconds) || 0) / USAGE_SECONDS_PER_CLICK
}

/**
 * タイルを本人 stats の score 降順に並べる。
 * - 準備中 (impl=false) は score 対象外で下部固定 (既定順)。
 * - stats なし/同点は既定順を維持 (stable)。
 * - statsByKey が空/欠落でも既定順を返す (ソートがハブ表示をブロックしない)。
 * @param {Array} tiles  各要素 { key, impl, ... }
 * @param {Object} statsByKey  { [page_key]: { view_count, total_seconds } }
 */
export function sortTilesByUsage(tiles, statsByKey) {
  const list = tiles ?? []
  const stats = statsByKey ?? {}
  const impl = []
  const coming = []
  list.forEach((t, i) => (t?.impl ? impl : coming).push({ t, i }))
  impl.sort((a, b) => {
    const d = usageScore(stats[b.t.key]) - usageScore(stats[a.t.key])
    return d !== 0 ? d : a.i - b.i // 同点/未計測は元の順序を維持
  })
  return [...impl.map(x => x.t), ...coming.map(x => x.t)]
}
