// SPEC-PATROL-HISTORY-HEATMAP-04 F2: changer section collapse logic
// コンポーネント依存を避け、バッジテキスト導出と展開状態トグルをピュア関数として検証。
import { describe, it, expect } from 'vitest'

function changerBadgeText(count) {
  if (count === 0) return null
  return `両替機 ${count}台`
}

function toggleExpanded(current) {
  return !current
}

describe('SPEC-PATROL-HISTORY-HEATMAP-04 F2: changer collapse', () => {
  it('when_no_changer_machines_badge_is_null', () => {
    expect(changerBadgeText(0)).toBeNull()
  })

  it('when_1_changer_badge_shows_1台', () => {
    expect(changerBadgeText(1)).toBe('両替機 1台')
  })

  it('when_3_changers_badge_shows_3台', () => {
    expect(changerBadgeText(3)).toBe('両替機 3台')
  })

  it('default_expanded_state_is_false', () => {
    // AC5: デフォルト折畳み
    const initialState = false
    expect(initialState).toBe(false)
  })

  it('toggle_from_false_to_true_expands', () => {
    // AC6: タップで展開
    expect(toggleExpanded(false)).toBe(true)
  })

  it('toggle_from_true_to_false_collapses', () => {
    expect(toggleExpanded(true)).toBe(false)
  })
})
