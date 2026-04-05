# 実装計画: 結合テスト + Release/Changelog整備

## Task 1: テスト基盤
- [x] Step 1a: Supabaseステートフルモック (`src/__tests__/helpers/supabaseMock.js`)
- [x] Step 1b: テストデータファクトリ (`src/__tests__/helpers/fixtures.js`)

## Task 2: 結合テスト
- [x] Step 2a: メーター入力→保存 (`src/__tests__/integration/meter-flow.test.js`) — 6テスト
- [x] Step 2b: 棚卸し→差分→確定 (`src/__tests__/integration/count-flow.test.js`) — 6テスト
- [x] Step 2c: 在庫移動→履歴反映 (`src/__tests__/integration/transfer-flow.test.js`) — 10テスト

## Task 3: Release/Changelog整備
- [x] Step 3a: リリーススクリプト (`scripts/release.sh`)
- [x] Step 3b: package.json に release スクリプト追加
- [x] Step 3c: CHANGELOG.md 更新（Auth一本化+監査ログ+ErrorDisplay+テスト追加を反映）
- [ ] Step 3d: バージョン整合 + 初回タグ v1.0.0（コミット後に実施）

## 検証
- [x] `npm test` 全パス（9ファイル 108テスト）
- [x] `npm run build` 成功
