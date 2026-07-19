// SPEC-INF-MAIL-IMPORT-01 (D-086): parseInfinityAnnouncement / isOrderMail / dedup の単体検証。
// 純関数を Edge Function ディレクトリから import (前例: pinThrottle.test.js)。
import { describe, it, expect } from 'vitest'
import {
  parseInfinityAnnouncement,
  isOrderMail,
  filterNewAnnouncements,
  announcementKey,
} from '../../../supabase/functions/inf-mail-import/parseInfinity.ts'

// spec 実物2ブロック例 (納期ヘッダー先頭1回 + ★品名 + 72入＠760 + 上代 + ハーフ)。全角スペース(　)保持。
const SAMPLE = [
  '7月末～8月上再入荷',
  '★たまごっち　ミニチュアポシェット6種',
  '72入　＠760-',
  '上代￥1200',
  'ハーフ不可',
  '',
  '★たまごっち　バケットハット6種',
  '72入　＠640-',
  '上代￥1000',
  'ハーフ不可',
].join('\n')

describe('AC2/AC3/AC4: parseInfinityAnnouncement', () => {
  const rows = parseInfinityAnnouncement(SAMPLE)

  it('AC2: 実物2ブロックを構造化 (品名/72入/＠760/上代/ハーフ→notes)', () => {
    expect(rows).toHaveLength(2)
    expect(rows[0].case_quantity).toBe(72)
    expect(rows[0].unit_cost).toBe(760)
    expect(rows[1].case_quantity).toBe(72)
    expect(rows[1].unit_cost).toBe(640)
    // 上代/ハーフ は notes へ退避 (原文)
    expect(rows[0].notes).toContain('上代￥1200')
    expect(rows[0].notes).toContain('ハーフ不可')
  })

  it('AC3: 納期ヘッダーが全ブロックの notes に配布される', () => {
    expect(rows[0].notes).toContain('7月末～8月上再入荷')
    expect(rows[1].notes).toContain('7月末～8月上再入荷')
  })

  it('AC4: 品名が1文字も加工されず原文保存 (★・6種・全角スペース保持)', () => {
    expect(rows[0].prize_name).toBe('★たまごっち　ミニチュアポシェット6種')
    expect(rows[1].prize_name).toBe('★たまごっち　バケットハット6種')
    // ★ 除去なし / 全角スペース(U+3000)保持
    expect(rows[0].prize_name.startsWith('★')).toBe(true)
    expect(rows[0].prize_name.includes('　')).toBe(true)
    expect(rows[0].prize_name.endsWith('6種')).toBe(true)
  })

  it('unit_cost 無しの案内も除外しない (価格未定許容)', () => {
    const r = parseInfinityAnnouncement('入荷予定\n★新商品\n60入')
    expect(r).toHaveLength(1)
    expect(r[0].prize_name).toBe('★新商品')
    expect(r[0].case_quantity).toBe(60)
    expect(r[0].unit_cost).toBeNull()
  })

  it('空入力 → 空配列 (クラッシュしない)', () => {
    expect(parseInfinityAnnouncement('')).toEqual([])
    expect(parseInfinityAnnouncement(null)).toEqual([])
  })
})

describe('AC6: isOrderMail (請書xlsx添付で発注判定)', () => {
  it('請書 xlsx 添付あり → true (案内として処理しない)', () => {
    expect(isOrderMail(['請書_20260718.xlsx'])).toBe(true)
    expect(isOrderMail(['image.png', '請書250718.XLSX'])).toBe(true)
  })
  it('請書 xlsx 添付なし → false (案内=Phase1で処理)', () => {
    expect(isOrderMail([])).toBe(false)
    expect(isOrderMail(['photo.jpg', '案内.pdf', '請書.pdf'])).toBe(false)
  })
})

describe('AC7: dedup (source_ref+prize_name)', () => {
  it('既存 msgId+品名 は除外、新規のみ残す + 同一バッチ内重複も除去', () => {
    const items = parseInfinityAnnouncement(SAMPLE)
    const existing = new Set([announcementKey('MSG1', '★たまごっち　ミニチュアポシェット6種')])
    const fresh = filterNewAnnouncements(items, 'MSG1', existing)
    expect(fresh).toHaveLength(1)
    expect(fresh[0].prize_name).toBe('★たまごっち　バケットハット6種')
    // 二重 invoke: 全部 existing なら 0
    const all = new Set(items.map(it => announcementKey('MSG1', it.prize_name)))
    expect(filterNewAnnouncements(items, 'MSG1', all)).toHaveLength(0)
  })
})
