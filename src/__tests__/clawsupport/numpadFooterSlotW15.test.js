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
  it('別配置フッター (currentField ? ... : hidden) は NumpadFooterPanel のまま温存', () => {
    expect(patrol).toContain("className={currentField ? 'flex flex-col overflow-hidden' : 'hidden'}")
    // Slot は主フッターの 1 箇所のみ
    expect(count(patrol, 'NumpadFooterSlot currentField={currentField}')).toBe(1)
    // Panel は import + null固定 + 別配置 の合計 (currentField={currentField} 版は別配置の 1 箇所のみ)
    expect(count(patrol, '<NumpadFooterPanel currentField={currentField} />')).toBe(1)
  })
})
