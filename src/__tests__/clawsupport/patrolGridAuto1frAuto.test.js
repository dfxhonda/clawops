// SPEC-PATROL-GRID-AUTO-1FR-AUTO-01
// Static analysis: verify main form return grid layout (no component render needed)
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)

// Slice from "=== Main patrol form ===" to avoid asserting on OCR/alwaysOpen returns
const mainFormIdx = src.indexOf('=== Main patrol form ===')
const mainSrc = src.slice(mainFormIdx)

describe('SPEC-PATROL-GRID-AUTO-1FR-AUTO-01 W1: page-root grid layout', () => {
  it('when_main_return_page_root_should_have_grid_class', () => {
    expect(mainSrc).toContain('"grid h-svh')
  })

  it('when_main_return_page_root_should_not_have_flex_flex_col', () => {
    expect(mainSrc).not.toContain('"h-svh flex flex-col')
  })

  it('when_main_return_history_should_not_have_flex_1', () => {
    expect(mainSrc).not.toContain('"flex-1 min-h-0 overflow-y-auto')
  })

  it('when_main_return_numpad_div_should_not_have_flex_shrink_0', () => {
    expect(mainSrc).not.toContain("'flex-shrink-0 flex flex-col overflow-hidden'")
  })

  it('when_main_return_form_wrapper_should_not_have_flex_shrink_0', () => {
    expect(mainSrc).not.toContain('"flex-shrink-0"')
  })

  it('when_main_return_page_root_should_have_overflow_y_hidden', () => {
    expect(mainSrc).toContain('overflow-y-hidden')
  })
})
