export const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

// 在庫移動の種類
export const MOVEMENT_TYPES = {
  TRANSFER: 'transfer',   // 拠点間・担当者間の移管
  ARRIVAL: 'arrival',     // 外部からの入庫
  REPLENISH: 'replenish', // 担当車→ブースへの補充
  COUNT: 'count',         // 棚卸し確認（差異なし）
  ADJUST: 'adjust',       // 棚卸し調整（差異あり）
}
const TOKEN_KEY = 'gapi_token'

export function getToken() { return sessionStorage.getItem(TOKEN_KEY) }
export function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { sessionStorage.removeItem(TOKEN_KEY) }

export function parseNum(v) {
  if (v === undefined || v === null || v === '') return NaN
  return Number(String(v).replace(/,/g, ''))
}

const cache = {}
function getCache(key) { return cache[key] }
function setCache(key, val) { cache[key] = val }
export function clearCache() { Object.keys(cache).forEach(k => delete cache[k]) }

function isOldEnough(readTime) {
  if (!readTime) return false
  const d = new Date(readTime)
  if (isNaN(d)) return false
  return d < new Date(Date.now() - 24 * 60 * 60 * 1000)
}

export async function sheetsGet(range) {
  const token = getToken()
  if (!token) {
    window.location.href = '/login'
    throw new Error('認証トークンがありません')
  }
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('認証が切れました。再ログインしてください')
  }
  if (!res.ok) throw new Error('Sheets API error: ' + res.status)
  return (await res.json()).values || []
}

async function sheetsAppend(range, values) {
  const token = getToken()
  if (!token) {
    window.location.href = '/login'
    throw new Error('認証トークンがありません')
  }
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }) }
  )
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('認証が切れました。再ログインしてください')
  }
  if (!res.ok) throw new Error('Sheets append error: ' + res.status)
  return res.json()
}

export async function sheetsPut(range, values) {
  const token = getToken()
  if (!token) {
    window.location.href = '/login'
    throw new Error('認証トークンがありません')
  }
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }) }
  )
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('認証が切れました。再ログインしてください')
  }
  if (!res.ok) throw new Error('Sheets PUT error: ' + res.status)
  return res.json()
}

export async function sheetsBatchUpdate(requests) {
  const token = getToken()
  if (!token) {
    window.location.href = '/login'
    throw new Error('認証トークンがありません')
  }
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }) }
  )
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('認証が切れました。再ログインしてください')
  }
  if (!res.ok) throw new Error('Sheets batchUpdate error: ' + res.status)
  return res.json()
}

export async function getAllMeterReadings(forceRefresh = false) {
  if (!forceRefresh && getCache('meter_readings')) return getCache('meter_readings')
  const rows = await sheetsGet('meter_readings!A1:U')
  if (rows.length === 0) return []

  // ヘッダー行でインデックス解決
  const header = rows[0].map(h => String(h).trim().toLowerCase())
  const col = name => header.indexOf(name)
  const iBoothId   = col('booth_id')
  const iFullCode  = col('full_booth_code')
  const iReadTime  = col('read_time')
  const iInMeter   = col('in_meter')
  const iOutMeter  = col('out_meter')
  const iRestock   = col('prize_restock_count')
  const iStock     = col('prize_stock_count')
  const iPrizeName = col('prize_name')
  const iSetA      = col('set_a')
  const iSetC      = col('set_c')
  const iSetL      = col('set_l')
  const iSetR      = col('set_r')
  const iSetO      = col('set_o')

  const result = rows.slice(1)
    .filter(r => {
      const bid = iBoothId >= 0 ? r[iBoothId] : undefined
      return bid !== undefined && bid !== null && String(bid).trim() !== ''
    })
    .map(r => ({
      booth_id:            String(r[iBoothId]).trim(),
      full_booth_code:     iFullCode  >= 0 ? (r[iFullCode]  || '') : '',
      read_time:           iReadTime  >= 0 ? (r[iReadTime]  || '') : '',
      in_meter:            iInMeter   >= 0 ? (r[iInMeter]   || '') : '',
      out_meter:           iOutMeter  >= 0 ? (r[iOutMeter]  || '') : '',
      prize_restock_count: iRestock   >= 0 ? (r[iRestock]   || '') : '',
      prize_stock_count:   iStock     >= 0 ? (r[iStock]     || '') : '',
      prize_name:          iPrizeName >= 0 ? (r[iPrizeName] || '') : '',
      set_a:               iSetA      >= 0 ? (r[iSetA]      || '') : '',
      set_c:               iSetC      >= 0 ? (r[iSetC]      || '') : '',
      set_l:               iSetL      >= 0 ? (r[iSetL]      || '') : '',
      set_r:               iSetR      >= 0 ? (r[iSetR]      || '') : '',
      set_o:               iSetO      >= 0 ? (r[iSetO]      || '') : '',
    }))

  setCache('meter_readings', result)
  return result
}

export async function getReadingsByBooth(boothId) {
  const all = await getAllMeterReadings()
  return all.filter(r => String(r.booth_id) === String(boothId))
}

export async function getLastReading(boothId) {
  const rows = await getReadingsByBooth(boothId)
  const old = [...rows].reverse().find(r => isOldEnough(r.read_time))
  return old || null
}

export async function getLastReadingsMap(boothIds) {
  const all = await getAllMeterReadings()
  const map = {}
  for (const id of boothIds) {
    const rows = all.filter(r => String(r.booth_id) === String(id))
    const latest = rows.length ? rows[rows.length - 1] : null
    const last = [...rows].reverse().find(r => isOldEnough(r.read_time)) || null
    map[id] = { latest, last }
  }
  return map
}

export async function getStores() {
  if (getCache('stores')) return getCache('stores')
  const rows = await sheetsGet('stores!A2:N')
  const result = rows
    .map(r => ({ store_id:r[0], store_code:r[1], store_name:r[2], active_flag:r[10] }))
    .filter(s => s.active_flag == 1 && s.store_code !== 'SIM01')
  setCache('stores', result)
  return result
}

export async function getMachines(storeId) {
  const ckey = `machines_${storeId}`
  if (getCache(ckey)) return getCache(ckey)
  const rows = await sheetsGet('machines!A2:M')
  const result = rows
    .filter(r => String(r[1]) === String(storeId) && String(r[12]) === '1')
    .map(r => ({
      machine_id:      r[0],
      store_id:        r[1],
      machine_code:    r[2],
      machine_name:    r[3],
      machine_model:   r[4],
      machine_type:    r[5],
      booth_count:     r[6],
      default_price:   parseNum(r[7] || '100'),
      meter_layout:    r[8],
      rental_code:     r[9],
      monthly_advance: parseNum(r[10] || '0'),
      location_note:   r[11],
      active_flag:     r[12],
    }))
  setCache(ckey, result)
  return result
}

export async function getBooths(machineId) {
  const ckey = `booths_${machineId}`
  if (getCache(ckey)) return getCache(ckey)
  const rows = await sheetsGet('booths!A2:K')
  const result = rows
    .filter(r => String(r[1]) === String(machineId) && String(r[10]) === '1')
    .map(r => ({ booth_id:r[0], machine_id:r[1], booth_code:r[2], booth_number:r[3],
      full_booth_code:r[5], meter_in_digit:r[6], meter_out_digit:r[7], play_price:r[9] }))
  setCache(ckey, result)
  return result
}

export async function saveReading(r) {
  const now = r.read_date ? new Date(r.read_date + "T12:00:00").toISOString() : new Date().toISOString()
  await sheetsAppend('meter_readings!A:U', [[
    'R'+Date.now(), r.booth_id, r.full_booth_code, now,
    r.in_meter, r.out_meter||'', r.prize_restock_count||'',
    r.prize_stock_count||'', r.prize_name||'', 'manual','','', r.note||'', now,
    r.set_a||'', r.set_c||'', r.set_l||'', r.set_r||'', r.set_o||''
  ]])
  clearCache()
}

export async function findBoothByCode(fullBoothCode) {
  const rows = await sheetsGet('booths!A2:K')
  const booth = rows.find(r => String(r[5]).trim() === String(fullBoothCode).trim() && String(r[10]) === '1')
  if (!booth) return null
  return {
    booth_id: booth[0], machine_id: booth[1], booth_code: booth[2], booth_number: booth[3],
    full_booth_code: booth[5], meter_in_digit: booth[6], meter_out_digit: booth[7], play_price: booth[9]
  }
}

export async function findMachineById(machineId) {
  const rows = await sheetsGet('machines!A2:M')
  const m = rows.find(r => String(r[0]) === String(machineId))
  if (!m) return null
  return { machine_id: m[0], store_id: m[1], machine_code: m[2], machine_name: m[3] }
}

export async function findStoreById(storeId) {
  const stores = await getStores()
  return stores.find(s => String(s.store_id) === String(storeId)) || null
}

export async function updateReading(rowIndex, r) {
  const range = `meter_readings!E${rowIndex}:I${rowIndex}`
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[r.in_meter, r.out_meter, r.prize_restock_count, r.prize_stock_count, r.prize_name]] }) }
  )
  clearCache()
}

// ============================================
// 店舗管理 CRUD
// ============================================
export async function getAllStoresRaw() {
  const rows = await sheetsGet('stores!A2:N')
  return rows.map((r, i) => ({
    _row: i + 2,
    store_id: r[0]||'', store_code: r[1]||'', store_name: r[2]||'',
    store_address: r[3]||'', store_tel: r[4]||'',
    accounting_contact_name: r[5]||'', accounting_contact_tel: r[6]||'',
    settlement_cycle: r[7]||'',
    contract_rate_store: r[8]||'', contract_rate_fc: r[9]||'',
    active_flag: r[10]||'', note: r[11]||'',
    created_at: r[12]||'', updated_at: r[13]||'',
  }))
}

export async function addStore(s) {
  const now = new Date().toISOString()
  const id = 'S' + Date.now()
  await sheetsAppend('stores!A:N', [[
    id, s.store_code, s.store_name, s.store_address||'', s.store_tel||'',
    s.accounting_contact_name||'', s.accounting_contact_tel||'',
    s.settlement_cycle||'月次', s.contract_rate_store||'70', s.contract_rate_fc||'20',
    '1', s.note||'', now, now
  ]])
  clearCache()
  return id
}

export async function updateStore(rowNum, s) {
  const now = new Date().toISOString()
  await sheetsPut(`stores!B${rowNum}:N${rowNum}`, [[
    s.store_code, s.store_name, s.store_address||'', s.store_tel||'',
    s.accounting_contact_name||'', s.accounting_contact_tel||'',
    s.settlement_cycle||'', s.contract_rate_store||'', s.contract_rate_fc||'',
    s.active_flag||'1', s.note||'', s.created_at||'', now
  ]])
  clearCache()
}

// ============================================
// 機械管理 CRUD
// ============================================
export async function getAllMachinesRaw(storeId) {
  const rows = await sheetsGet('machines!A2:M')
  return rows
    .map((r, i) => ({
      _row: i + 2,
      machine_id: r[0]||'', store_id: r[1]||'', machine_code: r[2]||'',
      machine_name: r[3]||'', machine_model: r[4]||'', machine_type: r[5]||'',
      booth_count: r[6]||'', default_price: r[7]||'100',
      meter_layout: r[8]||'', rental_code: r[9]||'',
      monthly_advance: r[10]||'0', location_note: r[11]||'',
      active_flag: r[12]||'',
    }))
    .filter(m => !storeId || String(m.store_id) === String(storeId))
}

export async function addMachine(m) {
  const now = new Date().toISOString()
  const id = 'M' + Date.now()
  await sheetsAppend('machines!A:M', [[
    id, m.store_id, m.machine_code, m.machine_name||'', m.machine_model||'',
    m.machine_type||'', m.booth_count||'1', m.default_price||'100',
    m.meter_layout||'', m.rental_code||'', m.monthly_advance||'0',
    m.location_note||'', '1'
  ]])
  // 自動ブース生成
  const count = parseInt(m.booth_count) || 1
  for (let i = 1; i <= count; i++) {
    const bc = `B${String(i).padStart(2,'0')}`
    const storeCode = m.store_code || ''
    const fullCode = `${storeCode}-${m.machine_code}-${bc}`
    await sheetsAppend('booths!A:K', [[
      'BT' + Date.now() + i, id, bc, String(i), '',
      fullCode, '7', '7', '', m.default_price||'100', '1'
    ]])
  }
  clearCache()
  return id
}

export async function updateMachine(rowNum, m) {
  await sheetsPut(`machines!B${rowNum}:M${rowNum}`, [[
    m.store_id, m.machine_code, m.machine_name||'', m.machine_model||'',
    m.machine_type||'', m.booth_count||'', m.default_price||'100',
    m.meter_layout||'', m.rental_code||'', m.monthly_advance||'0',
    m.location_note||'', m.active_flag||'1'
  ]])
  clearCache()
}

// ============================================
// 景品管理 CRUD
// ============================================
// Supabase接続（景品マスタ・発注履歴）
// ============================================
import { supabase } from '../lib/supabase'

const SUPPLIER_MAP = {
  SGP: '景品フォーム', PCH: 'ピーチトイ', SDY: 'エスディーワイ',
  INF: 'インフィニティ', AXS: 'アクシズ', LNS: 'LINE仕入先', MCR: 'メルカリ',
}

function supName(id) { return SUPPLIER_MAP[id] || id || '' }

// --- 仕入先 ---
export async function getSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('supplier_id, supplier_name').order('supplier_name')
  if (error) throw new Error('仕入先取得エラー: ' + error.message)
  return data || []
}

// --- 景品マスタ (Supabase) ---
export async function getPrizes() {
  if (getCache('prizes')) return getCache('prizes')
  const { data, error } = await supabase.from('prize_masters').select('*').order('prize_id')
  if (error) throw new Error('景品取得エラー: ' + error.message)
  const result = (data || []).map(r => ({
    _id: r.prize_id,
    prize_id: r.prize_id, prize_name: r.prize_name, jan_code: r.jan_code || '',
    barcode_value: r.jan_code || '', unit_cost: String(r.original_cost || '0'),
    supplier_name: supName(r.supplier_id), supplier_id: r.supplier_id || '',
    supplier_contact: '', is_active: r.status === 'active' ? 'TRUE' : 'FALSE',
    created_at: r.created_at || '', updated_at: r.updated_at || '',
    short_name: r.prize_name || '', item_size: r.size || '', category: r.category || '',
    order_at: r.order_date || '', arrival_at: r.expected_date || '',
    restock_count: '', stock_count: '',
    case_count: '', pieces_per_case: String(r.default_case_quantity || ''),
    aliases: r.aliases || '', notes: r.notes || '',
  }))
  setCache('prizes', result)
  return result
}

export async function addPrize(p) {
  const supEntry = Object.entries(SUPPLIER_MAP).find(([, v]) => v === p.supplier_name)
  const supId = supEntry ? supEntry[0] : p.supplier_id || null
  const { data, error } = await supabase.from('prize_masters').insert({
    prize_id: p.prize_id || undefined,
    prize_name: p.prize_name,
    original_cost: parseInt(p.unit_cost) || 0,
    supplier_id: supId,
    supplier_name: p.supplier_name || null,
    jan_code: p.jan_code || null,
    category: p.category || null,
    size: p.item_size || null,
    default_case_quantity: parseInt(p.pieces_per_case) || null,
    status: p.is_active === 'FALSE' ? 'inactive' : 'active',
    notes: p.notes || null,
  }).select().single()
  if (error) throw new Error('景品登録エラー: ' + error.message)
  clearCache()
  return data.prize_id
}

export async function addPrizesBatch(items) {
  const rows = items.map(p => {
    const supEntry = Object.entries(SUPPLIER_MAP).find(([, v]) => v === p.supplier_name)
    return {
      prize_name: p.prize_name,
      original_cost: parseInt(p.unit_cost) || 0,
      supplier_id: supEntry ? supEntry[0] : null,
      supplier_name: p.supplier_name || null,
      jan_code: p.jan_code || null,
      category: p.category || null,
      status: p.is_active === 'FALSE' ? 'inactive' : 'active',
    }
  })
  const { error } = await supabase.from('prize_masters').insert(rows)
  if (error) throw new Error('一括登録エラー: ' + error.message)
  clearCache()
  return rows.length
}

export async function updatePrize(prizeId, p) {
  const supEntry = Object.entries(SUPPLIER_MAP).find(([, v]) => v === p.supplier_name)
  const supId = supEntry ? supEntry[0] : p.supplier_id || null
  const { error } = await supabase.from('prize_masters').update({
    prize_name: p.prize_name,
    original_cost: parseInt(p.unit_cost) || 0,
    supplier_id: supId,
    supplier_name: p.supplier_name || null,
    jan_code: p.jan_code || null,
    category: p.category || null,
    size: p.item_size || null,
    default_case_quantity: parseInt(p.pieces_per_case) || null,
    status: p.is_active === 'FALSE' ? 'inactive' : 'active',
    notes: p.notes || null,
    updated_at: new Date().toISOString(),
  }).eq('prize_id', prizeId)
  if (error) throw new Error('景品更新エラー: ' + error.message)
  clearCache()
}

// --- 発注履歴 (Supabase) ---
export async function getPrizeOrders() {
  if (getCache('prize_orders')) return getCache('prize_orders')
  const { data, error } = await supabase.from('prize_orders').select('*').order('order_date', { ascending: false })
  if (error) throw new Error('発注取得エラー: ' + error.message)
  const result = (data || []).map(r => ({
    _id: r.order_id,
    order_id: r.order_id, prize_id: r.prize_id || '', prize_name: r.prize_name_raw || '',
    ordered_at: r.order_date || '', order_quantity: String(r.case_quantity || ''),
    arrived_at: r.arrived_at || '', arrival_quantity: String(r.received_quantity || ''),
    unit_cost_at_order: String(r.unit_cost || '0'),
    total_cost: String((r.unit_cost || 0) * (r.case_quantity || 0)),
    note: r.notes || '', created_at: r.created_at || '',
    supplier_name: supName(r.supplier_id),
    status: r.status || '',
    case_count: String(r.case_count || ''),
    case_cost: String(r.case_cost || ''),
    expected_date: r.expected_date || '',
    destination: r.destination || '',
  }))
  setCache('prize_orders', result)
  return result
}

export async function addPrizeOrder(o) {
  const supEntry = Object.entries(SUPPLIER_MAP).find(([, v]) => v === o.supplier_name)
  const prize = (getCache('prizes') || []).find(p => String(p.prize_id) === String(o.prize_id))
  const { data, error } = await supabase.from('prize_orders').insert({
    prize_id: o.prize_id || null,
    prize_name_raw: o.prize_name || prize?.prize_name || '',
    supplier_id: supEntry ? supEntry[0] : prize?.supplier_id || null,
    order_date: o.ordered_at || null,
    case_quantity: parseInt(o.order_quantity) || 0,
    unit_cost: parseInt(o.unit_cost_at_order) || 0,
    notes: o.note || null,
    status: 'ordered',
  }).select().single()
  if (error) throw new Error('発注登録エラー: ' + error.message)
  clearCache()
  return data.order_id
}

// 発注の入荷確認（arrived_at + status更新）
export async function markOrderArrived(orderId, arrivedQuantity) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('prize_orders').update({
    arrived_at: now,
    received_quantity: arrivedQuantity,
    status: 'arrived',
  }).eq('order_id', orderId)
  if (error) throw new Error('入荷更新エラー: ' + error.message)
  clearCache()
}

// 旧Google Sheets版（参考用・他シートで引き続き使用）
// ============================================
// prizes シート列構成 (A-S):
// A:prize_id B:prize_name C:jan_code D:barcode_value E:unit_cost
// F:supplier_name G:supplier_contact H:is_active I:created_at J:updated_at
// K:short_name L:item_size M:category N:order_at O:arrival_at
// P:restock_count Q:stock_count R:case_count S:pieces_per_case
// 旧: Google Sheets版（使わないが参考用に残す）
async function _sheets_getPrizes() {
  const rows = await sheetsGet('prizes!A2:S')
  const result = rows.map((r, i) => ({
    _row: i + 2,
    prize_id: r[0]||'', prize_name: r[1]||'', jan_code: r[2]||'',
    barcode_value: r[3]||'', unit_cost: r[4]||'', supplier_name: r[5]||'',
    supplier_contact: r[6]||'', is_active: r[7]||'TRUE',
    created_at: r[8]||'', updated_at: r[9]||'',
    short_name: r[10]||'', item_size: r[11]||'', category: r[12]||'',
    order_at: r[13]||'', arrival_at: r[14]||'',
    restock_count: r[15]||'', stock_count: r[16]||'',
    case_count: r[17]||'', pieces_per_case: r[18]||'',
  }))
  setCache('prizes', result)
  return result
}

async function _sheets_addPrize(p) {
  const now = new Date().toISOString()
  const existing = await _sheets_getPrizes()
  const nextId = existing.length > 0
    ? Math.max(...existing.map(x => parseInt(x.prize_id)||0)) + 1
    : 1
  const barcode = p.jan_code || `PRZ-${nextId}`
  await sheetsAppend('prizes!A:S', [[
    nextId, p.prize_name, p.jan_code||'', barcode,
    p.unit_cost||'0', p.supplier_name||'', p.supplier_contact||'',
    p.is_active || 'TRUE', now, now,
    p.short_name||'', p.item_size||'', p.category||'',
    p.order_at||'', p.arrival_at||'',
    p.restock_count||'', p.stock_count||'',
    p.case_count||'', p.pieces_per_case||'',
  ]])
  clearCache()
  return nextId
}

async function _sheets_addPrizesBatch(items) {
  const now = new Date().toISOString()
  const existing = await _sheets_getPrizes()
  let nextId = existing.length > 0
    ? Math.max(...existing.map(x => parseInt(x.prize_id)||0)) + 1
    : 1
  const rows = items.map(p => {
    const id = nextId++
    const barcode = p.jan_code || `PRZ-${id}`
    return [
      id, p.prize_name||'', p.jan_code||'', barcode,
      p.unit_cost||'0', p.supplier_name||'', p.supplier_contact||'',
      p.is_active || 'TRUE', now, now,
      p.short_name||'', p.item_size||'', p.category||'',
      p.order_at||'', p.arrival_at||'',
      p.restock_count||'', p.stock_count||'',
      p.case_count||'', p.pieces_per_case||'',
    ]
  })
  // バッチappend（1行ずつ送ると遅いのでまとめる）
  for (const row of rows) {
    await sheetsAppend('prizes!A:S', [row])
  }
  clearCache()
  return rows.length
}

async function _sheets_updatePrize(rowNum, p) {
  const now = new Date().toISOString()
  await sheetsPut(`prizes!B${rowNum}:S${rowNum}`, [[
    p.prize_name, p.jan_code||'', p.barcode_value||'',
    p.unit_cost||'0', p.supplier_name||'', p.supplier_contact||'',
    p.is_active||'TRUE', p.created_at||'', now,
    p.short_name||'', p.item_size||'', p.category||'',
    p.order_at||'', p.arrival_at||'',
    p.restock_count||'', p.stock_count||'',
    p.case_count||'', p.pieces_per_case||'',
  ]])
  clearCache()
}

async function _sheets_getPrizeOrders() {
  const rows = await sheetsGet('prize_orders!A2:L')
  return rows.map((r, i) => ({
    _row: i + 2,
    order_id: r[0]||'', prize_id: r[1]||'', prize_name: r[2]||'',
    ordered_at: r[3]||'', order_quantity: r[4]||'',
    arrived_at: r[5]||'', arrival_quantity: r[6]||'',
    unit_cost_at_order: r[7]||'', total_cost: r[8]||'',
    note: r[9]||'', created_at: r[10]||'', supplier_name: r[11]||'',
  }))
}

async function _sheets_addPrizeOrder(o) {
  const now = new Date().toISOString()
  const existing = await _sheets_getPrizeOrders()
  const nextId = existing.length > 0
    ? Math.max(...existing.map(x => parseInt(x.order_id)||0)) + 1
    : 1
  const total = (parseInt(o.order_quantity)||0) * (parseInt(o.unit_cost_at_order)||0)
  await sheetsAppend('prize_orders!A:L', [[
    nextId, o.prize_id, o.prize_name||'', o.ordered_at||'',
    o.order_quantity||'', o.arrived_at||'', o.arrival_quantity||'',
    o.unit_cost_at_order||'', total, o.note||'', now, o.supplier_name||''
  ]])
  clearCache()
  return nextId
}

export async function getPrizeStocks() {
  return getPrizeStocksExtended()
}

// ============================================
// 車在庫管理 (vehicle_stocks)
// ============================================
// シート構成: stock_id / staff_name / prize_id / prize_name / quantity / note / created_at / updated_at
export async function getVehicleStocks() {
  if (getCache('vehicle_stocks')) return getCache('vehicle_stocks')
  try {
    const rows = await sheetsGet('vehicle_stocks!A2:H')
    const result = rows.map((r, i) => ({
      _row: i + 2,
      stock_id: r[0]||'', staff_name: r[1]||'', prize_id: r[2]||'',
      prize_name: r[3]||'', quantity: r[4]||'0', note: r[5]||'',
      created_at: r[6]||'', updated_at: r[7]||'',
    }))
    setCache('vehicle_stocks', result)
    return result
  } catch (e) {
    // vehicle_stocks sheet not found, returning empty
    return []
  }
}

export async function addVehicleStock(item) {
  const now = new Date().toISOString()
  const existing = await getVehicleStocks()
  const nextId = existing.length > 0
    ? Math.max(...existing.map(x => parseInt(x.stock_id)||0)) + 1
    : 1
  await sheetsAppend('vehicle_stocks!A:H', [[
    nextId, item.staff_name||'', item.prize_id||'', item.prize_name||'',
    item.quantity||'0', item.note||'', now, now
  ]])
  clearCache()
  return nextId
}

export async function updateVehicleStock(rowNum, item) {
  const now = new Date().toISOString()
  await sheetsPut(`vehicle_stocks!B${rowNum}:H${rowNum}`, [[
    item.staff_name||'', item.prize_id||'', item.prize_name||'',
    item.quantity||'0', item.note||'', item.created_at||'', now
  ]])
  clearCache()
}

export async function deleteVehicleStock(rowNum) {
  // 行クリアで論理削除（空行にする）
  await sheetsPut(`vehicle_stocks!A${rowNum}:H${rowNum}`, [[
    '', '', '', '', '', '', '', ''
  ]])
  clearCache()
}

// ============================================
// 棚卸し記録 (inventory_checks)
// ============================================
// シート構成: check_id / check_date / prize_id / prize_name / warehouse_qty / checked_by / note / created_at
export async function getInventoryChecks() {
  if (getCache('inventory_checks')) return getCache('inventory_checks')
  try {
    const rows = await sheetsGet('inventory_checks!A2:H')
    const result = rows.map((r, i) => ({
      _row: i + 2,
      check_id: r[0]||'', check_date: r[1]||'', prize_id: r[2]||'',
      prize_name: r[3]||'', warehouse_qty: r[4]||'0', checked_by: r[5]||'',
      note: r[6]||'', created_at: r[7]||'',
    }))
    setCache('inventory_checks', result)
    return result
  } catch (e) {
    // inventory_checks sheet not found, returning empty
    return []
  }
}

export async function saveInventoryCheck(items) {
  // items: [{prize_id, prize_name, warehouse_qty, checked_by, note}]
  const now = new Date().toISOString()
  const checkDate = now.slice(0, 10)
  const rows = items.map((item, i) => [
    'IC' + Date.now() + i, checkDate, item.prize_id||'', item.prize_name||'',
    item.warehouse_qty||'0', item.checked_by||'', item.note||'', now
  ])
  for (const row of rows) {
    await sheetsAppend('inventory_checks!A:H', [row])
  }
  clearCache()
}

export async function updateInventoryCheck(rowNum, data) {
  await sheetsPut(`inventory_checks!E${rowNum}:G${rowNum}`, [[
    data.warehouse_qty || '0', data.checked_by || '', data.note || ''
  ]])
  clearCache()
}

export async function deleteInventoryCheck(rowNum) {
  await sheetsPut(`inventory_checks!A${rowNum}:H${rowNum}`, [['','','','','','','','']])
  clearCache()
}

// ============================================
// ロケーション管理 (locations) — Supabase版
// ============================================
// Supabase: location_id / location_name / location_type / parent_location_id / store_code / operator_id / is_active / notes / capacity_note / is_full / created_at / updated_at / updated_by

export async function getLocations(forceRefresh = false) {
  if (!forceRefresh && getCache('locations')) return getCache('locations')
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('location_name')
  if (error) { console.error('locations取得エラー:', error.message); return [] }
  // 既存コードとの互換性: name, note, active_flag を維持
  const result = data.map(r => ({
    location_id: r.location_id, name: r.location_name || '',
    location_name: r.location_name || '',
    parent_location_id: r.parent_location_id || '',
    store_code: r.store_code || '', location_type: r.location_type || '',
    note: r.notes || '', notes: r.notes || '',
    active_flag: r.is_active ? '1' : '0', is_active: r.is_active,
    operator_id: r.operator_id || '',
    capacity_note: r.capacity_note || '', is_full: r.is_full || false,
    created_at: r.created_at || '', updated_at: r.updated_at || '',
    updated_by: r.updated_by || '',
  }))
  setCache('locations', result)
  return result
}

export async function getLocationTree(parentId = null) {
  const all = await getLocations()
  if (!parentId) {
    return all.filter(l => !l.parent_location_id)
  }
  return all.filter(l => l.parent_location_id === parentId)
}

// 指定ロケーション + その子孫のID一覧を取得
export async function getLocationIdsIncludingChildren(locationId) {
  const all = await getLocations()
  const ids = [locationId]
  function collectChildren(pid) {
    all.filter(l => l.parent_location_id === pid).forEach(child => {
      ids.push(child.location_id)
      collectChildren(child.location_id)
    })
  }
  collectChildren(locationId)
  return ids
}

export async function addLocation(loc) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('locations').insert({
    location_id: loc.location_id,
    location_name: loc.name || loc.location_name || '',
    parent_location_id: loc.parent_location_id || null,
    store_code: loc.store_code || null,
    location_type: loc.location_type || 'warehouse',
    notes: loc.note || loc.notes || null,
    is_active: true,
    created_at: now, updated_at: now,
  })
  if (error) throw new Error('拠点追加エラー: ' + error.message)
  clearCache()
}

export async function updateLocation(locationId, loc) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('locations').update({
    location_name: loc.name || loc.location_name || undefined,
    parent_location_id: loc.parent_location_id || undefined,
    store_code: loc.store_code || undefined,
    location_type: loc.location_type || undefined,
    notes: loc.note || loc.notes || undefined,
    is_active: loc.active_flag === '0' ? false : (loc.is_active ?? true),
    updated_at: now, updated_by: loc.updated_by || null,
  }).eq('location_id', locationId)
  if (error) throw new Error('拠点更新エラー: ' + error.message)
  clearCache()
}

// ============================================
// 在庫管理 prize_stocks — Supabase版
// ============================================
// Supabase prize_stocks: stock_id / prize_id / owner_type / owner_id / quantity / tags / created_at / updated_at / updated_by / last_counted_at / last_counted_by
// prize_nameはprize_mastersからFK JOINで取得

export async function getPrizeStocksExtended(forceRefresh = false) {
  if (!forceRefresh && getCache('prize_stocks_ext')) return getCache('prize_stocks_ext')
  // ページネーション対応（Supabaseデフォルト1000件上限）
  const pageSize = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('prize_stocks')
      .select('*, prize_masters(prize_name)')
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) { console.error('prize_stocks取得エラー:', error.message); return [] }
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const result = all.map(r => ({
    stock_id: r.stock_id, prize_id: r.prize_id,
    prize_name: r.prize_masters?.prize_name || '',
    owner_type: r.owner_type || '', owner_id: r.owner_id || '',
    quantity: r.quantity ?? 0,
    tags: r.tags || '',
    updated_at: r.updated_at || '', updated_by: r.updated_by || '',
    last_counted_at: r.last_counted_at || '', last_counted_by: r.last_counted_by || '',
    created_at: r.created_at || '',
  }))
  setCache('prize_stocks_ext', result)
  return result
}

export async function getStocksByOwner(ownerType, ownerId) {
  const all = await getPrizeStocksExtended()
  return all.filter(s => s.owner_type === ownerType && s.owner_id === ownerId)
}

export async function getStocksByLocationTree(locationId) {
  const ids = await getLocationIdsIncludingChildren(locationId)
  const all = await getPrizeStocksExtended()
  return all.filter(s => s.owner_type === 'location' && ids.includes(s.owner_id))
}

export async function addPrizeStock(stock) {
  const now = new Date().toISOString()
  // insertを使用（upsertだと並行操作でquantity上書きリスクがあるため、fail-loud設計）
  // UNIQUE制約(prize_id,owner_type,owner_id)違反時はエラーで返り、呼び出し元でリトライ可能
  const { data, error } = await supabase.from('prize_stocks').insert({
    prize_id: stock.prize_id || null,
    owner_type: stock.owner_type || '',
    owner_id: stock.owner_id || '',
    quantity: stock.quantity ?? 0,
    tags: stock.tags || null,
    updated_by: stock.updated_by || null,
    created_at: now, updated_at: now,
  }).select('stock_id').single()
  if (error) throw new Error('在庫追加エラー: ' + error.message)
  clearCache()
  return data.stock_id
}

export async function updatePrizeStock(stockId, stock) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('prize_stocks').update({
    quantity: stock.quantity ?? 0,
    owner_type: stock.owner_type || undefined,
    owner_id: stock.owner_id || undefined,
    tags: stock.tags || undefined,
    updated_at: now,
    updated_by: stock.updated_by || null,
  }).eq('stock_id', stockId)
  if (error) throw new Error('在庫更新エラー: ' + error.message)
  clearCache()
}

export async function adjustPrizeStockQuantity(stockId, delta, updatedBy = '') {
  const all = await getPrizeStocksExtended(true)
  const stock = all.find(s => s.stock_id === stockId)
  if (!stock) throw new Error('Stock not found: ' + stockId)
  const newQty = stock.quantity + delta
  if (newQty < 0) throw new Error(`在庫不足: 現在${stock.quantity}個、要求${Math.abs(delta)}個 (${stock.prize_name || stockId})`)
  await updatePrizeStock(stockId, { ...stock, quantity: newQty, updated_by: updatedBy })
  return newQty
}

// ============================================
// 在庫移動履歴 (stock_movements) — Supabase版
// ============================================
// Supabase: movement_id / prize_id / movement_type / from_owner_type / from_owner_id / to_owner_type / to_owner_id / quantity / reason / note / created_at / created_by / updated_at / updated_by / tracking_number / adjustment_reason

export async function getStockMovements(forceRefresh = false) {
  if (!forceRefresh && getCache('stock_movements')) return getCache('stock_movements')
  // ページネーション対応（Supabaseデフォルト1000件上限）
  const pageSize = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) { console.error('stock_movements取得エラー:', error.message); return [] }
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const result = all.map(r => ({
    movement_id: r.movement_id, prize_id: r.prize_id || '', movement_type: r.movement_type || '',
    from_owner_type: r.from_owner_type || '', from_owner_id: r.from_owner_id || '',
    to_owner_type: r.to_owner_type || '', to_owner_id: r.to_owner_id || '',
    quantity: r.quantity ?? 0, note: r.note || '',
    reason: r.reason || '', adjustment_reason: r.adjustment_reason || '',
    tracking_number: r.tracking_number || '',
    created_at: r.created_at || '', created_by: r.created_by || '',
  }))
  setCache('stock_movements', result)
  return result
}

export async function addStockMovement(mv) {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('stock_movements').insert({
    prize_id: mv.prize_id || null,
    movement_type: mv.movement_type,
    from_owner_type: mv.from_owner_type || null,
    from_owner_id: mv.from_owner_id || null,
    to_owner_type: mv.to_owner_type || '',
    to_owner_id: mv.to_owner_id || '',
    quantity: mv.quantity || 0,
    note: mv.note || null,
    reason: mv.reason || null,
    adjustment_reason: mv.adjustment_reason || null,
    created_at: now, created_by: mv.created_by || null,
  }).select('movement_id').single()
  if (error) throw new Error('移動履歴追加エラー: ' + error.message)
  clearCache()
  return data.movement_id
}

// 在庫移管トランザクション: from → to に数量移動 + movement記録
export async function transferStock({ prizeId, prizeName, fromOwnerType, fromOwnerId, toOwnerType, toOwnerId, quantity, note, createdBy }) {
  // 数量バリデーション
  const qty = parseInt(quantity)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error(`無効な数量: ${quantity}`)
  quantity = qty
  const all = await getPrizeStocksExtended(true)

  // 移動元の在庫を減算
  if (fromOwnerType && fromOwnerId) {
    const fromStocks = all.filter(s => s.prize_id === prizeId && s.owner_type === fromOwnerType && s.owner_id === fromOwnerId)
    if (fromStocks.length === 0) throw new Error(`移動元在庫が見つかりません: ${prizeName || prizeId} (${fromOwnerType}/${fromOwnerId})`)
    if (fromStocks.length > 1) console.warn(`同一景品の複数レコード検出: ${prizeId} at ${fromOwnerType}/${fromOwnerId} (${fromStocks.length}件)`)
    const fromStock = fromStocks[0]
    if (fromStock.quantity < quantity) throw new Error(`在庫不足: ${prizeName || prizeId} 現在${fromStock.quantity}個、移動要求${quantity}個`)
    await updatePrizeStock(fromStock.stock_id, { ...fromStock, quantity: fromStock.quantity - quantity, updated_by: createdBy })
  }

  // 移動先の在庫を加算（なければ新規作成）
  const toStocks = all.filter(s => s.prize_id === prizeId && s.owner_type === toOwnerType && s.owner_id === toOwnerId)
  if (toStocks.length > 1) console.warn(`同一景品の複数レコード検出: ${prizeId} at ${toOwnerType}/${toOwnerId} (${toStocks.length}件)`)
  const toStock = toStocks[0] || null
  if (toStock) {
    await updatePrizeStock(toStock.stock_id, { ...toStock, quantity: toStock.quantity + quantity, updated_by: createdBy })
  } else {
    await addPrizeStock({ prize_id: prizeId, quantity, owner_type: toOwnerType, owner_id: toOwnerId, updated_by: createdBy })
  }

  // 移動履歴を記録
  const movementType = fromOwnerType ? MOVEMENT_TYPES.TRANSFER : MOVEMENT_TYPES.ARRIVAL
  return addStockMovement({
    prize_id: prizeId, movement_type: movementType,
    from_owner_type: fromOwnerType||'', from_owner_id: fromOwnerId||'',
    to_owner_type: toOwnerType, to_owner_id: toOwnerId,
    quantity, note: note||'', created_by: createdBy||''
  })
}

// 棚卸し実数確認: 実数をセット + 差異があればadjust movement記録
export async function countStock({ prizeId, prizeName, ownerType, ownerId, actualQuantity, note, createdBy }) {
  const qty = parseInt(actualQuantity)
  if (!Number.isFinite(qty) || qty < 0) throw new Error(`無効な数量: ${actualQuantity}`)
  actualQuantity = qty
  const all = await getPrizeStocksExtended(true)
  const stocks = all.filter(s => s.prize_id === prizeId && s.owner_type === ownerType && s.owner_id === ownerId)
  if (stocks.length > 1) console.warn(`同一景品の複数レコード検出: ${prizeId} at ${ownerType}/${ownerId} (${stocks.length}件)`)
  const stock = stocks[0] || null

  const currentQty = stock ? stock.quantity : 0
  const diff = actualQuantity - currentQty

  if (stock) {
    await updatePrizeStock(stock.stock_id, { ...stock, quantity: actualQuantity, updated_by: createdBy })
  } else {
    await addPrizeStock({ prize_id: prizeId, quantity: actualQuantity, owner_type: ownerType, owner_id: ownerId, updated_by: createdBy })
  }

  // count記録（差異がなくても記録）
  await addStockMovement({
    prize_id: prizeId, movement_type: diff !== 0 ? MOVEMENT_TYPES.ADJUST : MOVEMENT_TYPES.COUNT,
    from_owner_type: ownerType, from_owner_id: ownerId,
    to_owner_type: ownerType, to_owner_id: ownerId,
    quantity: diff,
    note: note || `棚卸し: 理論値${currentQty} → 実数${actualQuantity}${diff !== 0 ? ` (差異${diff > 0 ? '+' : ''}${diff})` : ' (一致)'}`,
    created_by: createdBy||''
  })

  return { previousQuantity: currentQty, actualQuantity, diff }
}
