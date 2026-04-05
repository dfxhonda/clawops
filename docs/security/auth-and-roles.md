# ClawOps 認証・権限設計書

## 認証方式

### 変更前（危険）
- staff テーブルから PIN を含む全データをフロントに取得
- ブラウザ側で PIN を照合
- sessionStorage にダミートークンを保存
- PrivateRoute は sessionStorage の有無だけで判定

### 変更後（Phase 1-B）
- スタッフ一覧は `staff_public` ビュー経由（PIN 非公開、has_pin フラグのみ）
- PIN 照合は Supabase Edge Function `verify-pin` がサーバー側で実行
- PIN は `pgcrypto` の `bcrypt` でハッシュ化済み
- 認証成功時に Supabase Auth のセッション（JWT）を発行
- フロント側は `supabase.auth.setSession()` でトークンを管理
- 既存コードとの互換のため sessionStorage にもスタッフ情報を保存

## ロール定義

| ロール | 説明 | 対象 |
|--------|------|------|
| admin | 全機能アクセス、マスター編集、削除、分析 | 経営者、システム管理者 |
| manager | 大半の機能、マスター編集可、削除不可 | 店長クラス |
| patrol | 巡回入力、棚卸し、在庫移動 | 巡回担当者 |
| staff | 基本入力、ダッシュボード閲覧 | 一般スタッフ |

ロールは `staff` テーブルの `role` カラムに保存され、JWT の `app_metadata.role` に埋め込まれる。

## 画面アクセス制御

| 画面 | パス | staff | patrol | manager | admin |
|------|------|-------|--------|---------|-------|
| メイン入力 | `/` | ○ | ○ | ○ | ○ |
| ダッシュボード | `/dashboard` | ○ | ○ | ○ | ○ |
| ブース入力 | `/booth/:id` | ○ | ○ | ○ | ○ |
| 下書き | `/drafts` | ○ | ○ | ○ | ○ |
| ランキング | `/ranking/:id` | ○ | ○ | ○ | ○ |
| 機械一覧 | `/machines/:id` | ○ | ○ | ○ | ○ |
| QRスキャン | `/patrol` | × | ○ | ○ | ○ |
| 巡回入力 | `/patrol/input` | × | ○ | ○ | ○ |
| 棚卸しダッシュボード | `/inventory` | × | ○ | ○ | ○ |
| 入庫確認 | `/inventory/receive` | × | ○ | ○ | ○ |
| 在庫移管 | `/inventory/transfer` | × | ○ | ○ | ○ |
| 棚卸しカウント | `/inventory/count` | × | ○ | ○ | ○ |
| 景品マッチング | `/inventory/match` | × | × | ○ | ○ |
| データ検索 | `/datasearch` | × | × | ○ | ○ |
| 読み値修正 | `/edit/:id` | × | × | ○ | ○ |
| 管理メニュー | `/admin` | × | × | ○ | ○ |
| 伝票取込 | `/admin/import-slips` | × | × | × | ○ |
| シート設定 | `/admin/setup-sheets` | × | × | × | ○ |
| テストデータ | `/admin/test-data` | × | × | × | ○ |

## セッション管理

- トークンの有効期限: Supabase Auth のデフォルト（1時間、自動リフレッシュ）
- ログアウト: `supabase.auth.signOut()` + sessionStorage クリア
- セッション切れ: 401 レスポンス時にログイン画面へリダイレクト

## 今後の課題

- PrivateRoute にロールベースの制御を追加する（Phase 2）
- public/docs/ の HTML ページにも認証を適用する（Phase 2）
- PIN 変更機能の追加
- ログアウトボタンの配置
