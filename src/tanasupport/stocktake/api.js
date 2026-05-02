import { supabase } from '../../lib/supabase'

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
