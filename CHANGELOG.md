# Changelog

すべての変更をこのファイルに記録する。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠。

## [Unreleased]

### 追加
- `src/lib/auth/session.js` — Supabase Auth一本化（getAuthSession/extractMeta/logout のみ）
- `src/lib/auth/AuthProvider.jsx` — 認証の唯一のProvider（useAuth hook付き）
- `src/components/LogoutButton.jsx` — 共通ログアウトボタン（14画面のインライン実装を統合）
- `src/features/inventory/hooks/useInventoryDashboard.js` — ダッシュボードの取得・集計フック
- `src/services/calc.js` に `isToday()` / `calcInventoryStats()` を追加
- `src/hooks/useAsync.js` — 非同期処理の統一フック（retry/errorProps付き）
- `src/components/ErrorDisplay.jsx` — 全画面のエラー表示を統一（自動分類・再試行・dismiss）
- `src/services/audit.js` — 構造化監査ログ（before_data/after_data JSONB、reason_code/reason_note分離）
- `src/__tests__/` — Vitest テスト基盤（9ファイル108テスト: 単体86 + 結合22）
- `src/__tests__/integration/` — サービス層結合テスト（メーター入力・棚卸し・在庫移動の3フロー）
- `src/__tests__/helpers/supabaseMock.js` — ステートフルSupabaseモック（インメモリDB）
- `scripts/release.sh` — セマンティックバージョニング用リリーススクリプト
- `archive/` ディレクトリ（旧 `取込/` を移動、`.gitignore` 済み）

### 変更
- `src/services/auth.js` を `lib/auth/session.js` の再エクスポートに変更（sessionStorage依存廃止）
- `src/pages/Login.jsx` — sessionStorage 直書きを Supabase Auth 経由に変更
- `src/components/RoleGuard.jsx` — sessionStorage 直アクセスを useAuth() 経由に変更
- `src/pages/inventory/InventoryDashboard.jsx` — Promise.all + 画面内集計を `useInventoryDashboard` フックに分離
- 14 画面の `sessionStorage.clear()` ログアウトを `LogoutButton` コンポーネントに統一
- 7画面の `alert()` を `ErrorDisplay` コンポーネントに置換（BoothInput, DraftList, PatrolInput, InventoryTransfer, InventoryCount, InventoryReceive, DataSearch）
- `src/services/readings.js` — saveReading/updateReading に監査ログ追加（before/after構造化データ付き）
- `src/services/movements.js` — transferStock/countStock の監査ログを構造化（before_data/after_data JSONB）
- `package.json` — `test`/`test:watch`/`release` スクリプト追加
- `README.md` — ディレクトリ構成を更新、テスト実行方法を追加

### セキュリティ
- `src/lib/auth/session.js` — localStorage後方互換コード廃止、Supabase Auth一本化

---

## [0.2.0] - 2026-04-04

### セキュリティ（最優先）
- `src/lib/supabase.js` から service_role キーのハードコードを除去し、環境変数のみに変更
- `public/docs/` 内 11 HTML ファイルからもキーを除去、`config.js` 経由に変更
- `.env.example` を追加、`.env.local` でローカル開発対応
- Supabase Edge Function `verify-pin` をデプロイ（PIN 照合をサーバー側に移行）
- `staff` テーブルの PIN を bcrypt ハッシュ化（`pin_hash` カラム追加）
- `staff_public` ビューを作成し、PIN をフロントから隠蔽
- 全テーブルの RLS ポリシーをロール別（admin/manager/patrol/staff）に書き換え
- RLS 未有効だった 5 テーブル（machine_categories 等）を有効化
- `skipLogin()` 関数を無効化
- `auth_logs` テーブルを作成し、認証ログ記録を開始

### 追加
- `src/services/auth.js` — 認証・セッション管理（ロール判定ヘルパー付き）
- `src/services/readings.js` — メーター読み値操作
- `src/services/masters.js` — 店舗・機械・ブース・ロケーション参照
- `src/services/inventory.js` — 在庫管理（監査ログ付き）
- `src/services/movements.js` — 在庫移動・棚卸し（監査ログ付き）
- `src/services/prizes.js` — 景品マスター・発注（監査ログ付き）
- `src/services/audit.js` — 監査ログ記録（誰が・いつ・何を・どう変えたか）
- `src/services/calc.js` — 純粋関数（売上計算、出率、メーター差分、在庫検証、棚卸し差分）
- `src/services/utils.js` — キャッシュ、数値変換、サプライヤーマッピング
- `src/services/index.js` — 統合エクスポート
- `src/components/RoleGuard.jsx` — ロールベース画面アクセス制御
- `src/components/ErrorDisplay.jsx` — 統一エラー表示・再試行コンポーネント
- `audit_logs` テーブル — 業務操作の監査ログ
- `docs/security/secrets-rotation.md` — キーローテーション手順書
- `docs/security/auth-and-roles.md` — 認証・権限設計書
- `docs/security/rls-policy-matrix.md` — RLS ポリシーマトリクス

### 変更
- `src/services/sheets.js` を 7 ファイルに分割（互換ラッパーとして維持）
- `src/App.jsx` に RoleGuard を適用（管理画面は manager 以上、棚卸しは patrol 以上）
- `src/pages/Login.jsx` を Edge Function 経由のサーバー側認証に改修
- `README.md` を全面改修（セットアップ手順、認証説明、画面一覧、ID 体系を追加）

## リリース運用ルール

- タグ形式: `v0.1.0`（セマンティックバージョニング）
- セキュリティ修正: patch バージョンを上げて即リリース
- 機能追加: minor バージョンを上げる
- 破壊的変更: major バージョンを上げる
- 各リリースに GitHub Release を作成し、変更内容をコピーする
- デプロイ後に動作確認し、問題なければタグを打つ
