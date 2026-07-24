// SPEC-PATROL-DEFAULT-BOOTH-VIEW-01 (D-119): 巡回(PatrolStorePage)の初期ビューを機械→ブースに変更。
// PatrolStorePage は full render 前例がなく、既存(crossFreezeTableD110)同様ソース文字列で初期値を検証する。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(__dirname, '../../clawsupport/pages/PatrolStorePage.jsx'), 'utf-8')

describe('AC1/AC8: 巡回の初期ビューが booth', () => {
  it('view state の初期値が booth', () => {
    expect(src).toMatch(/const \[view, setView\] = useState\('booth'\)/) // D1
  })
  it('view の初期値に machine を使っていない', () => {
    expect(src).not.toMatch(/const \[view, setView\] = useState\('machine'\)/)
  })
})

describe('AC2/D3: 他の初期値は不変', () => {
  it('boothOrder の初期値は machine (帳簿重要順=機械順)', () => {
    expect(src).toContain("const [boothOrder, setBoothOrder] = useState('machine')") // D2
  })
  it('viewMode の初期値は IN', () => {
    expect(src).toMatch(/useState\('IN'\)/) // D3
  })
})

describe('FORBIDDEN/AC3: ビュー切替タブは残す (機械ビューは集約把握用)', () => {
  it('機械/ブース タブが両方存在', () => {
    expect(src).toContain('patrol-view-tab-machine')
    expect(src).toContain('patrol-view-tab-booth')
  })
  it('view の永続化(sessionStorage/localStorage)は導入しない', () => {
    // D-119 は初期値変更のみ。view の永続化は禁止。
    expect(src).not.toMatch(/(sessionStorage|localStorage)[^\n]*view/i)
    expect(src).not.toMatch(/view[^\n]*(sessionStorage|localStorage)/i)
  })
})

describe('AC5: 保存して戻る復帰時のブースビュー切替は従来どおり残存', () => {
  it("復帰 useEffect の setView('booth') が存在", () => {
    expect(src).toContain("setView('booth')")
  })
})
