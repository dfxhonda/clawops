// @vitest-environment happy-dom
// SPEC-TESTBADGE-WATERMARK-ALLPAGES-01 (D-114): テスト版透かし。production非表示 / preview表示 / 操作非阻害。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import TestBuildWatermark from '../../components/TestBuildWatermark'

afterEach(() => vi.unstubAllGlobals())

describe('AC1: production で null / それ以外で描画', () => {
  it('env=production → null (本番で自動非表示)', () => {
    const { container } = render(<TestBuildWatermark env="production" />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('test-build-watermark')).toBeNull()
  })
  it('env=preview → 描画', () => {
    render(<TestBuildWatermark env="preview" />)
    expect(screen.getByTestId('test-build-watermark')).toBeTruthy()
    expect(screen.getAllByText('テスト版').length).toBeGreaterThanOrEqual(2) // 中央大文字 + 右下ラベル
  })
  it('env=development → 描画 (ローカル開発でも見える副作用)', () => {
    render(<TestBuildWatermark env="development" />)
    expect(screen.getByTestId('test-build-watermark')).toBeTruthy()
  })
  it('env未指定 → __VERCEL_ENV__ 既存defineを既定で参照 (テスト環境=非production=描画)', () => {
    // env prop 無しで default 経路(resolveEnv→__VERCEL_ENV__)を通す。テスト環境は非production。
    render(<TestBuildWatermark />)
    expect(screen.getByTestId('test-build-watermark')).toBeTruthy()
  })
})

describe('AC2: 操作を一切阻害しない (pointer-events none / user-select none / aria-hidden)', () => {
  it('オーバーレイに pointer-events-none + select-none + aria-hidden=true', () => {
    render(<TestBuildWatermark env="preview" />)
    const el = screen.getByTestId('test-build-watermark')
    expect(el.className).toContain('pointer-events-none')
    expect(el.className).toContain('select-none')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toContain('fixed')
    expect(el.className).toContain('inset-0')
    expect(el.className).toContain('z-[9999]')
  })
})

describe('AC3/AC4: App.jsx ルート直下に無条件mount / vite.config無変更', () => {
  const app = readFileSync(resolve(__dirname, '../../App.jsx'), 'utf-8')
  it('App.jsx が TestBuildWatermark を import し無条件配置 (isLoggedIn条件なし)', () => {
    expect(app).toContain("import TestBuildWatermark from './components/TestBuildWatermark'")
    // isLoggedIn && ... の条件付きでない (無条件の <TestBuildWatermark />)
    expect(app).toMatch(/\n\s*<TestBuildWatermark \/>/)
    expect(app).not.toMatch(/isLoggedIn && <TestBuildWatermark/)
  })
})
