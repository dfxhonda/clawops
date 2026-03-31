/**
 * ClawOps メール自動取込 (Google Apps Script)
 *
 * 機能:
 * 1. SDY/INF/AXSメールから景品案内をパース → prize_announcements登録
 * 2. 添付画像をSupabase Storageにアップ → image_url紐付け
 * 3. 発注書/請書メール → prize_orders直接登録
 * 4. prize_mastersに未登録なら自動追加（短縮名生成）
 *
 * セットアップ:
 * 1. script.google.com にchangegame.jpでログイン
 * 2. 新規プロジェクト作成 → このコードを貼り付け
 * 3. dailyProcess() を手動実行（権限承認）
 * 4. トリガー: dailyProcess を毎日1回 + processImages を15分おき
 *
 * clasp連携（将来）:
 * npm install -g @google/clasp && clasp login && clasp push
 */

// ─── 設定 ───
const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs';
const BUCKET = 'announcements';
const PROP_KEY = 'processed_ids';
const PROP_KEY_IMG = 'processed_img_ids';

// 仕入先判定
const SUPPLIER_MAP = {
  'info@sdy-co.com': 'SDY',
  'achieve.sakamoto@gmail.com': 'AXS',
  'infinity': 'INF',  // 転送メール: 件名に「請書」+添付xlsx
  'peach_to_y@rj8.so-net.ne.jp': 'PCH',
};

// 短縮名: 略語マップ
const ABBREV = [
  [/マスコット/g, 'MC'], [/スクイーズ/g, 'SQ'], [/ぬいぐるみ/g, 'ヌイ'],
  [/キーホルダー/g, 'KH'], [/キーチェーン/g, 'KC'], [/ワンポイントチャーム/g, 'WPチャーム'],
  [/ブラインドボックス/g, 'BB'], [/ヘアクリップ/g, 'Hクリップ'], [/ヘアアイロン/g, 'Hアイロン'],
  [/ステンレスタンブラー/g, 'SSタンブラー'], [/オイルマスコット/g, 'オイルMC'],
  [/ぷっくりネイルチップ/g, 'ネイルチップ'], [/ぷくぷくキャンディシール/g, 'キャンディシール'],
  [/ぷくぷくキャンディーシール/g, 'キャンディシール'],
  [/シリコンスクイーズ/g, 'シリコンSQ'],
];
// 短縮名: 削除語
const REMOVE_WORDS = [
  /まるで本物[？?]?/g, /新商品\s*/g, /超超?BIG\s*/g, /DX\s*/g,
  /\s*品番[：:]?\s*\S+/g, /\s*入数[：:]?\s*\S+/g,
  /（[^）]*）/g, /\([^)]*\)/g,  // 括弧内削除
];

// ─── Supabase ヘルパー ───
function sbGet(table, params) {
  const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/' + table + '?' + (params || ''), {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY },
    muteHttpExceptions: true,
  });
  return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : [];
}

function sbPost(table, body) {
  const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/' + table, {
    method: 'post',
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 300) {
    Logger.log('sbPost error: ' + r.getContentText());
    return null;
  }
  return JSON.parse(r.getContentText());
}

function sbPatch(table, id, body) {
  UrlFetchApp.fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'patch',
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
}

// ─── 短縮名生成 ───
function generateShortName(rawName) {
  let name = rawName.trim();
  // 削除語
  for (const re of REMOVE_WORDS) name = name.replace(re, '');
  // 略語置換
  for (const [re, abbr] of ABBREV) name = name.replace(re, abbr);
  // 空白正規化
  name = name.replace(/[\s　]+/g, ' ').trim();
  // 20文字以内に
  if (name.length > 20) {
    // スペースで分割して後ろから削る
    const parts = name.split(' ');
    name = '';
    for (const p of parts) {
      if ((name + ' ' + p).trim().length <= 20) name = (name + ' ' + p).trim();
      else break;
    }
    if (!name) name = rawName.slice(0, 20);
  }
  return name || rawName.slice(0, 20);
}

// ─── メールパース: SDY ───
function parseSDYEmail(body, subject) {
  const items = [];
  // パターン1: 「商品名 入数 @単価 納期」
  // パターン2: 「商品名\n入数 XX入\n価格 ＠XXX\n納期 XX」
  // パターン3: 「商品名 XX個 XXX円 納期」

  const lines = body.replace(/\r/g, '').split('\n').map(l => l.replace(/\*/g, '').trim()).filter(Boolean);

  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 署名開始で終了
    if (line.includes('◇◆◇◆') || line.includes('エスディーワイ') || line.includes('TEL：')) break;
    if (line.includes('お世話になっ') || line.includes('よろしくお願い') || line.includes('新商品のご案内')) continue;
    if (line.includes('※') || line.includes('ハーフ') && !currentItem) continue;
    if (line.includes('送料') && !currentItem) continue;

    // 「入数」「価格」「納期」「単価」「品番」「種類」「サイズ」「アイテム」行
    const isMetaLine = /^(入数|価格|納期|単価|品番|種類|サイズ|アイテム)[：:\s]/.test(line);

    if (isMetaLine && currentItem) {
      // メタ情報を現在のアイテムに追加
      const qtyMatch = line.match(/(\d+)\s*入/);
      const priceMatch = line.match(/[＠@][\s]*(\d[\d,]*)/);
      const dateMatch = line.match(/([\d]+月[上中下旬]*|即納|\d+日)/);

      if (qtyMatch) currentItem.case_quantity = parseInt(qtyMatch[1].replace(/,/g, ''));
      if (priceMatch) currentItem.unit_cost = parseInt(priceMatch[1].replace(/[,，]/g, ''));
      if (dateMatch) currentItem.notes = (currentItem.notes || '') + ' 納期' + dateMatch[1];
      continue;
    }

    // ワンライン: 「商品名 XX個 XXX円 納期」
    const oneLineMatch = line.match(/^(.+?)\s+(\d+)個\s+(\d[\d,]*)円\s+(.+)$/);
    if (oneLineMatch) {
      if (currentItem && currentItem.prize_name) items.push(currentItem);
      currentItem = {
        prize_name: oneLineMatch[1].trim(),
        case_quantity: parseInt(oneLineMatch[2]),
        unit_cost: parseInt(oneLineMatch[3].replace(/,/g, '')),
        notes: '納期' + oneLineMatch[4].trim(),
      };
      continue;
    }

    // ワンライン: 「商品名 単位XX個 ＠XXX 納期」
    const oneLine2 = line.match(/^(.+?)\s+(?:単位)?(\d[\d,]*)個?\s+.*?[＠@][\s]*(\d[\d,]*)/);
    if (oneLine2) {
      if (currentItem && currentItem.prize_name) items.push(currentItem);
      const dateMatch = line.match(/([\d]+月[上中下旬]*|即納)/);
      currentItem = {
        prize_name: oneLine2[1].trim(),
        case_quantity: parseInt(oneLine2[2].replace(/,/g, '')),
        unit_cost: parseInt(oneLine2[3].replace(/,/g, '')),
        notes: dateMatch ? '納期' + dateMatch[1] : '',
      };
      continue;
    }

    // ＠付き行: 「＠XXX XX入」
    const priceQtyLine = line.match(/[＠@][\s]*([\d,]+)\s+.*?(\d+)入/);
    if (priceQtyLine && currentItem) {
      currentItem.unit_cost = parseInt(priceQtyLine[1].replace(/,/g, ''));
      currentItem.case_quantity = parseInt(priceQtyLine[2]);
      continue;
    }
    const qtyPriceLine = line.match(/(\d+)入\s+.*?[＠@][\s]*([\d,]+)/);
    if (qtyPriceLine && currentItem) {
      currentItem.case_quantity = parseInt(qtyPriceLine[1]);
      currentItem.unit_cost = parseInt(qtyPriceLine[2].replace(/,/g, ''));
      continue;
    }

    // 単独＠行
    if (/^[＠@]/.test(line) && currentItem) {
      const pm = line.match(/[＠@][\s]*([\d,]+)/);
      const qm = line.match(/(\d+)入/);
      if (pm) currentItem.unit_cost = parseInt(pm[1].replace(/,/g, ''));
      if (qm) currentItem.case_quantity = parseInt(qm[1]);
      continue;
    }

    // 新しい商品名行（メタ行でも価格行でもない、ある程度の長さがある行）
    if (line.length >= 3 && !isMetaLine && !/^[＠@\d※【送]/.test(line) && !/^(ハーフ|納期)/.test(line)) {
      if (currentItem && currentItem.prize_name) items.push(currentItem);
      currentItem = { prize_name: line, notes: '' };
    }
  }

  if (currentItem && currentItem.prize_name) items.push(currentItem);

  // 単価がないアイテム、ゴミデータを除外
  return items.filter(it => it.prize_name && it.unit_cost
    && it.prize_name.length >= 3
    && !/^(お世話|いつも|よろしく|新商品の)/.test(it.prize_name));
}

// ─── メルカリ アカウント→仕入先マップ ───
const MERCARI_ACCOUNTS = {
  'merukarider': 'MCR',   // 本田
  'k&a':        'MC2',   // 坂本
};

// ─── メルカリ購入メール パーサー ───
function parseMercariEmail(body) {
  const items = [];

  // 商品名
  const nameMatch = body.match(/商品名\s*[:：]\s*(.+)/);
  if (!nameMatch) return items;
  const prizeName = nameMatch[1].trim();

  // 商品代金（ケース金額として使う）
  const priceMatch = body.match(/商品代金\s*[:：]\s*[￥¥]?([\d,]+)/);
  const totalPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
  if (!totalPrice) return items;

  // 数量: 商品名から「X種」「X個」「Xセット」「X入」を抽出
  let qty = 1;
  const qtyMatch = prizeName.match(/(\d+)\s*[種個セット入枚箱]/);
  if (qtyMatch) qty = parseInt(qtyMatch[1]);

  // 単価 = 商品代金 ÷ 数量
  const unitCost = Math.round(totalPrice / qty);

  // 商品ID（メモ用）
  const idMatch = body.match(/商品ID\s*[:：]\s*(\S+)/);
  const mercariId = idMatch ? idMatch[1].trim() : '';

  // アカウント判定（「XXXさん」の部分）
  const accountMatch = body.match(/^>?\s*(\S+?)さん/m);
  const accountName = accountMatch ? accountMatch[1].toLowerCase() : '';
  const supplierId = MERCARI_ACCOUNTS[accountName] || 'MCR';

  items.push({
    prize_name: prizeName,
    unit_cost: unitCost,
    case_quantity: qty,
    case_cost: totalPrice,
    notes: 'メルカリ購入' + (mercariId ? ' ' + mercariId : ''),
    _supplierId: supplierId,
  });

  return items;
}

// メルカリのsupplierIdを取得
function getMercariSupplierId(items) {
  return (items.length > 0 && items[0]._supplierId) ? items[0]._supplierId : 'MCR';
}

// ─── 次のprize_id取得 ───
function getNextPrizeId() {
  const rows = sbGet('prize_masters', 'select=prize_id&order=prize_id.desc&limit=1');
  if (rows.length) {
    const num = parseInt(rows[0].prize_id.replace('PZ-', ''));
    return 'PZ-' + String(num + 1).padStart(5, '0');
  }
  return 'PZ-01044';
}

// ─── prize_mastersに登録（未登録なら） ───
function ensurePrizeMaster(prizeName, unitCost, supplierId) {
  // 同名チェック
  const existing = sbGet('prize_masters', 'select=prize_id&prize_name=eq.' + encodeURIComponent(prizeName) + '&limit=1');
  if (existing.length) return existing[0].prize_id;

  const prizeId = getNextPrizeId();
  const shortName = generateShortName(prizeName);

  // supplier_nameをsuppliersテーブルから取得
  const supRows = sbGet('suppliers', 'select=supplier_name&supplier_id=eq.' + encodeURIComponent(supplierId) + '&limit=1');
  const supplierName = (supRows.length && supRows[0].supplier_name) || null;

  const result = sbPost('prize_masters', {
    prize_id: prizeId,
    prize_name: prizeName,
    original_cost: unitCost,
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'active',
    aliases: JSON.stringify([shortName]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (result) {
    Logger.log('New master: ' + prizeId + ' = ' + prizeName + ' (短縮: ' + shortName + ')');
    return prizeId;
  }
  return null;
}

// ─── インフィニティ請書 Excel パーサー（GAS版） ───
function parseInfinityAttachment(attachment, orderDate) {
  const items = [];
  try {
    // ExcelをGoogleスプレッドシートに変換して読む
    const blob = attachment.copyBlob();
    const tempFile = Drive.Files.create(
      { name: 'temp_inf_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' },
      blob, { fields: 'id' }
    );
    const ss = SpreadsheetApp.openById(tempFile.id);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    // 16行目(index 15)から2行おき: B=商品名, F=入数, G=数量, H=単価, I=金額, J=入荷予定, K=行先
    for (let r = 15; r < data.length; r += 2) {
      const name = String(data[r][1] || '').trim();   // B列
      const caseSize = Number(data[r][5]) || 1;       // F列
      const qty = Number(data[r][6]) || 0;            // G列
      const unitPrice = Number(data[r][7]) || 0;      // H列
      const dest = String(data[r][10] || '').trim();   // K列

      if (!name || qty === 0 || unitPrice === 0) continue;

      items.push({
        prize_name: name,
        unit_cost: unitPrice,
        case_quantity: caseSize,
        case_cost: unitPrice * caseSize,
        notes: dest ? '行先:' + dest : '',
      });
    }

    // 一時ファイル削除
    DriveApp.getFileById(tempFile.id).setTrashed(true);
  } catch (e) {
    Logger.log('INF Excel parse error: ' + e.message);
  }
  return items;
}

// ─── ピーチトイ PDF請求書パーサー ───
// 3パス方式: (1)前処理 (2)全行を分類 (3)単価行ごとに直前の品名・数量を紐付け
function parsePCHPdfAttachment(attachment, orderDate) {
  const items = [];
  try {
    const blob = attachment.copyBlob();
    blob.setContentType('application/pdf');
    const tempFile = Drive.Files.create(
      { name: 'temp_pch_' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
      blob, { fields: 'id' }
    );
    const doc = DocumentApp.openById(tempFile.id);
    const text = doc.getBody().getText();
    DriveApp.getFileById(tempFile.id).setTrashed(true);

    const rawLines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);

    // スキップパターン
    const SKIP = /^(814|546|福岡|大阪|株式会社|ピーチトイ|ビーチトイ|樣|橼|毎度|下記|登録番号|TEL|FAX|三菱|普通|前回|御入金|縑越|繰越|纖越|今回|消費税|消费|御買|御寶|伝票日付|伝票No|品\s*番|品\s*名|数\s*量|単\s*位|単\s*価|金\s*額|年|月|日\s*締|ZIU|TU|\d+\s*個)/;
    const SKIP_CONTENT = /振込|入金|送料|:$/;
    const IS_JP = /[ぁ-ヿ㐀-䶵一-鿋豈-頻々〇〻\u3400-\u9FFF\uF900-\uFAFFａ-ｚＡ-Ｚ]/;

    // Pass 0: 前処理 — 行を正規化
    const lines = [];
    for (let line of rawLines) {
      // 先頭の伝票番号(6桁)を除去: 「213343 Pro4ワイヤレス...」→「Pro4ワイヤレス...」
      line = line.replace(/^\d{6}\s+/, '');
      // 末尾のゴミ除去
      line = line.replace(/\s*[✓\/\-]\s*$/, '').trim();
      // 「660.00 10 10%」→「660.00 10%」（OCR重複）
      line = line.replace(/(\d+\.00)\s+10\s+10%/, '$1 10%');
      // 「660.00 10\n10%」対応は後述
      if (line) lines.push(line);
    }

    // Pass 0.5: 連結品名を分割
    // 「ミニポーチ巻き寿司キティ ミニポーチ巻き寿司マイメロディ」→ 2行に
    const expanded = [];
    for (const line of lines) {
      // 単価行やスキップ行はそのまま
      if (/\.00\s+10%/.test(line) || SKIP.test(line) || /^\d{4}\/\d{2}\/\d{2}$/.test(line)) {
        expanded.push(line);
        continue;
      }
      // 日本語品名行で、スペース区切りで複数の品名がありそうな場合
      if (IS_JP.test(line) && !SKIP_CONTENT.test(line)) {
        const parts = splitConcatenatedNames(line);
        for (const p of parts) expanded.push(p);
      } else {
        expanded.push(line);
      }
    }

    // 品名分割ヘルパー: スペースで区切って、各パーツが独立した品名かどうか判定
    function splitConcatenatedNames(line) {
      const parts = line.split(/\s+/);
      if (parts.length <= 1) return [line];

      // 各パーツが3文字以上で日本語を含むかチェック
      const names = [];
      let current = parts[0];
      for (let k = 1; k < parts.length; k++) {
        const part = parts[k];
        // 次のパーツが独立した品名っぽい（3文字以上かつ日本語/英字で始まる）
        if (part.length >= 3 && IS_JP.test(part) && current.length >= 3) {
          names.push(current);
          current = part;
        } else {
          current += ' ' + part;
        }
      }
      names.push(current);
      return names;
    }

    // Pass 1: 各行を分類してタグ付け
    const tagged = [];
    for (const line of expanded) {
      if (SKIP.test(line)) { tagged.push({ type: 'skip', line }); continue; }
      if (SKIP_CONTENT.test(line)) { tagged.push({ type: 'skip', line }); continue; }
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(line)) { tagged.push({ type: 'skip', line }); continue; }
      if (/^\d{6}$/.test(line)) { tagged.push({ type: 'skip', line }); continue; }

      // 単価行: 「XXX.00 10%」を含む
      const priceMatch = line.match(/([\d,]+)\.\d{2}\s+10%/);
      if (priceMatch) {
        const unitCost = parseInt(priceMatch[1].replace(/,/g, ''));
        const qtyMatch = line.match(/^(\d[\d,]*)\s/);
        const qty = qtyMatch ? parseInt(qtyMatch[1].replace(/,/g, '')) : null;
        const amtMatch = line.match(/10%\s+([\d,\s]+)$/);
        const amt = amtMatch ? parseInt(amtMatch[1].replace(/[,\s]/g, '')) : null;
        tagged.push({ type: 'price', unitCost, qty, amt, line });
        continue;
      }

      // 数値のみ行（数量 or 金額）
      if (/^[\d,\s]+\.?$/.test(line)) {
        const val = parseInt(line.replace(/[,\s\.]/g, ''));
        tagged.push({ type: 'num', val, line });
        continue;
      }

      // 日本語を含む = 品名候補
      if (IS_JP.test(line) && line.length >= 3) {
        const cleaned = line.replace(/\s+\/\s*$/, '').replace(/\s*-\s*$/, '').trim();
        tagged.push({ type: 'name', line: cleaned });
        continue;
      }

      // 英数字の品名候補 (Pro4等)
      if (/^[A-Za-z0-9]/.test(line) && line.length >= 3 && IS_JP.test(line)) {
        tagged.push({ type: 'name', line: line.trim() });
        continue;
      }

      tagged.push({ type: 'skip', line });
    }

    // Pass 2: 単価行(price)ごとに品名・数量・金額を紐付け
    const usedNames = new Set();

    for (let i = 0; i < tagged.length; i++) {
      if (tagged[i].type !== 'price') continue;

      const p = tagged[i];
      let qty = p.qty;
      let totalCost = p.amt;

      // 数量が単価行にない場合: 直前のnum行を探す
      if (!qty) {
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          if (tagged[j].type === 'num' && tagged[j].val < 10000) {
            qty = tagged[j].val;
            break;
          }
          if (tagged[j].type === 'price') break;
        }
      }

      // 金額が単価行にない場合: 直後のnum行を探す
      if (!totalCost) {
        for (let j = i + 1; j <= Math.min(tagged.length - 1, i + 2); j++) {
          if (tagged[j].type === 'num') {
            totalCost = tagged[j].val;
            break;
          }
          if (tagged[j].type === 'price' || tagged[j].type === 'name') break;
        }
      }

      // 品名: 直前の未使用name行を探す
      let name = null;
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        if (tagged[j].type === 'name' && !usedNames.has(j)) {
          name = tagged[j].line;
          usedNames.add(j);
          break;
        }
        if (tagged[j].type === 'price') break;
      }

      if (!name || p.unitCost <= 0) continue;
      if (!qty || qty <= 0) qty = 1;

      items.push({
        prize_name: name,
        unit_cost: p.unitCost,
        case_quantity: qty,
        case_cost: totalCost || (qty * p.unitCost),
        notes: '',
      });
    }

    // 重複除去
    const seen = new Set();
    const unique = [];
    for (const it of items) {
      const key = it.prize_name + '|' + it.case_quantity + '|' + it.unit_cost;
      if (!seen.has(key)) { seen.add(key); unique.push(it); }
    }
    return unique;
  } catch (e) {
    Logger.log('PCH PDF parse error: ' + e.message);
  }
  return items;
}

// PCH診断用: メールを探してOCR結果をログに出力
function testPCHEmail() {
  const threads = GmailApp.search('from:peach_to_y@rj8.so-net.ne.jp has:attachment newer_than:30d', 0, 5);
  Logger.log('PCH threads found: ' + threads.length);

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      Logger.log('--- Subject: ' + msg.getSubject() + ' Date: ' + msg.getDate());
      const atts = msg.getAttachments();
      Logger.log('Attachments: ' + atts.length);

      for (const att of atts) {
        Logger.log('  File: ' + att.getName() + ' (' + att.getContentType() + ', ' + att.getSize() + ' bytes)');

        if (att.getContentType() === 'application/pdf' || att.getName().endsWith('.pdf')) {
          // OCR変換してテキスト出力
          try {
            const blob = att.copyBlob();
            blob.setContentType('application/pdf');
            const tempFile = Drive.Files.create(
              { name: 'test_pch_' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
              blob, { fields: 'id' }
            );
            const doc = DocumentApp.openById(tempFile.id);
            const text = doc.getBody().getText();
            DriveApp.getFileById(tempFile.id).setTrashed(true);

            Logger.log('=== OCR TEXT (first 3000 chars) ===');
            Logger.log(text.slice(0, 3000));
            Logger.log('=== END OCR TEXT ===');

            // パーサーも試す
            const items = parsePCHPdfAttachment(att, '2026-03-31');
            Logger.log('Parsed items: ' + items.length);
            for (const it of items) {
              Logger.log('  ' + it.prize_name + ' x' + it.case_quantity + ' @' + it.unit_cost + ' =' + it.case_cost);
            }
          } catch (e) {
            Logger.log('OCR error: ' + e.message);
          }
        }
      }
    }
  }
}

// ─── 発注登録 ───
function createOrder(prizeName, unitCost, caseQty, supplierId, orderDate, prizeId) {
  const orderId = 'ORD-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();

  const result = sbPost('prize_orders', {
    order_id: orderId,
    prize_id: prizeId || null,
    prize_name_raw: prizeName,
    supplier_id: supplierId,
    order_date: orderDate,
    unit_cost: unitCost || null,
    case_quantity: caseQty || null,
    case_cost: (unitCost && caseQty) ? unitCost * caseQty : null,
    status: 'ordered',
    order_source: 'email_auto',
    created_at: new Date().toISOString(),
  });

  if (result) Logger.log('New order: ' + orderId + ' = ' + prizeName);
  return orderId;
}

// ─── メイン: メール取込（毎日実行） ───
function dailyProcess() {
  const processed = getProcessedSet(PROP_KEY);
  const threads = GmailApp.search('from:info@sdy-co.com OR from:achieve.sakamoto@gmail.com OR from:peach_to_y@rj8.so-net.ne.jp OR (subject:メルカリ ご購入) OR (subject:請書 has:attachment) newer_than:7d', 0, 50);

  let announcementCount = 0;
  let orderCount = 0;
  let masterCount = 0;

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const msgId = msg.getId();
      if (processed.has(msgId)) continue;

      const from = msg.getFrom();
      const subject = msg.getSubject();
      const body = msg.getPlainBody();
      const date = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy-MM-dd');

      // 仕入先判定
      let supplierId = null;
      for (const [email, sid] of Object.entries(SUPPLIER_MAP)) {
        if (from.includes(email)) { supplierId = sid; break; }
      }
      // メルカリ（転送メール）
      if (!supplierId && /mercari|メルカリ/.test(body)) {
        supplierId = 'MCR';
      }
      // インフィニティ（転送メール: 請書xlsx添付）
      if (!supplierId && /請書/.test(subject)) {
        const atts = msg.getAttachments();
        if (atts.some(a => a.getName().includes('請書') && a.getName().endsWith('.xlsx'))) {
          supplierId = 'INF';
        }
      }
      if (!supplierId) { processed.add(msgId); continue; }

      // 発注書/請書判定（メルカリ・INF・PCHは常に発注扱い）
      const isOrder = supplierId === 'MCR' || supplierId === 'INF' || supplierId === 'PCH' || /発注|注文|請書|確認書|請求/.test(subject);

      // メール本文パース
      let items = [];
      if (supplierId === 'SDY') {
        items = parseSDYEmail(body, subject);
      }

      if (supplierId === 'MCR') {
        items = parseMercariEmail(body);
        supplierId = getMercariSupplierId(items); // アカウントで MCR or MC2 に分岐
      }

      if (supplierId === 'INF') {
        const atts = msg.getAttachments();
        const xlsx = atts.find(a => a.getName().includes('請書') && a.getName().endsWith('.xlsx'));
        if (xlsx) items = parseInfinityAttachment(xlsx, date);
      }

      if (supplierId === 'PCH') {
        const atts = msg.getAttachments();
        for (const att of atts) {
          if (att.getContentType() === 'application/pdf' || att.getName().endsWith('.pdf')) {
            const pchItems = parsePCHPdfAttachment(att, date);
            items = items.concat(pchItems);
          }
        }
      }

      if (items.length === 0) {
        processed.add(msgId);
        continue;
      }

      // PCH・メルカリは景品案内不要（発注のみ）
      const skipAnnouncement = supplierId === 'PCH' || supplierId === 'MCR' || supplierId === 'MC2';

      for (const item of items) {
        // 1. prize_announcements に登録（PCH・メルカリ以外、重複チェック）
        if (!skipAnnouncement) {
          const dupCheck = sbGet('prize_announcements',
            'select=id&source_ref=eq.' + msgId + '&prize_name=eq.' + encodeURIComponent(item.prize_name) + '&limit=1');

          if (dupCheck.length === 0) {
            sbPost('prize_announcements', {
              supplier_id: supplierId,
              prize_name: item.prize_name,
              unit_cost: item.unit_cost || null,
              case_quantity: item.case_quantity || null,
              source_type: 'email',
              source_ref: msgId,
              status: isOrder ? 'ordered' : 'unread',
              notes: (item.notes || '').trim() || null,
              created_at: new Date().toISOString(),
            });
            announcementCount++;
          }
        }

        // 2. 発注書なら prize_orders + prize_masters にも登録
        if (isOrder) {
          const prizeId = ensurePrizeMaster(item.prize_name, item.unit_cost, supplierId);
          if (prizeId) {
            masterCount++;
            createOrder(item.prize_name, item.unit_cost, item.case_quantity, supplierId, date, prizeId);
            orderCount++;
          }
        }
      }

      processed.add(msgId);
    }
  }

  saveProcessedSet(PROP_KEY, processed);
  Logger.log('Daily done: ' + announcementCount + ' announcements, ' + orderCount + ' orders, ' + masterCount + ' masters');
}

// ─── 画像処理（15分おき） ───
function processImages() {
  const processed = getProcessedSet(PROP_KEY_IMG);
  const threads = GmailApp.search('from:info@sdy-co.com OR from:achieve.sakamoto@gmail.com has:attachment newer_than:7d', 0, 30);

  let count = 0;
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const msgId = msg.getId();
      if (processed.has(msgId)) continue;

      const attachments = msg.getAttachments();
      const images = attachments.filter(a => a.getContentType().startsWith('image/'));

      if (images.length === 0) { processed.add(msgId); continue; }

      // まず全画像をアップロード
      const uploaded = [];
      for (const att of images) {
        try {
          const origName = att.getName();
          const fileName = sanitizeFilename(origName);
          const storagePath = msgId + '/' + fileName;
          const blob = att.copyBlob();
          const imageUrl = uploadToStorage(blob, storagePath, att.getContentType());
          if (imageUrl) {
            uploaded.push({ origName, imageUrl });
            count++;
          }
        } catch (e) {
          Logger.log('Image error: ' + att.getName() + ': ' + e.message);
        }
      }
      // まとめて紐付け
      if (uploaded.length) linkImagesToAnnouncements(msgId, uploaded);
      processed.add(msgId);
    }
  }

  saveProcessedSet(PROP_KEY_IMG, processed);
  Logger.log('Images done: ' + count + ' uploaded');
}

// ─── Supabase Storage アップロード ───
function uploadToStorage(blob, path, contentType) {
  const url = SB_URL + '/storage/v1/object/' + BUCKET + '/' + path;
  const r = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': contentType, 'x-upsert': 'true' },
    payload: blob.getBytes(),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() === 200 || r.getResponseCode() === 201) {
    return SB_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
  }
  Logger.log('Storage error (' + r.getResponseCode() + '): ' + r.getContentText());
  return null;
}

// ─── 画像→案内紐付け（まとめて処理） ───
function linkImagesToAnnouncements(messageId, uploadedImages) {
  const records = sbGet('prize_announcements', 'source_ref=eq.' + messageId + '&image_url=is.null&select=id,prize_name');
  if (records.length === 0) return;

  const linked = new Set();

  // Pass 1: ファイル名と景品名のベストマッチで紐付け
  for (const img of uploadedImages) {
    const cleanName = img.origName.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
      .replace(/[_\-]/g, ' ').replace(/案内画像.*/i, '').replace(/ol.*min$/i, '')
      .replace(/\(.*\)/g, '').replace(/\d+$/,'').trim();

    let bestMatch = null, bestScore = 0;
    for (const rec of records) {
      if (linked.has(rec.id)) continue;
      const score = calcMatchScore(cleanName, rec.prize_name || '');
      if (score > bestScore) { bestScore = score; bestMatch = rec; }
    }

    if (bestMatch && bestScore >= 30) {
      sbPatch('prize_announcements', bestMatch.id, { image_url: img.imageUrl });
      linked.add(bestMatch.id);
      img.linked = true;
      Logger.log('Image matched: #' + bestMatch.id + ' (' + bestMatch.prize_name + ') ← ' + img.origName);
    }
  }

  // Pass 2: マッチしなかった画像を未紐付け案内に順番で割り当て
  const unlinkedImages = uploadedImages.filter(img => !img.linked);
  const unlinkedRecords = records.filter(rec => !linked.has(rec.id));

  for (let i = 0; i < Math.min(unlinkedImages.length, unlinkedRecords.length); i++) {
    sbPatch('prize_announcements', unlinkedRecords[i].id, { image_url: unlinkedImages[i].imageUrl });
    Logger.log('Image fallback: #' + unlinkedRecords[i].id + ' (' + unlinkedRecords[i].prize_name + ') ← ' + unlinkedImages[i].origName);
  }
}

function calcMatchScore(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;
  const tokens = a.split(/\s+/).filter(t => t.length >= 2);
  let hits = 0;
  for (const t of tokens) { if (b.includes(t)) hits++; }
  return tokens.length > 0 ? Math.round(60 * hits / tokens.length) : 0;
}

function sanitizeFilename(name) {
  // Supabase Storageは日本語キー不可。ハッシュ化してASCIIのみに
  const ext = (name.match(/\.[a-zA-Z]+$/) || ['.jpg'])[0];
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, name)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  return hash + ext;
}

// ─── プロパティ管理 ───
function getProcessedSet(key) {
  const json = PropertiesService.getScriptProperties().getProperty(key);
  return new Set(json ? JSON.parse(json) : []);
}
function saveProcessedSet(key, idSet) {
  const arr = Array.from(idSet).slice(-500);
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(arr));
}

// ─── 手動実行用 ───
function resetAndReprocessAll() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_KEY);
  PropertiesService.getScriptProperties().deleteProperty(PROP_KEY_IMG);
  dailyProcess();
  processImages();
}

function testShortName() {
  const tests = [
    'ぷかぷかくまさんオイルマスコット',
    'マグネット付まるで本物フルーツパンスクイーズ',
    'BT01233 ベイビースリーびりおねあきゃっとブラインドボックス 96入',
    'りるくまぷっくりヘアクリップ',
    'ズートピア極厚EVAサンダル',
    'むにゅいーずぱすてるべあー',
    'ストレートヘアアイロン',
    'PAWフレンズオイルマスコット',
  ];
  for (const t of tests) {
    Logger.log(t + ' → ' + generateShortName(t));
  }
}

// ─── 自動トリガー設定 ───
// GAS上でこの関数を1度手動実行すると、以降は自動取込になる
function setupTriggers() {
  // 既存トリガーを全削除（重複防止）
  const existing = ScriptApp.getProjectTriggers();
  for (const t of existing) {
    ScriptApp.deleteTrigger(t);
  }

  // dailyProcess: 1時間おきに実行（新着メール→案内+発注登録）
  ScriptApp.newTrigger('dailyProcess')
    .timeBased()
    .everyHours(1)
    .create();

  // processImages: 15分おきに実行（添付画像→Storage+紐付け）
  ScriptApp.newTrigger('processImages')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('トリガー設定完了: dailyProcess=1時間おき, processImages=15分おき');
}
