// @vitest-environment node
// SPEC-ORG-DFX-RESIDUAL-SWEEP-01 (D-066) F2/AC2: OCR 保存経路の patrol_date が JST 日付であること。
// OcrConfirm.jsx / PatrolBatchOcrPage.jsx で使う導出式
//   new Date(readTime).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
// を 9時前JST境界で検証。旧バグ (UTC slice) は前日になる。
import { describe, it, expect } from 'vitest'

const jstDate = (readTime) => new Date(readTime).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
const utcSlice = (readTime) => new Date(readTime).toISOString().slice(0, 10) // 旧バグ再現

describe('D-066 F2: patrol_date JST derivation (9時前境界)', () => {
  it('JST 08:30 (UTC前日23:30) → patrol_date は JST 当日、旧UTC slice は前日', () => {
    const readTime = '2026-07-14T23:30:00.000Z' // = 2026-07-15 08:30 JST
    expect(jstDate(readTime)).toBe('2026-07-15')   // JST 当日 (正)
    expect(utcSlice(readTime)).toBe('2026-07-14')  // 旧UTC slice は前日 (バグ)
  })

  it('JST 09:30 (UTC 00:30 同日) → 両者一致 (日中は問題なし)', () => {
    const readTime = '2026-07-15T00:30:00.000Z' // = 2026-07-15 09:30 JST
    expect(jstDate(readTime)).toBe('2026-07-15')
    expect(utcSlice(readTime)).toBe('2026-07-15')
  })

  it('JST 00:10 (UTC前日15:10) 深夜巡回 → JST 当日', () => {
    const readTime = '2026-07-14T15:10:00.000Z' // = 2026-07-15 00:10 JST
    expect(jstDate(readTime)).toBe('2026-07-15')
    expect(utcSlice(readTime)).toBe('2026-07-14')
  })
})
