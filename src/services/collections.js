// J-COLLECTION-01: 集金データアクセス層
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'
import { genCollectionId, boothTotal } from '../collection/lib/collectionCalc'

// is_collected=true のブースを持つ店舗のみ返す
export async function getCollectibleStores() {
  const { data, error } = await supabase
    .from('meter_readings').select('store_code')
    .eq('is_collected', true).eq('entry_type', 'patrol')
  if (error) return { data: null, error }
  const codes = [...new Set((data ?? []).map(r => r.store_code).filter(Boolean))]
  if (codes.length === 0) return { data: [], error: null }
  const { data: stores, error: e2 } = await supabase
    .from('stores').select('store_code, store_name, store_name_official')
    .in('store_code', codes).order('store_name')
  return { data: stores ?? [], error: e2 }
}

// 指定店舗の is_collected=true ブース一覧 (機械名/ブース番号 + メーター prev/current プリフィル)
export async function getCollectibleBooths(storeCode) {
  const { data: flagged, error } = await supabase
    .from('meter_readings')
    .select('booth_code, machine_code, in_meter, out_meter, patrol_date')
    .eq('store_code', storeCode).eq('is_collected', true).eq('entry_type', 'patrol')
  if (error) return { data: null, error }
  const boothCodes = [...new Set((flagged ?? []).map(r => r.booth_code).filter(Boolean))]
  if (boothCodes.length === 0) return { data: [], error: null }

  // prev メーター: 各ブースの直近2件 (current=最新, prev=その前)
  const { data: hist } = await supabase
    .from('meter_readings')
    .select('booth_code, in_meter, out_meter, patrol_date')
    .in('booth_code', boothCodes).eq('entry_type', 'patrol')
    .order('patrol_date', { ascending: false })
  const byBooth = {}
  for (const r of hist ?? []) { (byBooth[r.booth_code] ||= []).push(r) }

  const [{ data: machineData }, { data: boothData }] = await Promise.all([
    supabase.from('machines').select('machine_code, machine_name').eq('store_code', storeCode),
    supabase.from('booths').select('booth_code, booth_number').eq('store_code', storeCode),
  ])
  const mName = Object.fromEntries((machineData ?? []).map(m => [m.machine_code, m.machine_name]))
  const bNum = Object.fromEntries((boothData ?? []).map(b => [b.booth_code, b.booth_number]))

  const rows = (flagged ?? []).map(r => {
    const h = byBooth[r.booth_code] ?? []
    const prev = h[1] ?? {}
    return {
      booth_code: r.booth_code,
      machine_code: r.machine_code,
      machine_name: mName[r.machine_code] || r.machine_code || '機械不明',
      booth_number: bNum[r.booth_code] ?? null,
      in_meter_current: r.in_meter ?? null,
      out_meter_current: r.out_meter ?? null,
      in_meter_prev: prev.in_meter ?? null,
      out_meter_prev: prev.out_meter ?? null,
    }
  }).sort((a, b) =>
    (a.machine_name || '').localeCompare(b.machine_name || '', 'ja') ||
    (a.booth_number ?? 0) - (b.booth_number ?? 0)
  )
  return { data: rows, error: null }
}

// 集金確定保存: cash_collections(confirmed) + cash_collection_booths
export async function saveCollection({ storeCode, collectedAt, collectedBy, booths, counts, notes, staffName }) {
  // 当日連番
  const { count } = await supabase.from('cash_collections')
    .select('collection_id', { count: 'exact', head: true })
    .eq('store_code', storeCode).eq('collected_at', collectedAt)
  const seq = (count ?? 0) + 1
  const collectionId = genCollectionId(storeCode, collectedAt, seq)
  const now = new Date().toISOString()

  const { error: e1 } = await supabase.from('cash_collections').insert({
    collection_id: collectionId,
    store_code: storeCode,
    collected_by: collectedBy || null,
    collected_at: collectedAt,
    status: 'confirmed',
    notes: notes || null,
    organization_id: DFX_ORG_ID,
    created_at: now,
    updated_at: now,
    updated_by: staffName || null,
  })
  if (e1) return { data: null, error: e1 }

  const boothRows = booths.map(b => {
    const c = counts[b.booth_code] || {}
    return {
      id: `${collectionId}-${b.booth_code}`,
      collection_id: collectionId,
      booth_code: b.booth_code,
      machine_code: b.machine_code,
      store_code: storeCode,
      bill_10000: Number(c.bill_10000) || 0,
      bill_5000: Number(c.bill_5000) || 0,
      bill_1000: Number(c.bill_1000) || 0,
      coin_500: Number(c.coin_500) || 0,
      coin_100: Number(c.coin_100) || 0,
      coin_50: Number(c.coin_50) || 0,
      in_meter_prev: b.in_meter_prev,
      in_meter_current: b.in_meter_current,
      out_meter_prev: b.out_meter_prev,
      out_meter_current: b.out_meter_current,
      created_at: now,
    }
  })
  const { error: e2 } = await supabase.from('cash_collection_booths').insert(boothRows)
  if (e2) return { data: null, error: e2 }
  return { data: { collectionId }, error: null }
}

// 履歴一覧 (合計はブース total を集計)
export async function getCollectionHistory() {
  const { data: cols, error } = await supabase.from('cash_collections')
    .select('collection_id, store_code, collected_at, status, collected_by')
    .order('collected_at', { ascending: false })
  if (error) return { data: null, error }
  const ids = (cols ?? []).map(c => c.collection_id)
  let totals = {}
  let storeNames = {}
  if (ids.length) {
    const { data: bts } = await supabase.from('cash_collection_booths')
      .select('collection_id, total').in('collection_id', ids)
    for (const b of bts ?? []) totals[b.collection_id] = (totals[b.collection_id] || 0) + Number(b.total || 0)
    const codes = [...new Set((cols ?? []).map(c => c.store_code))]
    const { data: stores } = await supabase.from('stores').select('store_code, store_name').in('store_code', codes)
    storeNames = Object.fromEntries((stores ?? []).map(s => [s.store_code, s.store_name]))
  }
  const rows = (cols ?? []).map(c => ({
    ...c,
    store_name: storeNames[c.store_code] || c.store_code,
    total: totals[c.collection_id] || 0,
  }))
  return { data: rows, error: null }
}

// PDF再表示用 詳細
export async function getCollectionDetail(collectionId) {
  const { data: col, error } = await supabase.from('cash_collections')
    .select('*').eq('collection_id', collectionId).single()
  if (error) return { data: null, error }
  const { data: booths, error: e2 } = await supabase.from('cash_collection_booths')
    .select('*').eq('collection_id', collectionId)
  if (e2) return { data: null, error: e2 }

  const { data: store } = await supabase.from('stores')
    .select('store_name, store_name_official').eq('store_code', col.store_code).single()
  const codes = [...new Set((booths ?? []).map(b => b.machine_code))]
  const { data: machineData } = await supabase.from('machines')
    .select('machine_code, machine_name').in('machine_code', codes.length ? codes : ['__none__'])
  const mName = Object.fromEntries((machineData ?? []).map(m => [m.machine_code, m.machine_name]))
  const boothRows = (booths ?? []).map(b => ({ ...b, machine_name: mName[b.machine_code] || b.machine_code }))
  return {
    data: { collection: col, store: store ?? {}, booths: boothRows, total: boothRows.reduce((s, b) => s + Number(b.total || 0), 0) },
    error: null,
  }
}

export { boothTotal }
