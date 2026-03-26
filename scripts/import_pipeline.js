#!/usr/bin/env node
// ClawOps Import Pipeline v8.2
// Usage: node scripts/import_pipeline.js [--dry-run] [--skip-delete]
// Options:
//   --dry-run     パースとExcel出力のみ。Supabase投入しない
//   --skip-delete Supabase全削除をスキップ（追加投入モード）

const fs = require('fs');
const path = require('path');
const https = require('https');
const ExcelJS = require('exceljs');

// === CLI Options ===
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_DELETE = args.includes('--skip-delete');
if (DRY_RUN) console.log('*** DRY-RUN MODE: Supabase投入スキップ ***');
if (SKIP_DELETE) console.log('*** SKIP-DELETE MODE: 全削除スキップ ***');

const START_TIME = new Date();
console.log('=== ClawOps v8 Import Pipeline START ===', START_TIME.toISOString());

// === Config ===
const SUPA_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs';
const supaHeaders = { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

const BASE_DIR = 'C:\\Users\\dfx\\clawops\\取込';
const DONE_DIR = 'C:\\Users\\dfx\\clawops\\取込\\処理済み';
const OUT_DIR = 'C:\\Users\\dfx\\clawops\\取込\\output';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// === Supabase HTTP helper (Node built-in https) ===
function supaFetch(pathStr, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, SUPA_URL);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { ...supaHeaders, 'Prefer': 'return=minimal' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ======= UTILITY FUNCTIONS =======
function hankakuToZenkaku(str) {
  if (!str) return str;
  const kanaMap = {
    'ｦ':'ヲ','ｧ':'ァ','ｨ':'ィ','ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ','ｬ':'ャ','ｭ':'ュ','ｮ':'ョ','ｯ':'ッ',
    'ｰ':'ー','ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ','ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
    'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ','ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
    'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ','ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
    'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ','ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
    'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ','ﾜ':'ワ','ﾝ':'ン','ﾞ':'゛','ﾟ':'゜',
    '｡':'。','｢':'「','｣':'」','､':'、','･':'・'
  };
  const dakutenMap = {'カ':'ガ','キ':'ギ','ク':'グ','ケ':'ゲ','コ':'ゴ','サ':'ザ','シ':'ジ','ス':'ズ','セ':'ゼ','ソ':'ゾ','タ':'ダ','チ':'ヂ','ツ':'ヅ','テ':'デ','ト':'ド','ハ':'バ','ヒ':'ビ','フ':'ブ','ヘ':'ベ','ホ':'ボ','ウ':'ヴ'};
  const handakutenMap = {'ハ':'パ','ヒ':'ピ','フ':'プ','ヘ':'ペ','ホ':'ポ'};
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]; const next = str[i+1];
    if (kanaMap[ch]) {
      const zen = kanaMap[ch];
      if (next === 'ﾞ' && dakutenMap[zen]) { result += dakutenMap[zen]; i++; }
      else if (next === 'ﾟ' && handakutenMap[zen]) { result += handakutenMap[zen]; i++; }
      else result += zen;
    } else result += ch;
  }
  return result;
}

function zenDigitToHan(s) {
  if (!s) return s;
  return s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function shortenPrizeName(raw) {
  if (!raw) return '';
  let s = raw;
  s = zenDigitToHan(s);
  s = hankakuToZenkaku(s);
  s = s.replace(/^\d{5,6}\//, '');
  const br1 = s.replace(/【[^】]*】/g, '').trim();
  if (br1.length > 0) s = br1;
  const br2 = s.replace(/\[[^\]]*\]/g, '').trim();
  if (br2.length > 0) s = br2;
  s = s.replace(/\((?:ハーフ|クォーター)[^)]*円\)/g, '');
  s = s.replace(/\(送料[^)]*\)/g, '');
  s = s.replace(/アミューズ不可|即納|緊急入荷|発注|価格改定/g, '');
  s = s.replace(/バンダイ|ピーナッツクラブ/g, '');
  s = s.replace(/\d+\/\d+締切/g, '');
  s = s.replace(/〆切/g, '');
  s = s.replace(/\d+月発売/g, '');
  s = s.replace(/\d+月下旬再販/g, '');
  s = s.replace(/商品サイズ.*$/, '');
  s = s.replace(/カラーBOX入り|ウィンドウBOX入|BOX入|箱入/g, '');
  s = s.replace(/約?\d+(\.\d+)?[cｃ][mｍ]/g, '');
  s = s.replace(/\d+×\d+(×\d+)?[mｍ㎜㎝]/g, '');
  s = s.replace(/袋\d+×\d+/g, '');
  s = s.replace(/\d+入\s?[＠@]\d+/g, '');
  s = s.replace(/\d+個入り\d*[cｃ]?[mｍ]?/g, '');
  s = s.replace(/\d+入\(.*$/, '');
  s = s.replace(/\d+入$/, '');
  s = s.replace(/(\d+種)\d+[cｃ][mｍ]?/g, '$1');
  s = s.replace(/\d+種(?!\s*AS)/g, '');
  s = s.replace(/\*.*$/, '');
  s = s.replace(/～/g, '');
  s = s.replace(/^(?:500|1000|300|200)\s+/, '');
  s = s.replace(/品番\S*/g, '');
  s = s.replace(/CuriousGeorgeTOYSTYLE/g, 'ジョージ');
  const abbrevs = [
    ['ぬいぐるみ','NG'],['マスコット','MC'],['ボールチェーン','BC'],['キーホルダー','KH'],
    ['キーケース','KC'],['スクイーズ','SQ'],['ワイヤレスイヤホン','TWS'],['ブレスレット','BLT'],
    ['ミニゲーム機','MNGM'],['スマートウォッチ','SW'],['モバイルバッテリー','MBT'],
    ['コントローラー','CTRL'],['クッション','CSHN'],['ブランケット','BLKT'],['スピーカー','SPK'],
    ['フラッシュボタン','FLBT'],['ダストBOX','DTBX'],['ジャグラー','ジャグ'],['ディズニー','DN'],
    ['アソート','AS']
  ];
  for (const [from, to] of abbrevs) s = s.replaceAll(from, to);
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 15) s = s.substring(0, 15);
  return s;
}

// ======= parseExpectedDate =======
function parseExpectedDate(text, year) {
  if (!text || typeof text !== 'string') return null;
  text = text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  text = text.trim();
  let m = text.match(/(\d{4})年(\d{1,2})月\s*(上旬|中旬|下旬)/);
  if (m) { const d = m[3]==='上旬'?10:m[3]==='中旬'?20:28; return m[1]+'-'+m[2].padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  if (text.includes('即納')) return 'SOKUNOU';
  m = text.match(/(\d{4})年(\d{1,2})月\s*(\d{1,2})日/);
  if (m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m = text.match(/(\d{1,2})\/(\d{1,2})出荷/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  m = text.match(/(\d{1,2})[月\/](上|中|下)/);
  if (m) { const d = m[2]==='上'?10:m[2]==='中'?20:28; return year+'-'+m[1].padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  m = text.match(/^(\d{1,2})月$/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-15';
  m = text.match(/納品予定(\d{1,2})\/(\d{1,2})/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  m = text.match(/(\d{1,2})\/(上|中|下)/);
  if (m) { const d = m[2]==='上'?10:m[2]==='中'?20:28; return year+'-'+m[1].padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  m = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  return null;
}

function parseExpectedFromShipping(shippingStatus, year) {
  if (!shippingStatus) return null;
  let m = shippingStatus.match(/納品予定(\d{1,2})\/(\d{1,2})/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  m = shippingStatus.match(/(\d{1,2})\/(\d{1,2})出荷/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  m = shippingStatus.match(/(\d{1,2})\/(\d{1,2})発送/);
  if (m) return year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  return null;
}

// RFC4180 CSV parser
function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; const n = text[i+1];
    if (inQuote) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || (c === '\r' && n === '\n')) {
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        if (c === '\r') i++;
      } else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function mapDestination(raw) {
  if (!raw) return '';
  const s = raw.trim();
  if (s.includes('霧島')) return '鹿児島';
  if (s.includes('鹿児島')) return '鹿児島';
  if (s.includes('スポガ久留米')) return '久留米';
  if (s.includes('久留米')) return '久留米';
  if (s.includes('ドン・キホーテ飯塚') || s.includes('MEGAドンキ飯塚')) return '飯塚';
  if (s.includes('飯塚')) return '飯塚';
  if (s.includes('本社') || s.includes('野芥')) return '田隈';
  if (s.includes('change') || s.includes('Change') || s.includes('CHANGE')) return '田隈';
  if (s.includes('島添')) return '鹿児島';
  if (/久留米様/.test(s)) return '久留米';
  if (/飯塚様/.test(s)) return '飯塚';
  if (/鹿児島様/.test(s)) return '鹿児島';
  if (/田隈様/.test(s)) return '田隈';
  return s;
}

function detectBoxPrice(name, unitPrice, qty, totalExTax) {
  let notes = [];
  let realUnitPrice = unitPrice;
  let caseSize = null;
  let m = name.match(/(\d+)入\s?[＠@](\d+)/);
  if (m) { caseSize = parseInt(m[1]); realUnitPrice = parseInt(m[2]); notes.push(`箱単価修正: 元¥${unitPrice}→個¥${realUnitPrice}(${caseSize}入)`); return { realUnitPrice, caseSize, notes }; }
  m = name.match(/(\d+)個入り/);
  if (m && unitPrice >= 10000) { caseSize = parseInt(m[1]); realUnitPrice = Math.round(unitPrice / caseSize); notes.push(`箱単価修正: 元¥${unitPrice}→個¥${realUnitPrice}(${caseSize}入)`); return { realUnitPrice, caseSize, notes }; }
  m = name.match(/(\d+)入\(/);
  if (m && unitPrice >= 10000) { caseSize = parseInt(m[1]); realUnitPrice = qty > 0 && caseSize > 0 ? Math.round(totalExTax / caseSize / qty) : Math.round(unitPrice / caseSize); notes.push(`箱単価修正: 元¥${unitPrice}→個¥${realUnitPrice}(${caseSize}入)`); return { realUnitPrice, caseSize, notes }; }
  m = name.match(/(\d{1,3}(?:,\d{3})+)入/);
  if (m && unitPrice >= 10000) { caseSize = parseInt(m[1].replace(/,/g, '')); realUnitPrice = Math.round(unitPrice / caseSize); notes.push(`箱単価修正: 元¥${unitPrice}→個¥${realUnitPrice}(${caseSize}入)`); return { realUnitPrice, caseSize, notes }; }
  if (unitPrice >= 10000) notes.push('箱単価の可能性あり');
  return { realUnitPrice, caseSize, notes };
}

function safeNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,，¥￥円]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function safeStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1000) return null;
  if (serial > 40000 && serial < 60000) {
    const d = new Date((serial - 25569) * 86400000);
    return d.toISOString().split('T')[0];
  }
  return null;
}
function parseDateStr(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  if (s instanceof Date || (typeof s === 'object' && s.getTime)) return s.toISOString().split('T')[0];
  return null;
}
function getCellNum(ws, row, col) {
  const cell = ws.getCell(row, col);
  if (!cell || cell.value === null || cell.value === undefined) return 0;
  let v = cell.value;
  if (typeof v === 'object' && v.result !== undefined) v = v.result;
  if (typeof v === 'number') return v;
  return safeNum(v);
}
function getCellStr(ws, row, col) {
  const cell = ws.getCell(row, col);
  if (!cell || cell.value === null || cell.value === undefined) return '';
  let v = cell.value;
  if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text || '').join('');
  if (typeof v === 'object' && v.result !== undefined) v = v.result;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).trim();
}
function getCellDate(ws, row, col) {
  const cell = ws.getCell(row, col);
  if (!cell || cell.value === null || cell.value === undefined) return null;
  let v = cell.value;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'number' && v > 40000 && v < 60000) return excelDateToISO(v);
  return parseDateStr(String(v));
}

const allOrders = [];
const boxPriceCorrections = [];
const nameBeforeAfter = [];
const expectedDateLog = [];

// ======= PART A: 景品フォームCSV =======
async function parseKeihinFormCSVs() {
  const dirs = [BASE_DIR, DONE_DIR];
  let csvFiles = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.includes('景品フォーム発注履歴CSV') && f.endsWith('.csv'));
    csvFiles.push(...files.map(f => ({ name: f, path: path.join(dir, f) })));
  }
  console.log(`景品フォームCSV: ${csvFiles.length} files`);

  let count = 0;
  for (const file of csvFiles) {
    const raw = fs.readFileSync(file.path, 'utf-8');
    const rows = parseCSV(raw);
    if (rows.length < 2) continue;
    let fileYear = '2026';
    const ym = file.name.match(/伝票月：(\d{4})年/);
    if (ym) fileYear = ym[1];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 17) continue;
      const productName = safeStr(r[9]);
      if (!productName) continue;
      const orderDate = parseDateStr(r[4]) || null;
      const destination = mapDestination(r[6]);
      const unitPrice = safeNum(r[10]);
      const caseSize = safeNum(r[11]);
      const qty = safeNum(r[12]);
      const totalExTax = safeNum(r[14]);
      const shipping = safeNum(r[16]);
      const deliveryStatus = safeStr(r[17]);
      const rawExpDate = r.length > 18 ? safeStr(r[18]) : '';
      const category = r.length > 20 ? safeStr(r[20]) : '';

      const odYear = orderDate ? orderDate.substring(0, 4) : fileYear;
      let expectedDate = parseExpectedDate(rawExpDate, odYear);
      if (expectedDate === 'SOKUNOU') expectedDate = orderDate;
      if (!expectedDate && deliveryStatus) {
        expectedDate = parseExpectedFromShipping(deliveryStatus, odYear);
      }
      if (expectedDate) expectedDateLog.push({ src: '景品フォーム', raw: rawExpDate || deliveryStatus, parsed: expectedDate });

      const bp = detectBoxPrice(productName, unitPrice, qty, totalExTax);
      let noteParts = [];
      if (bp.notes.length) { noteParts.push(...bp.notes); boxPriceCorrections.push({ file: file.name, name: productName, orig: unitPrice, corrected: bp.realUnitPrice, caseSize: bp.caseSize }); }
      if (category) noteParts.push(`カテゴリー:${category}`);
      if (deliveryStatus) noteParts.push(`発送:${deliveryStatus}`);

      const shortened = shortenPrizeName(productName);
      nameBeforeAfter.push({ original: productName, shortened, supplier: '景品フォーム' });

      allOrders.push({
        prize_name_raw: productName, prize_name_short: shortened,
        supplier_id: '景品フォーム', order_date: orderDate, expected_date: expectedDate,
        case_quantity: bp.caseSize || caseSize || 1,
        case_count: Math.max(1, Math.round(qty)),
        unit_cost: bp.realUnitPrice, case_cost: bp.realUnitPrice * (bp.caseSize || caseSize || 1),
        notes: noteParts.join('; ') || null, status: 'confirmed',
        order_source: 'csv_import', source_file: file.name,
        order_date_source: 'csv_order_datetime',
        shipping_cost: shipping, shipping_allocation_method: qty > 0 ? 'per_order' : null,
        destination: destination, category: category || 'クレーン景品'
      });
      count++;
    }
  }
  console.log(`景品フォーム: ${count} orders parsed`);
}

// ======= PART B: インフィニティ XLSX =======
async function parseInfinityXlsx() {
  const dirs = [BASE_DIR, DONE_DIR];
  let files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const ff = fs.readdirSync(dir).filter(f => {
      if (!f.endsWith('.xlsx')) return false;
      if (/^(?:change様|㈱change様|坂本様|cahneg様)\d{4}請書/.test(f)) {
        if (/\(\d+\)\.xlsx$/.test(f)) return false;
        return true;
      }
      return false;
    });
    files.push(...ff.map(f => ({ name: f, path: path.join(dir, f), dir })));
  }
  console.log(`インフィニティXLSX: ${files.length} files`);

  let count = 0;
  for (const file of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file.path);
      const ws = wb.worksheets[0];
      if (!ws) continue;
      const mmddMatch = file.name.match(/(\d{4})請書/);
      if (!mmddMatch) continue;
      const mmdd = mmddMatch[1];
      const mm = mmdd.substring(0, 2);
      const dd = mmdd.substring(2, 4);
      // v8.1: Use Excel internal modified date instead of fs.stat mtime
      // fs.stat mtime changes on file copy/move, causing wrong year (2026 for 2025 files)
      const year = wb.modified ? wb.modified.getFullYear() : fs.statSync(file.path).mtime.getFullYear();
      const yearStr = String(year);
      const orderDate = `${yearStr}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;

      const items = [];
      let totalCases = 0;
      let shippingTotal = 0;
      for (let row = 16; row <= ws.rowCount; row += 2) {
        const name = getCellStr(ws, row, 2);
        const qtyVal = getCellNum(ws, row, 7);
        if (!name || qtyVal === 0) continue;
        const caseSz = getCellNum(ws, row, 6) || 1;
        const unitP = getCellNum(ws, row, 8);
        const amount = getCellNum(ws, row, 9);
        const expRaw = getCellStr(ws, row, 10);
        let expDate = getCellDate(ws, row, 10);
        if (!expDate && expRaw) {
          expDate = parseExpectedDate(expRaw, yearStr);
          if (expDate === 'SOKUNOU') expDate = orderDate;
        }
        if (expDate) expectedDateLog.push({ src: 'インフィニティ', raw: expRaw, parsed: expDate });
        const dest = getCellStr(ws, row, 11);
        items.push({ name, caseSize: caseSz, qty: qtyVal, unitPrice: unitP, amount, expectedDate: expDate, destination: dest });
        totalCases += qtyVal;
      }
      for (let row = 1; row <= ws.rowCount; row++) {
        const cellVal = getCellStr(ws, row, 2);
        if (cellVal.includes('送料')) { shippingTotal = getCellNum(ws, row, 9) || getCellNum(ws, row, 8); break; }
      }
      for (const item of items) {
        const mappedDest = mapDestination(item.destination);
        const shipAlloc = totalCases > 0 ? Math.round(shippingTotal * item.qty / totalCases) : 0;
        const shortened = shortenPrizeName(item.name);
        nameBeforeAfter.push({ original: item.name, shortened, supplier: 'インフィニティ' });
        allOrders.push({
          prize_name_raw: item.name, prize_name_short: shortened,
          supplier_id: 'インフィニティ', order_date: orderDate, expected_date: item.expectedDate,
          case_quantity: item.caseSize, case_count: Math.max(1, Math.round(item.qty)),
          unit_cost: item.unitPrice, case_cost: item.unitPrice * item.caseSize,
          notes: null, status: 'confirmed', order_source: 'xlsx_import',
          source_file: file.name, order_date_source: 'filename',
          shipping_cost: shipAlloc, shipping_allocation_method: 'proportional',
          destination: mappedDest, category: 'クレーン景品'
        });
        count++;
      }
    } catch (e) { console.error(`Error ${file.name}:`, e.message); }
  }
  console.log(`インフィニティ: ${count} orders`);
}

// ======= PART C: アクシズ XLSX =======
async function parseAxisXlsx() {
  const dirs = [BASE_DIR, DONE_DIR];
  let files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const ff = fs.readdirSync(dir).filter(f => {
      if (!f.endsWith('.xlsx')) return false;
      return /^\d{4}\.\d{2}\.\d{2}\s+㈱change様\s+請書/.test(f);
    });
    files.push(...ff.map(f => ({ name: f, path: path.join(dir, f), dir })));
  }
  console.log(`アクシズXLSX: ${files.length} files`);

  let count = 0;
  for (const file of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file.path);
      const ws = wb.worksheets[0];
      if (!ws) continue;
      const orderDate = getCellDate(ws, 3, 14) || null;
      const destRaw = getCellStr(ws, 6, 15);
      const destination = mapDestination(destRaw);
      const yearStr = orderDate ? orderDate.substring(0, 4) : String(new Date().getFullYear());

      for (let row = 14; row <= ws.rowCount; row++) {
        let nameParts = [];
        for (let c = 5; c <= 10; c++) { const v = getCellStr(ws, row, c); if (v) nameParts.push(v); }
        const name = nameParts.join(' ').trim();
        if (!name) continue;
        const shippingPerItem = getCellNum(ws, row, 3);
        const productCode = getCellStr(ws, row, 4);
        const caseSize = getCellNum(ws, row, 11) || 1;
        const unitPrice = getCellNum(ws, row, 14);
        const expRaw = getCellStr(ws, row, 16);
        let expectedDate = getCellDate(ws, row, 16);
        if (!expectedDate && expRaw) {
          expectedDate = parseExpectedDate(expRaw, yearStr);
          if (expectedDate === 'SOKUNOU') expectedDate = orderDate;
        }
        if (expectedDate) expectedDateLog.push({ src: 'アクシズ', raw: expRaw, parsed: expectedDate });
        if (unitPrice === 0 && caseSize <= 1) continue;
        const shortened = shortenPrizeName(name);
        nameBeforeAfter.push({ original: name, shortened, supplier: 'アクシズ' });
        allOrders.push({
          prize_name_raw: name, prize_name_short: shortened,
          supplier_id: 'アクシズ', order_date: orderDate, expected_date: expectedDate,
          case_quantity: caseSize, case_count: 1,
          unit_cost: unitPrice, case_cost: unitPrice * caseSize,
          notes: null, status: 'confirmed', order_source: 'xlsx_import',
          source_file: file.name, order_date_source: 'excel_cell',
          shipping_cost: shippingPerItem, shipping_allocation_method: 'per_item',
          destination: destination, category: 'クレーン景品'
        });
        count++;
      }
    } catch (e) { console.error(`Error ${file.name}:`, e.message); }
  }
  console.log(`アクシズ: ${count} orders`);
}

// ======= PART D: ピーチトイ XLSX =======
async function parsePeachToyXlsx() {
  const dirs = [BASE_DIR, DONE_DIR];
  let files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const ff = fs.readdirSync(dir).filter(f => {
      if (!f.endsWith('.xlsx')) return false;
      return f.includes('(株)Change') || f.includes('（株）Change');
    });
    files.push(...ff.map(f => ({ name: f, path: path.join(dir, f), dir })));
  }
  console.log(`ピーチトイXLSX: ${files.length} files`);

  let count = 0;
  for (const file of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file.path);
      // v8.1: Prefer Excel modified date over fs.stat mtime for consistent year detection
      const excelModDate = wb.modified || null;
      const stat = fs.statSync(file.path);
      const orderDate = excelModDate ? excelModDate.toISOString().split('T')[0] : stat.mtime.toISOString().split('T')[0];
      const yearStr = excelModDate ? String(excelModDate.getFullYear()) : String(stat.mtime.getFullYear());

      for (const ws of wb.worksheets) {
        const pendingItems = [];
        for (let row = 7; row <= ws.rowCount; row++) {
          const nameVal = getCellStr(ws, row, 1);
          if (!nameVal) continue;
          if (nameVal.includes('送料')) {
            const shippingCost = getCellNum(ws, row, 5) || getCellNum(ws, row, 4);
            if (pendingItems.length > 0 && shippingCost > 0) {
              const totalCases = pendingItems.reduce((s, it) => s + it.case_count, 0);
              for (const pi of pendingItems) {
                const alloc = totalCases > 0 ? Math.round(shippingCost * pi.case_count / totalCases) : 0;
                pi.shipping_cost = alloc;
              }
            }
            pendingItems.length = 0;
            continue;
          }
          const caseSize = getCellNum(ws, row, 4) || 1;
          const unitPrice = getCellNum(ws, row, 5);
          if (unitPrice === 0) continue;
          const remarks = getCellStr(ws, row, 8);
          let expectedDate = null;
          if (remarks) {
            expectedDate = parseExpectedDate(remarks, yearStr);
            if (expectedDate === 'SOKUNOU') expectedDate = orderDate;
            if (expectedDate) expectedDateLog.push({ src: 'ピーチトイ', raw: remarks, parsed: expectedDate });
          }
          const destRaw = getCellStr(ws, row, 9);
          const destMap = { '田': '田隈', '久': '久留米', '飯': '飯塚', '鹿': '鹿児島' };
          const destParts = destRaw.match(/([田久飯鹿])(\d+)/g) || [];
          const shortened = shortenPrizeName(nameVal);
          nameBeforeAfter.push({ original: nameVal, shortened, supplier: 'ピーチトイ' });

          if (destParts.length === 0) {
            const order = {
              prize_name_raw: nameVal, prize_name_short: shortened,
              supplier_id: 'ピーチトイ', order_date: orderDate, expected_date: expectedDate,
              case_quantity: caseSize, case_count: 1,
              unit_cost: unitPrice, case_cost: unitPrice * caseSize,
              notes: remarks || null, status: 'confirmed', order_source: 'xlsx_import',
              source_file: file.name, order_date_source: excelModDate ? 'excel_modified' : 'fs_mtime',
              shipping_cost: 0, shipping_allocation_method: 'proportional',
              destination: '', category: 'クレーン景品'
            };
            allOrders.push(order); pendingItems.push(order); count++;
          } else {
            for (const dp of destParts) {
              const dm = dp.match(/([田久飯鹿])(\d+)/);
              if (!dm) continue;
              const dest = destMap[dm[1]] || dm[1];
              const destQty = parseInt(dm[2]);
              let caseCount = Math.max(1, Math.round(destQty));
              let halfNote = destQty < 1 ? `ハーフ注文(${destQty}cs)` : null;
              const order = {
                prize_name_raw: nameVal, prize_name_short: shortened,
                supplier_id: 'ピーチトイ', order_date: orderDate, expected_date: expectedDate,
                case_quantity: caseSize, case_count: caseCount,
                unit_cost: unitPrice, case_cost: unitPrice * caseSize,
                notes: [remarks, halfNote].filter(Boolean).join('; ') || null,
                status: 'confirmed', order_source: 'xlsx_import',
                source_file: file.name, order_date_source: excelModDate ? 'excel_modified' : 'fs_mtime',
                shipping_cost: 0, shipping_allocation_method: 'proportional',
                destination: dest, category: 'クレーン景品'
              };
              allOrders.push(order); pendingItems.push(order); count++;
            }
          }
        }
      }
    } catch (e) { console.error(`Error ${file.name}:`, e.message); }
  }
  console.log(`ピーチトイ: ${count} orders`);
}

// ======= PART E: エスディーワイ XLSX =======
async function parseSDYXlsx() {
  const dirs = [BASE_DIR, DONE_DIR];
  let files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const ff = fs.readdirSync(dir).filter(f => {
      if (!f.endsWith('.xlsx')) return false;
      return /^(?:㈱change様|achieve様)\s*受注書/.test(f);
    });
    files.push(...ff.map(f => ({ name: f, path: path.join(dir, f), dir })));
  }
  console.log(`エスディーワイXLSX: ${files.length} files`);

  let count = 0;
  for (const file of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file.path);
      const ws = wb.worksheets[0];
      if (!ws) continue;
      const stat = fs.statSync(file.path);
      let orderDate = null;
      let orderDateSource = 'modified';
      // v8.2: Priority: wb.lastPrinted > wb.modified > fs.stat mtime > today
      if (wb.lastPrinted) {
        orderDate = new Date(wb.lastPrinted).toISOString().split('T')[0];
        orderDateSource = 'lastPrinted';
      }
      if (!orderDate && wb.modified) {
        orderDate = wb.modified.toISOString().split('T')[0];
        orderDateSource = 'excel_modified';
      }
      if (!orderDate) { orderDate = stat.mtime.toISOString().split('T')[0]; orderDateSource = 'fs_mtime'; }
      const yearStr = orderDate ? orderDate.substring(0, 4) : String(stat.mtime.getFullYear());

      for (let row = 11; row <= Math.min(ws.rowCount, 500); row++) {
        const name = getCellStr(ws, row, 1);
        if (!name) break;
        const caseSize = getCellNum(ws, row, 2) || 1;
        const unitPrice = getCellNum(ws, row, 3);
        const ctTotal = getCellNum(ws, row, 4);
        const expRaw = getCellStr(ws, row, 5);
        let expectedDate = getCellDate(ws, row, 5);
        if (!expectedDate && expRaw) {
          expectedDate = parseExpectedDate(expRaw, yearStr);
          if (expectedDate === 'SOKUNOU') expectedDate = orderDate;
        }
        if (expectedDate) expectedDateLog.push({ src: 'エスディーワイ', raw: expRaw, parsed: expectedDate });
        const remarks = getCellStr(ws, row, 6);
        const storeRaw = getCellStr(ws, row, 7);
        if (unitPrice === 0 && ctTotal === 0) continue;
        let dest = mapDestination(storeRaw);
        if (dest === storeRaw) {
          const storeMap = { '久留米店': '久留米', '飯塚店': '飯塚', '野芥': '田隈', '鹿児島': '鹿児島', '本社': '田隈' };
          for (const [k, v] of Object.entries(storeMap)) { if (storeRaw.includes(k)) { dest = v; break; } }
        }
        const shortened = shortenPrizeName(name);
        nameBeforeAfter.push({ original: name, shortened, supplier: 'エスディーワイ' });
        allOrders.push({
          prize_name_raw: name, prize_name_short: shortened,
          supplier_id: 'エスディーワイ', order_date: orderDate, expected_date: expectedDate,
          case_quantity: caseSize, case_count: 1,
          unit_cost: unitPrice, case_cost: unitPrice * caseSize,
          notes: remarks || null, status: 'confirmed', order_source: 'xlsx_import',
          source_file: file.name, order_date_source: orderDateSource,
          shipping_cost: 0, shipping_allocation_method: null,
          destination: dest, category: 'クレーン景品'
        });
        count++;
      }
    } catch (e) { console.error(`Error ${file.name}:`, e.message); }
  }
  console.log(`エスディーワイ: ${count} orders`);
}

// ======= Supabase Delete All =======
async function deleteAllFromSupabase() {
  if (DRY_RUN || SKIP_DELETE) {
    console.log('Supabase全削除: スキップ');
    return;
  }
  console.log('=== Supabase全削除 ===');
  // Delete prize_orders first (FK dependency)
  let r = await supaFetch('/rest/v1/prize_orders?order_id=neq.NONE', 'DELETE');
  console.log(`prize_orders DELETE: ${r.status}`);
  r = await supaFetch('/rest/v1/prize_masters?prize_id=neq.NONE', 'DELETE');
  console.log(`prize_masters DELETE: ${r.status}`);
}

// ======= MAIN =======
async function main() {
  console.log('=== Parsing all sources ===');
  await parseKeihinFormCSVs();
  await parseInfinityXlsx();
  await parseAxisXlsx();
  await parsePeachToyXlsx();
  await parseSDYXlsx();

  console.log(`\n=== Total orders: ${allOrders.length} ===`);
  const bySup = {};
  for (const o of allOrders) bySup[o.supplier_id] = (bySup[o.supplier_id] || 0) + 1;
  console.log('By supplier:', JSON.stringify(bySup));

  const expStats = {};
  for (const o of allOrders) {
    const key = o.supplier_id;
    if (!expStats[key]) expStats[key] = { total: 0, withDate: 0 };
    expStats[key].total++;
    if (o.expected_date) expStats[key].withDate++;
  }
  console.log('Expected date coverage:', JSON.stringify(expStats));

  // ======= Build prize_masters =======
  console.log('\n=== Building prize_masters ===');
  const masterMap = new Map();
  let pzCounter = 1;
  for (const o of allOrders) {
    const key = o.prize_name_short;
    if (!key) continue;
    if (!masterMap.has(key)) {
      masterMap.set(key, {
        prize_id: `PZ-${String(pzCounter++).padStart(5, '0')}`,
        prize_name: key, original_cost: o.unit_cost, supplier_name: o.supplier_id,
        aliases: new Set([o.prize_name_raw]), category: o.category || 'クレーン景品',
        status: 'active', last_order_date: o.order_date
      });
    } else {
      const m = masterMap.get(key);
      m.aliases.add(o.prize_name_raw);
      if (o.order_date && (!m.last_order_date || o.order_date > m.last_order_date)) {
        m.original_cost = o.unit_cost;
        m.last_order_date = o.order_date;
      }
    }
  }
  console.log(`prize_masters: ${masterMap.size} unique`);

  const masters = Array.from(masterMap.values()).map(m => ({
    prize_id: m.prize_id, prize_name: m.prize_name, original_cost: m.original_cost,
    supplier_name: m.supplier_name, aliases: JSON.stringify(Array.from(m.aliases).slice(0, 10)),
    category: m.category, status: m.status
  }));

  // ======= Supabase Delete + Insert =======
  await deleteAllFromSupabase();

  if (!DRY_RUN) {
    console.log('\n=== Inserting prize_masters ===');
    for (let i = 0; i < masters.length; i += 100) {
      const batch = masters.slice(i, i + 100);
      const r = await supaFetch('/rest/v1/prize_masters', 'POST', batch);
      if (r.status !== 201) {
        console.error(`prize_masters batch ${i}: ${r.status} ${r.body.substring(0, 300)}`);
      }
    }
    console.log(`prize_masters: ${masters.length} inserted`);
  } else {
    console.log(`[DRY-RUN] prize_masters: ${masters.length} would be inserted`);
  }

  // ======= Build + Insert prize_orders =======
  const nameToId = new Map();
  for (const m of masterMap.values()) nameToId.set(m.prize_name, m.prize_id);

  let orderCounter = 1;
  const orders = allOrders.map(o => {
    let caseCount = o.case_count;
    let notes = o.notes || '';
    if (typeof o.case_count === 'number' && o.case_count < 1 && o.case_count > 0) {
      caseCount = 1; notes = notes ? notes + '; ハーフ注文(0.5cs)' : 'ハーフ注文(0.5cs)';
    }
    return {
      order_id: `ORD-${String(orderCounter++).padStart(6, '0')}`,
      prize_id: nameToId.get(o.prize_name_short) || null,
      prize_name_raw: o.prize_name_raw, supplier_id: o.supplier_id,
      order_date: o.order_date, expected_date: o.expected_date,
      case_quantity: o.case_quantity, case_count: Math.max(1, Math.round(caseCount)),
      unit_cost: o.unit_cost, case_cost: o.case_cost,
      notes: notes || null, status: o.status, order_source: o.order_source,
      source_file: o.source_file, order_date_source: o.order_date_source,
      shipping_cost: o.shipping_cost || 0,
      shipping_allocation_method: o.shipping_allocation_method,
      destination: o.destination || null
    };
  });

  let insertErrors = 0;
  if (!DRY_RUN) {
    console.log('\n=== Inserting prize_orders ===');
    for (let i = 0; i < orders.length; i += 100) {
      const batch = orders.slice(i, i + 100);
      const r = await supaFetch('/rest/v1/prize_orders', 'POST', batch);
      if (r.status !== 201) {
        console.error(`prize_orders batch ${i}: ${r.status} ${r.body.substring(0, 300)}`);
        insertErrors++;
      }
    }
    console.log(`prize_orders: ${orders.length} inserted (errors: ${insertErrors})`);
  } else {
    console.log(`[DRY-RUN] prize_orders: ${orders.length} would be inserted`);
  }

  // ======= Excel Output =======
  console.log('\n=== Creating Excel v8 ===');
  const outWb = new ExcelJS.Workbook();

  const s1 = outWb.addWorksheet('景品マスタ');
  s1.columns = [
    { header: 'prize_id', key: 'pid', width: 12 },
    { header: '景品名(短縮)', key: 'name', width: 20 },
    { header: '仕入単価', key: 'cost', width: 10 },
    { header: '仕入先', key: 'sup', width: 15 },
    { header: 'エイリアス', key: 'alias', width: 40 },
    { header: 'カテゴリー', key: 'cat', width: 15 },
    { header: 'status', key: 'st', width: 10 }
  ];
  for (const m of masters) {
    s1.addRow({ pid: m.prize_id, name: m.prize_name, cost: m.original_cost, sup: m.supplier_name, alias: m.aliases, cat: m.category, st: m.status });
  }

  const s2 = outWb.addWorksheet('発注履歴');
  s2.columns = [
    { header: 'order_id', key: 'oid', width: 14 },
    { header: 'prize_id', key: 'pid', width: 12 },
    { header: '商品名(raw)', key: 'raw', width: 30 },
    { header: '仕入先', key: 'sup', width: 15 },
    { header: '発注日', key: 'od', width: 12 },
    { header: '納期', key: 'ed', width: 12 },
    { header: '入数', key: 'cq', width: 8 },
    { header: 'ケース数', key: 'cc', width: 8 },
    { header: '単価', key: 'uc', width: 10 },
    { header: '送料', key: 'sh', width: 8 },
    { header: '配送先', key: 'dest', width: 10 },
    { header: 'notes', key: 'n', width: 30 },
    { header: 'ソース', key: 'sf', width: 30 }
  ];
  for (const o of orders) {
    s2.addRow({ oid: o.order_id, pid: o.prize_id, raw: o.prize_name_raw, sup: o.supplier_id, od: o.order_date, ed: o.expected_date, cq: o.case_quantity, cc: o.case_count, uc: o.unit_cost, sh: o.shipping_cost, dest: o.destination, n: o.notes, sf: o.source_file });
  }

  const s3 = outWb.addWorksheet('サマリ');
  s3.addRow(['項目', '値']);
  s3.addRow(['総発注件数', orders.length]);
  s3.addRow(['景品マスタ数', masters.length]);
  s3.addRow(['箱単価修正件数', boxPriceCorrections.length]);
  s3.addRow(['---仕入先別---', '']);
  for (const [sup, cnt] of Object.entries(bySup)) s3.addRow([`${sup}発注数`, cnt]);
  s3.addRow(['---配送先別---', '']);
  const byDest = {};
  for (const o of allOrders) byDest[o.destination || '不明'] = (byDest[o.destination || '不明'] || 0) + 1;
  for (const [d, c] of Object.entries(byDest)) s3.addRow([`配送先:${d}`, c]);
  s3.addRow(['---納期カバー率---', '']);
  for (const [sup, st] of Object.entries(expStats)) {
    s3.addRow([`${sup} 納期あり`, `${st.withDate}/${st.total} (${Math.round(st.withDate/st.total*100)}%)`]);
  }

  const s4 = outWb.addWorksheet('短縮比較');
  s4.columns = [
    { header: '仕入先', key: 'sup', width: 15 },
    { header: '元の商品名', key: 'orig', width: 50 },
    { header: '短縮後', key: 'short', width: 20 }
  ];
  for (const n of nameBeforeAfter.slice(0, 500)) s4.addRow({ sup: n.supplier, orig: n.original, short: n.shortened });

  const s5 = outWb.addWorksheet('箱単価修正');
  s5.columns = [
    { header: 'ファイル', key: 'file', width: 30 },
    { header: '商品名', key: 'name', width: 40 },
    { header: '元単価', key: 'orig', width: 10 },
    { header: '修正単価', key: 'corr', width: 10 },
    { header: '入数', key: 'cs', width: 8 }
  ];
  for (const bp of boxPriceCorrections) s5.addRow({ file: bp.file, name: bp.name, orig: bp.orig, corr: bp.corrected, cs: bp.caseSize });

  const excelName = DRY_RUN ? '全取込結果v8_dryrun.xlsx' : '全取込結果v8.xlsx';
  await outWb.xlsx.writeFile(path.join(OUT_DIR, excelName));
  console.log(`Excel: ${excelName} written`);

  // ======= Save JSON state =======
  fs.writeFileSync(path.join(OUT_DIR, '_v8_orders.json'), JSON.stringify(orders.slice(0, 50), null, 2));

  // ======= Final Summary =======
  const END_TIME = new Date();
  const elapsed = ((END_TIME - START_TIME) / 1000).toFixed(1);
  console.log('\n========== v8 FINAL SUMMARY ==========');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : SKIP_DELETE ? 'SKIP-DELETE' : 'FULL'}`);
  console.log(`Start: ${START_TIME.toISOString()}`);
  console.log(`End:   ${END_TIME.toISOString()}`);
  console.log(`Elapsed: ${elapsed}s`);
  console.log(`Orders: ${orders.length}`);
  console.log(`Masters: ${masters.length}`);
  console.log(`BoxPrice fixes: ${boxPriceCorrections.length}`);
  console.log(`ExpDate parsed: ${expectedDateLog.length}`);
  console.log('By supplier:', JSON.stringify(bySup));
  console.log('By dest:', JSON.stringify(byDest));
  console.log('ExpDate coverage:', JSON.stringify(expStats));
  if (!DRY_RUN) console.log('Insert errors:', insertErrors);
  console.log('========================================');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
