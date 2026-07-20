// SPEC-MACHINE-MODEL-LINK-SORT-COLWIDTH-01 (D-103): ヘッダクリック3-stateソート + 列幅内容フィット。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { sortMachines, nextSortState } from '../../manesupport/pages/MachineModelLinkPage'

const rows = [
  { machine_code: 'B-M01', store_code: 'B', billing_order: 100, machine_name: 'ぜ', model_name: 'Zeta', short_name: null, is_active: true },
  { machine_code: 'A-M01', store_code: 'A', billing_order: 20,  machine_name: 'あ', model_name: 'Alpha', short_name: 'a', is_active: false },
  { machine_code: 'C-M01', store_code: 'C', billing_order: null, machine_name: 'か', model_name: null, short_name: 'k', is_active: true },
]

describe('AC1: nextSortState 3-state (無→asc→desc→無)', () => {
  it('別キー→asc / 同キーasc→desc / 同キーdesc→無', () => {
    expect(nextSortState(null, 'asc', 'billing_order')).toEqual({ sortKey: 'billing_order', sortDir: 'asc' })
    expect(nextSortState('billing_order', 'asc', 'billing_order')).toEqual({ sortKey: 'billing_order', sortDir: 'desc' })
    expect(nextSortState('billing_order', 'desc', 'billing_order')).toEqual({ sortKey: null, sortDir: 'asc' })
    // 別キーに乗り換え
    expect(nextSortState('billing_order', 'desc', 'machine_name')).toEqual({ sortKey: 'machine_name', sortDir: 'asc' })
  })
})

describe('AC1: 数値ソート (文字列ソートでない)', () => {
  it('int列は 20<100 の数値順 (100<20 にならない)', () => {
    const asc = sortMachines(rows, 'billing_order', 'asc')
    expect(asc.map(r => r.billing_order)).toEqual([20, 100, null]) // null末尾
    const desc = sortMachines(rows, 'billing_order', 'desc')
    expect(desc.map(r => r.billing_order)).toEqual([100, 20, null]) // null は desc でも末尾
  })
})

describe('AC1: 文字列/型別ソート + null末尾', () => {
  it('model列は model_name でソート、null は末尾', () => {
    const asc = sortMachines(rows, 'model_id', 'asc')
    expect(asc.map(r => r.model_name)).toEqual(['Alpha', 'Zeta', null])
  })
  it('shortname列は short_name でソート', () => {
    const asc = sortMachines(rows, 'short_name', 'asc')
    expect(asc.map(r => r.short_name)).toEqual(['a', 'k', null])
  })
  it('bool列 (is_active)', () => {
    const asc = sortMachines(rows, 'is_active', 'asc')
    expect(asc.map(r => r.is_active)).toEqual([false, true, true])
  })
})

describe('AC2: 無ソートは供給順そのまま (元配列を返す)', () => {
  it('sortKey=null → 元 rows (参照同一=非破壊)', () => {
    expect(sortMachines(rows, null, 'asc')).toBe(rows)
  })
})

describe('AC4: ソートは非破壊 (元配列不変=machine_code実体/edits紐付き無傷)', () => {
  it('sortMachines は新配列を返し元配列を並べ替えない', () => {
    const before = rows.map(r => r.machine_code)
    const out = sortMachines(rows, 'billing_order', 'asc')
    expect(out).not.toBe(rows)                       // 新配列
    expect(rows.map(r => r.machine_code)).toEqual(before) // 元は不変
    // 各行は同一オブジェクト参照 (machine_code 実体保持) → edits[machine_code] 紐付き無傷
    expect(out.every(r => rows.includes(r))).toBe(true)
  })
})

describe('AC3/AC5: 列幅内容フィット + 1ファイル変更 (ソース検査)', () => {
  const src = readFileSync(resolve(__dirname, '../../manesupport/pages/MachineModelLinkPage.jsx'), 'utf-8')
  it('固定 w-28/w-20/w-32 デフォルトが min-w-[Xrem] に置換 (余白削減)', () => {
    expect(src).toContain('min-w-[7rem]')   // text
    expect(src).toContain('min-w-[3.5rem]') // int/丸数字
    expect(src).toContain('min-w-[4.5rem]') // num
    expect(src).not.toContain("col.w ?? 'w-28'") // 旧デフォルト消滅
    expect(src).not.toContain('w-20`')
  })
  it('ヘッダは button 化 + ソートマーカー (↑/↓)', () => {
    expect(src).toContain('onClick={() => toggleSort(')
    expect(src).toMatch(/sortDir === 'asc' \? '↑' : '↓'/)
  })
  it('AC5安全: saveRow/saveAll/setCell は machine_code 参照のまま (ソート非依存)', () => {
    expect(src).toContain('sorted.map(row =>')       // 描画は sorted
    expect(src).toContain('saveRow(row.machine_code)')
    expect(src).toContain("updateMachineAdmin(code, patch)")
  })
})
