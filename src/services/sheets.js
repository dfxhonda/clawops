const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'
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

async function sheetsGet(range) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  )
  if (!res.ok) throw new Error('Sheets API error: ' + res.status)
  return (await res.json()).values || []
}

async function sheetsAppend(range, values) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { method: 'POST', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }) }
  )
  if (!res.ok) throw new Error('Sheets append error: ' + res.status)
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
  console.log("rows total:", rows.length, "first row:", JSON.stringify(rows[0])); const result = rows
    .map(r => ({ store_id:r[0], store_code:r[1], store_name:r[2], active_flag:r[10] }))
    .filter(s => s.active_flag == 1 && s.store_code !== 'SIM01')
  setCache('stores', result)
  return result
}

export async function getMachines(storeId) {
  const ckey = `machines_${storeId}`
  if (getCache(ckey)) return getCache(ckey)
  const rows = await sheetsGet('machines!A2:M')
  console.log("rows total:", rows.length, "first row:", JSON.stringify(rows[0])); const result = rows
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

  return result
}

export async function getBooths(machineId) {
  const ckey = `booths_${machineId}`
  if (getCache(ckey)) return getCache(ckey)
  const rows = await sheetsGet('booths!A2:K')
  console.log("rows total:", rows.length, "first row:", JSON.stringify(rows[0])); const result = rows
    .filter(r => String(r[1]) === String(machineId) && String(r[10]) === '1')
    .map(r => ({ booth_id:r[0], machine_id:r[1], booth_code:r[2], booth_number:r[3],
      full_booth_code:r[5], meter_in_digit:r[6], meter_out_digit:r[7], play_price:r[9] }))

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

// --- Sheets PUT helper ---
async function sheetsPut(range, values) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }) }
  )
  if (!res.ok) throw new Error('Sheets PUT error: ' + res.status)
  return res.json()
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
// prizes シート列構成 (A-Q):
// A:prize_id B:prize_name C:jan_code D:barcode_value E:unit_cost
// F:supplier_name G:supplier_contact H:is_active I:created_at J:updated_at
// K:short_name L:item_size M:usage_type N:order_at O:arrival_at
// P:restock_count Q:stock_count
export async function getPrizes() {
  if (getCache('prizes')) return getCache('prizes')
  const rows = await sheetsGet('prizes!A2:Q')
  const result = rows.map((r, i) => ({
    _row: i + 2,
    prize_id: r[0]||'', prize_name: r[1]||'', jan_code: r[2]||'',
    barcode_value: r[3]||'', unit_cost: r[4]||'', supplier_name: r[5]||'',
    supplier_contact: r[6]||'', is_active: r[7]||'TRUE',
    created_at: r[8]||'', updated_at: r[9]||'',
    short_name: r[10]||'', item_size: r[11]||'', usage_type: r[12]||'',
    order_at: r[13]||'', arrival_at: r[14]||'',
    restock_count: r[15]||'', stock_count: r[16]||'',
  }))
  setCache('prizes', result)
  return result
}

export async function addPrize(p) {
  const now = new Date().toISOString()
  const existing = await getPrizes()
  const nextId = existing.length > 0
    ? Math.max(...existing.map(x => parseInt(x.prize_id)||0)) + 1
    : 1
  const barcode = p.jan_code || `PRZ-${nextId}`
  await sheetsAppend('prizes!A:Q', [[
    nextId, p.prize_name, p.jan_code||'', barcode,
    p.unit_cost||'0', p.supplier_name||'', p.supplier_contact||'',
    'TRUE', now, now,
    p.short_name||'', p.item_size||'', p.usage_type||'',
    p.order_at||'', p.arrival_at||'',
    p.restock_count||'', p.stock_count||'',
  ]])
  clearCache()
  return nextId
}

export async function updatePrize(rowNum, p) {
  const now = new Date().toISOString()
  await sheetsPut(`prizes!B${rowNum}:Q${rowNum}`, [[
    p.prize_name, p.jan_code||'', p.barcode_value||'',
    p.unit_cost||'0', p.supplier_name||'', p.supplier_contact||'',
    p.is_active||'TRUE', p.created_at||'', now,
    p.short_name||'', p.item_size||'', p.usage_type||'',
    p.order_at||'', p.arrival_at||'',
    p.restock_count||'', p.stock_count||'',
  ]])
  clearCache()
}

export async function getPrizeOrders() {
  const rows = await sheetsGet('prize_orders!A2:K')
  return rows.map((r, i) => ({
    _row: i + 2,
    order_id: r[0]||'', prize_id: r[1]||'', prize_name: r[2]||'',
    ordered_at: r[3]||'', order_quantity: r[4]||'',
    arrived_at: r[5]||'', arrival_quantity: r[6]||'',
    unit_cost_at_order: r[7]||'', total_cost: r[8]||'',
    note: r[9]||'', created_at: r[10]||'',
  }))
}

export async function addPrizeOrder(o) {
  const now = new Date().toISOString()
  const existing = await getPrizeOrders()
  const nextId = existing.length > 0
    ? Math.max(...existing.map(x => parseInt(x.order_id)||0)) + 1
    : 1
  const total = (parseInt(o.order_quantity)||0) * (parseInt(o.unit_cost_at_order)||0)
  await sheetsAppend('prize_orders!A:K', [[
    nextId, o.prize_id, o.prize_name||'', o.ordered_at||'',
    o.order_quantity||'', o.arrived_at||'', o.arrival_quantity||'',
    o.unit_cost_at_order||'', total, o.note||'', now
  ]])
  clearCache()
  return nextId
}

export async function getPrizeStocks() {
  const rows = await sheetsGet('prize_stocks!A2:H')
  return rows.map((r, i) => ({
    _row: i + 2,
    stock_id: r[0]||'', prize_id: r[1]||'', prize_name: r[2]||'',
    booth_id: r[3]||'', booth_name: r[4]||'',
    quantity: r[5]||'0', last_updated_at: r[6]||'', last_updated_by: r[7]||'',
  }))
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
    console.warn('vehicle_stocks sheet not found, returning empty:', e.message)
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
    console.warn('inventory_checks sheet not found, returning empty:', e.message)
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
