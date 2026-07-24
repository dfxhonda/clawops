// SPEC-MACHINE-NAME-SHORTNAME-AUTOFILL-01 (D-117): 機械名の短縮名自動入力と丸数字の使用済み判定 (純関数)。
// UI (MachineList.jsx) から切り離して vitest 可能にする。DDL/既存データ変更なし。
//
// 設計根拠 (FIELD_DATA 実測):
//   - グルーピングは model_id ではなく short_name (BUZZCRE4 old と BUZZCRE 4 は同じ「バズクレ」列)。
//   - machine_name の表記は揺れる (BUZZクレ/Buzzミニ/500GATCHA) ため、使用済み判定は末尾の丸数字だけを見る。
//   - 無印も1つの枠。丸数字なしの機械があれば「なし」枠が使用済み。

// 丸数字 ①..⑩ (U+2460..U+2469)。「なし」枠は null で表す。
export const UNIT_MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

// D1a parseUnitMark: 文字列末尾の丸数字1文字 (①..⑩) を返す。無ければ null。
export function parseUnitMark(name) {
  if (name == null) return null
  const s = String(name).replace(/[\s　]+$/, '') // 末尾空白は無視
  const last = s.slice(-1)
  return last >= '①' && last <= '⑩' ? last : null
}

// D1b buildMachineName: 短縮名 + 丸数字。mark が null/空なら短縮名そのまま。
export function buildMachineName(shortName, mark) {
  const base = shortName == null ? '' : String(shortName)
  if (mark == null || mark === '') return base
  return base + mark
}

// D1c computeUsedMarks: その店舗の machines のうち short_name 一致の model_id を持つものを集め、
//   各 machine_name の末尾丸数字を使用済み集合として返す。無印使用時は null を含める。
export function computeUsedMarks(machines, machineModels, shortName) {
  const used = new Set()
  if (!shortName) return used
  // short_name が一致する model_id 群 (別 model_id でも short_name が同じなら同じ列)
  const modelIds = new Set(
    (machineModels || []).filter(mm => mm && mm.short_name === shortName).map(mm => mm.model_id)
  )
  for (const mc of (machines || [])) {
    if (!mc || !modelIds.has(mc.model_id)) continue
    used.add(parseUnitMark(mc.machine_name)) // 丸数字 or null(無印)
  }
  return used
}
