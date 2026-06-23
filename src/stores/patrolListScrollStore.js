// ============================================
// patrolListScrollStore: 巡回ブースリスト(PatrolStorePage)の
// 展開状態 + 「戻った時にスクロールして見せるブース」を route 跨ぎで保持する。
// 保存ボタン「リストに戻る」で、展開状態を維持したまま次ブースが見える位置へ復帰するため。
// ============================================
import { create } from 'zustand'

export const usePatrolListScrollStore = create((set) => ({
  // { [storeCode]: string[] (展開中の machine_code) }
  expandedByStore: {},
  // { [storeCode]: booth_code (復帰時にスクロールして見せたいブース) }
  focusBoothByStore: {},

  toggleExpanded: (storeCode, machineCode) =>
    set((s) => {
      const cur = new Set(s.expandedByStore[storeCode] ?? [])
      if (cur.has(machineCode)) cur.delete(machineCode)
      else cur.add(machineCode)
      return { expandedByStore: { ...s.expandedByStore, [storeCode]: [...cur] } }
    }),

  // 指定 machine を展開状態に含める (次ブースを見せるため)
  ensureExpanded: (storeCode, machineCode) =>
    set((s) => {
      const cur = new Set(s.expandedByStore[storeCode] ?? [])
      cur.add(machineCode)
      return { expandedByStore: { ...s.expandedByStore, [storeCode]: [...cur] } }
    }),

  setFocusBooth: (storeCode, boothCode) =>
    set((s) => ({ focusBoothByStore: { ...s.focusBoothByStore, [storeCode]: boothCode } })),

  clearFocusBooth: (storeCode) =>
    set((s) => {
      const next = { ...s.focusBoothByStore }
      delete next[storeCode]
      return { focusBoothByStore: next }
    }),

  // SPEC-PATROL-HISTORY-HEATMAP-01 F6: 全機械を一括展開/折畳みする
  setExpandedForStore: (storeCode, machineCodes) =>
    set((s) => ({
      expandedByStore: { ...s.expandedByStore, [storeCode]: machineCodes },
    })),
}))
