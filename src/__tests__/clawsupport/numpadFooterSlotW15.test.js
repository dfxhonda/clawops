// SPEC-MOTION-W1_5-NUMPAD-PATROL-ADMIN-01 (D-070)
// 静的解析: D-069 で温存した2画面 (AdminBoothEdit / PatrolBoothInput) の「主フッターのみ」を
// NumpadFooterSlot 化し、anchor / null固定 / 別配置 は NumpadFooterPanel のまま byte 温存されていることを検証。
// (これらのページは重い mock を要するため、patrolGridAuto1frAuto と同じ static-analysis 方式で誤置換を防ぐ)
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const admin = readFileSync(
  resolve(__dirname, '../../admin/pages/AdminBoothEditPage.jsx'),
  'utf-8',
)
const patrol = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)

const count = (src, needle) => src.split(needle).length - 1

describe('AC1: AdminBoothEditPage 主フッターのみ Slot 化', () => {
  it('NumpadFooterSlot を import している', () => {
    expect(admin).toContain("import NumpadFooterSlot from '../../clawsupport/components/NumpadFooterSlot'")
  })
  it('主フッターが NumpadFooterSlot に置換されている (即時トグル div 廃止)', () => {
    expect(admin).toContain('<NumpadFooterSlot currentField={currentField} />')
    // 主フッターの旧 h-0 即時トグル wrapper は消えていること
    expect(admin).not.toContain("${currentField ? 'flex-shrink-0' : 'h-0'} flex-none shrink-0 flex flex-col overflow-hidden")
  })
  it('anchor版 (numpad-anchor) は NumpadFooterPanel のまま温存', () => {
    expect(admin).toContain('data-testid="numpad-anchor"')
    // Slot は 1 箇所 (主フッター) のみ、Panel は import + anchor の 2 箇所
    expect(count(admin, 'NumpadFooterSlot currentField={currentField}')).toBe(1)
    expect(count(admin, '<NumpadFooterPanel currentField={currentField} />')).toBe(1)
  })
})

describe('AC2: PatrolBoothInputPage 主フッターのみ Slot 化', () => {
  it('NumpadFooterSlot を import している', () => {
    expect(patrol).toContain("import NumpadFooterSlot from '../components/NumpadFooterSlot'")
  })
  it('主フッターが NumpadFooterSlot に置換されている (即時トグル div 廃止)', () => {
    expect(patrol).toContain('<NumpadFooterSlot currentField={currentField} />')
    expect(patrol).not.toContain("${currentField ? 'flex-shrink-0' : 'h-0'} flex-none shrink-0 flex flex-col overflow-hidden")
  })
  it('null固定パス (無効化) は NumpadFooterPanel currentField={null} のまま温存', () => {
    expect(patrol).toContain('<NumpadFooterPanel currentField={null} />')
  })
  // SPEC-MOTION-W1_6-NUMPAD-PATROL-MAINFORM-SLOT-01 (D-076): D-075 で確定したとおり、日常の巡回で出る実フッターは
  // Main patrol form の L1110 raw NumpadFooterPanel (hidden↔flex 即時) だった。D-076 でこれも Slot 化。
  it('Main patrol form フッター (旧 hidden↔flex) も NumpadFooterSlot 化済 (D-076)', () => {
    // 旧 hidden↔flex 即時トグル wrapper は消滅
    expect(patrol).not.toContain("className={currentField ? 'flex flex-col overflow-hidden' : 'hidden'}")
    // NumpadFooterSlot currentField={currentField} は 2 箇所 (OCR confirming L971 + Main form L1112)
    expect(count(patrol, 'NumpadFooterSlot currentField={currentField}')).toBe(2)
    // currentField={currentField} 版の raw Panel は消滅 (残るは L856 の null固定のみ)
    expect(count(patrol, '<NumpadFooterPanel currentField={currentField} />')).toBe(0)
    expect(count(patrol, '<NumpadFooterPanel currentField={null} />')).toBe(1)
  })
})
