// Phase 5 SQL loader — ad-hoc, NOT committed to repo.
// Reads INSERT INTO ... VALUES (...),(...),...; SQL files, parses, batches 200 rows
// via supabase.from(table).insert() (prize_masters uses upsert with ignoreDuplicates).
// Run: cd ~/clawops && node --env-file=.env.local /tmp/load_phase5.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in env')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
console.log('connected:', SUPABASE_URL.replace(/^https?:\/\//, '').slice(0, 30))

const BASE = 'src/scripts/fukuoka_import_v2/insert_payload/sql'
const FILES = [
  { path: `${BASE}/03_prize_masters_01.sql`,   mode: 'upsert', onConflict: 'prize_id' },
  { path: `${BASE}/03_prize_masters_02.sql`,   mode: 'upsert', onConflict: 'prize_id' },
  { path: `${BASE}/04_meter_readings_001.sql`, mode: 'insert' },
  { path: `${BASE}/04_meter_readings_002.sql`, mode: 'insert' },
  { path: `${BASE}/04_meter_readings_003.sql`, mode: 'insert' },
  { path: `${BASE}/04_meter_readings_004.sql`, mode: 'insert' },
  { path: `${BASE}/04_meter_readings_005.sql`, mode: 'insert' },
]
const BATCH_SIZE = 200

// Parse INSERT INTO public.<table> (col1,...) VALUES (...),(...),...; → { table, cols, rows: [[val,...],...] }
function parseInsertSql(sql) {
  // strip trailing ON CONFLICT clause and final ;
  const cleaned = sql.replace(/ON\s+CONFLICT[\s\S]*$/i, '').trim().replace(/;\s*$/, '')
  const head = cleaned.match(/^INSERT\s+INTO\s+(?:public\.)?(\w+)\s*\(([^)]+)\)\s*VALUES\s*/i)
  if (!head) throw new Error('Cannot find INSERT INTO ... VALUES prefix')
  const table = head[1]
  const cols  = head[2].split(',').map(c => c.trim())
  const body  = cleaned.slice(head[0].length)

  const rows = []
  let j = 0
  const m = body.length
  while (j < m) {
    while (j < m && /[\s,]/.test(body[j])) j++
    if (j >= m) break
    if (body[j] !== '(') break
    j++
    const fields = []
    while (j < m) {
      while (j < m && /\s/.test(body[j])) j++
      if (body[j] === ')') { j++; break }
      let val
      if (body[j] === "'") {
        j++
        let s = ''
        while (j < m) {
          if (body[j] === "'") {
            if (body[j + 1] === "'") { s += "'"; j += 2; continue }
            j++; break
          }
          s += body[j]; j++
        }
        val = s
      } else {
        let lit = ''
        while (j < m && body[j] !== ',' && body[j] !== ')') { lit += body[j]; j++ }
        lit = lit.trim()
        if (lit.toUpperCase() === 'NULL' || lit === '') val = null
        else if (/^-?\d+\.?\d*$/.test(lit)) val = Number(lit)
        else if (/^(true|false)$/i.test(lit)) val = lit.toLowerCase() === 'true'
        else val = lit
      }
      fields.push(val)
      while (j < m && /\s/.test(body[j])) j++
      if (body[j] === ',') j++
      else if (body[j] === ')') { j++; break }
    }
    rows.push(fields)
  }
  return { table, cols, rows }
}

function objsFromRows(cols, rows) {
  return rows.map(r => {
    const o = {}
    for (let k = 0; k < cols.length; k++) o[cols[k]] = r[k]
    return o
  })
}

async function loadFile({ path, mode, onConflict }) {
  console.log(`\n=== ${path} ===`)
  const sql = readFileSync(path, 'utf8')
  const { table, cols, rows } = parseInsertSql(sql)
  console.log(`table=${table} cols=${cols.length} rows=${rows.length}`)
  const objects = objsFromRows(cols, rows)
  let inserted = 0
  let failed = 0
  let firstErr = null
  for (let i = 0; i < objects.length; i += BATCH_SIZE) {
    const batch = objects.slice(i, i + BATCH_SIZE)
    const res = mode === 'upsert'
      ? await supabase.from(table).upsert(batch, { onConflict, ignoreDuplicates: true })
      : await supabase.from(table).insert(batch)
    if (res.error) {
      failed += batch.length
      if (!firstErr) firstErr = res.error
      console.error(`  batch ${i / BATCH_SIZE + 1} FAIL (${batch.length} rows): ${res.error.message}`)
    } else {
      inserted += batch.length
    }
    if ((i / BATCH_SIZE) % 5 === 0 || i + BATCH_SIZE >= objects.length) {
      console.log(`  progress ${Math.min(i + BATCH_SIZE, objects.length)} / ${objects.length} (ok=${inserted}, fail=${failed})`)
    }
  }
  console.log(`done ${path}: inserted=${inserted} failed=${failed}`)
  return { table, inserted, failed, firstErr }
}

;(async () => {
  const t0 = Date.now()
  const results = []
  for (const f of FILES) {
    try { results.push(await loadFile(f)) }
    catch (e) {
      console.error(`fatal ${f.path}: ${e.message}`)
      results.push({ table: '?', inserted: 0, failed: -1, firstErr: e })
    }
  }

  console.log('\n=== verification ===')
  const { count: pmTotal, error: pmErr } = await supabase.from('prize_masters').select('*', { count: 'exact', head: true })
  const { count: mrV2, error: mrV2Err }  = await supabase.from('meter_readings').select('*', { count: 'exact', head: true }).eq('source', 'import_fukuoka_2026_v2')
  const { count: mrV1, error: mrV1Err }  = await supabase.from('meter_readings').select('*', { count: 'exact', head: true }).eq('source', 'import_fukuoka_2026')

  console.log(`prize_masters total: ${pmTotal} ${pmErr ? `(err: ${pmErr.message})` : ''}`)
  console.log(`meter_readings v2 (source='import_fukuoka_2026_v2'): ${mrV2} ${mrV2Err ? `(err: ${mrV2Err.message})` : ''}`)
  console.log(`meter_readings v1 (source='import_fukuoka_2026'):     ${mrV1} ${mrV1Err ? `(err: ${mrV1Err.message})` : ''}`)
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  console.log('\n=== summary ===')
  for (const r of results) console.log(`  ${r.table}: inserted=${r.inserted} failed=${r.failed}`)
})()
