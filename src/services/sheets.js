const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'
const TOKEN_KEY = 'gapi_token'

export function getToken() { return sessionStorage.getItem(TOKEN_KEY) }
export function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { sessionStorage.removeItem(TOKEN_KEY) }

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

export async function getAllMeterReadings() {
  const rows = await sheetsGet('meter_readings!A2:N')
  return rows.map(r => ({
    reading_id:r[0], booth_id:r[1], full_booth_code:r[2], read_time:r[3],
    in_meter:r[4], out_meter:r[5], prize_restock_count:r[6],
    prize_stock_count:r[7], prize_name:r[8]
  }))
}

export async function getReadingsByBooth(boothId) {
  const all = await getAllMeterReadings()
  return all.filter(r => String(r.booth_id) === String(boothId))
}

export async function getLastReading(boothId) {
  const rows = await getReadingsByBooth(boothId)
  return rows.length ? rows[rows.length - 1] : null
}

export async function getStores() {
  const rows = await sheetsGet('stores!A2:N')
  return rows.map(r => ({ store_id:r[0], store_code:r[1], store_name:r[2], active_flag:r[10] }))
    .filter(s => s.active_flag == 1 && s.store_code !== 'SIM01')
}

export async function getMachines(storeId) {
  const rows = await sheetsGet('machines!A2:L')
  return rows.filter(r => String(r[1]) === String(storeId) && String(r[11]) === '1')
    .map(r => ({ machine_id:r[0], store_id:r[1], machine_code:r[2], machine_name:r[3],
      machine_model:r[4], machine_type:r[5], booth_count:r[6], default_price:r[7] }))
}

export async function getBooths(machineId) {
  const rows = await sheetsGet('booths!A2:K')
  return rows.filter(r => String(r[1]) === String(machineId) && String(r[10]) === '1')
    .map(r => ({ booth_id:r[0], machine_id:r[1], booth_code:r[2], booth_number:r[3],
      full_booth_code:r[5], meter_in_digit:r[6], meter_out_digit:r[7], play_price:r[9] }))
}

export async function saveReading(r) {
  const now = new Date().toISOString()
  await sheetsAppend('meter_readings!A:N', [[
    'R'+Date.now(), r.booth_id, r.full_booth_code, now,
    r.in_meter, r.out_meter||'', r.prize_restock_count||'',
    r.prize_stock_count||'', r.prize_name||'', 'manual','','', r.note||'', now
  ]])
}

export async function updateReading(rowIndex, r) {
  const range = `meter_readings!E${rowIndex}:I${rowIndex}`
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[r.in_meter, r.out_meter, r.prize_restock_count, r.prize_stock_count, r.prize_name]] }) }
  )
}
