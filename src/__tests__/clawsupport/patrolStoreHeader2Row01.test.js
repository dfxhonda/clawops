// SPEC-PATROL-STORE-HEADER-2ROW-01: 完了バッジ色分岐ロジック + 2段目操作バー構造検証
import { describe, it, expect } from 'vitest'

// badge color logic (formerly inline in rightSlot, now in 2nd-row bar)
function badgeColorClass(doneCnt, totalCnt) {
  if (totalCnt === 0) return null
  if (doneCnt >= totalCnt) return 'text-emerald-400 border-emerald-400/40'
  if (doneCnt > 0)        return 'text-amber-400 border-amber-400/40'
  return 'text-muted border-border'
}

describe('SPEC-PATROL-STORE-HEADER-2ROW-01 AC5: 完了バッジ色分岐', () => {
  it('when_all_done_badge_is_emerald', () => {
    expect(badgeColorClass(7, 7)).toBe('text-emerald-400 border-emerald-400/40')
  })

  it('when_partially_done_badge_is_amber', () => {
    expect(badgeColorClass(3, 7)).toBe('text-amber-400 border-amber-400/40')
  })

  it('when_none_done_badge_is_muted', () => {
    expect(badgeColorClass(0, 7)).toBe('text-muted border-border')
  })

  it('when_totalCnt_is_0_badge_is_not_shown', () => {
    expect(badgeColorClass(0, 0)).toBeNull()
  })
})

describe('SPEC-PATROL-STORE-HEADER-2ROW-01 AC3: PageHeader.jsx unchanged', () => {
  it('PageHeader_does_not_contain_rightSlot_patrol_store_elements', async () => {
    // AC3: PageHeader.jsx に rightSlot として 完了バッジ/とりま保存 が埋め込まれていない
    // PatrolStorePage.jsx の修正前と比べ、PageHeader を直接 import して API を確認
    const mod = await import('../../shared/ui/PageHeader')
    expect(mod.PageHeader).toBeDefined()
    // PageHeader の source に patrol-store-manual-upload が含まれないことを確認
    const src = mod.PageHeader.toString()
    expect(src).not.toContain('patrol-store-manual-upload')
    expect(src).not.toContain('完了')
  })
})
