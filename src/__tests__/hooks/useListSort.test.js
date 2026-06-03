// @vitest-environment happy-dom
// SPEC-LIST-FILTER-SORT-01: useListSort 純粋ロジック検証。
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useListSort, compareValues } from '../../hooks/useListSort'

describe('compareValues', () => {
  it('compares_numbers_numerically', () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
    expect(compareValues(10, 2)).toBeGreaterThan(0)
  })
  it('compares_iso_date_strings_chronologically', () => {
    expect(compareValues('2026-01-02', '2026-01-10')).toBeLessThan(0)
    expect(compareValues('2026-02-01', '2026-01-15')).toBeGreaterThan(0)
  })
  it('compares_numeric_strings_as_numbers', () => {
    expect(compareValues('2', '10')).toBeLessThan(0)
  })
  it('falls_back_to_localeCompare_for_strings', () => {
    expect(compareValues('あ', 'い')).toBeLessThan(0)
  })
  it('places_null_after_non_null_regardless_of_dir', () => {
    expect(compareValues(null, 1)).toBeGreaterThan(0)
    expect(compareValues(1, null)).toBeLessThan(0)
    expect(compareValues(null, null)).toBe(0)
  })
})

describe('useListSort', () => {
  const DATA = [
    { id: 1, name: '田中',   age: 30, dt: '2026-01-10' },
    { id: 2, name: '佐藤',   age: 25, dt: '2026-03-05' },
    { id: 3, name: '鈴木',   age: 40, dt: '2026-02-01' },
    { id: 4, name: '渡辺',   age: null, dt: null },
  ]

  it('initial_sortKey_null_returns_data_in_insertion_order', () => {
    const { result } = renderHook(() => useListSort())
    expect(result.current.sorted(DATA).map(r => r.id)).toEqual([1, 2, 3, 4])
  })

  it('onSort_first_click_sets_asc_for_new_key', () => {
    const { result } = renderHook(() => useListSort())
    act(() => result.current.onSort('age'))
    expect(result.current.sortKey).toBe('age')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.sorted(DATA).map(r => r.id)).toEqual([2, 1, 3, 4])
  })

  it('onSort_same_key_toggles_asc_to_desc', () => {
    const { result } = renderHook(() => useListSort())
    act(() => result.current.onSort('age'))
    act(() => result.current.onSort('age'))
    expect(result.current.sortDir).toBe('desc')
    expect(result.current.sorted(DATA).map(r => r.id)).toEqual([3, 1, 2, 4])
  })

  it('onSort_different_key_resets_to_asc', () => {
    const { result } = renderHook(() => useListSort())
    act(() => result.current.onSort('age'))
    act(() => result.current.onSort('age'))
    act(() => result.current.onSort('dt'))
    expect(result.current.sortKey).toBe('dt')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.sorted(DATA).map(r => r.id)).toEqual([1, 3, 2, 4])
  })

  it('reset_returns_to_initial_state', () => {
    const { result } = renderHook(() => useListSort())
    act(() => result.current.onSort('age'))
    act(() => result.current.reset())
    expect(result.current.sortKey).toBe(null)
    expect(result.current.sorted(DATA).map(r => r.id)).toEqual([1, 2, 3, 4])
  })

  it('null_values_always_at_tail_for_asc_and_desc', () => {
    const { result } = renderHook(() => useListSort())
    act(() => result.current.onSort('age'))
    expect(result.current.sorted(DATA).slice(-1)[0].id).toBe(4)
    act(() => result.current.onSort('age'))
    expect(result.current.sorted(DATA).slice(-1)[0].id).toBe(4)
  })
})
