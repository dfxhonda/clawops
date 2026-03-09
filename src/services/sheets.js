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

// 2日前以前かどうか判定
function isOldEnough(readTime) {
  if (!readTime) return false
  const d = new Date(readTime)
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 1)
  threshold.setHours(0, 0, 0, 0)
  return d < threshold
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
  const rows = await sheetsGet('meter_readings!A1:P')
  if (rows.length === 0) return []
  const header = rows[0].map(h => String(h).trim().toLowerCase())
  const idx = name => header.indexOf(name)
  const iBoothId = idx('booth_id')
  const iFullCode = idx('full_booth_code')
  const iReadTime = idx('read_time')
  const iInMeter = idx('in_meter')
  const iOutMeter = idx('out_meter')
  const iRestock = idx('prize_restock_count')
  const iStock = idx('prize_stock_count')
  const iPrizeName = idx('prize_name')
  const result = rows.slice(1).map(r => ({
    booth_id: iBoothId >= 0 ? r[iBoothId] : undefined,
    full_booth_code: iFullCode >= 0 ? r[iFullCode] : r[2],
    read_time: iReadTime >= 0 ? r[iReadTime] : r[3],
    in_meter: iInMeter >= 0 ? r[iInMeter] : r[4],
    out_meter: iOutMeter >= 0 ? r[iOutMeter] : r[5],
    prize_restock_count: iRestock >= 0 ? r[iRestock] : r[6],
    prize_stock_count: iStock >= 0 ? r[iStock] : r[7],
    prize_name: iPrizeName >= 0 ? r[iPrizeName] : r[8],
  })).filter(r => r.booth_id !== undefined && r.booth_id !== '')
  setCache('meter_readings', result)
  return result
}

export async function getReadingsByBooth(boothId) {
  const all = await getAllMeterReadings()
  return all.filter(r => String(r.booth_id) === String(boothId))
}

// 最新レコード（当日・前日問わず）← 前回値の表示用
export async function getLatestReading(boothId) {
  const rows = await getReadingsByBooth(boothId)
  return rows.length ? rows[rows.length - 1] : null
}

// 最低2日前のレコード ← 差分計算用
export async function getLastReading(boothId) {
  const rows = await getReadingsByBooth(boothId)
  // 新しい順に並べて最初に「2日前以前」のものを返す
  const old = [...rows].reverse().find(r => isOldEnough(r.read_time))
  return old || null
}

// 一括取得（BoothInput高速化用）
// 戻り値: { boothId: { latest, last } }
// latest = 最新レコード（前回値表示用）
// last = 最低2日前のレコード（差分計算用）
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
  const result = rows.map(r => ({ store_id:r[0], store_code:r[1], store_name:r[2], active_flag:r[10] }))
    .filter(s => s.active_flag == 1 && s.store_code !== 'SIM01')
  setCache('stores', result)
  return result
}

export async function getMachines(storeId) {
  const ckey = `machines_${storeId}`
  if (getCache(ckey)) return getCache(ckey)
  const rows = await sheetsGet('machines!A2:L')
  const result = rows.filter(r => String(r[1]) === String(storeId) && String(r[11]) === '1')
    .map(r => ({ machine_id:r[0], store_id:r[1], machine_code:r[2], machine_name:r[3],
      machine_model:r[4], machine_type:r[5], booth_count:r[6], default_price:r[7] }))
  setCache(ckey, result)
  return result
}

export async function getBooths(machineId) {
  const ckey = `booths_${machineId}`
  if (getCache(ckey)) return getCache(ckey)
  const rows = await sheetsGet('booths!A2:K')
  const result = rows.filter(r => String(r[1]) === String(machineId) && String(r[10]) === '1')
    .map(r => ({ booth_id:r[0], machine_id:r[1], booth_code:r[2], booth_number:r[3],
      full_booth_code:r[5], meter_in_digit:r[6], meter_out_digit:r[7], play_price:r[9] }))
  setCache(ckey, result)
  return result
}

export async function saveReading(r) {
  const now = new Date().toISOString()
  await sheetsAppend('meter_readings!A:N', [[
    'R'+Date.now(), r.booth_id, r.full_booth_code, now,
    r.in_meter, r.out_meter||'', r.prize_restock_count||'',
    r.prize_stock_count||'', r.prize_name||'', 'manual','','', r.note||'', now
  ]])
  clearCache()
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
