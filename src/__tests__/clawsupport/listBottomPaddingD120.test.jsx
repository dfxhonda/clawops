// SPEC-LIST-BOTTOM-PADDING-URGENT-01 (D-120) → D-121 で標準クラス list-scroll に吸収済み。
// 本テストは D-121(SPEC-LIST-SCROLL-STANDARD-01)で pb-40 を list-scroll に置き換えた前提に書き換え。
// 実装をテストに合わせて戻すことはしない(spec D-121 SCOPE_WRITE)。
// PatrolStorePage/AdminMachineListPage は full render 前例がなく、既存(crossFreezeTableD110/D119)同様ソース文字列で検証する。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = p => readFileSync(resolve(__dirname, p), 'utf-8')
const patrol = read('../../clawsupport/pages/PatrolStorePage.jsx')
const admin = read('../../admin/pages/AdminMachineListPage.jsx')
const machineRow = read('../../clawsupport/components/MachineRow.jsx')
const boothRows = read('../../clawsupport/components/MachineRowExpandedBoothList.jsx')

describe('AC1/AC2/AC6(D-121): 両画面のスクロールコンテナに list-scroll (下部余白は標準クラスへ)', () => {
  it('PatrolStorePage: list-scroll 付与 + overflow-auto/ref は不変 (十字フリーズ構造保持)', () => {
    expect(patrol).toMatch(/flex-1 min-h-0 list-scroll overflow-auto"\s+ref=\{unifiedScrollRef\}/)
  })
  it('AdminMachineListPage: list-scroll 付与 + overflow-auto/ref は不変', () => {
    expect(admin).toMatch(/flex-1 min-h-0 list-scroll overflow-auto"\s+ref=\{scrollRef\}/)
  })
  it('D-120 の pb-40 は削除済み(list-scroll に吸収)', () => {
    expect(patrol).not.toContain('pb-40')
    expect(admin).not.toContain('pb-40')
  })
})

describe('AC7/FORBIDDEN: 行コンポーネントに余白を付けない (リスト間引き防止)', () => {
  it('MachineRow / BoothFlatRows に pb-40 も list-scroll も無い', () => {
    expect(machineRow).not.toContain('pb-40')
    expect(machineRow).not.toContain('list-scroll')
    expect(boothRows).not.toContain('pb-40')
    expect(boothRows).not.toContain('list-scroll')
  })
})

describe('AC8/FORBIDDEN: 十字フリーズ構造とcolgroup列幅は不変', () => {
  it('単一 overflow-auto のまま (overflow-x/y-auto 入れ子を作らない)', () => {
    for (const src of [patrol, admin]) {
      expect(src).toContain('table-fixed')
      expect(src).not.toMatch(/className="[^"]*overflow-x-auto/)
      expect(src).not.toMatch(/className="[^"]*overflow-y-auto/)
    }
  })
  it('colgroup 列幅 160/64/44 は不変', () => {
    for (const src of [patrol, admin]) {
      expect(src).toContain('<colgroup>')
      expect(src).toContain('width: 160')
      expect(src).toContain('width: 64')
      expect(src).toContain('width: 44')
    }
  })
})
