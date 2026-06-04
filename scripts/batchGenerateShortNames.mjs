#!/usr/bin/env node
// scripts/batchGenerateShortNames.mjs
// Usage: SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... node scripts/batchGenerateShortNames.mjs

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? SB_KEY;

if (!SB_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY 環境変数が未設定です');
  process.exit(1);
}

const ABBREV = {
  'ぬいぐるみ': 'NG', 'マスコット': 'MC', 'ボールチェーン': 'BC', 'キーホルダー': 'KH',
  'キーケース': 'KC', 'スクイーズ': 'SQ', 'ワイヤレスイヤホン': 'TWS', 'ブレスレット': 'BLT',
  'ミニゲーム機': 'MNGM', 'スマートウォッチ': 'SW', 'モバイルバッテリー': 'MBT',
  'コントローラー': 'CTRL', 'クッション': 'CSHN', 'ブランケット': 'BLKT', 'スピーカー': 'SPK',
  'フラッシュボタン': 'FLBT', 'ダストBOX': 'DTBX', 'ジャグラー': 'ジャグ', 'ディズニー': 'DN', 'アソート': 'AS',
};

function applyAbbrev(name) {
  let result = name;
  for (const [k, v] of Object.entries(ABBREV)) result = result.replaceAll(k, v);
  return result;
}

function stripSize(name) {
  return name
    .replace(/\s*約?\d+(\.\d+)?[xX×]\d+(\.\d+)?(cm|mm)?\s*/g, ' ')
    .replace(/\s*約?\d+(\.\d+)?(cm|mm)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function generateShortName(prizeName) {
  if (!prizeName) return '';
  const intermediate = applyAbbrev(stripSize(prizeName));
  if (intermediate.length <= 15) return intermediate;
  try {
    const res = await fetch(`${SB_URL}/functions/v1/shorten-prize-name`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prize_name: intermediate }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.short_name && typeof data.short_name === 'string') return data.short_name.slice(0, 15);
    }
    console.warn(`  [warn] Edge Function HTTP ${res.status} for: ${prizeName}`);
  } catch (e) {
    console.warn(`  [warn] Edge Function error for "${prizeName}": ${e.message}`);
  }
  return intermediate.slice(0, 15);
}

async function fetchAllNonDead() {
  const headers = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };
  let all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = `${SB_URL}/rest/v1/prize_masters?select=prize_id,prize_name,short_name&phase=neq.dead&limit=${limit}&offset=${offset}&order=prize_id.asc`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    all = all.concat(rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

async function updateShortName(prize_id, short_name) {
  const url = `${SB_URL}/rest/v1/prize_masters?prize_id=eq.${encodeURIComponent(prize_id)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ short_name }),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function main() {
  console.log('batchGenerateShortNames: 開始');
  const allRows = await fetchAllNonDead();

  const targets = allRows.filter(r =>
    !r.short_name || r.short_name === '' || r.short_name === r.prize_name
  );
  console.log(`対象: ${targets.length}件 (phase!=dead 合計${allRows.length}件中)`);

  let processed = 0;
  let errors = 0;
  const BATCH = 10;

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(batch.map(async row => {
      try {
        const shortName = await generateShortName(row.prize_name);
        await updateShortName(row.prize_id, shortName);
        processed++;
      } catch (e) {
        console.error(`  [error] ${row.prize_id} (${row.prize_name}): ${e.message}`);
        try {
          await updateShortName(row.prize_id, (row.prize_name ?? '').slice(0, 15));
          processed++;
        } catch {}
        errors++;
      }
    }));
    const done = Math.min(i + BATCH, targets.length);
    if (done % 50 === 0 || done === targets.length) {
      console.log(`  進捗: ${done}/${targets.length}`);
    }
  }

  console.log(`\n完了: 処理=${processed}件, エラー=${errors}件`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
