// getOrCreateMonthSession: Supabase を直接呼ぶ API レイヤー。
// MSW でネットワーク層をインターセプト。
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { server } from '../msw/server'
import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:54321'

import { getOrCreateMonthSession } from '../../tanasupport/stocktake/api'

const ORG_ID = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'

const MOCK_SESSION = {
  session_id: 'sess-test-001',
  month: '2026-05-01',
  status: 'open',
}

describe('getOrCreateMonthSession', () => {
  it('既存セッションがあれば返す', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/stocktake_sessions`, () =>
        HttpResponse.json([MOCK_SESSION])
      ),
    )

    const result = await getOrCreateMonthSession(ORG_ID)
    expect(result.session_id).toBe('sess-test-001')
    expect(result.status).toBe('open')
  })

  it('既存セッションがない場合は新規作成する', async () => {
    let insertCalled = false

    server.use(
      http.get(`${BASE}/rest/v1/stocktake_sessions`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('pgrst.object')) {
          return HttpResponse.json(null, { status: 404 })
        }
        return HttpResponse.json([])
      }),
      http.post(`${BASE}/rest/v1/stocktake_sessions`, () => {
        insertCalled = true
        return HttpResponse.json(
          [{ ...MOCK_SESSION, session_id: 'sess-new-001' }],
          { status: 201 }
        )
      }),
    )

    const result = await getOrCreateMonthSession(ORG_ID)
    expect(result).toBeDefined()
    expect(insertCalled).toBe(true)
  })

  it('INSERT が失敗したとき throw する', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/stocktake_sessions`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('pgrst.object')) {
          return HttpResponse.json(null, { status: 404 })
        }
        return HttpResponse.json([])
      }),
      http.post(`${BASE}/rest/v1/stocktake_sessions`, () =>
        HttpResponse.json({ message: 'DB error', code: '23505' }, { status: 409 })
      ),
    )

    await expect(getOrCreateMonthSession(ORG_ID)).rejects.toThrow()
  })
})
