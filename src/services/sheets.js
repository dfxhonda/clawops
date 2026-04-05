import { supabase } from '../lib/supabase'

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

// ============================================
// メーター読み値 (meter_readings) — Supabase版
// ============================================

export async function getAllMeterReadings(forceRefresh = false) {
  if (!forceRefresh && getCache('meter_readings')) return getCache('meter_readings')
  const pageSize = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('meter_readings')
      .select('*')
      .order('read_time', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) { console.error('meter_readings取得エラー:', error.message); return [] }
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const result = all.map(r => ({
    reading_id: r.reading_id,
    booth_id: r.booth_id || '',
    full_booth_code: r.full_booth_code || '',
    read_time: r.read_time || '',
    in_meter: r.in_meter != null ? String(r.in_meter) : '',
    out_meter: r.out_meter != null ? String(r.out_meter) : '',
    prize_restock_count: r.prize_restock_count != null ? String(r.prize_restock_count) : '',
    prize_stock_count: r.prize_stock_count != null ? String(r.prize_stock_count) : '',
    prize_name: r.prize_name || '',
    set_a: r.set_a || '', set_c: r.set_c || '', set_l: r.set_l || '',
    set_r: r.set_r || '', set_o: r.set_o || '',
    note: r.note || '', source: r.source || 'manual',
  }))
  setCache('meter_readings', result)
  return result
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

// スタッフID→名前マッピング取得
export async function getStaffMap() {
  if (getCache('staff_map')) return getCache('staff_map')
  const { data, error } = await supabase.from('staff').select('staff_id, name').eq('is_active', true)
  if (error) { console.error('staff取得エラー:', error.message); return {} }
  const map = Object.fromEntries(data.map(s => [s.staff_id, s.name]))
  setCache('staff_map', map)
  return map
}

// ============================================
// 店舗・機械・ブース — Supabase版
// ============================================

export async function getStores() {
  if (getCache('stores')) return getCache('stores')
  // 機械が登録されている店舗のみ取得（巡回入力で使う店舗に絞る）
  const { data: machineStores, error: mErr } = await supabase
    .from('machines')
    .select('store_code')
    .eq('is_active', true)
  if (mErr) { console.error('machines取得エラー:', mErr.message); return [] }
  const storeCodes = [...new Set(machineStores.map(m => m.store_code).filter(Boolean))]
  if (storeCodes.length === 0) return []
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_id, store_name, is_active')
    .in('store_code', storeCodes)
    .eq('is_active', true)
    .order('store_name')
  if (error) { console.error('stores取得エラー:', error.message); return [] }
  const result = data.map(r => ({
    store_id: r.store_code,
    store_code: r.store_code,
    store_name: r.store_name,
    active_flag: r.is_active ? 1 : 0,
  }))
  setCache('stores', result)
  return result
}

export async function getMachines(storeId) {
  const ckey = `machines_${storeId}`
  if (getCache(ckey)) return getCache(ckey)
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('store_code', storeId)
    .eq('is_active', true)
    .order('machine_code')
  if (error) { console.error('machines取得エラー:', error.message); return [] }
  // 既存コード互換マッピング
  const result = data.map(r => ({
    machine_id: r.machine_code, // React側はmachine_idでmachine_codeを参照
    store_id: r.store_code,
    machine_code: r.machine_code,
    machine_name: r.machine_name || '',
    machine_model: r.model_id || '',
    machine_type: '',
    booth_count: '',
    default_price: parseNum(r.play_price || '100'),
    meter_layout: '',
    rental_code: r.machine_number || '',
    monthly_advance: 0,
    location_note: r.notes || '',
    active_flag: r.is_active ? '1' : '0',
  }))
  setCache(ckey, result)
  return result
}

export async function getBooths(machineId) {
  const ckey = `booths_${machineId}`
  if (getCache(ckey)) return getCache(ckey)
  const { data, error } = await supabase
    .from('booths')
    .select('*')
    .eq('machine_code', machineId)
    .eq('is_active', true)
    .order('booth_number')
  if (error) { console.error('booths取得エラー:', error.message); return [] }
  // 既存コード互換マッピング
  const result = data.map(r => ({
    booth_id: r.booth_code, // React側はbooth_idでbooth_codeを参照
    machine_id: r.machine_code,
    booth_code: r.booth_code,
    booth_number: r.booth_number,
    full_booth_code: r.booth_code, // booth_code = full_booth_code (KIK01-M01-B01形式)
    meter_in_digit: r.meter_in_number || '7',
    meter_out_digit: r.meter_out_number || '7',
    play_price: r.play_price,
  }))
  setCache(ckey, result)
  return result
}

export async function saveReading(r) {
  const now = r.read_date ? new Date(r.read_date + "T12:00:00").toISOString() : new Date().toISOString()
  const { error } = await supabase.from('meter_readings').insert({
    booth_id: r.booth_id,
    full_booth_code: r.full_booth_code || null,
    read_time: now,
    in_meter: r.in_meter ? parseFloat(r.in_meter) : null,
    out_meter: r.out_meter ? parseFloat(r.out_meter) : null,
    prize_restock_count: parseInt(r.prize_restock_count) || 0,
    prize_stock_count: parseInt(r.prize_stock_count) || 0,
    prize_name: r.prize_name || null,
    set_a: r.set_a || null, set_c: r.set_c || null, set_l: r.set_l || null,
    set_r: r.set_r || null, set_o: r.set_o || null,
    note: r.note || null,
    source: 'manual',
    created_at: now,
    created_by: r.created_by || null,
  })
  if (error) throw new Error('メーター保存エラー: ' + error.message)
  clearCache()
}

export async function findBoothByCode(fullBoothCode) {
  const { data, error } = await supabase
    .from('booths')
    .select('*')
    .eq('booth_code', String(fullBoothCode).trim())
    .eq('is_active', true)
    .limit(1)
    .single()
  if (error || !data) return null
  return {
    booth_id: data.booth_code, machine_id: data.machine_code,
    booth_code: data.booth_code, booth_number: data.booth_number,
    full_booth_code: data.booth_code,
    meter_in_digit: data.meter_in_number || '7',
    meter_out_digit: data.meter_out_number || '7',
    play_price: data.play_price,
  }
}

export async function findMachineById(machineId) {
  const { data, error } = await supabase
    .from('machines')
    .select('machine_code, store_code, machine_name')
    .eq('machine_code', machineId)
    .limit(1)
    .single()
  if (error || !data) return null
  return { machine_id: data.machine_code, store_id: data.store_code, machine_code: data.machine_code, machine_name: data.machine_name }
}

export async function findStoreById(storeId) {
  const stores = await getStores()
  return stores.find(s => String(s.store_id) === String(storeId)) || null
}

export async function updateReading(readingId, r) {
  const { error } = await supabase.from('meter_readings').update({
    in_meter: r.in_meter ? parseFloat(r.in_meter) : null,
    out_meter: r.out_meter ? parseFloat(r.out_meter) : null,
    prize_restock_count: parseInt(r.prize_restock_count) || 0,
    prize_stock_count: parseInt(r.prize_stock_count) || 0,
    prize_name: r.prize_name || null,
  }).eq('reading_id', readingId)
  if (error) throw new Error('メーター更新エラー: ' + error.message)
  clearCache()
}

// ============================================
// 景品管理 CRUD
// ============================================
// Supabase接続（景品マスタ・発注履歴）
// ============================================

const SUPPLIER_MAP = {
  SGP: '景品フォーム', PCH: 'ピーチトイ', SDY: 'エスディーワイ',
  INF: 'インフィニティ', AXS: 'アクシズ', LNS: 'LINE仕入先', MCR: 'メルカリ',
}

function supName(id) { return SUPPLIER_MAP[id] || id || '' }

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

// ============================================
// ロケーション管理 (locations) — Supabase版
// ============================================

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

// ============================================
// 在庫管理 prize_stocks — Supabase版
// ============================================

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

async function addPrizeStock(stock) {
  const now = new Date().toISOString()
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

async function updatePrizeStock(stockId, stock) {
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

  const now = new Date().toISOString()
  if (stock) {
    // 在庫数量更新 + 棚卸し確定日時を記録
    const { error: upErr } = await supabase.from('prize_stocks').update({
      quantity: actualQuantity,
      last_counted_at: now, last_counted_by: createdBy || null,
      updated_at: now, updated_by: createdBy || null,
    }).eq('stock_id', stock.stock_id)
    if (upErr) throw new Error('棚卸し更新エラー: ' + upErr.message)
    clearCache()
  } else {
    await addPrizeStock({ prize_id: prizeId, quantity: actualQuantity, owner_type: ownerType, owner_id: ownerId, updated_by: createdBy })
  }

  // count記録（差異がなくても記録。adjustment_reasonで理由を明記）
  await addStockMovement({
    prize_id: prizeId, movement_type: diff !== 0 ? MOVEMENT_TYPES.ADJUST : MOVEMENT_TYPES.COUNT,
    from_owner_type: ownerType, from_owner_id: ownerId,
    to_owner_type: ownerType, to_owner_id: ownerId,
    quantity: diff,
    adjustment_reason: diff !== 0 ? '棚卸し差分' : '棚卸し一致',
    note: note || `棚卸し: 理論値${currentQty} → 実数${actualQuantity}${diff !== 0 ? ` (差異${diff > 0 ? '+' : ''}${diff})` : ' (一致)'}`,
    created_by: createdBy||''
  })

  return { previousQuantity: currentQty, actualQuantity, diff }
}
