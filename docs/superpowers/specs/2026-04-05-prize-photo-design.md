# 景品写真管理 設計書

## 概要

景品マスタに写真を紐付ける機能。SGP由来の画像は自動取込、画像がない景品は現場スタッフがスマホで撮影してアップロード。全スタッフ間で共有。

## 要件

- 1景品につき代表写真1枚
- SGP取込時に画像があれば `image_url` を自動セット
- 画像がない景品は景品詳細画面からカメラ撮影/ファイル選択でアップロード
- アップロード先は Supabase Storage
- 全スタッフが閲覧可能

## 機能A: Claude Code画像指示（開発用）

ローカルの `docs/` フォルダにファイルを置き、Claude Code CLIでパス指定するだけ。追加開発不要。

```
docs/lists/   — 設置希望リスト等のスキャン画像
docs/photos/  — 現調写真
docs/images/  — その他画像
```

使い方:
```
この画像を見て: docs/photos/site-A.jpg
```

## 機能B: 景品写真の自動取込+手動アップロード

### DB変更

`prize_masters` テーブルに `image_url` カラムを追加:

```sql
ALTER TABLE prize_masters ADD COLUMN image_url TEXT;
```

### Storage構成

既存バケット `announcements` を使用:

| 種別 | パス | 例 |
|------|------|----|
| SGP由来 | `sgp/{item_code}.jpg` | `sgp/12345.jpg` |
| 手動撮影 | `manual/{prize_id}.jpg` | `manual/PZ-00123.jpg` |

フルURL: `https://gedxzunoyzmvbqgwjalx.supabase.co/storage/v1/object/public/announcements/{パス}`

### 自動取込フロー

SGP取込（`sgp-import` Edge Function）の既存処理で画像は既に `announcements/sgp/{item_code}.jpg` に保存されている。追加で必要なのは:

1. `sgp-import` Edge Function で、景品マスタ(`prize_masters`)の `image_url` に Storage パスをセットする
2. `prize_orders.import_meta.item_code` → `announcements/sgp/{item_code}.jpg` の変換

```
sgp-import 処理フロー（追加部分）:
  画像アップロード成功時
  → prize_masters.image_url = 'sgp/{item_code}.jpg' を UPDATE
  （prize_orders.prize_id 経由で紐付け）
```

### 手動アップロードフロー

```
景品詳細画面（prizes.html）
  → カメラボタンをタップ
  → <input type="file" accept="image/*" capture="environment">
  → クライアント側でリサイズ（長辺1200px以下、JPEG 80%）
  → Supabase Storage にアップロード: announcements/manual/{prize_id}.jpg
  → prize_masters.image_url = 'manual/{prize_id}.jpg' を UPDATE
  → 画面に即時反映
```

### UI変更: prizes.html 景品詳細画面

現在の詳細ペインに以下を追加:

```
+---------------------------+
| [景品画像]                |  ← 画像あり: サムネイル表示
| [カメラボタン]            |  ← 画像なし: 撮影ボタン表示
|                           |     画像あり: タップで差し替え可能
|---------------------------|
| PZ-00123                  |
| ワンピース フィギュア     |
| カテゴリ: クレーン景品    |
| 原価: ¥800               |
| ...                       |
+---------------------------+
```

- 画像がない景品: グレーのプレースホルダー + カメラアイコン
- 画像がある景品: サムネイル表示、タップで差し替え可能

### 画像リサイズ

クライアント側（ブラウザ）で実行。Canvas APIを使用:
- 長辺1200px以下にリサイズ
- JPEG品質80%
- アップロード前に実行してストレージ節約

### セキュリティ

- Storage バケット `announcements` は既に public 読み取り可能
- アップロードは認証済みユーザーのみ（Supabase の service_role キーで制御）
- ファイル名は `{prize_id}.jpg` 固定でパストラバーサル防止
- `accept="image/*"` でフロントエンド制限 + アップロード前にMIMEタイプ検証

### 景品一覧での表示

prizes.html の一覧ペインに小さなサムネイル（32x32）を追加:
- 画像あり: 丸型サムネイル
- 画像なし: グレーの丸（アイコンなし）

## 影響範囲

| ファイル | 変更内容 |
|----------|----------|
| `prize_masters` テーブル | `image_url` カラム追加 |
| `sgp-import` Edge Function | 画像アップロード時に `prize_masters.image_url` 更新 |
| `public/docs/prizes.html` | 詳細画面に画像表示+アップロードUI追加、一覧にサムネイル追加 |

## スコープ外

- 画像の複数枚対応
- 画像の削除機能（差し替えで対応）
- 画像のトリミング/編集
- SGP以外のサプライヤーからの自動取込
