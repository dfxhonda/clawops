#!/usr/bin/env node
// SPEC-PCH-CSV-INTAKE-BACKFILL-FIX-01
// Backfill prize_orders.prize_id for pch_excel + csv_migration rows where prize_id IS NULL.
// Step 0: preflight (live re-count, MAX PZ seq)
// Step 1: exact-match link to existing prize_masters
// Step 2: create new prize_masters for no-match rows, link
// Step 3: verify AC1-AC7
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill_prize_id_pch_csv.mjs [--dry-run]

import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')
const ORG_ID = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
const SOURCES = ['pch_excel', 'csv_migration']
const EXPECTED_TOTAL = 1394
const DRIFT_THRESHOLD = 50

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
  console.log(`Live null count: ${liveCount} (expected ~${EXPECTED_TOTAL})`)
  const drift = Math.abs(liveCount - EXPECTED_TOTAL)
  if (drift > DRIFT_THRESHOLD) {
    console.error(`ABORT: count drift ${drift} > threshold ${DRIFT_THRESHOLD}. Manual review required.`)
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
  console.log(`Live MAX prize_id seq: ${maxSeq} → new masters start at ${formatPrizeId(maxSeq + 1)}`)

  // ── Step 1: exact-match link to existing masters ───────────────────────────
  console.log('\n=== Step 1: exact-match link ===')

  const rawNames = [...new Set(targetRows.map(r => r.prize_name_raw).filter(Boolean))]

  const masterMap = new Map() // prize_name → { prize_id, latest_order_date, created_at }
  const CHUNK = 500
  for (let i = 0; i < rawNames.length; i += CHUNK) {
    const chunk = rawNames.slice(i, i + CHUNK)
    const { data, error } = await sb
      .from('prize_masters')
      .select('prize_id, prize_name, latest_order_date, created_at')
      .in('prize_name', chunk)
    if (error) throw new Error('prize_masters bulk lookup: ' + error.message)
    for (const m of (data ?? [])) {
      const existing = masterMap.get(m.prize_name)
      if (!existing) {
        masterMap.set(m.prize_name, m)
      } else {
        // duplicate master rule: latest_order_date DESC NULLS LAST, then created_at DESC
        const existLod = existing.latest_order_date ?? '0000'
        const newLod = m.latest_order_date ?? '0000'
        if (newLod > existLod || (newLod === existLod && m.created_at > existing.created_at)) {
          masterMap.set(m.prize_name, m)
        }
      }
    }
  }

  const exactRows = targetRows.filter(r => masterMap.has(r.prize_name_raw))
  const noMatchRows = targetRows.filter(r => !masterMap.has(r.prize_name_raw))
  console.log(`Exact match: ${exactRows.length}, No match: ${noMatchRows.length}`)

  let step1Updated = 0
  if (DRY_RUN) {
    console.log('[DRY RUN] Would UPDATE', exactRows.length, 'rows for exact match')
  } else {
    for (const row of exactRows) {
      const master = masterMap.get(row.prize_name_raw)
      const { error } = await sb
        .from('prize_orders')
        .update({ prize_id: master.prize_id })
        .eq('order_id', row.order_id)
        .is('prize_id', null) // safety guard: never overwrite existing
      if (error) console.warn(`  WARN step1 UPDATE ${row.order_id}: ${error.message}`)
      else step1Updated++
    }
    console.log(`Step 1 done: ${step1Updated} rows updated`)
  }

  // ── Step 2: create new masters + link no-match rows ────────────────────────
  console.log('\n=== Step 2: create new masters ===')

  // Group no-match rows by prize_name_raw
  const noMatchGroups = new Map() // prize_name_raw → { rows: [...], supplier_id, unit_cost, order_date, order_source }
  for (const row of noMatchRows) {
    if (!row.prize_name_raw) continue
    if (!noMatchGroups.has(row.prize_name_raw)) {
      noMatchGroups.set(row.prize_name_raw, {
        rows: [],
        supplier_id: row.supplier_id,
        unit_cost: row.unit_cost,
        order_date: row.order_date,
        order_source: row.order_source,
      })
    }
    const grp = noMatchGroups.get(row.prize_name_raw)
    grp.rows.push(row)
    // pick representative: latest order_date
    if (!grp.order_date || (row.order_date && row.order_date > grp.order_date)) {
      grp.order_date = row.order_date
      grp.unit_cost = row.unit_cost
      grp.supplier_id = row.supplier_id
      grp.order_source = row.order_source
    }
  }
  console.log(`Distinct no-match names: ${noMatchGroups.size}`)

  // Resolve supplier_name for each supplier_id
  const supplierIds = [...new Set([...noMatchGroups.values()].map(g => g.supplier_id).filter(Boolean))]
  const supplierNameMap = new Map()
  if (supplierIds.length > 0) {
    const { data: suppliers, error: supErr } = await sb
      .from('suppliers')
      .select('supplier_id, supplier_name')
      .in('supplier_id', supplierIds)
    if (supErr) console.warn('suppliers lookup warn:', supErr.message)
    for (const s of (suppliers ?? [])) supplierNameMap.set(s.supplier_id, s.supplier_name)
  }

  let nextSeq = maxSeq
  let step2Created = 0
  let step2Linked = 0
  const createdMasterIds = []

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would CREATE ${noMatchGroups.size} new prize_masters starting ${formatPrizeId(nextSeq + 1)}`)
    console.log('[DRY RUN] Would UPDATE', noMatchRows.length, 'rows for new masters')
  } else {
    for (const [prizeName, grp] of noMatchGroups) {
      nextSeq += 1
      const newPrizeId = formatPrizeId(nextSeq)
      const supplierName = supplierNameMap.get(grp.supplier_id) ?? grp.supplier_id ?? null

      const { error: insErr } = await sb.from('prize_masters').insert({
        prize_id: newPrizeId,
        prize_name: prizeName,
        short_name: prizeName.length > 20 ? prizeName.substring(0, 20) : prizeName,
        supplier_id: grp.supplier_id ?? null,
        supplier_name: supplierName,
        original_cost: grp.unit_cost ?? null,
        phase: 'active',
        phase_changed_by: 'backfill-fix-01',
        organization_id: ORG_ID,
        registered_by: 'backfill-fix-01',
        notes: 'backfilled from order_source (pch_excel/csv_migration) 2026-06-09',
        created_at: now,
        updated_at: now,
      })
      if (insErr) {
        console.error(`  ERROR INSERT ${newPrizeId} "${prizeName}": ${insErr.message}`)
        continue
      }
      createdMasterIds.push(newPrizeId)
      step2Created++

      // Link all rows in this group
      for (const row of grp.rows) {
        const { error: updErr } = await sb
          .from('prize_orders')
          .update({ prize_id: newPrizeId })
          .eq('order_id', row.order_id)
          .is('prize_id', null)
        if (updErr) console.warn(`  WARN step2 UPDATE ${row.order_id}: ${updErr.message}`)
        else step2Linked++
      }
    }
    console.log(`Step 2 done: ${step2Created} masters created, ${step2Linked} rows linked`)
  }

  // ── Step 3: verify ────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    console.log('\n=== Step 3: verify ===')

    const { count: remainNull, error: v1Err } = await sb
      .from('prize_orders')
      .select('order_id', { count: 'exact', head: true })
      .is('prize_id', null)
      .in('order_source', SOURCES)
    if (v1Err) console.warn('verify AC1:', v1Err.message)
    else console.log(`AC1 remaining null: ${remainNull} (expect 0)`)

    const { count: newMasterCount, error: v2Err } = await sb
      .from('prize_masters')
      .select('prize_id', { count: 'exact', head: true })
      .in('prize_id', createdMasterIds.length ? createdMasterIds : ['NONE'])
      .eq('phase', 'active')
    if (v2Err) console.warn('verify AC2:', v2Err.message)
    else console.log(`AC2 new masters with phase=active: ${newMasterCount} (expect ${step2Created})`)

    // AC4: spot-check csv_migration row has supplier_id=SGP (not PCH)
    const csvNoMatchEntry = [...noMatchGroups.entries()].find(([, grp]) => grp.order_source === 'csv_migration')
    if (csvNoMatchEntry) {
      const csvIdx = [...noMatchGroups.keys()].indexOf(csvNoMatchEntry[0])
      const csvNewId = createdMasterIds[csvIdx]
      if (csvNewId) {
        const { data: spot } = await sb.from('prize_masters').select('prize_id, supplier_id').eq('prize_id', csvNewId).single()
        console.log(`AC4 spot check csv master ${csvNewId}: supplier_id=${spot?.supplier_id} (must NOT be PCH fixed supplier)`)
      }
    }

    // AC5: no writes outside ORG_ID
    const { count: outsideOrg, error: v5Err } = await sb
      .from('prize_masters')
      .select('prize_id', { count: 'exact', head: true })
      .in('prize_id', createdMasterIds.length ? createdMasterIds : ['NONE'])
      .neq('organization_id', ORG_ID)
    if (v5Err) console.warn('verify AC5:', v5Err.message)
    else console.log(`AC5 masters outside ORG_ID: ${outsideOrg} (expect 0)`)

    console.log('\n=== Rollback reference ===')
    console.log('Created prize_ids:', createdMasterIds.slice(0, 10).join(', '), createdMasterIds.length > 10 ? `...+${createdMasterIds.length - 10}` : '')
  }

  console.log('\n=== Summary ===')
  console.log(`Target rows found: ${liveCount}`)
  console.log(`Step 1 (exact link): ${DRY_RUN ? exactRows.length + ' (dry)' : step1Updated + ' updated'}`)
  console.log(`Step 2 (new masters): ${DRY_RUN ? noMatchGroups.size + ' names (dry)' : step2Created + ' created, ' + step2Linked + ' linked'}`)
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
