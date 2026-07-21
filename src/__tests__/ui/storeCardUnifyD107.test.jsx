// @vitest-environment happy-dom
// SPEC-PATROL-ROUTE-STORECARD-UNIFY-01 (D-107): 共有 StoreCard 切り出し + distanceLabel 併存。
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import StoreCard from '../../shared/ui/StoreCard'

const store = { store_code: 'KKY01', store_name: '久留米店' }
const meta = { lastDate: '2026-07-02', done: 3, total: 5 }

describe('AC2: distanceLabel 併存 (未渡しで既存挙動不変)', () => {
  it('distanceLabel 未渡し → 距離非表示、最終日/バッジは表示 (クレサポ本体で回帰なし)', () => {
    render(<StoreCard store={store} isPinned={false} meta={meta} onSelect={() => {}} onPin={() => {}} />)
    expect(screen.getByText('最終 7/2')).toBeTruthy()
    expect(screen.getByText('3/5')).toBeTruthy()
    expect(screen.queryByText(/km/)).toBeNull()
  })
  it('distanceLabel 渡すと距離を右メタに併存 (最終日/バッジも残る)', () => {
    render(<StoreCard store={store} isPinned={false} meta={meta} distanceLabel="1.2km" onSelect={() => {}} onPin={() => {}} />)
    expect(screen.getByText('1.2km')).toBeTruthy()
    expect(screen.getByText('最終 7/2')).toBeTruthy()
    expect(screen.getByText('3/5')).toBeTruthy()
  })
  it('meta なし + distanceLabel のみ → 距離だけ右メタ表示', () => {
    render(<StoreCard store={store} isPinned={false} distanceLabel="座標未登録" onSelect={() => {}} onPin={() => {}} />)
    expect(screen.getByText('座標未登録')).toBeTruthy()
  })
})

describe('AC4: タップで onSelect / ★表示', () => {
  it('カードクリックで onSelect', () => {
    const onSelect = vi.fn()
    render(<StoreCard store={store} isPinned={true} meta={null} distanceLabel={null} onSelect={onSelect} onPin={() => {}} />)
    expect(screen.getByText('★')).toBeTruthy()
    fireEvent.click(screen.getByTestId('store-card-KKY01'))
    expect(onSelect).toHaveBeenCalled()
  })
})

describe('AC1: ClawsupportHub は共有 StoreCard を import、旧ローカル定義は残骸ゼロ', () => {
  const hub = readFileSync(resolve(__dirname, '../../clawsupport/pages/ClawsupportHub.jsx'), 'utf-8')
  it('import 済 + ローカル function StoreCard 定義なし', () => {
    expect(hub).toContain("import StoreCard from '../../shared/ui/StoreCard'")
    expect(hub).not.toMatch(/function StoreCard\s*\(/)
  })
})
