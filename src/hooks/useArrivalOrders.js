import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COLS = [
  'order_id', 'prize_name_short', 'prize_name_raw', 'supplier_id',
  'expected_date', 'case_count', 'received_quantity', 'is_fully_received',
  'destination', 'status', 'arrived_at', 'unplanned_flag',
].join(', ')

export function useArrivalOrders(destinationFilter) {
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

    if (destinationFilter) {
      q1 = q1.ilike('destination', `%${destinationFilter}%`)
      q2 = q2.ilike('destination', `%${destinationFilter}%`)
      q3 = q3.ilike('destination', `%${destinationFilter}%`)
    }

    const [r1, r2, r3] = await Promise.all([q1, q2, q3])

    setLanes({
      upcoming: r1.data ?? [],
      overdue:  r2.data ?? [],
      recent:   r3.data ?? [],
    })
    setLoading(false)
  }, [destinationFilter])

  useEffect(() => { load() }, [load])

  return { lanes, loading, reload: load }
}
