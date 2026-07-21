// @vitest-environment happy-dom
// SPEC-PATROL-ROUTE-STORECARD-RIGHTMETA-01 (D-113): distanceLabel を店名行(左寄せ)へ移動、右メタは最終日+バッジ2段のみ。
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StoreCard from '../../shared/ui/StoreCard'

const store = { store_code: 'KKY01', store_name: '久留米店' }
const meta = { lastDate: '2026-07-02', done: 3, total: 5 }

describe('AC1: distanceLabel は店名行(左側ブロック)に描画され右メタ列から消えている', () => {
  it('distance は店名と同じ行(items-baseline)に、店名と一緒に居る', () => {
    render(<StoreCard store={store} isPinned={false} meta={meta} distanceLabel="1.2km" onSelect={() => {}} onPin={() => {}} />)
    const dist = screen.getByTestId('store-card-distance')
    const nameRow = dist.parentElement
    expect(nameRow.textContent).toContain('久留米店')      // 店名と同じ行
    expect(nameRow.className).toContain('items-baseline')  // 店名行(右メタは items-end)
    expect(nameRow.className).not.toContain('items-end')
  })
})

describe('AC2: hasRightMeta に distanceLabel が含まれない (distanceLabelだけでは右メタ列を出さない)', () => {
  it('meta なし + distanceLabel のみ → 距離は出るが右メタ列(最終日/バッジ)は無し', () => {
    render(<StoreCard store={store} isPinned={false} distanceLabel="座標未登録" onSelect={() => {}} onPin={() => {}} />)
    expect(screen.getByTestId('store-card-distance').textContent).toBe('座標未登録')
    expect(screen.queryByText(/最終/)).toBeNull()
    expect(screen.queryByText('3/5')).toBeNull()
  })
  it('meta あり → 右メタ列は 最終日 + バッジ の2段のみ (距離は右メタに無い)', () => {
    render(<StoreCard store={store} isPinned={false} meta={meta} distanceLabel="1.2km" onSelect={() => {}} onPin={() => {}} />)
    const badge = screen.getByText('3/5')
    const rightMeta = badge.parentElement // flex-col items-end
    expect(rightMeta.className).toContain('items-end')
    expect(rightMeta.textContent).toContain('最終 7/2')
    expect(rightMeta.textContent).not.toContain('1.2km') // 距離は右メタに居ない
  })
})

describe('AC3: distanceLabel 未渡し(クレサポ本体)は無回帰', () => {
  it('店名行に距離spanなし、右メタは従来通り(最終日+バッジ)', () => {
    render(<StoreCard store={store} isPinned={false} meta={meta} onSelect={() => {}} onPin={() => {}} />)
    expect(screen.queryByTestId('store-card-distance')).toBeNull() // 距離要素なし
    expect(screen.getByText('久留米店')).toBeTruthy()
    expect(screen.getByText('最終 7/2')).toBeTruthy()
    expect(screen.getByText('3/5')).toBeTruthy()
  })
})

describe('AC4: プレースホルダも同位置・小サイズ (行高を増やさない)', () => {
  it("'距離は現在地取得後' / '座標未登録' も店名行に text-xs 小サイズで出る", () => {
    for (const label of ['距離は現在地取得後', '座標未登録']) {
      const { unmount } = render(<StoreCard store={store} isPinned={false} meta={meta} distanceLabel={label} onSelect={() => {}} onPin={() => {}} />)
      const dist = screen.getByTestId('store-card-distance')
      expect(dist.textContent).toBe(label)
      expect(dist.className).toContain('text-xs')            // 小サイズ=行高を増やさない
      expect(dist.parentElement.textContent).toContain('久留米店') // 店名行
      unmount()
    }
  })
})
