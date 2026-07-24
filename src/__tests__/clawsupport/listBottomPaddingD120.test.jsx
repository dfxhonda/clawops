// SPEC-LIST-BOTTOM-PADDING-URGENT-01 (D-120): 巡回/過去メーター編集の一覧スクロールコンテナに下部余白(pb-40=160px)。
// 採用方式=D1(スクロールコンテナへ padding-bottom)。sticky は崩れない(bottom padding は top/left sticky に無影響)ため D2 スペーサー行は不採用。
// PatrolStorePage/AdminMachineListPage は full render 前例がなく、既存(crossFreezeTableD110/D119)同様ソース文字列で検証する。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = p => readFileSync(resolve(__dirname, p), 'utf-8')
const patrol = read('../../clawsupport/pages/PatrolStorePage.jsx')
const admin = read('../../admin/pages/AdminMachineListPage.jsx')
const machineRow = read('../../clawsupport/components/MachineRow.jsx')
const boothRows = read('../../clawsupport/components/MachineRowExpandedBoothList.jsx')

describe('AC1/AC2/D1: 両画面のスクロールコンテナに pb-40 (160px 下部余白)', () => {
  it('PatrolStorePage: overflow-auto コンテナに pb-40、ref/overflow-auto は不変', () => {
    expect(patrol).toMatch(/flex-1 min-h-0 pb-40 overflow-auto"\s+ref=\{unifiedScrollRef\}/) // D1 + 構造不変
  })
  it('AdminMachineListPage: overflow-auto コンテナに pb-40、ref/overflow-auto は不変', () => {
    expect(admin).toMatch(/flex-1 min-h-0 pb-40 overflow-auto"\s+ref=\{scrollRef\}/)
  })
})

describe('D4: 両画面で同一方式 (pb-40、スペーサー行は使わない)', () => {
  it('両画面とも pb-40 を採用', () => {
    expect(patrol).toContain('pb-40 overflow-auto')
    expect(admin).toContain('pb-40 overflow-auto')
  })
  it('D2 スペーサー行(aria-hidden の高さ160 td)は不採用', () => {
    // sticky が崩れないため D1 で完結。スペーサー行方式は入れていない。
    expect(patrol).not.toMatch(/aria-hidden[^>]*height:\s*160/)
    expect(admin).not.toMatch(/aria-hidden[^>]*height:\s*160/)
  })
})

describe('AC4/AC5/AC6/FORBIDDEN: 十字フリーズ構造とcolgroup列幅は不変', () => {
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

describe('AC7/FORBIDDEN: 行コンポーネントに余白を付けない (リスト間引き防止)', () => {
  it('MachineRow / BoothFlatRows に pb-40 は無い', () => {
    expect(machineRow).not.toContain('pb-40')
    expect(boothRows).not.toContain('pb-40')
  })
})
