import { supabase } from '../../../lib/supabase'

export async function getAllSessions() {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('session_id, session_name, store_code, start_date, end_date, status, created_at, submitted_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function getStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_name')
    .order('store_code')
  if (error) throw error
  return data ?? []
}

export async function getStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createSession({ storeCode, sessionName, startDate, endDate, createdBy, assignees }) {
  const { data: session, error } = await supabase
    .from('stocktake_sessions')
    .insert({ store_code: storeCode, session_name: sessionName, start_date: startDate, end_date: endDate || null, created_by: createdBy })
    .select('session_id')
    .single()
  if (error) throw error

  // Generate stocktake_items from store's prize_stocks
  const { data: locations } = await supabase
    .from('locations')
    .select('location_id, location_name')
    .eq('location_type', 'store')

  const { data: storeRow } = await supabase
    .from('stores').select('store_name').eq('store_code', storeCode).single()
  const storeName = storeRow?.store_name ?? ''

  const matchedLoc = locations?.find(l =>
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

  // Insert assignees
  if (assignees && assignees.length > 0) {
    await supabase.from('stocktake_assignees').insert(
      assignees.map(sid => ({ session_id: session.session_id, staff_id: sid }))
    )
  }

  return session.session_id
}

export async function getSessionDetail(sessionId) {
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
    status:           'rejected',
    rejected_reason:  reason,
  }).eq('session_id', sessionId)
  if (error) throw error
}
