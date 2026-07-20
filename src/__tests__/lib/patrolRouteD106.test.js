// @vitest-environment happy-dom
// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): 今日の巡回予定の idb 保存/復元 (日付JST・自動破棄)。
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { _resetDb, getDb, STORE_PATROL_ROUTE } from '../../lib/localStore/db'
import { saveRouteToday, loadRouteToday, clearRouteToday, todayJst } from '../../lib/localStore/patrolRoute'

beforeEach(async () => { await _resetDb() })

const items = [
  { store_code: 'A', store_name: '甲', lat: 33.5, lng: 130.4 },
  { store_code: 'B', store_name: '乙', lat: 33.6, lng: 130.5 },
]

describe('AC4: 保存→復元 (同日) / 日付が違えば空 / クリア', () => {
  it('saveRouteToday→loadRouteToday で順序保持復元', async () => {
    await saveRouteToday(items)
    const got = await loadRouteToday()
    expect(got.map(i => i.store_code)).toEqual(['A', 'B'])
  })

  it('stored_date が今日と違えば空リスト (日付変更で自動破棄)', async () => {
    const db = await getDb()
    await db.put(STORE_PATROL_ROUTE, { id: 'today', stored_date: '2000-01-01', items })
    const got = await loadRouteToday()
    expect(got).toEqual([])
  })

  it('保存レコードは stored_date に JST 日付を持つ', async () => {
    await saveRouteToday(items)
    const db = await getDb()
    const rec = await db.get(STORE_PATROL_ROUTE, 'today')
    expect(rec.stored_date).toBe(todayJst())
    expect(rec.stored_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('未保存→空 / clear で消える', async () => {
    expect(await loadRouteToday()).toEqual([])
    await saveRouteToday(items)
    await clearRouteToday()
    expect(await loadRouteToday()).toEqual([])
  })

  it('todayJst は toISOString でなく JST ローカル日付', () => {
    // sv-SE ロケール = YYYY-MM-DD 形式
    expect(todayJst()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
