// SPEC-PATROL-ACCUM-COL-S2-SUPPLY-01 (D-097): fn_booth_collection_baseline RPC ラッパー (供給層)。
// 巡回店舗機械一覧 入店時に 1回 fetch し、booth 別 累計(accum) / baseline を供給する。表示(S3)は本層では触らない。
// RPC 内部で collected_at/patrol_date は date 型直使用済 (S1/D-096)。フロント側日付変換なし。
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

// storeCode → { [booth_code]: { accum, baselineIn, baselineSource } }。
// RPC 失敗時は空 {} を返し logger.warn。巡回本体をブロックしない (累計列が出ないだけで巡回は回る)。
export async function fetchCollectionBaseline(storeCode) {
  if (!storeCode) return {}
  try {
    const { data, error } = await supabase.rpc('fn_booth_collection_baseline', { p_store_code: storeCode })
    if (error) throw error
    const map = {}
    for (const row of data ?? []) {
      if (!row?.booth_code) continue
      map[row.booth_code] = {
        accum: row.accum ?? null,
        baselineIn: row.baseline_in ?? null,
        baselineSource: row.baseline_source ?? 'none',
      }
    }
    return map
  } catch (e) {
    logger.warn?.('ERR-ACCUM-BASELINE-FETCH', { storeCode, message: e?.message ?? String(e) })
    return {}
  }
}
