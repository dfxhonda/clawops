// SPEC-MACHINE-MODEL-LINK-ADMIN-HUB-CARD-fix-01 (D-102): マスタハブに「全店機械確認」入口カード追加。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(__dirname, '../../admin/pages/AdminMastersHubPage.jsx'), 'utf-8')

describe('AC1: 全店機械確認カードが機械登録の直後に存在', () => {
  it('label/desc/path/impl 一式', () => {
    expect(src).toContain('全店機械確認')
    expect(src).toContain("path: '/admin/machine-links'")
    expect(src).toMatch(/全店機械確認[\s\S]*machine-links[\s\S]*impl: true/)
  })
  it('位置: 機械登録(/admin/machines) の直後、ブース一覧(/admin/booths) の直前', () => {
    const iMachines = src.indexOf("path: '/admin/machines'")
    const iLink     = src.indexOf("path: '/admin/machine-links'")
    const iBooths   = src.indexOf("path: '/admin/booths'")
    expect(iMachines).toBeGreaterThan(-1)
    expect(iLink).toBeGreaterThan(iMachines)
    expect(iBooths).toBeGreaterThan(iLink)
  })
})

describe('AC2: 既存カードは無改変 (追加は1枚=machine-linksのみ)', () => {
  it('TILES 総数 14 (既存13 + 追加1)', () => {
    const count = (src.match(/label:/g) || []).length
    expect(count).toBe(14)
  })
  it('既存の主要カードが従来 path のまま残る', () => {
    for (const p of ['/admin/import', '/admin/masters/store-list', '/admin/machines', '/admin/booths', '/admin/models', '/admin/manuals']) {
      expect(src).toContain(`path: '${p}'`)
    }
  })
})
