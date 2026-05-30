#!/usr/bin/env node
// 福岡 32,036 行 → Supabase (anon role, Round Zero RLS 全開)
// run from ~/clawops: node scripts/_import_tmp/import_fukuoka_to_supabase.mjs

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(homedir(), 'clawops')
const CSV = join(ROOT, 'docs/sheets/_import/meter_readings_all.csv')
const REAL_ORG = '01cf7a5e-6971-4ae1-918d-8e5981780a95' // 株式会社change
const PLACEHOLDER = '00000000-0000-0000-0000-000000000fuk'
const BATCH_SIZE = 200

// .env.local
const envText = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
if (!URL || !ANON) { console.error('missing env'); process.exit(1) }
console.log('URL:', URL)

const sb = createClient(URL, ANON, { auth: { persistSession: false } })

// === CSV パース ===
function parseCSV(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else inQ = false }
      else cell += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else if (c === '\r') {}
      else cell += c
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const text = readFileSync(CSV, 'utf8')
const all = parseCSV(text)
const header = all.shift()
const C = Object.fromEntries(header.map((h, i) => [h, i]))
console.log('header cols:', header.length, 'data rows:', all.length)

const toNum = v => (v == null || v === '') ? null : (Number.isFinite(Number(v)) ? Number(v) : null)
const toStr = v => (v == null || v === '') ? null : String(v)

const rows = []
let skipped = 0
for (const r of all) {
  if (r.length < header.length - 2) { skipped++; continue }
  const store = r[C.store_code]
  const booth = r[C.booth_code]
  if (!store || !booth) { skipped++; continue }
  const patrol = r[C.patrol_date]
  if (!patrol) { skipped++; continue }
  const orgRaw = r[C.organization_id]
  const org = (!orgRaw || orgRaw === PLACEHOLDER) ? REAL_ORG : orgRaw
  const synth = `${store}:${booth}`

  rows.push({
    organization_id: org,
    store_code: store,
    booth_code: booth,
    patrol_date: patrol,
    read_time: r[C.read_time] || `${patrol}T12:00:00+00:00`,
    in_meter: toNum(r[C.in_meter]),
    in_diff: toNum(r[C.in_diff]),
    out_meter: toNum(r[C.out_meter]),
    out_diff: toNum(r[C.out_diff]),
    theoretical_stock: (v => v == null ? null : Math.round(v))(toNum(r[C.theoretical_stock])),
    prize_restock_count: (v => v == null ? null : Math.round(v))(toNum(r[C.prize_restock_count])),
    prize_name: toStr(r[C.prize_name]),
    prize_cost: toNum(r[C.prize_cost]),
    replace_cost: toNum(r[C.replace_cost]),
    payout_rate: toNum(r[C.payout_rate]),
    note: toStr(r[C.note]),
    revenue: toNum(r[C.revenue]),
    source: r[C.source] || 'import_fukuoka_2026',
    input_method: r[C.input_method] || 'bulk_import',
    booth_id: synth,
    full_booth_code: synth,
  })
}
console.log(`prepared ${rows.length} rows, skipped ${skipped}`)

// === BEFORE count ===
const { count: before, error: beforeErr } = await sb.from('meter_readings').select('*', { count: 'exact', head: true })
if (beforeErr) console.error('before count err:', beforeErr)
console.log('BEFORE meter_readings count:', before)

// === Bulk INSERT ===
let inserted = 0, failed = 0
const failures = []
const t0 = Date.now()
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE)
  const { data, error } = await sb.from('meter_readings').insert(batch).select('reading_id')
  if (error) {
    failed += batch.length
    failures.push({ batch_start: i, error: error.message, code: error.code })
    console.error(`batch[${i}-${i + batch.length}] FAIL:`, error.message)
    if (failures.length >= 8) {
      console.error('!! 3 consecutive fails, aborting')
      break
    }
  } else {
    inserted += data?.length || batch.length
    if ((i / BATCH_SIZE) % 5 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(`  inserted ${inserted}/${rows.length} (${elapsed}s)`)
    }
  }
}

const elapsedTotal = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n=== DONE in ${elapsedTotal}s ===`)
console.log('inserted:', inserted, 'failed:', failed)

const { count: after, error: afterErr } = await sb.from('meter_readings').select('*', { count: 'exact', head: true })
if (afterErr) console.error('after count err:', afterErr)
console.log('AFTER meter_readings count:', after, 'delta:', (after ?? 0) - (before ?? 0))

if (failures.length) {
  console.log('\n=== failures ===')
  for (const f of failures) console.log(JSON.stringify(f))
}
