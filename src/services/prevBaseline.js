// SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094):
// 巡回プレフィル用 prev を単一 booth の rows から「合成」するピュア関数。
//
// 真因: SPEC-LF1-HISTORY-FIX-05 が baseline fetch を entry_type='patrol' に限定した結果、
//   入替(replace)で変えた景品名の「最新値」まで道連れで消え、再入店で旧景品がプレフィル→
//   スタッフがメーターだけ入れて保存すると defaultsFromPrev で旧景品が新 patrol 行に焼かれ DB 汚染ループ化。
//
// 設計 (景品系=全 entry_type 最新 / メーター系=patrol 限定 の分離):
//   - 景品/set 系  = 全 entry_type の複合ソート最新行 (= 入替後の新景品)。
//   - メーター/在庫系 = patrol 限定の最新行 (= replace の in_meter=0 を混入させない)。
// prevHold(tier-0) / tier-2(IDB) / tier-3(getLastReadingForBooth) の 3 経路すべてが本関数を通すこと
// (片割れ取り残し禁止、HEATMAP-05 教訓)。

// prev から採用する景品/set 系キー (メーター系はこのリストに含めない = base=patrol 行を維持)。
export const PREV_PRIZE_KEYS = [
  'prize_id', 'prize_name', 'prize_name_2', 'prize_name_3',
  'prize_cost', 'prize_cost_1', 'prize_cost_2', 'prize_cost_3',
  'set_a', 'set_c', 'set_l', 'set_r', 'set_o',
]

// rows: 単一 booth の meter_readings 行配列 (順不同可、本関数内で複合ソート)。
// 返り値: 合成済み prev オブジェクト (rows 空 → null)。
export function buildPrevFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => {
    const pd = String(b?.patrol_date ?? '').localeCompare(String(a?.patrol_date ?? ''))
    if (pd !== 0) return pd
    return String(b?.created_at ?? b?.read_time ?? '').localeCompare(String(a?.created_at ?? a?.read_time ?? ''))
  })
  const latestAny = sorted[0] // 景品系の供給源 (replace 含む最新)
  const latestPatrol = sorted.find(r => r?.entry_type === 'patrol') ?? latestAny // メーター系の供給源
  // base = patrol 行 (メーター/在庫/identity はこちら)、景品/set のみ最新行で上書き。
  const prev = { ...latestPatrol }
  for (const k of PREV_PRIZE_KEYS) prev[k] = latestAny[k]
  return prev
}
