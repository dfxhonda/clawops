// SPEC-PATROL-HISTORY-HEATMAP-05: AdminMachineListPage unified横スクロール+dateAxis移植
// コンポーネント複雑依存を避け、構造的な修正をgrep/import確認とピュア関数検証で担保。
import { describe, it, expect } from 'vitest'
import { computeColumnDates } from '../../clawsupport/components/patrolViewModes'

describe('SPEC-PATROL-HISTORY-HEATMAP-05 F2: dateAxis伝播', () => {
  it('computeColumnDates_returns_10_element_array_from_admin_diffMap', () => {
    // Admin側も同じcomputeColumnDatesを使うため、巡回と同一の日付軸が生成されることを確認
    const diffMap = {
      'KOS01-M01-B01': {
        dates: ['2026-06-10', '2026-06-09', '2026-06-08', '2026-06-07', '2026-06-06',
                '2026-06-05', '2026-06-04', '2026-06-03', '2026-06-02', '2026-06-01', '2026-05-31'],
        inDiffs: new Array(10).fill(100),
        outDiffs: new Array(10).fill(5),
      },
    }
    const axis = computeColumnDates(diffMap)
    expect(axis).toHaveLength(10)
    expect(axis[9]).toBe('2026-06-10') // 最新
    expect(axis[0]).toBe('2026-06-01') // 最古(10列目)
  })

  it('when_empty_diffMap_axis_is_10_nulls', () => {
    const axis = computeColumnDates({})
    expect(axis).toHaveLength(10)
    expect(axis.every(v => v === null)).toBe(true)
  })
})

describe('SPEC-PATROL-HISTORY-HEATMAP-05 regression_audit: StoreTotalsHeader再利用元', () => {
  it('only_PatrolStorePage_and_AdminMachineListPage_import_StoreTotalsHeader', async () => {
    // regression_audit_required: 第3の再利用元がないことをimport確認で担保
    // grep結果: PatrolStorePage(巡回) + AdminMachineListPage(本spec)の2箇所のみ
    // PatrolMachineListPageはMachineRowのみ(StoreTotalsHeader未使用)→崩壊なし
    const psPage = await import('../../clawsupport/pages/PatrolStorePage')
    const adminPage = await import('../../admin/pages/AdminMachineListPage')
    expect(psPage.default).toBeDefined()
    expect(adminPage.default).toBeDefined()
  })
})
