// SPEC-MACHINE-NAME-SHORTNAME-AUTOFILL-01 (D-117): machineNaming.js 3純関数の単体テスト。
import { describe, it, expect } from 'vitest'
import { parseUnitMark, buildMachineName, computeUsedMarks, UNIT_MARKS } from '../../lib/machineNaming'

describe('parseUnitMark: 末尾の丸数字1文字 or null (AC11)', () => {
  it('末尾丸数字あり → その丸数字', () => {
    expect(parseUnitMark('バズクレ②')).toBe('②')
    expect(parseUnitMark('Buzzミニ②')).toBe('②')
    expect(parseUnitMark('500GATCHA①')).toBe('①')
    expect(parseUnitMark('セサミW⑩')).toBe('⑩') // U+2469 単一コードポイント
  })
  it('末尾丸数字なし(無印) → null', () => {
    expect(parseUnitMark('BUZZクレ')).toBeNull()
    expect(parseUnitMark('両替機')).toBeNull()
    expect(parseUnitMark('バズクレ2')).toBeNull() // 半角数字は対象外
    expect(parseUnitMark('②バズクレ')).toBeNull() // 先頭の丸数字は対象外(末尾のみ)
  })
  it('空文字 → null', () => {
    expect(parseUnitMark('')).toBeNull()
  })
  it('null/undefined → null', () => {
    expect(parseUnitMark(null)).toBeNull()
    expect(parseUnitMark(undefined)).toBeNull()
  })
  it('末尾空白があっても丸数字を拾う', () => {
    expect(parseUnitMark('バズクレ②　')).toBe('②')
    expect(parseUnitMark('バズクレ② ')).toBe('②')
  })
})

describe('buildMachineName: 短縮名 + 丸数字 (AC1/AC2)', () => {
  it('mark あり → 連結', () => {
    expect(buildMachineName('バズクレミニ', '②')).toBe('バズクレミニ②')
    expect(buildMachineName('バズクレ', '①')).toBe('バズクレ①')
  })
  it('mark が空/null → 短縮名そのまま (無印)', () => {
    expect(buildMachineName('バズクレミニ', '')).toBe('バズクレミニ')
    expect(buildMachineName('バズクレミニ', null)).toBe('バズクレミニ')
    expect(buildMachineName('バズクレミニ', undefined)).toBe('バズクレミニ')
  })
  it('shortName が null/空 → 空文字ベース', () => {
    expect(buildMachineName(null, '②')).toBe('②')
    expect(buildMachineName('', '')).toBe('')
  })
})

describe('computeUsedMarks: short_name グルーピングで使用済み集合 (AC11/AC3/AC4)', () => {
  // KOS01 実データ模型: バズクレ列は別 model_id 2つ(BUZZCRE4 old / BUZZCRE 4)が同一 short_name「バズクレ」。
  const models = [
    { model_id: 'BUZZCRE4old', short_name: 'バズクレ', type_id: 'crane' },
    { model_id: 'BUZZCRE4', short_name: 'バズクレ', type_id: 'crane' },
    { model_id: 'BUZZCREmini', short_name: 'バズクレミニ', type_id: 'crane' },
    { model_id: 'CHANGER', short_name: 'ラモンメイト', type_id: 'changer' },
  ]

  it('AC4: 別 model_id でも short_name 一致なら使用済みに数える (R1実証)', () => {
    // M02 BUZZクレ (BUZZCRE4old, 無印) / M09 BUZZクレ② (BUZZCRE 4, ②)
    const machines = [
      { model_id: 'BUZZCRE4old', machine_name: 'BUZZクレ' },
      { model_id: 'BUZZCRE4', machine_name: 'BUZZクレ②' },
    ]
    const used = computeUsedMarks(machines, models, 'バズクレ')
    expect(used.has(null)).toBe(true) // 無印(なし)使用済み
    expect(used.has('②')).toBe(true)
    expect(used.has('①')).toBe(false)
    expect(used.has('③')).toBe(false)
  })

  it('AC3: バズクレミニは 無印+② が使用済み', () => {
    // M11 BUZZクレミニ (無印) / M13 Buzzミニ② (②)
    const machines = [
      { model_id: 'BUZZCREmini', machine_name: 'BUZZクレミニ' },
      { model_id: 'BUZZCREmini', machine_name: 'Buzzミニ②' },
    ]
    const used = computeUsedMarks(machines, models, 'バズクレミニ')
    expect(used.has(null)).toBe(true)
    expect(used.has('②')).toBe(true)
    expect(used.has('①')).toBe(false)
  })

  it('①始まり(無印を使わない)グループ: null は含まれない', () => {
    const machines = [
      { model_id: 'BUZZCRE4', machine_name: 'バズクレツイン①' },
      { model_id: 'BUZZCRE4', machine_name: 'バズクレツイン②' },
    ]
    const used = computeUsedMarks(machines, models, 'バズクレ')
    expect(used.has(null)).toBe(false)
    expect(used.has('①')).toBe(true)
    expect(used.has('②')).toBe(true)
  })

  it('short_name が一致しない machine は無視される', () => {
    const machines = [
      { model_id: 'BUZZCREmini', machine_name: 'BUZZクレミニ③' }, // ミニ列
    ]
    const used = computeUsedMarks(machines, models, 'バズクレ') // バズクレ列には無関係
    expect(used.size).toBe(0)
  })

  it('shortName が空/null → 空集合', () => {
    const machines = [{ model_id: 'BUZZCRE4', machine_name: 'バズクレ①' }]
    expect(computeUsedMarks(machines, models, '').size).toBe(0)
    expect(computeUsedMarks(machines, models, null).size).toBe(0)
  })

  it('machines/machineModels が空でも落ちない', () => {
    expect(computeUsedMarks([], [], 'バズクレ').size).toBe(0)
    expect(computeUsedMarks(null, null, 'バズクレ').size).toBe(0)
  })
})

describe('UNIT_MARKS 定数', () => {
  it('①..⑩ の11択のうち丸数字10個 (「なし」はUI側の空値)', () => {
    expect(UNIT_MARKS).toEqual(['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'])
    expect(UNIT_MARKS).toHaveLength(10)
  })
})
