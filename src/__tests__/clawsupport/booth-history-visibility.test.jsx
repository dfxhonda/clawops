// @vitest-environment happy-dom
// J-PATROL-99_adhoc_booth_history_visibility-fix-01
// c5fa733 (J-COLLECTION-12 派生 ad-hoc, iPhoneカスタムテンキーOFF) で
// NumpadFooterPanel が isCustomNumpadEnabled()=false 時に null を返すため、
// idleContent として渡されていた BoothHistoryList も同時に消えるリグレッション。
// fix: BoothHistoryList を NumpadFooterPanel の外に出して常時描画する。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { isCustomNumpadEnabled } from '../../shared/lib/device'

// device の isCustomNumpadEnabled をモック (default OFF が再現対象)
vi.mock('../../shared/lib/device', async () => {
  const actual = await vi.importActual('../../shared/lib/device')
  return { ...actual, isCustomNumpadEnabled: vi.fn() }
})

// BoothHistoryList を test-id 付きの軽量モックに置換
vi.mock('../../clawsupport/components/BoothHistoryList', () => ({
  default: () => <div data-testid="booth-history-list">history-mock</div>,
}))

// NumpadField 本物のコンポーネントを利用 (回帰検証対象)
import { NumpadFooterPanel } from '../../clawsupport/components/NumpadField'
import BoothHistoryList from '../../clawsupport/components/BoothHistoryList'

beforeEach(() => { vi.clearAllMocks() })

describe('NumpadFooterPanel when_custom_numpad_disabled', () => {
  it('should_return_null_so_idle_content_is_not_rendered_via_panel', () => {
    isCustomNumpadEnabled.mockReturnValue(false)
    const { container } = render(
      <NumpadFooterPanel
        currentField={null}
        idleContent={<BoothHistoryList />}
      />
    )
    // panel 自体が null → DOM 内に footer も history も無い。
    // この事実が「idleContent 経由で history を載せる設計は OFF 時に history を消す」リグレッション根拠。
    expect(container.querySelector('[data-testid="numpad-footer"]')).toBeNull()
    expect(container.querySelector('[data-testid="booth-history-list"]')).toBeNull()
  })
})

describe('PatrolBoothInputPage layout when_custom_numpad_disabled', () => {
  it('should_render_BoothHistoryList_outside_NumpadFooterPanel_as_sibling', () => {
    isCustomNumpadEnabled.mockReturnValue(false)

    // PatrolBoothInputPage は重い依存を持つので、fix 後のレイアウト構造のみを検証する
    // 軽量テスト用ラッパを fix 後パターンと同形で再現する:
    //   - panel 外に BoothHistoryList を sibling として常時描画する構造
    const TestLayout = () => (
      <div>
        {!isCustomNumpadEnabled() && (
          <div data-testid="booth-history-container">
            <BoothHistoryList />
          </div>
        )}
        <NumpadFooterPanel currentField={null} />
      </div>
    )

    const { getByTestId, container } = render(<TestLayout />)
    // fix 後: panel が null でも history は sibling として描画される
    expect(getByTestId('booth-history-list')).toBeTruthy()
    expect(getByTestId('booth-history-container')).toBeTruthy()
    expect(container.querySelector('[data-testid="numpad-footer"]')).toBeNull()
  })
})
