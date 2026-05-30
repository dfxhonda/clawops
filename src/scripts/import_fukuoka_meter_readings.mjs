#!/usr/bin/env node
/**
 * 福岡 13 店舗 クレーン売上 → meter_readings import
 *
 * Usage:
 *   node src/scripts/import_fukuoka_meter_readings.mjs --dry-run
 *   node src/scripts/import_fukuoka_meter_readings.mjs --commit
 *
 * Env (commit のみ要):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (※ anon key だと RLS で 5万件 INSERT 弾かれる)
 *   ORG_ID                     (placeholder UUID 推奨)
 *
 * 出力:
 *   docs/sheets/_import/meter_readings_all.csv
 *   docs/sheets/_import/meter_readings_<store>.csv (per store)
 *   docs/sheets/_import/warnings.log
 *   docs/sheets/_import/stats.json
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import XLSX from 'xlsx'

// ---------- Config ----------
const SHEETS_DIR = './docs/sheets'
const OUT_DIR = './docs/sheets/_import'
const ORG_ID = process.env.ORG_ID || '00000000-0000-0000-0000-000000000fuk'
const DRY_RUN = !process.argv.includes('--commit')
const STORE_LIMIT = parseInt(process.env.STORE_LIMIT || '0', 10)
const VERBOSE = process.argv.includes('--verbose')

// Excel ファイル名 → store_code 変換 (placeholder ローマ字)
const STORE_CODE_MAP = {
  'ファミマ呉服町': 'familyma_gofukumachi',
  '西新': 'nishijin',
  '中州': 'nakasu',
  '浜の町': 'hamanomachi',
  '那珂川': 'nakagawa',
  '時津': 'togitsu',
  '佐賀': 'saga',
  '唐津': 'karatsu',
  'ダイキョー': 'daikyo',
  'ベイサイド': 'bayside',
  '福江': 'fukue',
  '福重': 'fukushige',
}

// Per-machine column block layout (per ファミマ呉服町 sample)
const BLOCK_COLS = [
  '日付',      // 1
  '合計',      // 2
  '100円',     // 3 (in_meter)
  '差',        // 4 (in_diff)
  'プライズ',  // 5 (out_meter)
  '差',        // 6 (out_diff)
  '投入残',    // 7 (theoretical_stock or capsule_stock)
  '払出',      // 8
  '補充',      // 9 (prize_restock_count)
  '景品',      // 10 (prize_name)
  '単価',      // 11 (prize_cost)
  '払出',      // 12 (replace_cost, =単価×払出)
  '出率',      // 13 (payout_rate)
  '設定',      // 14 (note)
]
const BLOCK_WIDTH = 14

// ---------- Helpers ----------
function parseStoreFromFilename(filename) {
  // macOS は NFD (タ+゙) で filename を返す。NFC に正規化してから lookup
  const stripped = basename(filename, '.xlsx')
    .normalize('NFC')
    .replace(/^★/, '')
    .replace(/[\s　]+クレーン売上.*$/, '')
    .replace(/[\s　]+/g, '')
    .trim()
  const code = STORE_CODE_MAP[stripped] || `unknown_${stripped.replace(/[^a-zA-Z0-9぀-ヿ一-龯]/g, '_')}`
  return { storeName: stripped, storeCode: code }
}

function excelDateToISO(v) {
  if (v == null) return null
  let iso = null
  if (v instanceof Date) iso = v.toISOString().slice(0, 10)
  else if (typeof v === 'number') {
    // Excel serial date — small values (<10) are not real dates
    if (v < 30) return null
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    iso = `${d.y.toString().padStart(4, '0')}-${d.m.toString().padStart(2, '0')}-${d.d.toString().padStart(2, '0')}`
  } else if (typeof v === 'string') {
    const m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (m) iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  if (!iso) return null
  // 2000〜2030 範囲外は不正データとして除外
  const year = parseInt(iso.slice(0, 4), 10)
  if (year < 2000 || year > 2030) return null
  // day=00 も無効
  if (iso.endsWith('-00')) return null
  return iso
}

function toNum(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toStr(v) {
  if (v == null || v === '') return null
  return String(v).trim() || null
}

// ---------- Detect machine column blocks from row 1 + row 2 ----------
function detectBlocks(rows) {
  if (rows.length < 2) return []
  const r1 = rows[0]
  const r2 = rows[1]
  const blocks = []
  // Find column positions where row 2 starts with "日付"
  for (let i = 0; i < r2.length; i++) {
    if (r2[i] === '日付') {
      // boothName is in row 1 within this block (col i to i+13)
      let boothName = null
      for (let j = i; j < Math.min(i + BLOCK_WIDTH, r1.length); j++) {
        if (r1[j] != null && r1[j] !== '' && typeof r1[j] === 'string') {
          boothName = String(r1[j]).trim()
          break
        }
      }
      if (!boothName) {
        // Maybe r1 has booth name slightly above (col i-1 or further)
        // Try to scan whole r1 segment
        boothName = `BOOTH_AT_COL_${i + 1}`
      }
      blocks.push({ startCol: i, boothName })
    }
  }
  return blocks
}

// ---------- Process one workbook ----------
function processWorkbook(filepath) {
  const { storeName, storeCode } = parseStoreFromFilename(filepath)
  const wb = XLSX.readFile(filepath)
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

  const blocks = detectBlocks(rows)
  if (blocks.length === 0) {
    return { storeName, storeCode, blocks: 0, readings: [], warnings: [`${storeName}: 14-col block not detected`] }
  }

  const readings = []
  const warnings = []
  // Per-block: track lastDate so that empty 日付 inherits from previous row
  const lastDateByBlock = new Array(blocks.length).fill(null)

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue

    for (let b = 0; b < blocks.length; b++) {
      const { startCol, boothName } = blocks[b]
      const c = startCol
      const dateRaw = row[c + 0]
      const isoDate = excelDateToISO(dateRaw)
      if (isoDate) lastDateByBlock[b] = isoDate
      const patrolDate = lastDateByBlock[b]
      if (!patrolDate) continue // no date yet (header row remnants)

      const inMeter   = toNum(row[c + 2])
      const inDiff    = toNum(row[c + 3])
      const outMeter  = toNum(row[c + 4])
      const outDiff   = toNum(row[c + 5])
      const stock     = toNum(row[c + 6])
      const payout    = toNum(row[c + 7])
      const restock   = toNum(row[c + 8])
      const prizeName = toStr(row[c + 9])
      const prizeCost = toNum(row[c + 10])
      const replaceCost = toNum(row[c + 11])
      const payoutRate  = toNum(row[c + 12])
      const note       = toStr(row[c + 13])

      // skip row if all key fields null
      const hasAny = inMeter != null || outMeter != null || prizeName != null || inDiff != null
      if (!hasAny) continue

      readings.push({
        organization_id: ORG_ID,
        store_code: storeCode,
        booth_code: boothName,
        patrol_date: patrolDate,
        read_time: `${patrolDate}T12:00:00.000Z`,
        in_meter: inMeter,
        in_diff: inDiff,
        out_meter: outMeter,
        out_diff: outDiff,
        theoretical_stock: stock,
        prize_restock_count: restock,
        prize_name: prizeName,
        prize_cost: prizeCost,
        replace_cost: replaceCost,
        payout_rate: payoutRate,
        note,
        revenue: inDiff != null ? inDiff * 100 : null,
        source: 'import_fukuoka_2026',
        input_method: 'bulk_import',
        // booth_id, prize_id 後で SQL で JOIN UPDATE 推奨
        booth_id: null,
      })
    }
  }

  return { storeName, storeCode, blocks: blocks.length, readings, warnings }
}

// ---------- CSV output ----------
function toCSV(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const r of rows) {
    const vals = headers.map(h => {
      const v = r[h]
      if (v == null) return ''
      const s = String(v)
      // CSV escape: quote if contains comma, newline, or quote
      if (s.includes(',') || s.includes('\n') || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    })
    lines.push(vals.join(','))
  }
  return lines.join('\n')
}

// ---------- Main ----------
async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const files = readdirSync(SHEETS_DIR)
    .filter(f => f.startsWith('★') && f.endsWith('.xlsx'))
    .map(f => join(SHEETS_DIR, f))
    .sort()

  console.error(`[INFO] Found ${files.length} ★ files`)
  if (STORE_LIMIT > 0) {
    files.splice(STORE_LIMIT)
    console.error(`[INFO] STORE_LIMIT=${STORE_LIMIT} applied`)
  }

  const allReadings = []
  const stats = []
  const allWarnings = []

  for (const f of files) {
    process.stderr.write(`[INFO] Processing ${basename(f)}... `)
    try {
      const res = processWorkbook(f)
      console.error(`${res.blocks} booths, ${res.readings.length} readings`)
      stats.push({
        store: res.storeName,
        store_code: res.storeCode,
        booths: res.blocks,
        readings: res.readings.length,
        warnings: res.warnings.length,
      })
      // per-store CSV
      const perStoreCSV = toCSV(res.readings)
      writeFileSync(join(OUT_DIR, `meter_readings_${res.storeCode}.csv`), perStoreCSV)
      allReadings.push(...res.readings)
      allWarnings.push(...res.warnings)
    } catch (e) {
      console.error(`FAILED: ${e.message}`)
      allWarnings.push(`${basename(f)}: ${e.message}`)
    }
  }

  // all readings combined
  const allCSV = toCSV(allReadings)
  writeFileSync(join(OUT_DIR, 'meter_readings_all.csv'), allCSV)
  writeFileSync(join(OUT_DIR, 'warnings.log'), allWarnings.join('\n'))
  writeFileSync(join(OUT_DIR, 'stats.json'), JSON.stringify({
    org_id: ORG_ID,
    total_readings: allReadings.length,
    total_files: files.length,
    stores: stats,
    unique_stores: new Set(allReadings.map(r => r.store_code)).size,
    unique_booths: new Set(allReadings.map(r => `${r.store_code}/${r.booth_code}`)).size,
    unique_prize_names: new Set(allReadings.map(r => r.prize_name).filter(Boolean)).size,
    date_range: {
      min: allReadings.map(r => r.patrol_date).filter(Boolean).sort()[0],
      max: allReadings.map(r => r.patrol_date).filter(Boolean).sort().at(-1),
    },
  }, null, 2))

  console.error(`\n[INFO] Total readings: ${allReadings.length}`)
  console.error(`[INFO] Output: ${OUT_DIR}/`)
  console.error(`[INFO]   - meter_readings_all.csv (${allCSV.length} bytes)`)
  console.error(`[INFO]   - meter_readings_<store>.csv (per store)`)
  console.error(`[INFO]   - stats.json + warnings.log`)

  if (DRY_RUN) {
    console.error('\n[DRY-RUN] No data written to Supabase. To commit, run with --commit')
    console.error('[DRY-RUN] Review CSVs first, then:')
    console.error('[DRY-RUN]   1) Supabase Dashboard → Table Editor → meter_readings → Import CSV')
    console.error('[DRY-RUN]   2) Or set SUPABASE_SERVICE_ROLE_KEY env and run --commit')
    return
  }

  // --- commit mode ---
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[ERR] VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --commit')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const BATCH = 500
  let inserted = 0
  let errors = 0
  for (let i = 0; i < allReadings.length; i += BATCH) {
    const batch = allReadings.slice(i, i + BATCH)
    const { error, count } = await supabase.from('meter_readings').insert(batch, { count: 'exact' })
    if (error) {
      errors++
      console.error(`[ERR] Batch ${i}-${i + batch.length}: ${error.message}`)
    } else {
      inserted += batch.length
      console.error(`[OK] Inserted ${inserted}/${allReadings.length}`)
    }
  }
  console.error(`\n[DONE] Inserted ${inserted} rows, ${errors} errors`)
}

main().catch(e => {
  console.error('[FATAL]', e)
  process.exit(1)
})
