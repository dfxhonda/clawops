// SPEC-PATROL-HISTORY-CROSS-FREEZE-01 (D-110): 十字フリーズ (単一スクロールコンテナ + sticky 左列/上端/角)。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = p => readFileSync(resolve(__dirname, p), 'utf-8')
const patrolPage = read('../../clawsupport/pages/PatrolStorePage.jsx')
const adminPage  = read('../../admin/pages/AdminMachineListPage.jsx')
const header     = read('../../clawsupport/components/StoreTotalsHeader.jsx')
const machineRow = read('../../clawsupport/components/MachineRow.jsx')
const boothList  = read('../../clawsupport/components/MachineRowExpandedBoothList.jsx')

describe('AC1: PatrolStorePage 単一スクロールコンテナ (2祖先入れ子廃止)', () => {
  it('overflow-auto 1祖先 + unifiedScrollRef、overflow-x-auto/overflow-y-auto の入れ子なし', () => {
    expect(patrolPage).toMatch(/overflow-auto"\s+ref=\{unifiedScrollRef\}/)
    // className として overflow-x-auto / overflow-y-auto を使う入れ子が無い (コメント言及は可)
    expect(patrolPage).not.toMatch(/className="[^"]*overflow-x-auto/)
    expect(patrolPage).not.toMatch(/className="[^"]*overflow-y-auto/)
  })
})

describe('AC6: AdminMachineListPage も単一コンテナ (共通コンポーネント無回帰)', () => {
  it('overflow-auto 1祖先 + scrollRef、入れ子なし', () => {
    expect(adminPage).toMatch(/overflow-auto"\s+ref=\{scrollRef\}/)
    expect(adminPage).not.toMatch(/className="[^"]*overflow-x-auto/)
    expect(adminPage).not.toMatch(/className="[^"]*overflow-y-auto/)
  })
})

describe('AC3/AC4/AC5: 上端日付ヘッダー sticky top + 左上コーナー両軸 + 不透明', () => {
  it('ヘッダー行 root が sticky top-0 z-30 bg-bg (縦固定・不透明)', () => {
    expect(header).toMatch(/store-totals-header[\s\S]*sticky top-0 z-30 bg-bg/)
  })
  it('左端ラベルセル(コーナー)が sticky left-0 top-0 z-40 bg-surface (両軸・最上位・不透明)', () => {
    // 日付ラベル行の空コーナー + 合計行ラベル、両方コーナー扱い
    const corners = header.match(/sticky left-0 top-0 z-40 bg-surface/g) || []
    expect(corners.length).toBe(2)
  })
})

describe('AC2: 左端ラベル列 sticky left 横固定 (中位 z-20・不透明)', () => {
  it('MachineRow 機械名セル sticky left-0 z-20 bg-surface', () => {
    expect(machineRow).toMatch(/sticky left-0 z-20 bg-surface/)
  })
  it('MachineRowExpandedBoothList ブース名セル sticky left-0 z-20 bg-surface', () => {
    expect(boothList).toMatch(/sticky left-0 z-20 bg-surface/)
  })
  it('z順: コーナー(40) > 上端ヘッダー(30) > 左端列(20) > 中央(0)', () => {
    expect(header).toContain('z-40')  // corner
    expect(header).toContain('z-30')  // header row
    expect(machineRow).toContain('z-20') // left col
  })
})

describe('AC7: 供給層/列数/累計 ロジック無変更 (表示層のみ)', () => {
  it('COLUMN_COUNT=10 / ACCUM_COL_WIDTH / dateAxis は不変 (patrolViewModes 由来を参照のまま)', () => {
    // 表示コンポーネントは供給値を参照するのみ。grid-cols-10 と w-[440px] は保持。
    expect(header).toContain('grid-cols-10')
    expect(header).toContain('w-[440px]')
    expect(machineRow).toContain('grid-cols-10')
    // 累計列 (ACCUM_COL_WIDTH) は sticky を付けず従来通り (挙動不変)
    expect(machineRow).toContain('ACCUM_COL_WIDTH')
  })
})
