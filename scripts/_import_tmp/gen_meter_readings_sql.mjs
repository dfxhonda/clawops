#!/usr/bin/env node
// 福岡 32,036 行 → SQL batch files
// in: ~/clawops/docs/sheets/_import/meter_readings_all.csv
// out: ~/clawops/docs/sheets/_import/sql_batches/batch_NNN.sql

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const CSV = join(homedir(), 'clawops/docs/sheets/_import/meter_readings_all.csv')
const OUT_DIR = join(homedir(), 'clawops/docs/sheets/_import/sql_batches')
const REAL_ORG = '01cf7a5e-6971-4ae1-918d-8e5981780a95' // 株式会社change
const PLACEHOLDER = '00000000-0000-0000-0000-000000000fuk'
const BATCH_SIZE = 500

// クリーンアップ
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.sql')) unlinkSync(join(OUT_DIR, f))
}
mkdirSync(OUT_DIR, { recursive: true })

// CSV パース(シンプル: クォート + カンマ + 改行)
function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else inQuotes = false
      } else cell += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else if (c === '\r') { /* skip */ }
      else cell += c
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function esc(v) {
  if (v == null || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}
function num(v) {
  if (v == null || v === '') return 'NULL'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : 'NULL'
}

const text = readFileSync(CSV, 'utf8')
const rows = parseCSV(text)
const header = rows.shift()
console.log('header:', header.join(','))
console.log('data rows:', rows.length)

// マップ
const COL = Object.fromEntries(header.map((h, i) => [h, i]))

const COLS = [
  'organization_id', 'store_code', 'booth_code', 'patrol_date', 'read_time',
  'in_meter', 'in_diff', 'out_meter', 'out_diff', 'theoretical_stock',
  'prize_restock_count', 'prize_name', 'prize_cost', 'replace_cost', 'payout_rate',
  'note', 'revenue', 'source', 'input_method', 'booth_id', 'full_booth_code',
]

let batchNo = 0
let totalRows = 0
let skipped = 0

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const chunk = rows.slice(i, i + BATCH_SIZE)
  const values = []
  for (const r of chunk) {
    if (r.length < header.length - 2) { skipped++; continue }
    const orgRaw = r[COL.organization_id]
    const org = (orgRaw === PLACEHOLDER || !orgRaw) ? REAL_ORG : orgRaw
    const store = r[COL.store_code] || ''
    const booth = r[COL.booth_code] || ''
    if (!store || !booth) { skipped++; continue }
    const booth_id_synth = `${store}:${booth}`
    const patrol = r[COL.patrol_date]
    const read_time = r[COL.read_time]
    if (!patrol || !read_time) { skipped++; continue }

    values.push('(' + [
      esc(org),
      esc(store),
      esc(booth),
      esc(patrol),
      esc(read_time),
      num(r[COL.in_meter]),
      num(r[COL.in_diff]),
      num(r[COL.out_meter]),
      num(r[COL.out_diff]),
      num(r[COL.theoretical_stock]),
      num(r[COL.prize_restock_count]),
      esc(r[COL.prize_name]),
      num(r[COL.prize_cost]),
      num(r[COL.replace_cost]),
      num(r[COL.payout_rate]),
      esc(r[COL.note]),
      num(r[COL.revenue]),
      esc(r[COL.source] || 'import_fukuoka_2026'),
      esc(r[COL.input_method] || 'bulk_import'),
      esc(booth_id_synth),
      esc(booth_id_synth),
    ].join(',') + ')')
  }
  if (values.length === 0) continue
  batchNo++
  const sql =
    `INSERT INTO meter_readings (${COLS.join(', ')}) VALUES\n` +
    values.join(',\n') + ';\n'
  const fname = join(OUT_DIR, `batch_${String(batchNo).padStart(3, '0')}.sql`)
  writeFileSync(fname, sql)
  totalRows += values.length
}

const manifest = {
  total_rows_in_csv: rows.length,
  rows_emitted: totalRows,
  rows_skipped: skipped,
  batches: batchNo,
  batch_size: BATCH_SIZE,
  out_dir: OUT_DIR,
  real_org: REAL_ORG,
  placeholder_replaced: PLACEHOLDER,
}
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest, null, 2))
