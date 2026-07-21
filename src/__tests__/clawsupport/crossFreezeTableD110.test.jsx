// @vitest-environment happy-dom
// SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): table + table-layout:fixed + セル単位 sticky 十字フリーズ。
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = p => readFileSync(resolve(__dirname, p), 'utf-8')
const patrolPage = read('../../clawsupport/pages/PatrolStorePage.jsx')
const adminPage  = read('../../admin/pages/AdminMachineListPage.jsx')
const header     = read('../../clawsupport/components/StoreTotalsHeader.jsx')
const machineRow = read('../../clawsupport/components/MachineRow.jsx')
const boothRows  = read('../../clawsupport/components/MachineRowExpandedBoothList.jsx')

import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'

describe('AC1: table + table-fixed + 単一 overflow-auto コンテナ (両ページ)', () => {
  it('PatrolStorePage: overflow-auto + table-fixed、overflow-x-auto入れ子なし', () => {
    expect(patrolPage).toMatch(/overflow-auto"\s+ref=\{unifiedScrollRef\}/)
    expect(patrolPage).toContain('table-fixed')
    expect(patrolPage).not.toMatch(/className="[^"]*overflow-x-auto/)
    expect(patrolPage).not.toMatch(/className="[^"]*overflow-y-auto/)
  })
  it('AC10: AdminMachineListPage も同じ table 十字フリーズ (片割れ回帰なし)', () => {
    expect(adminPage).toMatch(/overflow-auto"\s+ref=\{scrollRef\}/)
    expect(adminPage).toContain('table-fixed')
    expect(adminPage).not.toMatch(/className="[^"]*overflow-x-auto/)
    expect(adminPage).not.toMatch(/className="[^"]*overflow-y-auto/)
  })
  it('colgroup で列幅固定 (160/64/44×10)', () => {
    for (const src of [patrolPage, adminPage]) {
      expect(src).toContain('<colgroup>')
      expect(src).toContain('width: 160')
      expect(src).toContain('width: 64')
      expect(src).toContain('width: 44')
    }
  })
})

describe('AC3/AC4/AC5: thead sticky top / 左上コーナー両軸 / 不透明', () => {
  it('日付ヘッダー行 th が sticky top-0 z-30 bg-surface (不透明)', () => {
    expect(header).toMatch(/sticky top-0 z-30 bg-surface/)
  })
  it('左上コーナー th が sticky left-0 top-0 z-40 (両軸・最上位)', () => {
    expect(header).toMatch(/sticky left-0 top-0 z-40 bg-surface/)
  })
  it('2行目ヘッダーは sticky top-7 (h-7オフセット)', () => {
    expect(header).toContain('sticky top-7')
  })
  it('<thead> 描画 + store-value は th', () => {
    render(<MemoryRouter><table><StoreTotalsHeader diffMap={{}} mode="IN" /></table></MemoryRouter>)
    expect(screen.getByTestId('store-totals-header').tagName).toBe('THEAD')
    expect(screen.getByTestId('store-value-0').tagName).toBe('TH')
  })
})

describe('AC2: tbody 左端 th が sticky left-0 (中位 z-20・不透明)', () => {
  it('MachineRow 左端 th sticky left-0 z-20 bg-surface', () => {
    expect(machineRow).toMatch(/sticky left-0 z-20 bg-surface/)
    expect(machineRow).toMatch(/<th scope="row"/)
  })
  it('BoothFlatRows 左端 th sticky left-0 z-20 bg-surface', () => {
    expect(boothRows).toMatch(/sticky left-0 z-20 bg-surface/)
    expect(boothRows).toMatch(/<th scope="row"/)
  })
  it('z順: コーナー(40) > ヘッダー(30) > 左端列(20) > 中央(0)', () => {
    expect(header).toContain('z-40')
    expect(header).toContain('z-30')
    expect(machineRow).toContain('z-20')
  })
})

describe('AC6/AC7: 2ビュータブ + ブースビュー並び順トグル', () => {
  it('機械/ブース タブ + booth order トグル(機械順/ランキング)', () => {
    expect(patrolPage).toContain('patrol-view-tab-machine')
    expect(patrolPage).toContain('patrol-view-tab-booth')
    expect(patrolPage).toContain('patrol-booth-order-machine')
    expect(patrolPage).toContain('patrol-booth-order-ranking')
    // デフォルト 機械順 / 機械ビュー
    expect(patrolPage).toMatch(/useState\('machine'\)/)
  })
  it('アコーディオン(全開全閉/expandedSet)は廃止', () => {
    expect(patrolPage).not.toContain('expand-all-toggle')
    expect(patrolPage).not.toContain('expandedSet')
    expect(patrolPage).not.toContain('toggleExpanded')
  })
})

describe('AC9: 供給層は import のみ (ロジック無変更)', () => {
  it('patrolViewModes/storeMachineSummary/boothHistory の COLUMN_COUNT/dateAxis を参照するだけ', () => {
    // 列は10のまま (COLUMN_COUNT を patrolViewModes から import)
    expect(machineRow).toContain('COLUMN_COUNT')
    expect(header).toContain('COLUMN_COUNT')
    // ランキングは既存供給値の並び替えのみ (sourceArrayFor / mapSummaryToDateAxis を使う)
    expect(patrolPage).toContain('sourceArrayFor')
    expect(patrolPage).toContain('mapSummaryToDateAxis')
  })
})
