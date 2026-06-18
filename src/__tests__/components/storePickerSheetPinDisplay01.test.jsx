// @vitest-environment happy-dom
// SPEC-STORE-PICKER-PIN-DISPLAY-AND-COLLECTION-UNIFY-01: R1 card star, R2 long-press toggle, R3 disabled prop
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import StorePickerSheet from '../../components/StorePickerSheet'

const STORES = [
  { store_code: 'S01', store_name: '店舗A', locality: '福岡', locality_kana: 'ふくおか' },
  { store_code: 'S02', store_name: '店舗B', locality: '久留米', locality_kana: 'くるめ' },
]
const PINNED_CODES = [{ store_code: 'S01' }]

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'STAFF01' }),
}))

vi.mock('../../lib/sentry', () => ({
  Sentry: { addBreadcrumb: vi.fn() },
}))

vi.mock('../../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../../shared/ui/KanaIndex', () => ({
  default: ({ items, pinnedKeys, idKey, renderCard }) => (
    <div data-testid="kana-index">
      {(items || []).map(item =>
        renderCard(item, (pinnedKeys || []).includes(item[idKey]))
      )}
    </div>
  ),
}))

const makeChain = (resolveVal) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve, reject) => Promise.resolve(resolveVal).then(resolve, reject),
    catch: (fn) => Promise.resolve(resolveVal).catch(fn),
  }
  return chain
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      if (table === 'stores') return makeChain({ data: STORES })
      if (table === 'staff_pinned_stores') return makeChain({ data: PINNED_CODES })
      return makeChain({ data: [] })
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'jwt-test' } } }),
    },
  },
}))

describe('StorePickerSheet (SPEC-STORE-PICKER-PIN-DISPLAY-AND-COLLECTION-UNIFY-01)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('when_pinned_store_card_is_rendered_should_show_star_only_on_pinned', async () => {
    render(<StorePickerSheet value={null} onChange={vi.fn()} showAllOption={false} />)
    fireEvent.click(screen.getByTestId('store-picker-trigger'))
    await waitFor(() => expect(screen.queryByTestId('store-picker-item-S01')).not.toBeNull())
    expect(screen.getByTestId('store-picker-item-S01').textContent).toContain('★')
    expect(screen.getByTestId('store-picker-item-S02').textContent).not.toContain('★')
  })

  it('when_short_tap_on_store_card_should_call_onChange_and_close_sheet', async () => {
    const onChange = vi.fn()
    render(<StorePickerSheet value={null} onChange={onChange} showAllOption={false} />)
    fireEvent.click(screen.getByTestId('store-picker-trigger'))
    await waitFor(() => expect(screen.queryByTestId('store-picker-item-S02')).not.toBeNull())
    fireEvent.click(screen.getByTestId('store-picker-item-S02'))
    expect(onChange).toHaveBeenCalledWith('S02')
    expect(screen.queryByTestId('store-picker-sheet')).toBeNull()
  })

  it('when_long_press_on_store_card_should_call_fetch_and_not_call_onChange', async () => {
    const onChange = vi.fn()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      render(<StorePickerSheet value={null} onChange={onChange} showAllOption={false} />)
      // flush async store load
      await act(async () => { await Promise.resolve() })
      fireEvent.click(screen.getByTestId('store-picker-trigger'))
      await act(async () => { await Promise.resolve() })

      const card = screen.getByTestId('store-picker-item-S02')
      fireEvent.pointerDown(card)
      act(() => { vi.advanceTimersByTime(600) })
      fireEvent.pointerUp(card)
      fireEvent.click(card)

      await act(async () => { await Promise.resolve() })
      expect(global.fetch).toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('when_disabled_true_trigger_click_should_not_open_sheet', () => {
    render(<StorePickerSheet value={null} onChange={vi.fn()} showAllOption={false} disabled={true} />)
    fireEvent.click(screen.getByTestId('store-picker-trigger'))
    expect(screen.queryByTestId('store-picker-sheet')).toBeNull()
  })
})
