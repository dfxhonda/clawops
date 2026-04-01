/**
 * ピーチトイPDF請求書 → Supabase取込スクリプト
 *
 * Usage: node 取込/import_pch_pdf.js
 *
 * - 2025.pdf (Oct 2025 - Mar 2026) + 2025-2026.pdf (Apr 2025 - Sep 2025)
 * - 伝票日付 → order_date + expected_date
 * - prize_name はそのまま（短縮しない）
 * - supplier_id: PCH, supplier_name: ピーチトイ
 * - 重複チェック: slip_no + prize_name + quantity
 */

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs';

async function sbGet(table, params = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPost(table, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err);
  }
  return r.json();
}

async function main() {
  // Load extracted data
  const d1 = require('./pch_2025_extracted.json');
  const d2 = require('./pch_2025_2026_extracted.json');
  const all = [...d2, ...d1]; // chronological (Apr 2025 → Mar 2026)

  // Dedupe by slip_no + prize_name + quantity
  const seen = new Set();
  const items = [];
  for (const it of all) {
    const key = `${it.slip_no}|${it.prize_name}|${it.quantity}`;
    if (seen.has(key)) { console.log('  skip dupe:', it.prize_name, 'x' + it.quantity); continue; }
    seen.add(key);
    items.push(it);
  }
  console.log(`Total items: ${items.length} (after dedup from ${all.length})`);

  // Get existing prize_masters for PCH
  const masters = await sbGet('prize_masters', 'select=prize_id,prize_name&supplier_id=eq.PCH&limit=5000');
  const masterMap = new Map(masters.map(m => [m.prize_name, m.prize_id]));
  console.log(`Existing PCH masters: ${masters.length}`);

  // Get next prize_id
  const maxRows = await sbGet('prize_masters', 'select=prize_id&order=prize_id.desc&limit=1');
  let nextNum = maxRows.length ? parseInt(maxRows[0].prize_id.replace('PZ-', '')) + 1 : 1;

  // Get existing orders to avoid double import
  const existingOrders = await sbGet('prize_orders', 'select=order_id,prize_name_raw,case_quantity&supplier_id=eq.PCH&order_source=eq.pdf_import&limit=5000');
  const existingSet = new Set(existingOrders.map(o => `${o.prize_name_raw}|${o.case_quantity}`));
  console.log(`Existing PCH pdf_import orders: ${existingOrders.length}`);

  let orderCount = 0, masterCount = 0, skipCount = 0;

  for (const it of items) {
    // Skip if already imported
    const checkKey = `${it.prize_name}|${it.quantity}`;
    if (existingSet.has(checkKey)) {
      skipCount++;
      continue;
    }

    // Ensure prize_master exists
    let prizeId = masterMap.get(it.prize_name);
    if (!prizeId) {
      prizeId = 'PZ-' + String(nextNum++).padStart(5, '0');
      try {
        await sbPost('prize_masters', {
          prize_id: prizeId,
          prize_name: it.prize_name,
          original_cost: it.unit_cost,
          supplier_id: 'PCH',
          supplier_name: 'ピーチトイ',
          status: 'active',
          aliases: JSON.stringify([it.prize_name]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        masterMap.set(it.prize_name, prizeId);
        masterCount++;
      } catch (e) {
        // Maybe already exists with slightly different name
        console.log(`  master create failed: ${it.prize_name} - ${e.message.slice(0, 80)}`);
        prizeId = null;
      }
    }

    // Create order
    const orderId = 'ORD-' + it.date.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    try {
      await sbPost('prize_orders', {
        order_id: orderId,
        prize_id: prizeId,
        prize_name_raw: it.prize_name,
        supplier_id: 'PCH',
        order_date: it.date,
        expected_date: it.date,
        unit_cost: it.unit_cost,
        case_quantity: it.quantity,
        case_cost: it.total_cost || (it.unit_cost * it.quantity),
        status: 'ordered',
        order_source: 'pdf_import',
        source_file: it.slip_no ? `伝票${it.slip_no}` : null,
        notes: null,
        created_at: new Date().toISOString(),
      });
      orderCount++;
      if (orderCount % 20 === 0) process.stdout.write(`  ${orderCount} orders...\r`);
    } catch (e) {
      console.log(`  order failed: ${it.prize_name} - ${e.message.slice(0, 80)}`);
    }
  }

  console.log(`\nDone! Orders: ${orderCount}, New masters: ${masterCount}, Skipped (existing): ${skipCount}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
