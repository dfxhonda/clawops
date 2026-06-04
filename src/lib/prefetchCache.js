import { supabase } from './supabase'

const TTL_MS = 60000
const _cache = new Map()

export async function startPrefetch(staffId) {
  if (!staffId) return
  const entry = {
    stores: [], machines: [], booths: [], booth_alerts: [], staff_stores: [],
    fetched_at: Date.now(),
    ready: false,
  }
  _cache.set(staffId, entry)
  try {
    const [storesRes, machinesRes, boothsRes, alertsRes, staffStoresRes] = await Promise.all([
      supabase.from('stores').select('store_code,store_name'),
      supabase.from('machines').select('machine_code,machine_name'),
      supabase.from('booths').select('booth_code,booth_number'),
      supabase.from('booth_alerts')
        .select('*, alert_types(label, icon_emoji, color_hex)')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('staff_stores').select('store_code').eq('staff_id', staffId),
    ])
    entry.stores = storesRes.data || []
    entry.machines = machinesRes.data || []
    entry.booths = boothsRes.data || []
    entry.booth_alerts = alertsRes.data || []
    entry.staff_stores = staffStoresRes.data || []
    entry.ready = true
  } catch {
    // ready stays false; Launcher falls back to normal fetch
  }
}

export function getCache(staffId) {
  if (!staffId) return null
  const entry = _cache.get(staffId)
  if (!entry) return null
  if (Date.now() - entry.fetched_at > TTL_MS) {
    _cache.delete(staffId)
    return null
  }
  return entry
}

export function clearCache() {
  _cache.clear()
}
