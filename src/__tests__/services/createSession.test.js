// createSession は Supabase を直接呼ぶ API レイヤー。
// MSW でネットワーク層をインターセプトしてリアルな API テストを行う。
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import { server } from '../msw/server'
import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:54321'

import { createSession } from '../../tanasupport/stocktake/api'

const ARGS = {
  storeCode: 'TEST01',
  sessionName: '2026-05-05',
  startDate: '2026-05-05',
  staffId: 'staff-test-001',
}

describe('createSession', () => {
  beforeEach(() => {
    // 各テストの前にハンドラーをデフォルト状態（handlers.js）にリセット
  })

  it('正常系: session_id を返す', async () => {
    const sessionId = await createSession(ARGS)
    expect(sessionId).toBe('sess-test-001')
  })

  it('prize_stocks が空でもセッション作成に成功する', async () => {
    // デフォルトの prize_stocks ハンドラーは [] を返す
    const sessionId = await createSession(ARGS)
    expect(typeof sessionId).toBe('string')
    expect(sessionId.length).toBeGreaterThan(0)
  })

  it('prize_stocks があるとき stocktake_items に投入する', async () => {
    let itemsInserted = false

    server.use(
      // stocks あり
      http.get(`${BASE}/rest/v1/prize_stocks`, () => {
        return HttpResponse.json([
          { prize_id: 'prize-001', quantity: 5 },
          { prize_id: 'prize-002', quantity: 3 },
        ])
      }),
      // items INSERT が呼ばれたか確認
      http.post(`${BASE}/rest/v1/stocktake_items`, () => {
        itemsInserted = true
        return new HttpResponse(null, { status: 201 })
      }),
    )

    await createSession(ARGS)
    expect(itemsInserted).toBe(true)
  })

  it('stocktake_items の投入が失敗してもセッションIDを返す（非致命的）', async () => {
    server.use(
      // stocks あり（investは呼ばれる）
      http.get(`${BASE}/rest/v1/prize_stocks`, () => {
        return HttpResponse.json([{ prize_id: 'prize-001', quantity: 5 }])
      }),
      // items INSERT が 500 エラー
      http.post(`${BASE}/rest/v1/stocktake_items`, () => {
        return HttpResponse.json({ message: 'DB error' }, { status: 500 })
      }),
    )

    // エラーがスローされない
    const sessionId = await createSession(ARGS)
    expect(sessionId).toBe('sess-test-001')
  })

  it('session INSERT が失敗したとき throw する', async () => {
    server.use(
      http.post(`${BASE}/rest/v1/stocktake_sessions`, () => {
        return HttpResponse.json({ message: 'DB error', code: '23505' }, { status: 409 })
      }),
    )

    await expect(createSession(ARGS)).rejects.toThrow()
  })

  it('location にマッチしたとき、その location_id で prize_stocks を絞り込む', async () => {
    let capturedUrl = null

    server.use(
      http.get(`${BASE}/rest/v1/locations`, () => {
        return HttpResponse.json([
          { location_id: 'loc-001', location_name: 'テスト店舗' },
        ])
      }),
      http.get(`${BASE}/rest/v1/stores`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('pgrst.object')) {
          return HttpResponse.json({ store_name: 'テスト店舗' })
        }
        return HttpResponse.json([{ store_name: 'テスト店舗', store_code: 'TEST01', is_active: true }])
      }),
      http.get(`${BASE}/rest/v1/prize_stocks`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    await createSession(ARGS)

    // owner_id=loc-001 で絞り込まれているか確認
    expect(capturedUrl).toContain('owner_id=eq.loc-001')
  })
})
