// J-COLLECTION-02: 集金データアクセス層 (J-COLLECTION-01全面置換)
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'
import { genCollectionId, boothTotal } from '../collection/lib/collectionCalc'

// アクティブ店舗 (is_active=true)
export async function getActiveStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_name, store_name_official')
    .eq('is_active', true)
    .order('store_name')
  return { data: data ?? [], error }
}

// 店舗のアクティブブース一覧 + 表示名 + 集金日<=meter_readings 最新プリフィル + 直前confirmed集金からprevプリフィル
// J-COLLECTION-04 fix_1/2/3/4:
//   - rental_code = machine_number ?? '' (NULL=空欄)
//   - booth_name = booth_label ?? `${machine_code末尾}-B{nn}` (例 M04-B02)
//   - in_meter_current_default = patrol_date <= collectedAt の meter_readings最新
//   - in_meter_prev_default    = 当該店舗の直前confirmed cash_collection_booths.in_meter_current
export async function getActiveBoothsForStore(storeCode, collectedAt) {
  const { data: booths, error } = await supabase
    .from('booths')
    .select('booth_code, machine_code, booth_number, booth_label, is_active')
    .eq('store_code', storeCode)
    .eq('is_active', true)
    .order('machine_code')
    .order('booth_code')
  if (error) return { data: null, error }
  if (!booths || booths.length === 0) return { data: [], error: null }

  const boothCodes = booths.map(b => b.booth_code)
  const machineCodes = [...new Set(booths.map(b => b.machine_code))]

  // meter_readings は patrol_date <= collectedAt に限定 (集金日基準)
  let mrQuery = supabase.from('meter_readings')
    .select('booth_code, in_meter, out_meter, patrol_date, created_at')
    .in('booth_code', boothCodes)
    .eq('entry_type', 'patrol')
  if (collectedAt) mrQuery = mrQuery.lte('patrol_date', collectedAt)
  mrQuery = mrQuery.order('patrol_date', { ascending: false }).order('created_at', { ascending: false })

  const [{ data: machines }, { data: readings }, prevMap] = await Promise.all([
    supabase.from('machines').select('machine_code, machine_name, machine_number').in('machine_code', machineCodes),
    mrQuery,
    getLatestConfirmedMeters(storeCode, boothCodes),
  ])
  const mMap = Object.fromEntries((machines ?? []).map(m => [m.machine_code, m]))
  const latestPerBooth = {}
  for (const r of readings ?? []) {
    if (!latestPerBooth[r.booth_code]) latestPerBooth[r.booth_code] = r
  }

  const rows = booths.map(b => {
    const r = latestPerBooth[b.booth_code]
    const m = mMap[b.machine_code] || {}
    const mcTail = b.machine_code?.split('-').pop() ?? b.machine_code
    return {
      booth_code: b.booth_code,
      machine_code: b.machine_code,
      // fix_1: rental_code = machine_number ?? '' (NULL=空欄、表示はboothで補完)
      rental_code: m.machine_number ?? '',
      machine_name: m.machine_name || b.machine_code || '機械不明',
      // fix_2: booth_name = booth_label(上書き優先) ?? `${machine_code末尾}-B{nn}` 例 M04-B02
      booth_name: b.booth_label
        || (b.booth_number != null ? `${mcTail}-B${String(b.booth_number).padStart(2, '0')}` : b.booth_code),
      booth_number: b.booth_number,
      in_meter_current_default: r?.in_meter ?? null,
      out_meter_current_default: r?.out_meter ?? null,
      // fix_3: prev = 当該店舗の直前confirmed cash_collection の in_meter_current
      in_meter_prev_default: prevMap?.[b.booth_code] ?? null,
    }
  })
  return { data: rows, error: null }
}

// J-COLLECTION-04 fix_3: 直前confirmed集金から booth毎の最新 in_meter_current を取得
async function getLatestConfirmedMeters(storeCode, boothCodes) {
  if (!storeCode || !boothCodes || boothCodes.length === 0) return {}
  const { data: cols } = await supabase.from('cash_collections')
    .select('collection_id, collected_at')
    .eq('store_code', storeCode)
    .eq('status', 'confirmed')
    .order('collected_at', { ascending: false })
    .limit(30)
  const ids = (cols ?? []).map(c => c.collection_id)
  if (ids.length === 0) return {}
  const colDate = Object.fromEntries((cols ?? []).map(c => [c.collection_id, c.collected_at]))
  const { data: bts } = await supabase.from('cash_collection_booths')
    .select('collection_id, booth_code, in_meter_current')
    .in('collection_id', ids)
    .in('booth_code', boothCodes)
  const map = {}
  const seenDate = {}
  for (const b of bts ?? []) {
    const d = colDate[b.collection_id]
    if (b.in_meter_current == null) continue
    if (!seenDate[b.booth_code] || (d && d > seenDate[b.booth_code])) {
      seenDate[b.booth_code] = d
      map[b.booth_code] = b.in_meter_current
    }
  }
  return map
}

// 前回集金日選択時: 当該店舗の指定日の集金から各ブースのprevメーターを取得
export async function getPrevCollectionMeters(storeCode, prevDate) {
  if (!storeCode || !prevDate) return { data: {}, error: null }
  const { data: col, error: e1 } = await supabase
    .from('cash_collections')
    .select('collection_id')
    .eq('store_code', storeCode)
    .eq('collected_at', prevDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (e1) return { data: null, error: e1 }
  if (!col) return { data: {}, error: null } // 該当日の集金なし

  const { data: bts, error: e2 } = await supabase
    .from('cash_collection_booths')
    .select('booth_code, in_meter_current, out_meter_current')
    .eq('collection_id', col.collection_id)
  if (e2) return { data: null, error: e2 }

  const map = {}
  for (const b of bts ?? []) {
    map[b.booth_code] = { in_meter_prev: b.in_meter_current, out_meter_prev: b.out_meter_current }
  }
  return { data: map, error: null }
}

// 確定保存 (status=confirmed)。advance_payment / prev_collection_date 対応。
export async function saveCollection({
  storeCode, collectedAt, prevCollectionDate, collectedBy, collectedByName, booths, rowData, notes,
}) {
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
    prev_collection_date: prevCollectionDate || null,
    status: 'confirmed',
    notes: notes || null,
    organization_id: DFX_ORG_ID,
    created_at: now,
    updated_at: now,
    updated_by: collectedByName || null,
  })
  if (e1) return { data: null, error: e1 }

  const boothRows = booths.map(b => {
    const d = rowData[b.booth_code] || {}
    const c = d.counts || {}
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
      in_meter_prev: d.in_meter_prev ?? null,
      in_meter_current: d.in_meter_current === '' || d.in_meter_current == null ? null : Number(d.in_meter_current),
      out_meter_prev: d.out_meter_prev ?? null,
      out_meter_current: d.out_meter_current === '' || d.out_meter_current == null ? null : Number(d.out_meter_current),
      advance_payment: Number(d.advance_payment) || 0,
      notes: d.notes && String(d.notes).trim() !== '' ? String(d.notes).trim() : null,
      created_at: now,
    }
  })
  const { error: e2 } = await supabase.from('cash_collection_booths').insert(boothRows)
  if (e2) return { data: null, error: e2 }
  return { data: { collectionId }, error: null }
}

// 履歴一覧 (CollectionHistoryPage 用、変更なし)
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

// PDF再表示用 詳細 (advance_payment / prev_collection_date 込み)
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
    .select('machine_code, machine_name, machine_number').in('machine_code', codes.length ? codes : ['__none__'])
  const mMap = Object.fromEntries((machineData ?? []).map(m => [m.machine_code, m]))

  // ブース表示名 (booth_label / booth_number) 補完
  const boothCodes = (booths ?? []).map(b => b.booth_code)
  const { data: boothMaster } = await supabase.from('booths')
    .select('booth_code, booth_label, booth_number').in('booth_code', boothCodes.length ? boothCodes : ['__none__'])
  const bName = Object.fromEntries((boothMaster ?? []).map(b => [
    b.booth_code,
    b.booth_label || (b.booth_number != null ? `B${String(b.booth_number).padStart(2, '0')}` : b.booth_code),
  ]))

  const boothRows = (booths ?? []).map(b => {
    const m = mMap[b.machine_code] || {}
    return {
      ...b,
      machine_name: m.machine_name || b.machine_code,
      booth_name: bName[b.booth_code] || b.booth_code,
      // J-COLLECTION-03: rental_code = machine_number ?? machine_code 末尾セグメント
      rental_code: m.machine_number || (b.machine_code?.split('-').pop() ?? b.machine_code),
    }
  })
  const total = boothRows.reduce((s, b) => s + Number(b.total || 0), 0)
  const advanceTotal = boothRows.reduce((s, b) => s + Number(b.advance_payment || 0), 0)
  return {
    data: { collection: col, store: store ?? {}, booths: boothRows, total, advanceTotal },
    error: null,
  }
}

export { boothTotal }
