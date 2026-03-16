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
