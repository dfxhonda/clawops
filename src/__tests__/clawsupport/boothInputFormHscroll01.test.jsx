// @vitest-environment happy-dom
// SPEC-ADMIN-METER-EDIT-HSCROLL-01: hscroll edit layout + crane gate
import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import BoothInputForm from '../../clawsupport/components/BoothInputForm'

vi.mock('../../clawsupport/components/NumpadField', () => ({
  default: ({ testId, id, value }) => <input data-testid={testId ?? id} readOnly value={value ?? ''} />,
}))
vi.mock('../../clawsupport/components/Tooltip', () => ({
  default: ({ id }) => <span data-testid={`tooltip-${id}`} />,
}))
vi.mock('../../clawsupport/components/PrizeNameAutocomplete', () => ({
  default: ({ value, fieldId, testId }) => <input data-testid={testId ?? fieldId ?? 'prize-autocomplete'} readOnly value={value ?? ''} />,
}))

const DEFAULT_EDIT = {
  mode: 'edit',
  outMeterCount: 1,
  inMeter: '', setIn: vi.fn(),
  outMeter1: '', setOut1: vi.fn(),
  outMeter2: '', setOut2: vi.fn(),
  outMeter3: '', setOut3: vi.fn(),
  stock: '', setStk: vi.fn(),
  restock: '', setRst: vi.fn(),
  prizeName: '', setPrize: vi.fn(),
  prizeCost: '', setCost: vi.fn(),
  setA: '', setSetA: vi.fn(),
  setC: '', setSetC: vi.fn(),
  setL: '', setSetL: vi.fn(),
  setR: '', setSetR: vi.fn(),
  setO: '', setSetO: vi.fn(),
  touched: {}, touch: vi.fn(() => vi.fn()),
  navigateNext: vi.fn(), registerField: vi.fn(), activeTabindex: null,
  canSave: false, saving: false, result: null, onSave: vi.fn(),
  onDelete: vi.fn(), deleting: false,
}

function renderEdit(overrides = {}) {
  return render(<BoothInputForm {...DEFAULT_EDIT} {...overrides} />)
}

describe('SPEC-ADMIN-METER-EDIT-HSCROLL-01 R1: hscroll meter row', () => {
  it('when_edit_mode_meter_row_should_contain_all_meter_fields', () => {
    const { getByTestId } = renderEdit()
    const row = getByTestId('meter-row')
    expect(within(row).getByTestId('field-in-meter')).toBeTruthy()
    expect(within(row).getByTestId('field-out-meter')).toBeTruthy()
    expect(within(row).getByTestId('field-stock')).toBeTruthy()
    expect(within(row).getByTestId('field-restock')).toBeTruthy()
    expect(within(row).getByTestId('diff-cell')).toBeTruthy()
  })

  it('when_edit_mode_meter_row_should_have_overflow_x_auto_class', () => {
    const { getByTestId } = renderEdit()
    expect(getByTestId('meter-row').className).toContain('overflow-x-auto')
  })
})

describe('SPEC-ADMIN-METER-EDIT-HSCROLL-01 R1: OUT2/OUT3 conditional', () => {
  it('when_outMeterCount_1_should_not_render_out2_field', () => {
    const { queryByTestId } = renderEdit({ outMeterCount: 1 })
    expect(queryByTestId('field-out-meter-2')).toBeNull()
  })

  it('when_outMeterCount_2_should_render_out2_not_out3', () => {
    const { getByTestId, queryByTestId } = renderEdit({ outMeterCount: 2 })
    expect(getByTestId('field-out-meter-2')).toBeTruthy()
    expect(queryByTestId('field-out-meter-3')).toBeNull()
  })

  it('when_outMeterCount_3_should_render_out2_and_out3', () => {
    const { getByTestId } = renderEdit({ outMeterCount: 3 })
    expect(getByTestId('field-out-meter-2')).toBeTruthy()
    expect(getByTestId('field-out-meter-3')).toBeTruthy()
  })
})

describe('SPEC-ADMIN-METER-EDIT-OUT2-FIELDS-fix-01: edit-mode OUT2/OUT3 prize sections', () => {
  it('when_edit_outMeterCount_1_should_not_render_out2_prize_fields', () => {
    const { queryByTestId } = renderEdit({ outMeterCount: 1 })
    expect(queryByTestId('field-stock-2')).toBeNull()
    expect(queryByTestId('field-prize-name-2')).toBeNull()
    expect(queryByTestId('field-prize-cost-2')).toBeNull()
  })

  it('when_edit_outMeterCount_2_should_render_out2_prize_section', () => {
    const { getByTestId } = renderEdit({
      outMeterCount: 2,
      stock2: '10', setStk2: vi.fn(),
      restock2: '5', setRst2: vi.fn(),
      prizeName2: 'テスト景品B', setPrize2: vi.fn(),
      prizeCost2: '300', setCost2: vi.fn(),
    })
    expect(getByTestId('field-stock-2')).toBeTruthy()
    expect(getByTestId('field-restock-2')).toBeTruthy()
    expect(getByTestId('field-prize-name-2')).toBeTruthy()
    expect(getByTestId('field-prize-cost-2')).toBeTruthy()
  })

  it('when_edit_outMeterCount_2_should_not_render_out3_prize_section', () => {
    const { queryByTestId } = renderEdit({ outMeterCount: 2 })
    expect(queryByTestId('field-stock-3')).toBeNull()
    expect(queryByTestId('field-prize-name-3')).toBeNull()
  })

  it('when_edit_outMeterCount_3_should_render_out2_and_out3_prize_sections', () => {
    const { getByTestId } = renderEdit({
      outMeterCount: 3,
      stock2: '10', setStk2: vi.fn(),
      restock2: '5', setRst2: vi.fn(),
      prizeName2: 'テスト景品B', setPrize2: vi.fn(),
      prizeCost2: '300', setCost2: vi.fn(),
      stock3: '8', setStk3: vi.fn(),
      restock3: '2', setRst3: vi.fn(),
      prizeName3: 'テスト景品C', setPrize3: vi.fn(),
      prizeCost3: '250', setCost3: vi.fn(),
    })
    expect(getByTestId('field-stock-2')).toBeTruthy()
    expect(getByTestId('field-prize-name-2')).toBeTruthy()
    expect(getByTestId('field-stock-3')).toBeTruthy()
    expect(getByTestId('field-prize-name-3')).toBeTruthy()
  })

  it('when_patrol_mode_should_not_render_edit_out2_prize_fields', () => {
    const { queryByTestId } = render(
      <BoothInputForm {...DEFAULT_EDIT} mode="patrol" outMeterCount={2} />
    )
    expect(queryByTestId('field-prize-name-2')).toBeNull()
    expect(queryByTestId('field-prize-cost-2')).toBeNull()
  })
})

describe('SPEC-ADMIN-METER-EDIT-HSCROLL-01 R3: crane gate for set fields', () => {
  it('when_edit_mode_no_typeId_should_hide_set_fields', () => {
    const { queryByTestId } = renderEdit()
    expect(queryByTestId('field-set-a')).toBeNull()
  })

  it('when_edit_mode_non_crane_typeId_should_hide_set_fields', () => {
    const { queryByTestId } = renderEdit({ typeId: 'capsule' })
    expect(queryByTestId('field-set-a')).toBeNull()
  })

  it('when_edit_mode_crane_typeId_should_show_set_fields', () => {
    const { getByTestId } = renderEdit({ typeId: 'crane' })
    expect(getByTestId('field-set-a')).toBeTruthy()
  })

  it('when_patrol_mode_should_show_set_fields_regardless_of_typeId', () => {
    const { getByTestId } = render(
      <BoothInputForm {...DEFAULT_EDIT} mode="patrol" />
    )
    expect(getByTestId('field-set-a')).toBeTruthy()
  })
})
