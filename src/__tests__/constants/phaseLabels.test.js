// SPEC-PHASE-LABEL-FIX-01: phase 表示名 / バッジ色 / 選択肢の純関数検証。
import { describe, it, expect } from 'vitest'
import {
  PHASE_LABEL_MAP,
  PHASE_BADGE_CLASS_MAP,
  PHASE_UNKNOWN_LABEL,
  PHASE_UNKNOWN_BADGE_CLASS,
  PHASE_FILTER_OPTIONS,
  PHASE_EDIT_OPTIONS,
  getPhaseLabel,
  getPhaseBadgeClass,
} from '../../constants/phaseLabels'

describe('PHASE_LABEL_MAP / PHASE_BADGE_CLASS_MAP', () => {
  it('exposes_4_actual_db_values_only', () => {
    expect(Object.keys(PHASE_LABEL_MAP).sort()).toEqual(['active', 'dead', 'provisional', 'yobigun'])
    expect(Object.keys(PHASE_BADGE_CLASS_MAP).sort()).toEqual(['active', 'dead', 'provisional', 'yobigun'])
  })
  it('provisional_and_yobigun_share_japanese_label', () => {
    expect(PHASE_LABEL_MAP.provisional).toBe('入荷予定')
    expect(PHASE_LABEL_MAP.yobigun).toBe('入荷予定')
  })
  it('active_is_稼働中_dead_is_廃番', () => {
    expect(PHASE_LABEL_MAP.active).toBe('稼働中')
    expect(PHASE_LABEL_MAP.dead).toBe('廃番')
  })
  it('active_badge_green_provisional_amber_yobigun_amber_dead_gray', () => {
    expect(PHASE_BADGE_CLASS_MAP.active).toMatch(/bg-green-/)
    expect(PHASE_BADGE_CLASS_MAP.provisional).toMatch(/bg-amber-/)
    expect(PHASE_BADGE_CLASS_MAP.yobigun).toMatch(/bg-amber-/)
    expect(PHASE_BADGE_CLASS_MAP.dead).toMatch(/bg-gray-/)
  })
})

describe('getPhaseLabel', () => {
  it('returns_japanese_label_for_known_phase', () => {
    expect(getPhaseLabel('active')).toBe('稼働中')
    expect(getPhaseLabel('provisional')).toBe('入荷予定')
    expect(getPhaseLabel('yobigun')).toBe('入荷予定')
    expect(getPhaseLabel('dead')).toBe('廃番')
  })
  it('returns_不明_for_null_undefined_empty_unknown', () => {
    expect(getPhaseLabel(null)).toBe(PHASE_UNKNOWN_LABEL)
    expect(getPhaseLabel(undefined)).toBe(PHASE_UNKNOWN_LABEL)
    expect(getPhaseLabel('')).toBe(PHASE_UNKNOWN_LABEL)
    expect(getPhaseLabel('normal')).toBe(PHASE_UNKNOWN_LABEL)        // 旧ハードコード値
    expect(getPhaseLabel('out_of_stock')).toBe(PHASE_UNKNOWN_LABEL)  // 旧ハードコード値
  })
})

describe('getPhaseBadgeClass', () => {
  it('returns_class_for_known_phase', () => {
    expect(getPhaseBadgeClass('active')).toMatch(/bg-green-/)
    expect(getPhaseBadgeClass('dead')).toMatch(/bg-gray-/)
  })
  it('returns_unknown_class_for_null_undefined_empty_unknown', () => {
    expect(getPhaseBadgeClass(null)).toBe(PHASE_UNKNOWN_BADGE_CLASS)
    expect(getPhaseBadgeClass(undefined)).toBe(PHASE_UNKNOWN_BADGE_CLASS)
    expect(getPhaseBadgeClass('')).toBe(PHASE_UNKNOWN_BADGE_CLASS)
    expect(getPhaseBadgeClass('normal')).toBe(PHASE_UNKNOWN_BADGE_CLASS)
  })
})

describe('PHASE_FILTER_OPTIONS / PHASE_EDIT_OPTIONS', () => {
  it('filter_options_start_with_empty_全て', () => {
    expect(PHASE_FILTER_OPTIONS[0]).toEqual({ value: '', label: '全て' })
  })
  it('filter_options_have_5_entries_including_全て', () => {
    expect(PHASE_FILTER_OPTIONS).toHaveLength(5)
    expect(PHASE_FILTER_OPTIONS.map(o => o.value)).toEqual(['', 'active', 'provisional', 'yobigun', 'dead'])
  })
  it('filter_options_show_japanese_labels', () => {
    const labels = PHASE_FILTER_OPTIONS.map(o => o.label)
    expect(labels).toEqual(['全て', '稼働中', '入荷予定', '入荷予定', '廃番'])
  })
  it('edit_options_exclude_empty_全て', () => {
    expect(PHASE_EDIT_OPTIONS).toHaveLength(4)
    expect(PHASE_EDIT_OPTIONS.every(o => o.value !== '')).toBe(true)
    expect(PHASE_EDIT_OPTIONS.map(o => o.value)).toEqual(['active', 'provisional', 'yobigun', 'dead'])
  })
})
