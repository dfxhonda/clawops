// SPEC-LIST-SCROLL-STANDARD-01 (D-121) D5: 一覧系スクロール領域の list-scroll 付与を自動担保する装置。
// src 配下を走査し、className に flex-1 と (overflow-auto|overflow-y-auto) を両方含む要素を抽出。
// EXCLUDE(許可リスト)を除いた全てに list-scroll が付いていること、pb-N が残っていないことを検査する。
// 今後の新規画面が一覧系スクロール領域を作ったら、この test が list-scroll 未付与を検出して落ちる。
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

const SRC = resolve(__dirname, '../..') // src/__tests__/ui/ -> src

// EXCLUDE 許可リスト (増やす場合は必ず理由コメントを残す)。src からの相対パス。
const EXCLUDE_FILES = new Set([
  'admin/AdminLayout.jsx',                         // レイアウトの全体スクロール(子ページが個別スクロール、付与で二重余白)
  'shared/ui/KanaIndex.jsx',                       // 共有UIであり余白は listClassName で呼び出し元が決める (D-122)
  'admin/components/StoreCrudDrawer.jsx',          // ドロワー内スクロール(自前padding)
  'collection/components/DenominationDrawer.jsx',  // ドロワー内スクロール(自前padding)
  'clawsupport/components/PrizeSearchModal.jsx',   // モーダル内スクロール(自前padding)
])
const EXCLUDE_PREFIX = ['admin/_legacy/']          // legacy は改修対象外

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name === '__tests__') continue; walk(join(dir, e.name), acc) }
    else if (/\.(jsx|js)$/.test(e.name)) acc.push(join(dir, e.name))
  }
  return acc
}
const rel = f => f.slice(SRC.length + 1).replace(/\\/g, '/')
const isExcluded = r => EXCLUDE_FILES.has(r) || EXCLUDE_PREFIX.some(p => r.startsWith(p))

function collect(includeExcluded) {
  const out = []
  for (const f of walk(SRC)) {
    const r = rel(f)
    if (isExcluded(r) !== includeExcluded) continue
    const src = readFileSync(f, 'utf8')
    const re = /className="([^"]*)"/g
    let m
    while ((m = re.exec(src))) {
      const cls = m[1]
      const hasFlex = /(^|\s)flex-1(\s|$)/.test(cls)
      const hasOv = /(^|\s)(overflow-auto|overflow-y-auto)(\s|$)/.test(cls)
      if (hasFlex && hasOv) out.push({ file: r, cls })
    }
  }
  return out
}

describe('D5/AC3: TARGET_RULE 該当かつ EXCLUDE 以外は全て list-scroll', () => {
  const targets = collect(false)
  it('対象が検出される(下限ガード=走査が空でない)', () => {
    expect(targets.length).toBeGreaterThanOrEqual(50)
  })
  it('全対象に list-scroll が付いている', () => {
    const missing = targets.filter(x => !/(^|\s)list-scroll(\s|$)/.test(x.cls))
    expect(missing.map(x => `${x.file} :: ${x.cls}`)).toEqual([])
  })
  it('AC5/D6: list-scroll 要素に非variant pb-N が残っていない', () => {
    // print:pb-0 等の variant は `:` 前置ゆえ (^|\s)pb- に非該当 → 対象外。
    const withPb = targets.filter(x => /(^|\s)pb-[0-9]/.test(x.cls))
    expect(withPb.map(x => `${x.file} :: ${x.cls}`)).toEqual([])
  })
})

describe('AC4: EXCLUDE 6系統に list-scroll を付与しない', () => {
  it('EXCLUDE 対象の一覧要素に list-scroll は無い', () => {
    const wrong = collect(true).filter(x => /(^|\s)list-scroll(\s|$)/.test(x.cls))
    expect(wrong.map(x => x.file)).toEqual([])
  })
})
