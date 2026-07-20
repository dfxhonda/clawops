// SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 前回集金後累計 固定列の表示 + 保存時リフレッシュ。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { sumAccum, formatCellPlain, ACCUM_COL_WIDTH } from '../../clawsupport/components/patrolViewModes'

const read = p => readFileSync(resolve(__dirname, p), 'utf-8')

describe('AC2: sumAccum 合算 (機械=全booth合計 / 店=全accumMap合計)', () => {
  const map = { B01: { accum: 2000 }, B02: { accum: 500 }, B03: { accum: null }, B04: {} }

  it('boothCodes 指定 = 該当ブースのみ合算', () => {
    expect(sumAccum(map, ['B01', 'B02'])).toBe(2500)
    expect(sumAccum(map, ['B01'])).toBe(2000)
  })
  it('boothCodes 無指定 = 全 accumMap 合算', () => {
    expect(sumAccum(map)).toBe(2500) // null/欠落は加算しない
  })
  it('全 null/未供給 → null (→ 表示 −)', () => {
    expect(sumAccum({ B01: { accum: null }, B02: {} })).toBeNull()
    expect(sumAccum({}, ['B01'])).toBeNull()
    expect(sumAccum(null)).toBeNull()
    expect(sumAccum(undefined)).toBeNull()
  })
  it('accum=0 は有効値として合算 (null と区別)', () => {
    expect(sumAccum({ B01: { accum: 0 }, B02: { accum: 0 } })).toBe(0)
  })
})

describe('AC2: 累計値フォーマット (D-089 formatCellPlain カンマ抜き / null→−)', () => {
  it('大きい累計もカンマを付けない', () => {
    expect(formatCellPlain(40721, 'count')).toBe('40721')
    expect(formatCellPlain(2500, 'count')).toBe('2500')
  })
  it('null → −', () => {
    expect(formatCellPlain(null, 'count')).toBe('−')
    expect(formatCellPlain(sumAccum(null), 'count')).toBe('−')
  })
})

describe('AC1: 4コンポーネント全てに同幅の累計固定列 (ACCUM_COL_WIDTH 共有 = 縦ズレなし)', () => {
  const files = {
    MachineRow: read('../../clawsupport/components/MachineRow.jsx'),
    MachineRowExpandedBoothList: read('../../clawsupport/components/MachineRowExpandedBoothList.jsx'),
    StoreTotalsHeader: read('../../clawsupport/components/StoreTotalsHeader.jsx'),
  }
  it('MachineRow/ExpandedBoothList/StoreTotalsHeader が ACCUM_COL_WIDTH を使用 (同幅保証)', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, `${name} ACCUM_COL_WIDTH import`).toContain('ACCUM_COL_WIDTH')
    }
  })
  it('ACCUM_COL_WIDTH 定義は shrink-0 固定幅 (日付gridの w-[440px] とは別)', () => {
    const vm = read('../../clawsupport/components/patrolViewModes.js')
    expect(vm).toMatch(/ACCUM_COL_WIDTH\s*=\s*'w-16 shrink-0'/)
  })
  it('各行の累計セル testid (機械/ブース/店ヘッダ合計)', () => {
    expect(files.MachineRow).toContain('machine-accum-')
    expect(files.MachineRowExpandedBoothList).toContain('booth-accum-')
    expect(files.StoreTotalsHeader).toContain('store-accum-total')
  })
  it('Admin側は共有 MachineRow/StoreTotalsHeader を子呼び = 列幅自動追従 (個別挿入なし)', () => {
    const admin = read('../../admin/pages/AdminMachineListPage.jsx')
    expect(admin).toContain('MachineRow')
    expect(admin).toContain('StoreTotalsHeader')
  })
})

describe('AC3: 日付軸 (grid-cols-10 w-[440px]) は不可侵', () => {
  it('累計セルは grid-cols-10 でも w-[440px] でもない (日付gridの外)', () => {
    // 累計セルの className は ACCUM_COL_WIDTH(w-16) を使い、grid/w-[440px] を含まない
    const mr = read('../../clawsupport/components/MachineRow.jsx')
    const accumBlock = mr.slice(mr.indexOf('machine-accum-'), mr.indexOf('machine-totals-'))
    expect(accumBlock).toContain('ACCUM_COL_WIDTH')
    expect(accumBlock).not.toContain('grid-cols-10')
    expect(accumBlock).not.toContain('w-[440px]')
  })
})

describe('AC4/AC5/AC6: リフレッシュは全台サーバー保存時のみ (1台ローカル保存では無し)', () => {
  const page = read('../../clawsupport/pages/PatrolStorePage.jsx')
  it('AC4: handleManualUpload(とりま保存)成功後に fetchCollectionBaseline→setAccumMap', () => {
    const fn = page.slice(page.indexOf('async function handleManualUpload'), page.indexOf('async function handleManualUpload') + 700)
    expect(fn).toContain('fetchCollectionBaseline(storeCode)')
    expect(fn).toContain('setAccumMap')
  })
  it('AC6: per-swipe再fetchなし — 入店時 fetch は deps=[storeCode] のみ', () => {
    // 入店 effect のみ storeCode 依存で fetch。swipe 専用の再fetchが無いことを確認 (fetch呼び出し総数 = 入店1 + 保存2 + 退店1 = 4)
    const calls = (page.match(/fetchCollectionBaseline\(/g) || []).length
    expect(calls).toBeLessThanOrEqual(4)
    expect(page).toContain('}, [storeCode])')
  })
  it('AC5: PatrolBoothInputPage(1台ローカル保存)には累計引き直しが無い', () => {
    const booth = read('../../clawsupport/pages/PatrolBoothInputPage.jsx')
    expect(booth).not.toContain('fetchCollectionBaseline')
  })
})
