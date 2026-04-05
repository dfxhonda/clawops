# Changelog

すべての変更をこのファイルに記録する。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠。

## [Unreleased]

---

## [1.0.0] - 2026-04-06

Auth一本化・監査ログ強化・Error UX統一・テスト基盤整備により安定版に到達。0.2.0 → 1.0.0 のジャンプはこれらの包括的品質改善による。

### 追加
- `src/lib/auth/AuthProvider.jsx` — Supabase Auth Provider（useAuth hook、onAuthStateChange監視）
- `src/hooks/useAsync.js` — 非同期処理の統一フック（loading/error/retry/errorProps）
- `src/components/ErrorDisplay.jsx` — 全画面エラー表示の統一（自動分類・再試行・dismiss）
- `src/services/audit.js` — 構造化監査ログ（before_data/after_data JSONB、reason_code/reason_note分離、AUDIT_REASONS定数）
- `src/__tests__/integration/` — サービス層結合テスト 3フロー22テスト（メーター入力・棚卸し・在庫移動）
- `src/__tests__/helpers/supabaseMock.js` — ステートフルSupabaseモック（インメモリDB、クエリビルダーチェーン模倣）
- `src/__tests__/helpers/fixtures.js` — テストデータファクトリ
- `scripts/release.sh` — セマンティックバージョニング用リリーススクリプト（Linux/macOS両対応）

### 変更
- `src/lib/auth/session.js` — Supabase Auth一本化（getAuthSession/extractMeta/logoutの3関数のみに縮小、sessionStorage/localStorage依存を完全廃止）
- `src/services/auth.js` — session.jsの再エクスポートのみに変更
- `src/services/readings.js` — saveReading/updateReadingに監査ログ追加（before/after構造化データ付き）
- `src/services/movements.js` — transferStock/countStockの監査ログを構造化（before_data/after_data JSONB）
- 7画面の `alert()` を `ErrorDisplay` に置換（BoothInput, DraftList, PatrolInput, InventoryTransfer, InventoryCount, InventoryReceive, DataSearch）
- `src/services/sheets.js` 互換レイヤーを廃止、各モジュールへの直接importに切替
- `package.json` — `test`/`test:watch`/`release` スクリプト追加

### セキュリティ
- localStorage後方互換コード廃止（Supabase Auth一本化）

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
- `src/services/` — sheets.js を 7 ファイルに分割（auth, readings, masters, inventory, movements, prizes, audit）
- `src/services/calc.js` — 純粋関数（売上計算、出率、メーター差分、在庫検証、棚卸し差分）
- `src/services/utils.js` — キャッシュ、数値変換、サプライヤーマッピング
- `src/components/RoleGuard.jsx` — ロールベース画面アクセス制御
- `src/components/LogoutButton.jsx` — 共通ログアウトボタン（14画面のインライン実装を統合）
- `src/features/inventory/hooks/useInventoryDashboard.js` — ダッシュボード集計フック
- `src/__tests__/` — Vitest テスト基盤（calc/utils/session/hooks/auth-provider/routes の 86 単体テスト）
- `audit_logs` テーブル — 業務操作の監査ログ
- `docs/security/` — 認証設計書、RLSマトリクス、キーローテーション手順書

### 変更
- `src/App.jsx` に RoleGuard を適用（管理画面は manager 以上、棚卸しは patrol 以上）
- `src/pages/Login.jsx` を Edge Function 経由のサーバー側認証に改修
- `README.md` を全面改修（セットアップ手順、認証説明、画面一覧、ID 体系を追加）

## リリース運用ルール

- タグ形式: `v1.0.0`（セマンティックバージョニング）
- リリース手順: `npm run release <version>` → `git push origin main --tags`
- セキュリティ修正: patch バージョンを上げて即リリース
- 機能追加: minor バージョンを上げる
- 破壊的変更: major バージョンを上げる
- 各リリースに GitHub Release を作成し、変更内容をコピーする
