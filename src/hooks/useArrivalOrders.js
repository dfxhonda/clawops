import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// J-STOCK-OWNER-FILTER-01 (司令塔Opus spec):
// COLS に location_id を追加 (Phase1 名寄せ済 列を取得)。J-SCHEMA-DROP-FIX-01: zone_id / size_id は削除済のため除外。
// 第1引数 locationId: 拠点 eq 絞り (場所ハブから来た owner_id)、null/undefined = 全件
// 第2引数 textFilter: 入庫先 free-text ilike 絞り (locationId と併用可能)
// レーン判定ロジック (upcoming/overdue/recent の status + 日付条件) は spec forbidden、変更なし。
const COLS = [
  'prize_id', 'order_id', 'prize_name_short', 'prize_name_raw', 'supplier_id',
  'expected_date', 'case_count', 'received_quantity', 'is_fully_received',
  'destination', 'status', 'arrived_at', 'unplanned_flag',
  // J-SCHEMA-DROP-FIX-01: zone_id / size_id 列は DB から削除済、COLS から除外。
  'location_id',
].join(', ')

export function useArrivalOrders(locationId, textFilter) {
  const [lanes, setLanes]   = useState({ upcoming: [], overdue: [], recent: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const now   = new Date()
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    const d7    = new Date(now); d7.setDate(d7.getDate() - 7)
    const d14   = new Date(now); d14.setDate(d14.getDate() - 14)
    const overdue7 = d7.toLocaleDateString('sv-SE',  { timeZone: 'Asia/Tokyo' })
    const recent14 = d14.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

    setLoading(true)

    let q1 = supabase.from('prize_orders').select(COLS)
      .in('status', ['ordered', 'shipped', 'partial'])
      .gte('expected_date', today)
      .order('expected_date', { ascending: true })
    let q2 = supabase.from('prize_orders').select(COLS)
      .in('status', ['shipped', 'partial'])
      .lt('expected_date', overdue7)
      .order('expected_date', { ascending: true })
    let q3 = supabase.from('prize_orders').select(COLS)
      .in('status', ['arrived', 'partial'])
      .gte('arrived_at', recent14 + 'T00:00:00+09:00')
      .order('arrived_at', { ascending: false })

    if (locationId) {
      q1 = q1.eq('location_id', locationId)
      q2 = q2.eq('location_id', locationId)
      q3 = q3.eq('location_id', locationId)
    }
    if (textFilter) {
      q1 = q1.ilike('destination', `%${textFilter}%`)
      q2 = q2.ilike('destination', `%${textFilter}%`)
      q3 = q3.ilike('destination', `%${textFilter}%`)
    }

    const [r1, r2, r3] = await Promise.all([q1, q2, q3])

    setLanes({
      upcoming: r1.data ?? [],
      overdue:  r2.data ?? [],
      recent:   r3.data ?? [],
    })
    setLoading(false)
  }, [locationId, textFilter])

  useEffect(() => { load() }, [load])

  return { lanes, loading, reload: load }
}
