// SPEC-PATROL-HEATMAP-NOCOMMA-COLGAP-01 (D-089): 日付軸ヒートマップのカンマ無し表示 + 列間隔拡大。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { formatCell, formatCellPlain } from '../../clawsupport/components/patrolViewModes'

describe('AC1/AC4: formatCellPlain (カンマ無し) と formatCell (互換維持)', () => {
  it('formatCellPlain は 5桁でもカンマを付けない (40721)', () => {
    expect(formatCellPlain(40721, 'perDay')).toBe('40721')
    expect(formatCellPlain(40721, 'count')).toBe('40721')
    expect(formatCellPlain(40721, undefined)).toBe('40721')
    expect(formatCellPlain(40721.6, 'perDay')).toBe('40722') // perDay は Math.round
  })
  it('formatCellPlain null → "−" (既存 formatCell と同挙動)', () => {
    expect(formatCellPlain(null, 'perDay')).toBe('−')
    expect(formatCellPlain(undefined, 'count')).toBe('−')
  })
  it('AC4: 既存 formatCell はシグネチャ不変 (カンマ付きのまま、削除しない)', () => {
    expect(formatCell(40721, 'perDay')).toBe('40,721') // 従来通りカンマ付き
    expect(formatCell(null, 'count')).toBe('−')
  })
})

// SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): div+flex grid → table セルへ載せ替え。
// カンマ抜き(formatCellPlain)は不変。旧 grid-cols-10 / gap-x-2 / w-[440px] は table 化で廃止 (colgroup が列幅を持つ)。
describe('AC2/AC3(D-110更新): table 化で grid/flex 廃止、formatCellPlain 継続', () => {
  const files = {
    StoreTotalsHeader: readFileSync(resolve(__dirname, '../../clawsupport/components/StoreTotalsHeader.jsx'), 'utf-8'),
    MachineRow: readFileSync(resolve(__dirname, '../../clawsupport/components/MachineRow.jsx'), 'utf-8'),
    MachineRowExpandedBoothList: readFileSync(resolve(__dirname, '../../clawsupport/components/MachineRowExpandedBoothList.jsx'), 'utf-8'),
  }

  it('旧 grid-cols-10 / gap-x-2 / w-[440px] は残らない (table セルへ移行)', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, `${name} no grid`).not.toContain('grid-cols-10')
      expect(src, `${name} no gap`).not.toContain('gap-x-2')
      expect(src, `${name} no fixed width`).not.toContain('w-[440px]')
    }
  })

  it('table 要素 (thead/tr/th/td) で描画される', () => {
    expect(files.StoreTotalsHeader).toContain('<thead')
    expect(files.MachineRow).toContain('<tr')
    expect(files.MachineRow).toMatch(/<th\s/)
    expect(files.MachineRowExpandedBoothList).toContain('<tr')
  })

  it('表示3箇所が formatCellPlain を使用 (カンマ抜き, formatCell 直呼び無し)', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, `${name} plain`).toContain('formatCellPlain(')
      expect(src, `${name} no raw formatCell`).not.toMatch(/[^a-zA-Z]formatCell\(/)
    }
  })
})
