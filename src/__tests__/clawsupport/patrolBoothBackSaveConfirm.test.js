// SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01 C1-C3
// C1: onBack → isDirty gate (was canSave-based)
// C2: save-confirm bottom-sheet dialog with 3 buttons
// C3: commitSwipeAndNavigate restores isDirty && canSave gate

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)

describe('SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01 C1 back dirty-gate', () => {
  it('when_onBack_should_use_isDirty_not_canSave_as_gate', () => {
    expect(src).toContain('if (!isDirty) goBack()')
    expect(src).toContain('setShowBackConfirm(true)')
  })

  it('when_onBack_should_not_use_old_canSave_based_auto_save', () => {
    // Old: if (canSave) handleSave(goBack); else goBack()
    // New form must NOT exist alongside the new pattern
    expect(src).not.toContain('if (canSave) handleSave(goBack)')
  })
})

describe('SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01 C2 save-confirm dialog', () => {
  it('when_dialog_rendered_should_have_overlay_testid', () => {
    expect(src).toContain('back-confirm-overlay')
  })

  it('when_dialog_rendered_should_have_dialog_panel_testid', () => {
    expect(src).toContain('back-confirm-dialog')
  })

  it('when_dialog_rendered_should_have_save_button', () => {
    expect(src).toContain('back-confirm-save')
  })

  it('when_dialog_rendered_should_have_discard_button', () => {
    expect(src).toContain('back-confirm-discard')
  })

  it('when_dialog_rendered_should_have_cancel_button', () => {
    expect(src).toContain('back-confirm-cancel')
  })

  it('when_dialog_rendered_should_show_title', () => {
    expect(src).toContain('保存しますか？')
  })

  it('when_overlay_tapped_should_close_dialog', () => {
    // overlay onClick must call setShowBackConfirm(false)
    const overlayBlock = src.slice(src.indexOf('back-confirm-overlay') - 200, src.indexOf('back-confirm-overlay') + 200)
    expect(overlayBlock).toContain('setShowBackConfirm(false)')
  })

  it('when_save_button_clicked_should_call_handleSave_then_goBack', () => {
    // onClick appears before data-testid in JSX
    const saveBtn = src.slice(src.indexOf('back-confirm-save') - 250, src.indexOf('back-confirm-save') + 50)
    expect(saveBtn).toContain('handleSave(goBack)')
  })

  it('when_discard_button_clicked_should_call_goBack_directly', () => {
    // onClick appears before data-testid in JSX, so look in chars before the testid
    const discardBtn = src.slice(src.indexOf('back-confirm-discard') - 200, src.indexOf('back-confirm-discard') + 50)
    expect(discardBtn).toContain('goBack()')
  })
})

describe('SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01 C3 swipe dirty-gate restored', () => {
  it('when_swipe_navigate_should_gate_on_isDirty_and_canSave', () => {
    expect(src).toContain('if (isDirty && canSave) handleSave(navFn)')
  })
})
