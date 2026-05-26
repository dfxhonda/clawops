// @vitest-environment happy-dom
// J-INFRA-DUAL-TRACK-LOGIN-01: 安定版/テスト版 選択画面
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

let sessionData = { session: { access_token: 'AT', refresh_token: 'RT' } }
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: sessionData })) } },
}))

beforeEach(() => {
  navigateMock.mockClear()
  cleanup()
})

async function load() {
  const mod = await import('./DualTrackSelectPage')
  return mod.default
}

describe('DualTrackSelectPage', () => {
  it('VITE_TEST_TRACK_URL 設定時は2ボタン表示', async () => {
    vi.stubEnv('VITE_TEST_TRACK_URL', 'https://test.example.app')
    vi.resetModules()
    const Page = await load()
    render(<Page />)
    expect(screen.getByText('安定版で続ける')).toBeInTheDocument()
    expect(screen.getByText('テスト版を使う')).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('安定版ボタンで /launcher へ navigate', async () => {
    vi.stubEnv('VITE_TEST_TRACK_URL', 'https://test.example.app')
    vi.resetModules()
    const Page = await load()
    render(<Page />)
    await userEvent.click(screen.getByText('安定版で続ける'))
    expect(navigateMock).toHaveBeenCalledWith('/launcher', { replace: true })
    vi.unstubAllEnvs()
  })

  it('VITE_TEST_TRACK_URL 未設定時は選択画面を出さず /launcher へリダイレクト', async () => {
    vi.stubEnv('VITE_TEST_TRACK_URL', '')
    vi.resetModules()
    const Page = await load()
    render(<Page />)
    expect(navigateMock).toHaveBeenCalledWith('/launcher', { replace: true })
    expect(screen.queryByText('テスト版を使う')).not.toBeInTheDocument()
    vi.unstubAllEnvs()
  })
})
