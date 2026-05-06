import { supabase } from '../../lib/supabase'

// 新規棚卸しセッション作成 + prize_stocks から期待数を自動補填
export async function createSession({ storeCode, sessionName, startDate, staffId }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  // 1. セッション作成
  const { data: session, error } = await supabase
    .from('stocktake_sessions')
    .insert({
      store_code:   storeCode,
      session_name: sessionName || today,
      start_date:   startDate || today,
      status:       'in_progress',
      created_by:   staffId ?? null,
    })
    .select('session_id')
    .single()
  if (error) throw error

  // 2. 店舗の location を特定して prize_stocks から期待数を取得
  try {
    const [{ data: storeRow }, { data: locations }] = await Promise.all([
      supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
      supabase.from('locations').select('location_id, location_name').eq('location_type', 'store'),
    ])
    const storeName = storeRow?.store_name ?? ''
    const matchedLoc = (locations ?? []).find(l =>
      l.location_name.includes(storeName) || storeName.includes(l.location_name)
    ) ?? null

    let stockQuery = supabase.from('prize_stocks').select('prize_id, quantity')
    if (matchedLoc) {
      stockQuery = stockQuery.eq('owner_type', 'location').eq('owner_id', matchedLoc.location_id)
    } else {
      stockQuery = stockQuery.eq('owner_type', 'location').gt('quantity', 0)
    }
    const { data: stocks } = await stockQuery
    if (stocks && stocks.length > 0) {
      await supabase.from('stocktake_items').insert(
        stocks.map(s => ({
          session_id:   session.session_id,
          prize_id:     s.prize_id,
          expected_qty: s.quantity,
        }))
      )
    }
  } catch {
    // アイテム補填失敗はセッション作成を妨げない
  }

  return session.session_id
}

export async function getActiveSessions(storeCode) {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('session_id, session_name, start_date, end_date, status')
    .eq('store_code', storeCode)
    .in('status', ['in_progress', 'submitted'])
    .order('start_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSessionWithItems(sessionId) {
  const [sessionRes, itemsRes] = await Promise.all([
    supabase.from('stocktake_sessions').select('*').eq('session_id', sessionId).single(),
    supabase.from('stocktake_items')
      .select('*, prize:prize_masters(prize_id, prize_name)')
      .eq('session_id', sessionId)
      .order('created_at'),
  ])
  if (sessionRes.error) throw sessionRes.error
  if (itemsRes.error) throw itemsRes.error
  return {
    session: sessionRes.data,
    items: (itemsRes.data ?? []).map(i => ({
      ...i,
      prize_name: i.prize?.prize_name ?? i.prize_id,
    })),
  }
}

export async function updateItem(itemId, actualQty, staffId) {
  const { error } = await supabase.from('stocktake_items').update({
    actual_qty:  actualQty,
    counted_by:  staffId,
    counted_at:  new Date().toISOString(),
  }).eq('item_id', itemId)
  if (error) throw error
}

export async function submitSession(sessionId) {
  const { error } = await supabase.from('stocktake_sessions').update({
    status:       'submitted',
    submitted_at: new Date().toISOString(),
  }).eq('session_id', sessionId)
  if (error) throw error
}

export async function getAllSessions() {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('session_id, session_name, store_code, start_date, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function approveSession(sessionId, staffId) {
  const { error } = await supabase.from('stocktake_sessions').update({
    status:      'approved',
    approved_by: staffId,
    approved_at: new Date().toISOString(),
  }).eq('session_id', sessionId)
  if (error) throw error
}

export async function rejectSession(sessionId, reason) {
  const { error } = await supabase.from('stocktake_sessions').update({
    status:          'rejected',
    rejected_reason: reason,
  }).eq('session_id', sessionId)
  if (error) throw error
}
