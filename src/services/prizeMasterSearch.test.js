// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { server } from '../__tests__/msw/server'
import { http, HttpResponse } from 'msw'
import { searchPrizeMasters } from './prizeMasterSearch'

const BASE = 'http://localhost:54321'

const MOCK_RESULTS = [
  {
    prize_id: 'PM-001',
    prize_name: 'ラブブBOX',
    prize_name_kana: 'ラブブボックス',
    aliases: null,
    short_name: 'ラブブ',
    original_cost: 2500,
  },
  {
    prize_id: 'PM-002',
    prize_name: 'ラブブリング',
    prize_name_kana: null,
    aliases: null,
    short_name: null,
    original_cost: 1200,
  },
]

describe('searchPrizeMasters', () => {
  it('キーワードが2文字以下は空配列を返す（ネットワーク不要）', async () => {
    const spy = { called: false }
    server.use(
      http.get(`${BASE}/rest/v1/prize_masters`, () => {
        spy.called = true
        return HttpResponse.json([])
      }),
    )
    expect(await searchPrizeMasters('')).toEqual([])
    expect(await searchPrizeMasters('ラ')).toEqual([])
    expect(await searchPrizeMasters('ラブ')).toEqual([])
    expect(spy.called).toBe(false)
  })

  it('3文字以上でSupabaseを呼び結果を返す', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/prize_masters`, () =>
        HttpResponse.json(MOCK_RESULTS),
      ),
    )
    const result = await searchPrizeMasters('ラブブ')
    expect(result).toHaveLength(2)
    expect(result[0].prize_id).toBe('PM-001')
    expect(result[0].prize_name).toBe('ラブブBOX')
    expect(result[0].original_cost).toBe(2500)
  })

  it('前後の空白をトリムして3文字判定する', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/prize_masters`, () =>
        HttpResponse.json(MOCK_RESULTS),
      ),
    )
    const result = await searchPrizeMasters('  ラブブ  ')
    expect(result).toHaveLength(2)
  })

  it('3文字丁度もトリム後2文字なら空配列', async () => {
    const spy = { called: false }
    server.use(
      http.get(`${BASE}/rest/v1/prize_masters`, () => {
        spy.called = true
        return HttpResponse.json([])
      }),
    )
    expect(await searchPrizeMasters(' ラブ ')).toEqual([])
    expect(spy.called).toBe(false)
  })

  it('ネットワークエラー時は空配列を返す', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/prize_masters`, () =>
        HttpResponse.json({ message: 'DB error' }, { status: 500 }),
      ),
    )
    const result = await searchPrizeMasters('ラブブ')
    expect(result).toEqual([])
  })

  it('結果0件でも空配列を返す（nullではない）', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/prize_masters`, () =>
        HttpResponse.json([]),
      ),
    )
    const result = await searchPrizeMasters('zzz')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
  })
})
