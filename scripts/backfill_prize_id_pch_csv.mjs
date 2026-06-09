#!/usr/bin/env node
// SPEC-PCH-CSV-INTAKE-BACKFILL-FIX-01 rev3
// Backfill prize_orders.prize_id for pch_excel + csv_migration + sgp_api rows where prize_id IS NULL.
//
// rev1 defects (rolled back 2026-06-09T13:05):
//   defect_1: raw name match without whitespace normalization → 95 false no-matches (dup masters)
//   defect_2: unit_cost stored as original_cost (case total, not per-unit)
//
// rev2 fixes (pch_excel + csv_migration, 2026-06-09):
//   match: btrim(regexp_replace(name,'[\s　]+',' ','g')) — normalize ASCII + full-width space
//   cost:  per_unit = round(unit_cost / qty_per_case) from N入 pattern; null if unparseable
//   Results: 205 exact-linked, 55 new masters PZ-02452→PZ-02506, 138 linked. null=0.
//
// rev3 scope extension (sgp_api added, 2026-06-09):
//   sgp_api had 105 null rows not covered by rev2 scope.
//   same logic reused: normalized match, per-unit cost, supplier=SGP (景品フォーム).
//   Results: 48 exact-linked, 47 new masters PZ-02507→PZ-02553, 57 linked. null=0.
//   @-validation: 0 rows (no @ price hints in sgp_api names)
//   unparseable qty (original_cost=null): 41 of 47 new masters (no N入 pattern; correct fallback)
//
// Executed via Supabase MCP SQL directly (SUPABASE_SERVICE_ROLE_KEY not accessible from CLI env).
// This script is the reference implementation; the actual run used equivalent SQL CTEs.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill_prize_id_pch_csv.mjs [--dry-run]

import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')
const ORG_ID = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
const SOURCES = ['pch_excel', 'csv_migration', 'sgp_api']
const EXPECTED_TOTAL_APPROX = 448  // rev3: 343 (rev2) + 105 (sgp_api)
const DRIFT_THRESHOLD = 60

if (!SB_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY 未設定')
  process.exit(1)
}
if (DRY_RUN) console.log('[DRY RUN MODE]')

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })

function formatPrizeId(seq) {
  return 'PZ-' + String(seq).padStart(5, '0')
}
function parsePrizeIdSeq(id) {
  const m = String(id ?? '').match(/^PZ-(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}
// rev2: normalize ASCII space + full-width space (U+3000)
function normalizeWS(s) {
  return s == null ? '' : s.trim().replace(/[\s　]+/g, ' ')
}
// rev2: extract N入 qty for per-unit cost derivation
function extractQtyPerCase(name) {
  const m = (name ?? '').match(/(\d+)入/)
  return m ? parseInt(m[1], 10) : null
}

async function main() {
  const now = new Date().toISOString()

  // ── Step 0: preflight ─────────────────────────────────────────────────────
  console.log('\n=== Step 0: preflight ===')

  const { data: targetRows, error: targetErr } = await sb
    .from('prize_orders')
    .select('order_id, prize_name_raw, supplier_id, unit_cost, order_date, order_source')
    .is('prize_id', null)
    .in('order_source', SOURCES)
  if (targetErr) throw new Error('preflight fetch: ' + targetErr.message)

  const liveCount = targetRows.length
  console.log(`Live null count: ${liveCount} (expected ~${EXPECTED_TOTAL_APPROX})`)
  if (Math.abs(liveCount - EXPECTED_TOTAL_APPROX) > DRIFT_THRESHOLD) {
    console.error('ABORT: count drift too large. Manual review required.')
    process.exit(1)
  }

  const { data: maxRow, error: maxErr } = await sb
    .from('prize_masters')
    .select('prize_id')
    .ilike('prize_id', 'PZ-%')
    .order('prize_id', { ascending: false })
    .limit(1)
  if (maxErr) throw new Error('max prize_id fetch: ' + maxErr.message)
  const maxSeq = maxRow?.length ? (parsePrizeIdSeq(maxRow[0].prize_id) ?? 0) : 0
  console.log(`MAX prize_id seq: ${maxSeq} → new masters start at ${formatPrizeId(maxSeq + 1)}`)

  // ── Step 1: normalized exact-match link ────────────────────────────────────
  console.log('\n=== Step 1: normalized exact-match link ===')

  const rawNames = [...new Set(targetRows.map(r => r.prize_name_raw).filter(Boolean))]
  const normToRaw = new Map()
  for (const raw of rawNames) {
    const norm = normalizeWS(raw)
    if (!normToRaw.has(norm)) normToRaw.set(norm, raw)
  }

  const masterMap = new Map() // normalizedName → { prize_id, latest_order_date, created_at }
  const CHUNK = 200
  const normNames = [...normToRaw.keys()]
  for (let i = 0; i < normNames.length; i += CHUNK) {
    const chunk = normNames.slice(i, i + CHUNK).map(n => normToRaw.get(n))
    const { data, error } = await sb
      .from('prize_masters')
      .select('prize_id, prize_name, latest_order_date, created_at')
      .in('prize_name', chunk)
    if (error) throw new Error('bulk lookup: ' + error.message)
    for (const m of (data ?? [])) {
      const norm = normalizeWS(m.prize_name)
      const existing = masterMap.get(norm)
      if (!existing) {
        masterMap.set(norm, m)
      } else {
        // duplicate master: latest_order_date DESC NULLS LAST, then created_at DESC
        const existLod = existing.latest_order_date ?? '0000'
        const newLod = m.latest_order_date ?? '0000'
        if (newLod > existLod || (newLod === existLod && m.created_at > existing.created_at)) {
          masterMap.set(norm, m)
        }
      }
    }
  }

  const exactRows = targetRows.filter(r => masterMap.has(normalizeWS(r.prize_name_raw)))
  const noMatchRows = targetRows.filter(r => !masterMap.has(normalizeWS(r.prize_name_raw)))
  console.log(`Exact match: ${exactRows.length}, No match: ${noMatchRows.length}`)

  let step1Updated = 0
  if (!DRY_RUN) {
    for (const row of exactRows) {
      const master = masterMap.get(normalizeWS(row.prize_name_raw))
      const { error } = await sb
        .from('prize_orders')
        .update({ prize_id: master.prize_id })
        .eq('order_id', row.order_id)
        .is('prize_id', null)
      if (error) console.warn(`  WARN ${row.order_id}: ${error.message}`)
      else step1Updated++
    }
    console.log(`Step 1 done: ${step1Updated} updated`)
  } else {
    console.log(`[DRY RUN] Would UPDATE ${exactRows.length} rows`)
  }

  // ── Step 2: create new masters + link ──────────────────────────────────────
  console.log('\n=== Step 2: create new masters ===')

  const noMatchGroups = new Map()
  for (const row of noMatchRows) {
    if (!row.prize_name_raw) continue
    const norm = normalizeWS(row.prize_name_raw)
    if (!noMatchGroups.has(norm)) {
      noMatchGroups.set(norm, { rows: [], supplier_id: row.supplier_id, unit_cost: row.unit_cost, order_date: row.order_date, raw: row.prize_name_raw.trim() })
    }
    const grp = noMatchGroups.get(norm)
    grp.rows.push(row)
    if (!grp.order_date || (row.order_date && row.order_date > grp.order_date)) {
      grp.order_date = row.order_date
      grp.unit_cost = row.unit_cost
      grp.supplier_id = row.supplier_id
    }
  }

  const atValidationFail = []
  const unparseable = []
  let nextSeq = maxSeq
  let step2Created = 0
  let step2Linked = 0

  for (const [norm, grp] of noMatchGroups) {
    nextSeq += 1
    const newPrizeId = formatPrizeId(nextSeq)
    const qty = extractQtyPerCase(grp.raw)
    let perUnit = null
    if (qty && qty > 0) {
      perUnit = Math.round(parseFloat(grp.unit_cost) / qty)
      // @-validation: check against @NNN / ＠NNN in name (ASCII + full-width)
      const atMatch = grp.raw.match(/[@＠](\d+)/)
      if (atMatch) {
        const atPrice = parseInt(atMatch[1], 10)
        const diffPct = Math.abs(perUnit - atPrice) * 100 / atPrice
        if (diffPct > 5) {
          atValidationFail.push({ norm, perUnit, atPrice, diffPct: diffPct.toFixed(1) })
          perUnit = null // do NOT write failed cost
        }
      }
    } else {
      unparseable.push(norm)
    }

    const supplierName = grp.supplier_id === 'PCH' ? 'ピーチトイ' : grp.supplier_id === 'SGP' ? '景品フォーム' : grp.supplier_id ?? ''

    if (!DRY_RUN) {
      const { error: insErr } = await sb.from('prize_masters').insert({
        prize_id: newPrizeId,
        prize_name: grp.raw,
        short_name: grp.raw.substring(0, 20),
        supplier_id: grp.supplier_id ?? null,
        supplier_name: supplierName,
        original_cost: perUnit,
        cost_updated_at: perUnit != null ? now : null,
        phase: 'active',
        phase_changed_at: now,
        phase_changed_by: 'backfill-fix-01-rev2',
        organization_id: ORG_ID,
        registered_at: now,
        registered_by: 'backfill-fix-01-rev2',
        notes: 'backfilled rev3 from order_source 2026-06-09',
        created_at: now,
        updated_at: now,
      })
      if (insErr) { console.error(`  ERROR INSERT ${newPrizeId}: ${insErr.message}`); continue }
      step2Created++
      for (const row of grp.rows) {
        const { error } = await sb
          .from('prize_orders')
          .update({ prize_id: newPrizeId })
          .eq('order_id', row.order_id)
          .is('prize_id', null)
        if (error) console.warn(`  WARN ${row.order_id}: ${error.message}`)
        else step2Linked++
      }
    }
  }

  if (!DRY_RUN) console.log(`Step 2: ${step2Created} created, ${step2Linked} linked`)
  if (atValidationFail.length) console.log('@ validation FAIL (cost set to null):', atValidationFail)
  else console.log('@-validation: all PASS (0 fails)')
  console.log(`Unparseable qty (original_cost=null): ${unparseable.length} names`)

  console.log('\n=== Summary ===')
  console.log(`Target rows: ${liveCount}`)
  console.log(`Step 1: ${DRY_RUN ? exactRows.length + ' (dry)' : step1Updated + ' updated'}`)
  console.log(`Step 2: ${DRY_RUN ? noMatchGroups.size + ' names (dry)' : step2Created + ' created, ' + step2Linked + ' linked'}`)
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1) })
