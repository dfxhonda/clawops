// M2 Stage 1: 管理側 API を新スキーマにアダプタ
// 旧 store_code/session_name ベースは廃止

import { supabase } from '../../../lib/supabase'

const DFX_ORG_ID = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'

export async function getAllSessions(organizationId = DFX_ORG_ID) {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('session_id, month, status, created_at, locked_at')
    .eq('organization_id', organizationId)
    .order('month', { ascending: false })
    .limit(24)
  if (error) throw error
  return data ?? []
}

export async function getSessionDetail(sessionId) {
  const [sessionRes, itemsRes] = await Promise.all([
    supabase.from('stocktake_sessions').select('*').eq('session_id', sessionId).single(),
    supabase
      .from('stocktake_items')
      .select('*, prize:prize_masters(prize_name)')
      .eq('session_id', sessionId)
      .order('owner_type')
      .order('owner_code'),
  ])
  if (sessionRes.error) throw sessionRes.error
  if (itemsRes.error)   throw itemsRes.error
  return {
    session: sessionRes.data,
    items: (itemsRes.data ?? []).map(i => ({
      ...i,
      prize_name: i.prize?.prize_name ?? i.prize_id,
    })),
  }
}

export async function approveSession(sessionId) {
  const { error } = await supabase
    .from('stocktake_sessions')
    .update({ status: 'approved' })
    .eq('session_id', sessionId)
  if (error) throw error
}

export async function lockSession(sessionId) {
  const { error } = await supabase
    .from('stocktake_sessions')
    .update({ status: 'locked', locked_at: new Date().toISOString() })
    .eq('session_id', sessionId)
  if (error) throw error
}
