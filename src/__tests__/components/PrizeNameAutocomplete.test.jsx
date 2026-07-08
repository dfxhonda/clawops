// @vitest-environment happy-dom
// SPEC-PATROL-PRIZE-SUGGEST-01: 景品名候補リスト 上限排除 + 全件スクロール表示
// AC-01 4 件以上の候補も全件 render / AC-02 max-h-[400px] + overflow-y-auto / AC-03 文字追加で再 fetch
// AC-04 候補選択・キャンセル挙動は変更なし
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// searchPrizeMasters を mock (Supabase 非依存テスト、CLAUDE.md テスト方針 4)
vi.mock('../../services/prizeMasterSearch', () => ({
  searchPrizeMasters: vi.fn(),
}))

import PrizeNameAutocomplete from '../../clawsupport/components/PrizeNameAutocomplete'
import { searchPrizeMasters } from '../../services/prizeMasterSearch'

function makeCandidates(n) {
  return Array.from({ length: n }, (_, i) => ({
    prize_id: `P${String(i + 1).padStart(3, '0')}`,
    prize_name: `テスト景品${i + 1}`,
    prize_name_kana: `テストケイヒン${i + 1}`,
    original_cost: 100 + i,
  }))
}

function renderAutocomplete(extra = {}) {
  const onChange = extra.onChange ?? vi.fn()
  const onSelect = extra.onSelect ?? vi.fn()
  const utils = render(
    <PrizeNameAutocomplete
      value={extra.value ?? ''}
      onChange={onChange}
      onSelect={onSelect}
      placeholder="景品名"
      fieldId="prize-name"
      testId="prize-name-input"
    />
  )
  return { onChange, onSelect, ...utils }
}

async function typeQuery(input, value) {
  await act(async () => {
    fireEvent.change(input, { target: { value } })
  })
  // debounce 300ms + state flush
  await act(async () => {
    await new Promise(r => setTimeout(r, 350))
  })
}

beforeEach(() => {
  searchPrizeMasters.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PrizeNameAutocomplete (SPEC-PATROL-PRIZE-SUGGEST-01)', () => {
  // AC-01: 2文字入力時、マッチする候補が4件以上あれば全件表示される
  it('when_5_candidates_returned_should_render_all_5_li_not_capped_at_3', async () => {
    const five = makeCandidates(5)
    searchPrizeMasters.mockResolvedValue(five)
    const { onChange } = renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'テスト')

    await waitFor(() => {
      // 5 件全 render を確認 (旧 .limit(10) を維持していれば 5 件、'3 件で打ち切り' なら fail)
      expect(screen.queryAllByRole('option')).toHaveLength(5)
    })
    expect(screen.getByTestId('prize-candidate-0')).toBeTruthy()
    expect(screen.getByTestId('prize-candidate-4')).toBeTruthy()
    expect(onChange).toHaveBeenCalledWith('テスト')
  })

  // AC-01 strict: 20 件など多数も全件 render する (spec '制限なし')
  it('when_20_candidates_returned_should_render_all_20_li', async () => {
    const twenty = makeCandidates(20)
    searchPrizeMasters.mockResolvedValue(twenty)
    renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'テスト')

    await waitFor(() => {
      expect(screen.queryAllByRole('option')).toHaveLength(20)
    })
    expect(screen.getByTestId('prize-candidate-19')).toBeTruthy()
  })

  // AC-02b: z-[9999] でオーバーレイ要素に隠れない (Fix: z-50 では「気づきを記録」ボタンに隠れる)
  it('listbox_should_have_z_9999_to_appear_above_overlapping_buttons', async () => {
    searchPrizeMasters.mockResolvedValue(makeCandidates(5))
    renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'テスト')

    await waitFor(() => expect(screen.getByTestId('prize-autocomplete-list')).toBeTruthy())
    const ul = screen.getByTestId('prize-autocomplete-list')
    expect(ul.className).toContain('z-[9999]')
  })

  // AC-02: 候補が多い場合、リスト内でスクロールできる
  // (UX-02 で max-h は fixed 400px → inline min(45svh,...) + overscroll-contain に変更)
  it('listbox_should_scroll_within_with_svh_maxheight_and_overscroll_contain', async () => {
    searchPrizeMasters.mockResolvedValue(makeCandidates(10))
    renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'テスト')

    await waitFor(() => {
      expect(screen.getByTestId('prize-autocomplete-list')).toBeTruthy()
    })
    const ul = screen.getByTestId('prize-autocomplete-list')
    expect(ul.className).toContain('overflow-y-auto')
    expect(ul.className).toContain('overscroll-contain')
    expect(ul.style.maxHeight).toContain('svh')
  })

  // AC-03: 文字を増やすと候補が絞り込まれる (再 fetch される、フィルター維持)
  it('when_query_extended_should_call_searchPrizeMasters_with_new_keyword', async () => {
    searchPrizeMasters.mockResolvedValue(makeCandidates(3))
    renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'ピカ')
    await waitFor(() => expect(searchPrizeMasters).toHaveBeenCalledWith('ピカ'))

    searchPrizeMasters.mockResolvedValue(makeCandidates(1))
    await typeQuery(input, 'ピカチュウ')
    await waitFor(() => expect(searchPrizeMasters).toHaveBeenCalledWith('ピカチュウ'))
  })

  // AC-04: 候補選択動作は変更なし (onSelect with prize fields)
  it('when_candidate_clicked_should_invoke_onSelect_with_prize_fields', async () => {
    const five = makeCandidates(5)
    searchPrizeMasters.mockResolvedValue(five)
    const { onSelect } = renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'テスト')
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(5))

    const third = screen.getByTestId('prize-candidate-2')
    fireEvent.mouseDown(third)

    expect(onSelect).toHaveBeenCalledWith({
      prize_id: 'P003',
      prize_name: 'テスト景品3',
      original_cost: 102,
    })
  })

  // AC-04: 1文字以下に減ると open=false (キャンセル挙動維持)
  it('when_query_shortened_below_2_chars_should_close_list', async () => {
    searchPrizeMasters.mockResolvedValue(makeCandidates(5))
    renderAutocomplete()
    const input = screen.getByTestId('prize-name-input')

    await typeQuery(input, 'テス')
    await waitFor(() => expect(screen.queryByTestId('prize-autocomplete-list')).toBeTruthy())

    await act(async () => {
      fireEvent.change(input, { target: { value: 'テ' } })
    })
    expect(screen.queryByTestId('prize-autocomplete-list')).toBeNull()
  })
})

describe('PrizeNameAutocomplete (SPEC-PATROL-PRIZE-INPUT-IOS-QUIRKS-FIX-01)', () => {
  // AC2: neutral name/id (no English "name" token that iOS reads as a contact field) + class hook
  it('B1_input_has_neutral_name_and_id_without_name_token', () => {
    render(
      <PrizeNameAutocomplete value="" onChange={vi.fn()} onSelect={vi.fn()}
        placeholder="B段景品" fieldId="field-prize-name" testId="prize-name-input" />
    )
    const input = screen.getByTestId('prize-name-input')
    expect(input.getAttribute('name')).toBe('pz_field')
    expect(input.id.toLowerCase()).not.toContain('name') // field-prize-name -> field-prize-f
    expect(input.className).toContain('prize-name-field') // contacts-auto-fill CSS hook
  })

  // AC2: iOS heuristic dampeners present
  it('B1_input_disables_autocomplete_autocorrect_autocapitalize', () => {
    render(
      <PrizeNameAutocomplete value="" onChange={vi.fn()} onSelect={vi.fn()}
        placeholder="B段景品" fieldId="field-prize-name" testId="prize-name-input" />
    )
    const input = screen.getByTestId('prize-name-input')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('autocorrect')).toBe('off')
    expect(input.getAttribute('autocapitalize')).toBe('off')
  })

  // AC3: focusing the prize field must NOT select-all (no select()/setSelectionRange on the input)
  it('B2_AC3_focus_does_not_select_all_text', () => {
    render(
      <PrizeNameAutocomplete value="たまごっち" onChange={vi.fn()} onSelect={vi.fn()}
        placeholder="B段景品" fieldId="field-prize-name" testId="prize-name-input" />
    )
    const input = screen.getByTestId('prize-name-input')
    fireEvent.focus(input)
    // a select-all would set selectionStart=0, selectionEnd=length; caret placement keeps them equal
    expect(input.selectionStart).toBe(input.selectionEnd)
  })

  // AC4: suggest dropdown suppresses the iOS long-press edit-menu callout (not the input)
  it('B2_AC4_dropdown_has_touch_callout_and_user_select_none', async () => {
    searchPrizeMasters.mockResolvedValue(makeCandidates(5))
    render(
      <PrizeNameAutocomplete value="" onChange={vi.fn()} onSelect={vi.fn()}
        placeholder="B段景品" fieldId="field-prize-name" testId="prize-name-input" />
    )
    const input = screen.getByTestId('prize-name-input')
    await typeQuery(input, 'テスト')
    await waitFor(() => expect(screen.getByTestId('prize-autocomplete-list')).toBeTruthy())
    const ul = screen.getByTestId('prize-autocomplete-list')
    expect(ul.className).toContain('select-none')
    expect(ul.style.webkitTouchCallout || ul.style.WebkitTouchCallout).toBe('none')
  })
})

describe('PrizeNameAutocomplete (SPEC-PATROL-PRIZE-SUGGEST-UX-02)', () => {
  it('W1: dropdown is a full-width fixed portal (left-3 right-3, z-[9999]), not w-72 absolute', async () => {
    searchPrizeMasters.mockResolvedValue(makeCandidates(3))
    renderAutocomplete()
    await typeQuery(screen.getByTestId('prize-name-input'), 'テスト')
    await waitFor(() => expect(screen.getByTestId('prize-autocomplete-list')).toBeTruthy())
    const ul = screen.getByTestId('prize-autocomplete-list')
    expect(ul.className).toContain('fixed')
    expect(ul.className).toContain('left-3')
    expect(ul.className).toContain('right-3')
    expect(ul.className).toContain('z-[9999]')
    expect(ul.className).not.toContain('w-72')
    // portaled to document.body (not nested under the input's relative wrapper)
    expect(ul.closest('[data-testid="prize-name-input"]')).toBeNull()
  })

  it('W2: candidate name wraps 2 lines (line-clamp-2), not truncate', async () => {
    searchPrizeMasters.mockResolvedValue([
      { prize_id: 'P1', prize_name: '●5/10締切 400 アミューズ不可 とても長い景品名テスト', short_name: null, original_cost: 400, latest_order_date: '2026-05-10' },
    ])
    renderAutocomplete()
    await typeQuery(screen.getByTestId('prize-name-input'), 'テスト')
    await waitFor(() => expect(screen.getByTestId('prize-candidate-0')).toBeTruthy())
    const nameSpan = screen.getByTestId('prize-candidate-0').querySelector('.font-bold')
    expect(nameSpan.className).toContain('line-clamp-2')
    expect(nameSpan.className).not.toContain('truncate')
  })

  it('W5: identical-name candidates get a distinguishing sub-line (納期), unique ones do not', async () => {
    searchPrizeMasters.mockResolvedValue([
      { prize_id: 'A', prize_name: '●400 アミューズ不可', short_name: 'a', original_cost: 400, latest_order_date: '2026-05-10' },
      { prize_id: 'B', prize_name: '●400 アミューズ不可', short_name: 'b', original_cost: 400, latest_order_date: '2026-04-01' },
      { prize_id: 'C', prize_name: 'ユニーク景品', short_name: 'c', original_cost: 500, latest_order_date: '2026-03-01' },
    ])
    renderAutocomplete()
    await typeQuery(screen.getByTestId('prize-name-input'), 'テスト')
    await waitFor(() => expect(screen.getByTestId('prize-candidate-2')).toBeTruthy())
    // twins (0,1) get the hint sub-line...
    expect(screen.getByTestId('prize-candidate-hint-0').textContent).toContain('納期 2026-05-10')
    expect(screen.getByTestId('prize-candidate-hint-1').textContent).toContain('納期 2026-04-01')
    // ...the unique one (2) does not
    expect(screen.queryByTestId('prize-candidate-hint-2')).toBeNull()
  })
})
