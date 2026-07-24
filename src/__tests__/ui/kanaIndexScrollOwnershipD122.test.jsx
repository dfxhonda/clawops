// @vitest-environment happy-dom
// SPEC-KANAINDEX-SCROLL-OWNERSHIP-01 (D-122 B案): KanaIndex の余白責務を親へ返す listClassName prop。
// 既定 '' で回帰ゼロ(AC6)、リスト本体のみに連結(AC2)、本体にハードコードなし(AC5)。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import KanaIndex from '../../shared/ui/KanaIndex'

afterEach(() => cleanup())

const BASE = 'flex-1 overflow-y-auto px-5 py-3 space-y-2' // 変更前の list body className
// リスト本体 = overflow-y-auto を class で持つ div (タブ行は style overflowX ゆえ class に無い)
const listDiv = c => c.querySelector('div.overflow-y-auto')

describe('AC1/AC6: listClassName 未指定なら list body className が変更前と完全一致 (回帰ゼロ)', () => {
  it('listClassName を渡さない → className === BASE (1バイトも変わらない)', () => {
    const { container } = render(<KanaIndex items={[]} showPinned={false} renderCard={() => null} />)
    expect(listDiv(container).className).toBe(BASE)
  })
})

describe('AC2: listClassName はリスト本体に連結、タブ行には付かない', () => {
  it('listClassName="list-scroll" → list body に末尾連結', () => {
    const { container } = render(<KanaIndex items={[]} showPinned={false} listClassName="list-scroll" renderCard={() => null} />)
    expect(listDiv(container).className).toBe(`${BASE} list-scroll`)
  })
  it('タブバー(shrink-0 border-b)には list-scroll が付かない', () => {
    const { container } = render(<KanaIndex items={[]} showPinned={false} listClassName="list-scroll" renderCard={() => null} />)
    const tabbar = container.querySelector('div.shrink-0.border-b')
    expect(tabbar).toBeTruthy()
    expect(tabbar.className).not.toContain('list-scroll')
  })
})

describe('AC1/AC5/AC3/AC4: 既定値/ハードコード/呼び出し元 (ソース検証)', () => {
  const read = p => readFileSync(resolve(__dirname, p), 'utf-8')
  const kana = read('../../shared/ui/KanaIndex.jsx')
  it('AC1: listClassName の既定は空文字列', () => {
    expect(kana).toMatch(/listClassName\s*=\s*''/)
  })
  it('AC5: KanaIndex 本体に list-scroll のハードコードがない', () => {
    expect(kana).not.toContain('list-scroll')
  })
  it('AC3: ClawsupportHub は listClassName="list-scroll" を渡す', () => {
    expect(read('../../clawsupport/pages/ClawsupportHub.jsx')).toContain('listClassName="list-scroll"')
  })
  it('AC4: 他4箇所(Tanasupport/StockHub/PatrolRoute/StorePickerSheet)は listClassName を渡さない', () => {
    for (const p of [
      '../../tanasupport/pages/TanasupportHub.jsx',
      '../../tanasupport/pages/StockHubPage.jsx',
      '../../clawsupport/pages/PatrolRoutePage.jsx',
      '../../components/StorePickerSheet.jsx',
    ]) {
      expect(read(p), `${p} は listClassName 未指定であること`).not.toContain('listClassName')
    }
  })
})
