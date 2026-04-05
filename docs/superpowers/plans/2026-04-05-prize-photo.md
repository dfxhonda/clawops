# 景品写真管理 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 景品マスタに写真を紐付け、SGP由来画像は自動取込、画像なし景品は現場スタッフがスマホ撮影でアップロードできるようにする

**Architecture:** `prize_masters` に `image_url` カラムを追加。SGP取込時にEdge Functionが自動セット。手動アップロードは `prizes.html` の詳細画面からSupabase Storageへ直接PUT。画像はクライアント側でリサイズ（長辺1200px, JPEG 80%）してからアップロード。

**Tech Stack:** Supabase Storage (既存 `announcements` バケット), Supabase REST API, Canvas API (リサイズ), HTML/JS (prizes.html)

**Note:** テストフレームワーク未導入のため、TDDステップは省略。各タスクでブラウザ手動確認を実施。

---

### Task 1: DB マイグレーション — `prize_masters` に `image_url` 追加

**Files:**
- 対象: Supabase ダッシュボード（SQL Editor）

- [ ] **Step 1: SQLを実行**

Supabase ダッシュボード > SQL Editor で以下を実行:

```sql
ALTER TABLE prize_masters ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN prize_masters.image_url IS 'Storage path relative to announcements bucket (e.g. sgp/12345.jpg or manual/PZ-00123.jpg)';
```

- [ ] **Step 2: 確認**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'prize_masters' AND column_name = 'image_url';
```

1行返ること。

- [ ] **Step 3: 既存SGP画像の一括紐付け**

SGP由来の景品で、既に `prize_orders.import_meta->>'item_code'` が存在するものに `image_url` を自動セット:

```sql
UPDATE prize_masters pm
SET image_url = 'sgp/' || sub.item_code || '.jpg'
FROM (
  SELECT DISTINCT ON (po.prize_id)
    po.prize_id,
    po.import_meta->>'item_code' AS item_code
  FROM prize_orders po
  WHERE po.prize_id IS NOT NULL
    AND po.import_meta->>'item_code' IS NOT NULL
    AND po.import_meta->>'item_code' != ''
  ORDER BY po.prize_id, po.order_date DESC
) sub
WHERE pm.prize_id = sub.prize_id
  AND pm.image_url IS NULL;
```

- [ ] **Step 4: 結果確認**

```sql
SELECT COUNT(*) AS total,
       COUNT(image_url) AS with_image,
       COUNT(*) - COUNT(image_url) AS without_image
FROM prize_masters;
```

`with_image` が0より大きいこと。

---

### Task 2: Supabase Storage — `manual` フォルダのアップロード権限確認

**Files:**
- ��象: Supabase ダッシュボード（Storage Policies）

- [ ] **Step 1: 既存バケット確認**

Supabase ダッシュボード > Storage で `announcements` バケットが存在し、Public であることを確認。

- [ ] **Step 2: アップロードポリシー確認**

`announcements` バケットに INSERT ポリシーがあるか確認。なければ以下を SQL Editor で実行:

```sql
-- service_role は常にアクセス可能だが、念のためポリシー追加
-- prizes.html は service_role キーでアクセスしているので、ポリシー不要の場合はスキップ
-- 確認: SELECT * FROM storage.policies WHERE bucket_id = 'announcements';
```

prizes.html は `SB_KEY`（service_role）を使っているため、Storage API も同じキーで認証すればポリシー不要。追加設定なしで進める。

---

### Task 3: prizes.html — データ取得に `image_url` を追加

**Files:**
- Modify: `public/docs/prizes.html:573-574`

- [ ] **Step 1: `loadAll()` の select に `image_url` を追加**

`public/docs/prizes.html` の `loadAll()` 関数（574行目）を変更:

変更前:
```javascript
        'select=prize_id,prize_name,category,aliases,original_cost,supplier_id,supplier_name,status,default_case_quantity,latest_order_date' +
```

変更後:
```javascript
        'select=prize_id,prize_name,category,aliases,original_cost,supplier_id,supplier_name,status,default_case_quantity,latest_order_date,image_url' +
```

- [ ] **Step 2: Storage URL 定数を追加**

`public/docs/prizes.html` の定数セクション（452行目の直後）に追加:

```javascript
const SB_STORAGE = SB_URL + '/storage/v1/object/public/announcements/';
```

- [ ] **Step 3: ブラウザで確認**

prizes.html を開き、コンソールで `DATA[0]` を確認。`image_url` プロパティが存在すること（値は `null` または `sgp/xxx.jpg` のような文字列���。

- [ ] **Step 4: コミット**

```bash
git add public/docs/prizes.html
git commit -m "feat: prizes.htmlのデータ取得にimage_urlを追加"
```

---

### Task 4: prizes.html — 画像リサイズユーティリティ関数

**Files:**
- Modify: `public/docs/prizes.html` (HELPERS セクション付近に追加)

- [ ] **Step 1: リサイズ関数を追加**

`public/docs/prizes.html` の `// ─── HELPERS` セクション（519行目付近）の末尾に以下を追加:

```javascript
// ─── IMAGE RESIZE ─────────────────────��──────────────────────────────────────
function resizeImage(file, maxSide = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('画像ファイルを��択してください'));
      return;
    }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSide || h > maxSide) {
        if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
        else { w = Math.round(w * maxSide / h); h = maxSide; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('画像の変換に失敗しました'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('画像を読み込めませんでした'));
    img.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 2: アップロード関数を追加**

同じ場所の直下に:

```javascript
async function uploadPrizeImage(prizeId, file) {
  const blob = await resizeImage(file);
  const path = `manual/${prizeId}.jpg`;
  const uploadUrl = `${SB_URL}/storage/v1/object/announcements/${path}`;
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true'
    },
    body: blob
  });
  if (!res.ok) throw new Error('画像のアップロードに失敗しました: ' + (await res.text()));
  await sbPatch('prize_masters', prizeId, 'prize_id', {
    image_url: path,
    updated_at: new Date().toISOString(),
    updated_by: getStaffId()
  });
  const item = DATA.find(x => String(x.prize_id) === String(prizeId));
  if (item) item.image_url = path;
  return path;
}
```

- [ ] **Step 3: コミット**

```bash
git add public/docs/prizes.html
git commit -m "feat: 画像リサイズ+アップロード関���を追加"
```

---

### Task 5: prizes.html — デスクトップ詳細画面に画像表示+アップロードUI

**Files:**
- Modify: `public/docs/prizes.html:818-823` (renderDetail 関数)

- [ ] **Step 1: 詳細ヘッダーの上に画像エリアを追加**

`renderDetail()` 関数（818行目）の `pane.innerHTML = \`` の直後、`<div class="detail-header">` の前に画像セクションを挿入:

変更前:
```javascript
  pane.innerHTML = `
<div class="detail-header">
```

変更後:
```javascript
  const imgSrc = p.image_url ? SB_STORAGE + p.image_url + '?t=' + Date.now() : '';
  pane.innerHTML = `
<div class="prize-img-area" style="text-align:center;padding:16px 16px 8px">
  ${imgSrc
    ? `<img src="${imgSrc}" alt="" style="max-width:100%;max-height:200px;border-radius:8px;cursor:pointer;object-fit:contain" onclick="document.getElementById('imgUpload').click()">`
    : `<div style="width:120px;height:120px;margin:0 auto;border-radius:12px;background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--border)" onclick="document.getElementById('imgUpload').click()">
        <span style="font-size:36px;color:var(--text2)">📷</span>
      </div>`}
  <input type="file" id="imgUpload" accept="image/*" capture="environment" style="display:none" onchange="handleImgUpload(this)">
  ${imgSrc ? `<div style="font-size:10px;color:var(--text2);margin-top:4px">タップで差し替え</div>` : `<div style="font-size:11px;color:var(--text2);margin-top:8px">写真を撮影</div>`}
</div>
<div class="detail-header">
```

- [ ] **Step 2: アップロードハンドラを追加**

`renderDetail()` 関数の後（864行目付近）に:

```javascript
async function handleImgUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const targetId = selPrizeId;
  if (!targetId) { showToast('景品を先に保存してください', false); return; }
  showLoading();
  try {
    await uploadPrizeImage(targetId, file);
    showToast('画像を保存しました');
    renderDetail();
  } catch(e) {
    showToast('エラー: ' + e.message, false);
  } finally {
    hideLoading();
    input.value = '';
  }
}
```

- [ ] **Step 3: ブラウザで確認**

1. 画像がない景品を選択 → グレーの📷プレースホルダーが表示される
2. Task 1 で画像紐付けした景品を選択 → 画像が表示される
3. プレースホルダーをタップ → カメラ/ファイル選択が起動する

- [ ] **Step 4: コミット**

```bash
git add public/docs/prizes.html
git commit -m "feat: デスクトップ詳細画面に景品画像表示+アップロードUI"
```

---

### Task 6: prizes.html — モバイル詳細画面に画像表示+アップロードUI

**Files:**
- Modify: `public/docs/prizes.html:1112-1118` (renderMobileDetailContent 関数)

- [ ] **Step 1: モバイル詳細のヘッダー下に画像エリアを追加**

`renderMobileDetailContent()` 関数（1112行目）で、`<div class="md-body">` の前に画像セクションを挿入:

変更前:
```javascript
${!isNewMode ? `<div style="padding:2px 16px 8px;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border)">ID: ${esc(p.prize_id)}</div>` : `<div style="border-bottom:1px solid var(--border)"></div>`}
<div class="md-body">
```

変更後:
```javascript
${!isNewMode ? `<div style="padding:2px 16px 8px;font-size:10px;color:var(--text2)">ID: ${esc(p.prize_id)}</div>` : ''}
<div style="text-align:center;padding:12px 16px;border-bottom:1px solid var(--border)">
  ${(() => { const mImgSrc = p.image_url ? SB_STORAGE + p.image_url + '?t=' + Date.now() : ''; return mImgSrc
    ? `<img src="${mImgSrc}" alt="" style="max-width:100%;max-height:180px;border-radius:8px;cursor:pointer;object-fit:contain" onclick="document.getElementById('mImgUpload').click()">`
    : `<div style="width:100px;height:100px;margin:0 auto;border-radius:12px;background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--border)" onclick="document.getElementById('mImgUpload').click()">
        <span style="font-size:32px;color:var(--text2)">📷</span>
      </div>`; })()}
  <input type="file" id="mImgUpload" accept="image/*" capture="environment" style="display:none" onchange="handleMobileImgUpload(this)">
  ${p.image_url ? `<div style="font-size:10px;color:var(--text2);margin-top:4px">タップで差し替え</div>` : `<div style="font-size:11px;color:var(--text2);margin-top:6px">写真を撮影</div>`}
</div>
<div class="md-body">
```

- [ ] **Step 2: モバイル用アップロードハンドラを追加**

`renderMobileDetailContent()` の後（1155行目付近）に:

```javascript
async function handleMobileImgUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const targetId = selPrizeId;
  if (!targetId) { showToast('景品を先に���存してください', false); return; }
  showLoading();
  try {
    await uploadPrizeImage(targetId, file);
    showToast('画像を保存しました');
    renderMobileDetailContent();
  } catch(e) {
    showToast('エラー: ' + e.message, false);
  } finally {
    hideLoading();
    input.value = '';
  }
}
```

- [ ] **Step 3: スマホで確認**

1. モバイル表示で景品を選択 → 画像エリアが表示される
2. 📷をタップ → カメラが起動する
3. 撮影後 → 画像がアップロードされ即時���示される

- [ ] **Step 4: コミット**

```bash
git add public/docs/prizes.html
git commit -m "feat: モバイル詳細画面に景品��像表示+アップロードUI"
```

---

### Task 7: prizes.html — 一覧にサムネイル表示

**Files:**
- Modify: `public/docs/prizes.html:685-686` (render 関数 — デスクトップ一覧)
- Modify: `public/docs/prizes.html:1048-1051` (renderMobileList 関数 — モバイル一覧)

- [ ] **Step 1: デスクトップ一覧の景品名セルにサムネイル追加**

`render()` 関数（685行目）の行テンプレートを変更:

変更前:
```javascript
  return `<tr class="${sel ? 'selected' : ''}" onclick="selectPrize('${esc(sid)}')">
  <td class="td-name" title="${esc(p.prize_name)}">${highlight(p.prize_name || '', curSearch)}</td>
```

変更後:
```javascript
  const thumbUrl = p.image_url ? SB_STORAGE + p.image_url : '';
  return `<tr class="${sel ? 'selected' : ''}" onclick="selectPrize('${esc(sid)}')">
  <td class="td-name" title="${esc(p.prize_name)}"><span style="display:inline-flex;align-items:center;gap:6px">${thumbUrl ? `<img src="${thumbUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0">` : `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:var(--surface);flex-shrink:0"></span>`}${highlight(p.prize_name || '', curSearch)}</span></td>
```

- [ ] **Step 2: モバイル一覧にサムネイル追加**

`renderMobileList()` 関数（1048行目）を��更:

変更前:
```javascript
    return `<div class="mc-item" onclick="openMobileDetail('${esc(sid)}')">
  <div class="mc-status-bar ${statusClass}"></div>
  <div class="mc-body">
    <div class="mc-name">${highlight(p.prize_name || '', curSearch)}</div>
```

変更��:
```javascript
    const mThumb = p.image_url ? SB_STORAGE + p.image_url : '';
    return `<div class="mc-item" onclick="openMobileDetail('${esc(sid)}')">
  <div class="mc-status-bar ${statusClass}"></div>
  ${mThumb ? `<img src="${mThumb}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;margin:8px 0 8px 8px;flex-shrink:0">` : `<div style="width:40px;height:40px;border-radius:8px;background:var(--surface);margin:8px 0 8px 8px;flex-shrink:0"></div>`}
  <div class="mc-body">
    <div class="mc-name">${highlight(p.prize_name || '', curSearch)}</div>
```

- [ ] **Step 3: ブラウザで確認**

1. デスクトップ: 一覧の景品名の左に丸型サムネイル（24px）が表示される
2. モバイル: 一覧アイテムの左に角丸サムネイル（40px）が表示される
3. 画像なし景品: グレーのプレースホルダー円/角丸が表示される

- [ ] **Step 4: コミット**

```bash
git add public/docs/prizes.html
git commit -m "feat: 景品一覧にサムネイル画像を表示"
```

---

### Task 8: sgp-import Edge Function — 画像アップロード時に `prize_masters.image_url` を自動セット

**Files:**
- 対象: Supabase Edge Function `sgp-import`（Supabase ダッシュボード）

- [ ] **Step 1: 現在のEdge Functionコードを確認**

Supabase ダッシュボード > Edge Functions > `sgp-import` でソースを確認。画像アップロード処理の箇所を特定する。

- [ ] **Step 2: 画像アップロード成功時に `prize_masters.image_url` を更新するロジックを追加**

画像アップロード成功後のブロックに以下のような処理を追加:

```typescript
// 画像アップロード成功後
if (uploadSuccess && prizeId) {
  const imagePath = `sgp/${itemCode}.jpg`;
  await supabase
    .from('prize_masters')
    .update({ image_url: imagePath })
    .eq('prize_id', prizeId)
    .is('image_url', null);  // 手動設定済みのものは上書きしない
}
```

ポイント:
- `.is('image_url', null)` で手動アップロード済みの画像を上書きしない
- `prize_orders` の `prize_id` を使って `prize_masters` を特定する

- [ ] **Step 3: Edge Functionをデプロイ**

Supabase ダッシュボード上でデプロイ、または `supabase functions deploy sgp-import`。

- [ ] **Step 4: テスト実行**

sgp-scraper.html から画像バックフィル（`?images=1&page=1`）を1ページ実行。完了後:

```sql
SELECT prize_id, image_url
FROM prize_masters
WHERE image_url LIKE 'sgp/%'
ORDER BY prize_id
LIMIT 10;
```

新しく `image_url` がセットされた行があること。

- [ ] **Step 5: コミット（Edge Functionのローカルコピーがあれば）**

Edge Functionのコードがローカルにある場合のみ:
```bash
git add supabase/functions/sgp-import/
git commit -m "feat: sgp-import画像アップロード時にprize_masters.image_urlを自���セット"
```

---

### Task 9: ビルド確認 + 最終動作テスト

**Files:**
- なし（確認のみ）

- [ ] **Step 1: ビルド確認**

```bash
cd /Users/dfx/clawops && npm run build
```

エラーなくビルド完了すること。（prizes.html は static HTML なのでビルドには影響しないが、念のため確認）

- [ ] **Step 2: E2Eシナリオ — 手動アップロード**

1. prizes.html を開く
2. 画像がない景品を選択
3. 📷���タップ → 写真を選択/撮影
4. アップロード完了 → 画像が即��表示される
5. 一覧に戻る → サムネイルが表示される
6. 同じ景品をもう一度選択 → 画像が表示されている（永続化確認）

- [ ] **Step 3: E2Eシナ���オ — 画像差し替え**

1. Step 2 で画像を設定した景品を選択
2. 画像をタップ → 別の写真を選択
3. 新しい画像に差し替わること

- [ ] **Step 4: E2E���ナリオ — モバイル**

スマホまたはDevToolsのモバイルビューで:
1. 景品一覧でサムネイルが表示される
2. 景品をタップ → 詳細画面に画像エリアがある
3. 撮影ボタンが動作する

- [ ] **Step 5: 完了通知**

```bash
~/scripts/zundamon.sh "景品写真管理の実装が完了しました"
curl -d "景品写真管理の実装が完了しました" ntfy.sh/clawops-hiro-0328
```
