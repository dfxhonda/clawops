// @vitest-environment happy-dom
// SPEC-PATROL-ROUTE-AUTO-LOCATE-01 (D-116): 現在地を入場時に自動取得。常設ボタン撤去、失敗時のみ再取得ボタン。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'S1' }) }))
const getLocationMock = vi.fn()
vi.mock('../../shared/hooks/useGeolocation', () => ({ useGeolocation: () => ({ getLocation: getLocationMock }) }))
vi.mock('../../lib/localStore/patrolRoute', () => ({
  saveRouteToday: () => Promise.resolve(),
  loadRouteToday: () => Promise.resolve([]),
}))
const STORES = [{ store_code: 'A', store_name: '甲', lat: 33.5, lng: 130.4, locality_kana: 'アオイ' }]
vi.mock('../../lib/supabase', () => {
  const mk = (data) => { const b = { select: () => b, eq: () => b, then: (cb) => Promise.resolve({ data, error: null }).then(cb) }; return b }
  return { supabase: { from: (t) => t === 'stores' ? mk(STORES) : mk([]), rpc: () => Promise.resolve({ data: [], error: null }) } }
})

const PatrolRoutePage = (await import('../../clawsupport/pages/PatrolRoutePage')).default
const renderPage = () => render(<MemoryRouter><PatrolRoutePage /></MemoryRouter>)

beforeEach(() => { getLocationMock.mockReset() })

describe('AC1: 常設 route-locate ボタン/ステータス撤去', () => {
  it('route-locate testid が存在しない (成功時も再取得ボタンも出ない)', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    renderPage()
    await waitFor(() => expect(getLocationMock).toHaveBeenCalled())
    expect(screen.queryByTestId('route-locate')).toBeNull()
    await waitFor(() => expect(screen.queryByTestId('route-relocate')).toBeNull()) // AC3 成功時は再取得なし
  })
})

describe('AC2: マウント時に getLocation を自動で1回呼ぶ', () => {
  it('render 後 getLocationMock が呼ばれる', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    renderPage()
    await waitFor(() => expect(getLocationMock).toHaveBeenCalledTimes(1))
  })
})

describe('AC4: 取得失敗時のみ再取得ボタン、押下で再取得→成功で消える', () => {
  it('NULL_LOC → route-relocate 描画、click で再取得成功→ボタン消滅', async () => {
    getLocationMock.mockResolvedValueOnce({ lat: null, lng: null, accuracy: null }) // 初回失敗
    renderPage()
    const btn = await screen.findByTestId('route-relocate') // 失敗で出る
    expect(btn).toBeTruthy()
    // 再取得は成功させる
    getLocationMock.mockResolvedValueOnce({ lat: 33.5, lng: 130.4, accuracy: 20 })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.queryByTestId('route-relocate')).toBeNull()) // 成功で消滅
    expect(getLocationMock).toHaveBeenCalledTimes(2)
  })
})

describe('AC5: 再入場のたびに毎回取得が走る', () => {
  it('unmount→再mount で getLocationMock が再度呼ばれる', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    const { unmount } = renderPage()
    await waitFor(() => expect(getLocationMock).toHaveBeenCalledTimes(1))
    unmount()
    renderPage()
    await waitFor(() => expect(getLocationMock).toHaveBeenCalledTimes(2))
  })
})

describe('AC1/AC6: 撤去の grep + 供給側/他呼び出し元 無変更', () => {
  it('PatrolRoutePage に route-locate 不在・route-relocate 実在・マウント自動取得', () => {
    const src = readFileSync(resolve(__dirname, '../../clawsupport/pages/PatrolRoutePage.jsx'), 'utf-8')
    expect(src).not.toContain('route-locate')
    expect(src).toContain('route-relocate')
    expect(src).toMatch(/useEffect\(\(\) => \{[\s\S]*handleLocate\(\(\) => alive\)/) // マウント時自動取得
  })
})
