import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

export function getOrCreateDeviceId() {
  let id = localStorage.getItem('round0_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('round0_device_id', id)
  }
  return id
}

export async function fetchStarStaff(allStaff) {
  const deviceId = getOrCreateDeviceId()
  const { data, error } = await supabase
    .from('device_login_history')
    .select('staff_id, last_login_at')
    .eq('organization_id', DFX_ORG_ID)
    .eq('device_id', deviceId)
    .order('last_login_at', { ascending: false })
    .limit(7)
  if (error || !data?.length) return []
  const staffMap = Object.fromEntries(allStaff.map(s => [s.staff_id, s]))
  return data.map(h => staffMap[h.staff_id]).filter(Boolean)
}

export async function upsertLoginHistory(staffId) {
  const deviceId = getOrCreateDeviceId()
  await supabase
    .from('device_login_history')
    .upsert({
      organization_id: DFX_ORG_ID,
      device_id: deviceId,
      staff_id: staffId,
      last_login_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,device_id,staff_id',
    })
}
