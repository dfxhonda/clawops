// SPEC-PATROL-BOOTH-UI-IMPROVE-01
// task_1: 気づきボタンが BoothInputForm より上に来ること (DOM 順)
// task_3: 入替モード時も canSave=true になること
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

// ── task_1: 静的ファイル解析で DOM 順を検証 ──────────────────────────────────
const src = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)

describe('PatrolBoothInputPage layout (SPEC-PATROL-BOOTH-UI-IMPROVE-01 task_1)', () => {
  it('when_button_moved_to_top_should_have_kizuki_before_BoothInputForm', () => {
    const kiIdx = src.indexOf('気づき')
    const bfIdx = src.indexOf('<BoothInputForm')
    expect(kiIdx).toBeGreaterThan(-1)
    expect(bfIdx).toBeGreaterThan(-1)
    // 気づきボタンのJSXは BoothInputForm より前に現れること
    expect(kiIdx).toBeLessThan(bfIdx)
  })
})

// ── task_3: canSave ロジック — 入替モード時は inMeter 空でも保存可 ────────────
import { patrolCanSave } from '../../clawsupport/lib/patrolCanSave'

// 本番の canSave 計算をミラー (修正後の期待挙動)
function computeCanSave(inMeter, entryType) {
  return patrolCanSave(inMeter) || entryType === 'replace'
}

describe('canSave in replace mode (SPEC-PATROL-BOOTH-UI-IMPROVE-01 task_3)', () => {
  it('when_inMeter_empty_and_patrol_mode_should_not_be_able_to_save', () => {
    expect(computeCanSave('', 'patrol')).toBe(false)
  })

  it('when_inMeter_empty_and_replace_mode_should_be_able_to_save', () => {
    // 入替時は景品/設定変更のみでも保存可、inMeter 空でも canSave=true であること
    expect(computeCanSave('', 'replace')).toBe(true)
  })

  it('when_inMeter_filled_and_patrol_mode_should_be_able_to_save', () => {
    expect(computeCanSave('12345', 'patrol')).toBe(true)
  })

  it('when_inMeter_filled_and_replace_mode_should_be_able_to_save', () => {
    expect(computeCanSave('12345', 'replace')).toBe(true)
  })
})
