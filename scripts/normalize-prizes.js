#!/usr/bin/env node
/**
 * normalize-prizes.js
 * prize_masters テーブルのデータを正規化する
 *
 * 処理内容:
 *   1. 全 prize_masters を取得
 *   2. 各フィールドを正規化（trim、標準化）
 *   3. 差分があるレコードのみ PATCH
 *   4. 結果を標準出力へ
 *
 * 追加済みカラム: order_date DATE, expected_date DATE
 */

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs';

// ─── ステータス正規化マップ ───────────────────────────────────────────────────
const STATUS_MAP = {
  'active': 'active',
  'アクティブ': 'active',
  '運用中': 'active',
  '稼働中': 'active',
  'provisional': 'provisional',
  '仮登録': 'provisional',
  '仮': 'provisional',
  'inactive': 'inactive',
  '非アクティブ': 'inactive',
  '廃棄': 'inactive',
  '終了': 'inactive',
  '削除': 'inactive',
};

const VALID_STATUSES = new Set(['active', 'provisional', 'inactive']);

// ─── カテゴリ正規化 ──────────────────────────────────────────────────────────
function normalizeCategory(cat) {
  if (!cat) return cat;
  return cat.trim()
    .replace(/　/g, ' ')           // 全角スペース→半角
    .replace(/\s+/g, ' ');
}

// ─── サイズ正規化 ────────────────────────────────────────────────────────────
const SIZE_MAP = {
  'ＢＩＧ': 'BIG', 'ビッグ': 'BIG', 'big': 'BIG', 'Big': 'BIG',
  'Ｍ': 'M', 'ｍ': 'M',
  'Ｓ': 'S', 'ｓ': 'S',
  'ＬＬ': 'LL', 'll': 'LL',
  'Ｌ': 'L', 'ｌ': 'L',
  'XL': 'XL', 'xl': 'XL', 'Xl': 'XL',
};

function normalizeSize(size) {
  if (!size) return size;
  const t = size.trim().replace(/　/g, ' ');
  return SIZE_MAP[t] || t;
}

// ─── フェーズ正規化 ──────────────────────────────────────────────────────────
function normalizePhase(phase) {
  if (!phase) return phase;
  return phase.trim().replace(/　/g, ' ').replace(/\s+/g, ' ');
}

// ─── テキストフィールド正規化 ────────────────────────────────────────────────
function normalizeText(s) {
  if (s == null) return s;
  const t = String(s).trim();
  return t === '' ? null : t;
}

// ─── ステータス正規化 ────────────────────────────────────────────────────────
function normalizeStatus(status) {
  if (!status) return 'provisional';
  const mapped = STATUS_MAP[status.trim()];
  if (mapped) return mapped;
  if (VALID_STATUSES.has(status.trim())) return status.trim();
  return 'provisional';
}

// ─── notes から order_date / expected_date を抽出 ───────────────────────────
// 例: notes に "発注:2026-01-15" "入荷予定:2026-02-01" が含まれる場合
function extractDates(notes) {
  const result = { order_date: null, expected_date: null };
  if (!notes) return result;

  const orderMatch = notes.match(/発注[日:：\s]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (orderMatch) {
    result.order_date = orderMatch[1].replace(/\//g, '-');
  }
  const expectedMatch = notes.match(/(?:入荷予定|予定)[日:：\s]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (expectedMatch) {
    result.expected_date = expectedMatch[1].replace(/\//g, '-');
  }
  return result;
}

// ─── 差分チェック ────────────────────────────────────────────────────────────
function hasDiff(original, patched) {
  for (const [k, v] of Object.entries(patched)) {
    if (original[k] !== v) return true;
  }
  return false;
}

// ─── Supabase REST ────────────────────────────────────────────────────────────
async function sbGet(table, params = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
  });
  if (!r.ok) throw new Error(`GET ${table} failed: ${await r.text()}`);
  return r.json();
}

async function sbPatch(table, id, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?prize_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`PATCH ${id} failed: ${await r.text()}`);
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== normalize-prizes.js 開始 ===');
  console.log(`対象: ${SB_URL}`);

  // 全件取得（最大2000件でページング対応）
  let allData = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const page = await sbGet(
      'prize_masters',
      `select=prize_id,prize_name,original_cost,status,category,aliases,supplier_item_code,notes,size,phase,order_date,expected_date&order=prize_id.asc&limit=${PAGE}&offset=${offset}`
    );
    allData = allData.concat(page);
    console.log(`  取得: ${allData.length}件 (offset=${offset})`);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n合計 ${allData.length} 件を取得`);

  const stats = {
    total: allData.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    status_fixed: 0,
    category_fixed: 0,
    size_fixed: 0,
    phase_fixed: 0,
    dates_extracted: 0,
  };

  for (const p of allData) {
    try {
      const dates = extractDates(p.notes);

      const normalized = {
        prize_name:         normalizeText(p.prize_name) || p.prize_name,
        status:             normalizeStatus(p.status),
        category:           normalizeCategory(p.category),
        aliases:            normalizeText(p.aliases),
        supplier_item_code: normalizeText(p.supplier_item_code),
        notes:              normalizeText(p.notes),
        size:               normalizeSize(p.size),
        phase:              normalizePhase(p.phase),
        order_date:         p.order_date || dates.order_date,
        expected_date:      p.expected_date || dates.expected_date,
      };

      // undefined→null変換
      for (const k of Object.keys(normalized)) {
        if (normalized[k] === undefined) normalized[k] = null;
      }

      if (!hasDiff(p, normalized)) {
        stats.skipped++;
        continue;
      }

      // 差分統計
      if (normalized.status !== p.status) stats.status_fixed++;
      if (normalized.category !== p.category) stats.category_fixed++;
      if (normalized.size !== p.size) stats.size_fixed++;
      if (normalized.phase !== p.phase) stats.phase_fixed++;
      if (normalized.order_date !== p.order_date || normalized.expected_date !== p.expected_date) stats.dates_extracted++;

      await sbPatch('prize_masters', p.prize_id, normalized);
      stats.updated++;

      if (stats.updated % 50 === 0) {
        process.stdout.write(`  更新中... ${stats.updated}件\r`);
      }
    } catch (e) {
      console.error(`  ERROR prize_id=${p.prize_id}: ${e.message}`);
      stats.errors++;
    }
  }

  console.log('\n\n=== 正規化完了 ===');
  console.log(`  総件数:         ${stats.total}`);
  console.log(`  更新:           ${stats.updated}`);
  console.log(`  変更なし:       ${stats.skipped}`);
  console.log(`  エラー:         ${stats.errors}`);
  console.log(`  status修正:     ${stats.status_fixed}`);
  console.log(`  category修正:   ${stats.category_fixed}`);
  console.log(`  size修正:       ${stats.size_fixed}`);
  console.log(`  phase修正:      ${stats.phase_fixed}`);
  console.log(`  日付抽出:       ${stats.dates_extracted}`);
  console.log('==================');

  return stats;
}

main().then(stats => {
  process.exitCode = stats.errors > 0 ? 1 : 0;
}).catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
