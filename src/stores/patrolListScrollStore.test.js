// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { usePatrolListScrollStore } from './patrolListScrollStore'

const reset = () => usePatrolListScrollStore.setState({ expandedByStore: {}, focusBoothByStore: {} })

describe('patrolListScrollStore', () => {
  beforeEach(reset)

  it('toggleExpanded で machine_code を追加/削除', () => {
    const { toggleExpanded } = usePatrolListScrollStore.getState()
    toggleExpanded('S1', 'M1')
    expect(usePatrolListScrollStore.getState().expandedByStore.S1).toEqual(['M1'])
    toggleExpanded('S1', 'M2')
    expect(usePatrolListScrollStore.getState().expandedByStore.S1).toEqual(['M1', 'M2'])
    toggleExpanded('S1', 'M1')
    expect(usePatrolListScrollStore.getState().expandedByStore.S1).toEqual(['M2'])
  })

  it('store別に独立して保持', () => {
    const { toggleExpanded } = usePatrolListScrollStore.getState()
    toggleExpanded('S1', 'M1')
    toggleExpanded('S2', 'MX')
    const s = usePatrolListScrollStore.getState().expandedByStore
    expect(s.S1).toEqual(['M1'])
    expect(s.S2).toEqual(['MX'])
  })

  it('ensureExpanded は冪等(重複追加しない)', () => {
    const { ensureExpanded } = usePatrolListScrollStore.getState()
    ensureExpanded('S1', 'M1')
    ensureExpanded('S1', 'M1')
    expect(usePatrolListScrollStore.getState().expandedByStore.S1).toEqual(['M1'])
  })

  it('setFocusBooth / clearFocusBooth', () => {
    const { setFocusBooth, clearFocusBooth } = usePatrolListScrollStore.getState()
    setFocusBooth('S1', 'B02')
    expect(usePatrolListScrollStore.getState().focusBoothByStore.S1).toBe('B02')
    clearFocusBooth('S1')
    expect(usePatrolListScrollStore.getState().focusBoothByStore.S1).toBeUndefined()
  })
})
