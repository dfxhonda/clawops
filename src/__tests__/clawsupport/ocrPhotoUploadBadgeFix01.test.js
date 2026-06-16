// SPEC-OCR-PHOTO-UPLOAD-BADGE-FIX-01 C1-C3
// C1: OCR confirm screen no longer shows 写真UP失敗 badge
// C2: handleOCRUse sets ocrPhotoUploadFailed on uploadError / throw
// C3: save payload is unaffected by upload failure state

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)

describe('SPEC-OCR-PHOTO-UPLOAD-BADGE-FIX-01 C1 confirm badge removed', () => {
  it('when_ocr_confirming_should_not_render_photoUrl_failure_badge', () => {
    // The old pattern: {!photoUrl && <span>写真UP失敗</span>} must not exist
    expect(src).not.toContain('!photoUrl && <span')
    expect(src).not.toMatch(/ocrState.*confirming[\s\S]{0,3000}写真UP失敗/)
  })

  it('when_confirm_screen_rendered_should_have_no_static_写真UP失敗_in_confirm_block', () => {
    // Confirm the string only ever appears in the failure banner (outside the confirming block)
    const confirmBlock = src.slice(
      src.indexOf("ocrState === 'confirming'"),
      src.indexOf("ocrState === 'confirming'") + 4000,
    )
    expect(confirmBlock).not.toContain('写真UP失敗')
  })
})

describe('SPEC-OCR-PHOTO-UPLOAD-BADGE-FIX-01 C2 real failure state', () => {
  it('when_upload_returns_uploadError_should_set_ocrPhotoUploadFailed_true', () => {
    // uploadError branch must call setOcrPhotoUploadFailed(true)
    const uploadBlock = src.slice(
      src.indexOf('uploadStorage().then'),
      src.indexOf('uploadStorage().then') + 600,
    )
    expect(uploadBlock).toContain('setOcrPhotoUploadFailed(true)')
  })

  it('when_upload_throws_should_set_ocrPhotoUploadFailed_true', () => {
    const catchBlock = src.slice(
      src.indexOf('.catch(e =>'),
      src.indexOf('.catch(e =>') + 200,
    )
    expect(catchBlock).toContain('setOcrPhotoUploadFailed(true)')
  })

  it('when_upload_succeeds_should_set_ocrPhotoUploadFailed_false', () => {
    const successBlock = src.slice(
      src.indexOf('up?.url'),
      src.indexOf('up?.url') + 200,
    )
    expect(successBlock).toContain('setOcrPhotoUploadFailed(false)')
  })

  it('when_new_capture_starts_should_reset_ocrPhotoUploadFailed', () => {
    // reset must happen in handleOCRCapture alongside setOcrState('loading')
    const captureBlock = src.slice(
      src.indexOf("setOcrState('loading')"),
      src.indexOf("setOcrState('loading')") + 100,
    )
    expect(captureBlock).toContain('setOcrPhotoUploadFailed(false)')
  })

  it('when_upload_failed_should_show_banner_with_testid', () => {
    expect(src).toContain('ocr-photo-upload-failed-banner')
    expect(src).toContain('ocrPhotoUploadFailed')
    expect(src).toContain('証拠写真のUPに失敗しました')
  })
})

describe('SPEC-OCR-PHOTO-UPLOAD-BADGE-FIX-01 C3 save payload unaffected', () => {
  it('when_upload_fails_save_payload_should_not_depend_on_ocrPhotoUploadFailed', () => {
    // _buildPayload must not reference ocrPhotoUploadFailed
    const buildPayloadIdx = src.indexOf('_buildPayload')
    const buildPayloadBlock = src.slice(buildPayloadIdx, buildPayloadIdx + 1500)
    expect(buildPayloadBlock).not.toContain('ocrPhotoUploadFailed')
  })

  it('when_upload_completes_fire_and_forget_design_should_be_preserved', () => {
    // uploadStorage() must be called without await (fire-and-forget)
    const handleUseBlock = src.slice(
      src.indexOf('function handleOCRUse'),
      src.indexOf('function handleOCRUse') + 900,
    )
    expect(handleUseBlock).not.toContain('await uploadStorage')
    expect(handleUseBlock).toContain('uploadStorage()')
  })
})
