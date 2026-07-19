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

describe('AC2/AC3: 共通グリッド4箇所が gap-x-2 + w-[440px] に統一 (縦ズレ防止)', () => {
  const files = {
    StoreTotalsHeader: readFileSync(resolve(__dirname, '../../clawsupport/components/StoreTotalsHeader.jsx'), 'utf-8'),
    MachineRow: readFileSync(resolve(__dirname, '../../clawsupport/components/MachineRow.jsx'), 'utf-8'),
    MachineRowExpandedBoothList: readFileSync(resolve(__dirname, '../../clawsupport/components/MachineRowExpandedBoothList.jsx'), 'utf-8'),
  }

  it('旧 gap-x-1 / w-[400px] が残らず、gap-x-2 / w-[440px] に統一', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, `${name} old gap`).not.toContain('gap-x-1')
      expect(src, `${name} old width`).not.toContain('w-[400px]')
      expect(src, `${name} new gap`).toContain('gap-x-2')
      expect(src, `${name} new width`).toContain('w-[440px]')
    }
  })

  it('grid-cols-10 数 = gap-x-2/w-[440px] 数 (全 heatmap grid が追従)', () => {
    for (const [name, src] of Object.entries(files)) {
      const grids = (src.match(/grid-cols-10/g) || []).length
      const gaps = (src.match(/gap-x-2/g) || []).length
      const widths = (src.match(/w-\[440px\]/g) || []).length
      expect(gaps, `${name} gap count`).toBe(grids)
      expect(widths, `${name} width count`).toBe(grids)
    }
  })

  it('AC1 表示3箇所が formatCellPlain を使用 (formatCell 直呼び無し)', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, `${name} plain`).toContain('formatCellPlain(')
      expect(src, `${name} no raw formatCell`).not.toMatch(/[^a-zA-Z]formatCell\(/)
    }
  })
})
