const REQUIRED_HEADERS = ['ブースコード', '巡回日', 'IN', 'OUT']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateRow(row, idx) {
  const errors = []
  const boothCode  = String(row['ブースコード'] ?? '').trim()
  const patrolDate = String(row['巡回日']       ?? '').trim()
  const inRaw      = row['IN']
  const outRaw     = row['OUT']

  if (!boothCode)  errors.push('ブースコード空欄')
  if (!patrolDate) errors.push('巡回日空欄')
  else if (!DATE_RE.test(patrolDate)) errors.push(`巡回日フォーマット不正: ${patrolDate}`)

  const numIn  = inRaw  != null && inRaw  !== '' ? Number(inRaw)  : null
  const numOut = outRaw != null && outRaw !== '' ? Number(outRaw) : null

  if (numIn  == null || isNaN(numIn))  errors.push('IN空欄または非数値')
  if (numOut == null || isNaN(numOut)) errors.push('OUT空欄または非数値')
  if (numIn  != null && !isNaN(numIn)  && (numIn  < 0 || numIn  > 1_000_000)) errors.push(`IN異常値: ${numIn}`)
  if (numOut != null && !isNaN(numOut) && (numOut < 0 || numOut > 1_000_000)) errors.push(`OUT異常値: ${numOut}`)

  const prizeCostRaw = row['単価']
  const prizeCost = prizeCostRaw != null && prizeCostRaw !== '' ? Number(prizeCostRaw) : null

  return {
    rowIndex:          idx + 2,
    boothCode,
    patrolDate,
    inMeter:           numIn,
    outMeter:          numOut,
    prizeStockCount:   parseInt(row['残'] ?? 0, 10) || 0,
    prizeRestockCount: parseInt(row['補'] ?? 0, 10) || 0,
    prizeName:         String(row['景品名']  ?? '').trim() || null,
    prizeId:           String(row['景品ID']  ?? '').trim() || null,
    prizeCost:         prizeCost != null && !isNaN(prizeCost) ? prizeCost : null,
    setA:              String(row['設定A']    ?? '').trim() || null,
    setC:              String(row['設定C']    ?? '').trim() || null,
    setL:              String(row['設定L']    ?? '').trim() || null,
    setR:              String(row['設定R']    ?? '').trim() || null,
    setO:              String(row['メモ設定'] ?? '').trim() || null,
    note:              String(row['ノート']   ?? '').trim() || null,
    errors,
    status: errors.length > 0 ? 'error' : 'ok',
  }
}

export async function parseAndValidateExcel(file) {
  const XLSX = await import('xlsx')
  const ab = await file.arrayBuffer()
  const wb = XLSX.read(ab, { type: 'array', cellDates: false })

  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('シートが見つかりません (ERR-IMPORT-001)')

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  if (rows.length === 0) throw new Error('データ行がありません (ERR-IMPORT-001)')

  const headers = Object.keys(rows[0])
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) throw new Error(`必須列「${h}」が見つかりません (ERR-IMPORT-001)`)
  }

  return rows
    .filter(r => String(r['ブースコード'] ?? '').trim() !== '')
    .map((row, i) => validateRow(row, i))
}
