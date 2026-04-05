#!/usr/bin/env node
// prize_masters 一括クリーニングスクリプト v2
// 実行: node scripts/clean-prizes.mjs

const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_KEY) { console.error('Error: SUPABASE_SERVICE_ROLE_KEY 環境変数が未設定です'); process.exit(1); }
const CURRENT_YEAR = 2026;

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function sbGetAll(table) {
  let all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=*&limit=${limit}&offset=${offset}&order=prize_id.asc`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    all = all.concat(rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

async function sbPatchBatch(rows) {
  const promises = rows.map(row => {
    const { prize_id, ...body } = row;
    return fetch(`${SB_URL}/rest/v1/prize_masters?prize_id=eq.${encodeURIComponent(prize_id)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    }).then(async r => {
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`ID ${prize_id}: ${txt}`);
      }
      return prize_id;
    });
  });
  return Promise.all(promises);
}

// ─── aliasesのJSONパース（["..."]形式の場合）────────────────────────────────
function parseAliasText(aliases) {
  if (!aliases) return null;
  const s = String(aliases).trim();
  // JSON配列形式 ["..."] の場合
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    } catch {}
  }
  // JSON文字列形式 "..." の場合
  if (s.startsWith('"') && s.endsWith('"')) {
    try { return JSON.parse(s); } catch {}
  }
  return s;
}

// ─── Extract helpers ──────────────────────────────────────────────────────────

// 締切日抽出
function extractOrderDate(text) {
  if (!text) return null;
  const patterns = [
    /[●○]?\s*(\d{1,2})\/(\d{1,2})\s*[締〆]切?/,
    /(\d{1,2})月(\d{1,2})日\s*[締〆]切?/,
  ];
  for (const pat of patterns) {
    const m = pat.exec(text);
    if (m) {
      const month = parseInt(m[1]);
      const day = parseInt(m[2]);
      const d = new Date(CURRENT_YEAR, month - 1, day);
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

// 発売日抽出
function extractExpectedDate(text) {
  if (!text) return null;
  const m = text.match(/(\d{1,2})月(上旬|中旬|下旬|初旬)?[頃ごろ]?(?:～)?発売/);
  if (m) {
    const month = parseInt(m[1]);
    let day = 1;
    if (m[2] === '中旬') day = 11;
    else if (m[2] === '下旬') day = 21;
    const d = new Date(CURRENT_YEAR, month - 1, day);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// サイズ抽出
function extractSize(text) {
  if (!text) return null;
  const patterns = [
    // H34*W14.5*D14.5cm, H33*W13.7*D13.7cm
    /[HhWwDdLl]\d+[\.\d]*\s*[*×xX]\s*[HhWwDdLl]\d+[\.\d]*/i,
    // 約H150×W100×D80mm
    /約[HhWwDdLl]\d+[\.\d]*[×xXx][HhWwDdLl]\d+[\.\d]*/i,
    // 約5x5x5cm
    /約?\d+[\.\d]*\s*[xX×]\s*\d+[\.\d]*\s*[xX×]?\s*\d*[\.\d]*\s*(?:cm|mm|㎝)/i,
    // W14.5×H33mm
    /[Ww]\d+[\.\d]*[×xX][Hh]\d+[\.\d]*[×xX]?[Dd]?\d*[\.\d]*\s*(?:cm|mm|㎝)?/i,
    // 36.5*14.5*13cm or 36.5×14.5×13cm
    /\d+[\.\d]*\s*[*×xX]\s*\d+[\.\d]*\s*[*×xX]\s*\d+[\.\d]*\s*(?:cm|mm|㎝|ｃｍ)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[0].trim();
  }
  return null;
}

// ─── カテゴリ推定 ─────────────────────────────────────────────────────────────
function inferCategory(text) {
  const t = text;
  if (/ぬいぐるみ/.test(t)) return 'ぬいぐるみ';
  if (/フィギュア|figure|fig|マスコット|アクリル|アクスタ|スタンド|ジオラマ|ミニチュア|ドール|人形/i.test(t)) return 'フィギュア・マスコット';
  if (/ゲーム|switch|PS4|PS5|xbox|イヤホン|スピーカー|USB|充電|ワイヤレス|bluetooth|カウントバンク/i.test(t)) return 'ゲーム・電子機器';
  if (/ネックレス|ピアス|リング|ブレスレット|ヘアアクセ|ヘアピン|ヘアゴム|キーホルダー|スマホケース|ケース|カバー/i.test(t)) return 'アクセサリー';
  if (/バッグ|ポーチ|トート|リュック|サコッシュ|巾着|ショルダー|小銭入れ|財布/.test(t)) return 'バッグ・ポーチ';
  if (/お菓子|食品|グミ|チョコ|キャンディ|飴|スナック|クッキー|ラムネ|マシュマロ/.test(t)) return '食品・お菓子';
  if (/タンブラー|マグ|コップ|グラス|皿|お椀|キッチン|エコバッグ|タオル|クッション|ブランケット|毛布|まくら|枕/.test(t)) return 'キッチン・生活用品';
  if (/シール|ステッカー|タイルシール/.test(t)) return 'シール・ステッカー';
  if (/文具|ノート|ペン|メモ|手帳|ファイル|クリアファイル/.test(t)) return '文具';
  if (/Tシャツ|パーカー|衣類|ウェア|ソックス|靴下|帽子/.test(t)) return '衣類';
  if (/おもちゃ|玩具|トイ|フィジェット/.test(t)) return 'おもちゃ';
  if (/消耗品|部材|ロープ/.test(t)) return '消耗品・部材';
  if (/ワンピース|ドラゴンボール|鬼滅|呪術|進撃|ナルト|ポケモン|ピカチュウ|ディズニー|マリオ|サンリオ|ハローキティ|ちいかわ|すみっコ|コリラックマ|リラックマ|スヌーピー|ジブリ|トトロ|ハリポタ|キティ/.test(t)) return 'キャラクターグッズ';
  return 'その他';
}

// ─── 商品名クリーニング ───────────────────────────────────────────────────────
function cleanPrizeName(raw) {
  let s = raw;

  // サイズ情報を早めに削除（複雑なパターンが残らないように）
  // 【サイズ:...】【BOXサイズ:...】【商品サイズ:...】etc.
  s = s.replace(/【[^】]*サイズ[^】]*】/g, '');
  s = s.replace(/【[^】]*cm[^】]*】/g, '');
  s = s.replace(/【[^】]*mm[^】]*】/g, '');

  // 1. 【】とその中身すべて（残り）
  s = s.replace(/【[^】]*】/g, '');

  // 2. アミューズ不可
  s = s.replace(/[\s　]*アミューズ不可[\s　]*/g, ' ');

  // 3. 締切パターン削除
  s = s.replace(/[●○]?\s*\d{1,2}\/\d{1,2}\s*[締〆]切?/g, '');
  s = s.replace(/\d{1,2}月\d{1,2}日\s*[締〆]切?/g, '');

  // 4. 発売パターン削除
  s = s.replace(/\d{1,2}月(?:上旬|中旬|下旬|初旬)?[頃ごろ]?(?:～)?発売/g, '');

  // 5. 緊急入荷・緊急受注
  s = s.replace(/緊急[入受][荷注]/g, '');

  // 6. 発注（単独）
  s = s.replace(/\s*発注\s*/g, ' ');

  // 7. バンダイ
  s = s.replace(/バンダイ/g, '');

  // 8. メーカー名削除
  const makers = ['ピーナッツクラブ', 'ケーツー', 'エール', 'ブライトリンク', '奇譚クラブ', '夢屋', 'ベネリック', 'フリュー', 'Qualia', 'ACT', 'TTA', 'IP4', 'Rainbow', 'くりんぼう'];
  for (const m of makers) {
    s = s.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  }

  // 9. 数量/入数/単価（2桁以上+単位）
  s = s.replace(/\s*[@＠][0-9０-９,，]{2,}\s*/g, ' ');
  s = s.replace(/\s*[0-9０-９]{2,}入\s*/g, ' ');
  s = s.replace(/\s*\d+[cC][tT]\s*/g, ' ');

  // 10. サイズ情報削除（H/W/D パターン、*×xX区切り）
  // H34*W14.5*D14.5cm etc.
  s = s.replace(/[HhWwDdLl]\d+[\.\d]*\s*[*×xX]\s*[HhWwDdLl]\d+[\.\d]*(?:\s*[*×xX]\s*[HhWwDdLl]?\d*[\.\d]*)?\s*(?:cm|mm|㎝|ｃｍ)?/ig, '');
  // 約H150×W100×D80mm
  s = s.replace(/約?[HhWwDdLl]\d+[\.\d]*[×xX][HhWwDdLl]\d+[\.\d]*/ig, '');
  // 約5x5x5cm または 5×5×5cm
  s = s.replace(/約?\d+[\.\d]*\s*[xX×*]\s*\d+[\.\d]*\s*[xX×*]\s*\d*[\.\d]*\s*(?:cm|mm|㎝|ｃｍ)/ig, '');
  // (5x5cmPKG) などの括弧内サイズ
  s = s.replace(/[（(][^）)]*(?:cm|mm|㎝|サイズ|PKG|BOX)[^）)]*[）)]/ig, '');
  // 商品サイズ、PKGサイズ等の残り
  s = s.replace(/(?:商品|パッケージ|PKG|BOX|カラー立方体)[Ss]ize[：:\s]*/ig, '');
  s = s.replace(/(?:商品|パッケージ|PKG|BOX)サイズ[：:\s]*[^\s　]+/ig, '');
  // 36.5*14.5*13cm
  s = s.replace(/\d+[\.\d]*\s*[*×xX]\s*\d+[\.\d]*\s*[*×xX]\s*\d+[\.\d]*\s*(?:cm|mm|㎝|ｃｍ)/ig, '');

  // 11. ハーフ/クォーター+1000円
  s = s.replace(/[（(]ハーフ[/／]クォーター[＋+]\d+円[）)]/g, '');

  // 12. 送料系
  s = s.replace(/送料[＋+][0-9０-９,，]+円/g, '');
  s = s.replace(/送料無料/g, '');
  s = s.replace(/別途運賃/g, '');
  s = s.replace(/通常送料[＋+]別途送料/g, '');

  // 13. SNS/投入不可注記
  s = s.replace(/※[^※]*告知[^※]*※/g, '');
  s = s.replace(/※[^※]*投入不可[^※]*※/g, '');
  s = s.replace(/※[^※]{0,50}※/g, '');

  // 14. 即納
  s = s.replace(/即納/g, '');

  // 15. 再販
  s = s.replace(/再販/g, '');

  // 16. 価格改定・特価
  s = s.replace(/価格改定/g, '');
  s = s.replace(/特価/g, '');

  // 17. ○○円パターン（カンマ入り数字も対応、万円も）
  // 商品名の一部でない価格表示: 1,000,000円→除去、300円→除去
  // ただし「100万円貯まる」等のネーミングはそのまま
  // 実際の価格表示パターン: 数字のみ+円（商品名文脈でない）
  s = s.replace(/\s+[\d,]+円\s+/g, ' ');  // スペースに囲まれた価格
  s = s.replace(/^[\d,]+円\s*/g, '');     // 先頭の価格

  // 18. 納品前
  s = s.replace(/納品前/g, '');

  // 19. 文末・文中の装飾記号
  s = s.replace(/[☆★◆◇▲△▼▽]\s*$/g, '');
  s = s.replace(/\s*[☆★◆◇▲△▼▽]\s*/g, ' ');
  // ●○は締切削除後の残骸
  s = s.replace(/^[●○]\s*/g, '');
  s = s.replace(/\s*[●○]\s*$/g, '');

  // 余分な記号の後始末
  s = s.replace(/[/／]{2,}/g, '/');   // 連続スラッシュ
  s = s.replace(/[（(]\s*[）)]/g, ''); // 空括弧
  // 残留するPKG/入など単独
  s = s.replace(/\bPKG入\b/ig, '');

  // 先頭の数字+スペース（月の残骸 "11月分" 等はそのまま残す）
  // "11月分" はそのまま → 月分パターンは残す
  // 先頭に独立した "4種" "2種" 等の種数は残す

  // 20. 余分なスペース・前後空白
  s = s.replace(/[\s　]+/g, ' ').trim();
  // 末尾の孤立した記号・単語（約、入、等）
  s = s.replace(/\s*約\s*$/g, '').trim();
  s = s.replace(/\s*入\s*$/g, '').trim();
  s = s.replace(/[\s,，、。・/／]+$/g, '').trim();
  s = s.replace(/^[\s,，、。・/／\s約]+/g, '').trim();
  // 残留するクォート
  s = s.replace(/^["'「「]|["'」」]$/g, '').trim();

  // 21. 30文字で切る
  if (s.length > 30) s = s.slice(0, 30).trim();

  return s || raw.slice(0, 30).replace(/[\s　]+/g, ' ').trim();
}

// タグ抽出
function extractTags(raw, existingCategory) {
  const tags = [];
  if (/即納/.test(raw)) tags.push('即納');
  if (/再販/.test(raw)) tags.push('再販');
  if (/限定/.test(raw)) tags.push('限定');
  if (/新作/.test(raw)) tags.push('新作');
  if (/アミューズ不可/.test(raw)) tags.push('アミューズ不可');

  // 既存categoryが長文（タグっぽい）場合はカンマ分割
  if (existingCategory && existingCategory.length > 15) {
    existingCategory.split(/[,，、]/).map(t => t.trim()).filter(t => t.length > 0 && t.length < 20).forEach(t => {
      if (!tags.includes(t)) tags.push(t);
    });
  }

  return tags.length ? tags.join(',') : null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Step 1: Supabaseから全件取得...');
  const records = await sbGetAll('prize_masters');
  console.log(`  → ${records.length}件取得`);

  console.log('Step 2: クリーニング処理...');
  const cleaned = [];
  const samples = [];

  for (const row of records) {
    // aliasesがJSON配列文字列の場合はパースして元の長い名前を取得
    const aliasText = parseAliasText(row.aliases);

    // クリーニング元テキスト: aliasesから取得した元テキストを優先
    // （前回の実行でaliasesに元テキストが保存されている）
    const workName = aliasText || row.prize_name;

    // 各種抽出（クリーニング前のテキストから）
    const orderDate = extractOrderDate(workName) || extractOrderDate(row.notes || '');
    const expectedDate = extractExpectedDate(workName) || extractExpectedDate(row.notes || '');
    const size = extractSize(workName);

    // タグ抽出
    const tags = extractTags(workName, row.category);

    // 商品名クリーニング
    const newName = cleanPrizeName(workName);

    // カテゴリ推定
    const validCats = ['ぬいぐるみ', 'フィギュア・マスコット', 'ゲーム・電子機器', 'アクセサリー', 'バッグ・ポーチ', '食品・お菓子', 'キッチン・生活用品', 'キャラクターグッズ', 'おもちゃ', 'シール・ステッカー', '文具', '衣類', '消耗品・部材', 'その他'];
    let category = row.category;
    if (!category || !validCats.includes(category)) {
      category = inferCategory(workName);
    }

    // aliases: 元の長いテキスト（パース前の生テキスト）を保存
    // aliasesにはクリーン前の元の名前を文字列で保存（JSON配列ではなく）
    const newAliases = aliasText || row.aliases || null;

    const isSample = samples.length < 15;
    if (isSample) {
      samples.push({
        id: row.prize_id,
        before: workName.slice(0, 70),
        after: newName,
        category,
        orderDate,
        expectedDate,
        size,
      });
    }

    const update = {
      prize_id: row.prize_id,
      prize_name: newName,
      aliases: newAliases || null,
      category: category || null,
      tags: tags || null,
      size: size || null,
    };
    if (orderDate) update.order_date = orderDate;
    if (expectedDate) update.expected_date = expectedDate;

    cleaned.push(update);
  }

  // サンプル表示
  console.log('\n─── クリーニングサンプル（15件）────────────────────────────────');
  samples.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.before}`);
    console.log(`  → [${s.after}] cat:${s.category}${s.size ? ' size:' + s.size : ''}${s.orderDate ? ' 発注:' + s.orderDate : ''}${s.expectedDate ? ' 納期:' + s.expectedDate : ''}`);
    console.log('');
  });

  // カテゴリ分布
  const catDist = {};
  cleaned.forEach(r => { catDist[r.category || 'その他'] = (catDist[r.category || 'その他'] || 0) + 1; });
  console.log('─── カテゴリ分布 ────────────────────────────────────────────────');
  Object.entries(catDist).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
    const bar = '█'.repeat(Math.round(n / 10));
    console.log(`  ${c.padEnd(16)}: ${String(n).padStart(4)}件 ${bar}`);
  });

  const withOrderDate = cleaned.filter(r => r.order_date).length;
  const withExpectedDate = cleaned.filter(r => r.expected_date).length;
  const withSize = cleaned.filter(r => r.size).length;
  console.log(`\n発注日抽出: ${withOrderDate}件 (${(withOrderDate / cleaned.length * 100).toFixed(1)}%)`);
  console.log(`納期抽出:   ${withExpectedDate}件 (${(withExpectedDate / cleaned.length * 100).toFixed(1)}%)`);
  console.log(`サイズ抽出: ${withSize}件 (${(withSize / cleaned.length * 100).toFixed(1)}%)`);

  console.log('\nStep 3: Supabaseに一括UPDATE（100件ずつバッチ）...');
  const BATCH = 100;
  let done = 0;
  let errors = 0;
  for (let i = 0; i < cleaned.length; i += BATCH) {
    const batch = cleaned.slice(i, i + BATCH);
    try {
      await sbPatchBatch(batch);
      done += batch.length;
      process.stdout.write(`\r  → ${done}/${cleaned.length}件完了`);
    } catch (e) {
      errors++;
      console.error(`\nバッチエラー [${i}-${i + BATCH}]: ${e.message}`);
    }
  }
  console.log(`\n  → 完了: ${done}件, エラー: ${errors}件`);

  // 結果をJSONで保存
  const summary = {
    total: records.length,
    cleaned: cleaned.length,
    withOrderDate,
    withExpectedDate,
    withSize,
    catDist,
    errors,
    samples
  };
  const { writeFile } = await import('fs/promises');
  await writeFile('scripts/clean-prizes-result.json', JSON.stringify(summary, null, 2));
  console.log('\n結果サマリーを scripts/clean-prizes-result.json に保存');
}

main().catch(e => { console.error(e); process.exit(1); });
