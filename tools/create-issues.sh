#!/bin/bash
# ClawOps GitHub Issues 一括作成スクリプト
# 使い方: cd clawops && bash tools/create-issues.sh
# 前提: gh auth login 済みであること

set -euo pipefail
REPO="dfxhonda/clawops"

echo "=== ClawOps Issues 一括作成 ==="
echo "対象リポジトリ: $REPO"
echo ""

# --- Issue 1 ---
echo "[1/10] auth/session の専用層を作る"
gh issue create --repo "$REPO" \
  --title "auth/session の専用層を作る" \
  --body "$(cat <<'EOF'
## 目的
sessionStorage 直操作をやめて、認証状態の読み書きを1か所に集約する。

## 背景
今は Login.jsx で `sessionStorage.setItem('clawops_staff_id'...)` と `sessionStorage.setItem('gapi_token'...)` を直接書き込み、App.jsx の PrivateRoute は `getToken()` があれば通すだけになっている。

## やること

- [ ] `src/lib/auth/session.ts` を新設
- [ ] `getSession`, `setSession`, `clearSession`, `isLoggedIn` を実装
- [ ] Login.jsx の sessionStorage 直書きを session 層経由へ置換
- [ ] App.jsx の `getToken()` 依存を session 層へ置換

## 完了条件

- 画面側から sessionStorage を直接触る箇所が `auth/session` 以外に残らない
- 既存ログイン動線が壊れない
EOF
)"

# --- Issue 2 ---
echo "[2/10] ProtectedRoute と RoleRoute を導入する"
gh issue create --repo "$REPO" \
  --title "ProtectedRoute と RoleRoute を導入する" \
  --body "$(cat <<'EOF'
## 目的
「ログイン済み」と「権限あり」を分ける。

## 背景
今の PrivateRoute は `getToken()` の有無だけで通している。権限別の経路制御は入っていない。

## やること

- [ ] `src/features/auth/ProtectedRoute.jsx` を作成
- [ ] `src/features/auth/RoleRoute.jsx` を作成
- [ ] `useAuth()` フックを作る
- [ ] App.jsx の route を staff / patrol / admin 単位で保護する

## 完了条件

- ログインしていても権限外の画面へ直接入れない
- 管理画面を一般スタッフに出さない
EOF
)"

# --- Issue 3 ---
echo "[3/10] services/sheets.js を分割する"
gh issue create --repo "$REPO" \
  --title "services/sheets.js を auth / inventory / locations / readings に分割する" \
  --body "$(cat <<'EOF'
## 目的
責務を分離して、変更しやすくする。

## 背景
`src/services/sheets.js` は 576 行あり、`getToken()`、`parseNum()`、在庫移動種別、各種 API が混在している。

## やること

- [ ] `src/lib/utils/number.ts` — parseNum 等
- [ ] `src/features/inventory/api.ts` — 在庫系取得・更新
- [ ] `src/features/locations/api.ts` — 店舗・マシン・ブース
- [ ] `src/features/readings/api.ts` — メーター読み取り
- [ ] `src/lib/auth/session.ts` — getToken 等（Issue 1 と連動）
- [ ] 一時的に `services/sheets.js` は互換窓口として残す

## 完了条件

- 新規コードは `services/sheets.js` を直接増やさない
- 少なくとも getToken, parseNum, getLocations, 在庫系取得は別ファイル化される
EOF
)"

# --- Issue 4 ---
echo "[4/10] InventoryDashboard の集計を hook 化する"
gh issue create --repo "$REPO" \
  --title "InventoryDashboard の集計を hook 化する" \
  --body "$(cat <<'EOF'
## 目的
画面から取得・集計責務を外す。

## 背景
`InventoryDashboard.jsx` は `getLocations`, `getPrizeStocksExtended`, `getStockMovements` を `Promise.all` で呼び、その場で `owner_type` や `created_at` を使って集計している。

## やること

- [ ] `src/features/inventory/hooks/useInventoryDashboard.ts` を作る
- [ ] 取得、集計、読み込み中、失敗状態を hook に集約
- [ ] 画面側は表示だけに薄くする

## 完了条件

- `InventoryDashboard.jsx` に直接の `Promise.all` が残らない
- 画面で数値計算しない
EOF
)"

# --- Issue 5 ---
echo "[5/10] 純粋関数として number / 差分 / 当日判定を切り出す"
gh issue create --repo "$REPO" \
  --title "純粋関数として number / 差分 / 当日判定を切り出す" \
  --body "$(cat <<'EOF'
## 目的
試験しやすい単位を先に作る。

## 背景
`parseNum()` は `services/sheets.js` にあり、在庫画面では `created_at?.startsWith(new Date().toISOString().slice(0, 10))` のような当日判定が画面内にある。

## やること

- [ ] `parseNum` を `src/lib/utils/number.ts` へ
- [ ] 差分計算を切り出す
- [ ] 当日移動件数判定を切り出す
- [ ] 在庫不足判定を切り出す
- [ ] `src/lib/utils` や `src/features/*/model.ts` に配置

## 完了条件

- UI から計算ロジックを直接呼ばない
- それぞれ入力と出力が明確な関数になる
EOF
)"

# --- Issue 6 ---
echo "[6/10] 最低限のテスト基盤を入れる"
gh issue create --repo "$REPO" \
  --title "最低限のテスト基盤を入れる (Vitest)" \
  --body "$(cat <<'EOF'
## 目的
壊してもすぐ気づける状態を作る。

## 背景
`package.json` の test は `echo "Error: no test specified" && exit 1` のまま。

## やること

- [ ] Vitest 導入（`vitest.config.ts` 作成）
- [ ] `package.json` の `test` スクリプト更新
- [ ] `parseNum` のテスト
- [ ] 差分計算のテスト
- [ ] 在庫不足判定のテスト
- [ ] `isLoggedIn` のテスト
- [ ] Role 判定のテスト

## 完了条件

- `npm test` が失敗メッセージではなく実テストを走らせる
- 上記関数の正常系と異常系がある

## 依存

- Issue 5（純粋関数の切り出し）が先に終わっていると書きやすい
EOF
)"

# --- Issue 7 ---
echo "[7/10] root 直下の試作ファイルを整理する"
gh issue create --repo "$REPO" \
  --title "root 直下の試作ファイルを整理する" \
  --body "$(cat <<'EOF'
## 目的
本番コードと資料を分ける。

## 背景
repo 直下に `collection_slips_data.csv`, `niceland_stores_to_add.xlsx`, `orders.html`, `prizes.html`, `ui-redesign-mockup.html`, `ui-v2-input-mockup.html` などが置かれている。

## やること

- [ ] `data_samples/` を作成して CSV/XLSX を移動
- [ ] `docs/mockups/` を作成して HTML モックアップを移動
- [ ] `tools/import/` を作成してインポート用ツールを移動
- [ ] `archive/` を作成して不要な試作物を移動
- [ ] root には設定ファイルと README だけを残す

## 完了条件

- root が軽くなる
- サンプルと本番コードの区別がつく
EOF
)"

# --- Issue 8 ---
echo "[8/10] README を起動手順ベースで作り直す"
gh issue create --repo "$REPO" \
  --title "README を起動手順ベースで作り直す" \
  --body "$(cat <<'EOF'
## 目的
他人が引き継げるようにする。

## 背景
README は現状かなり短く、アプリ名と簡単な説明が中心。repo には Issues 0、Releases 未公開なので、文書の重要度が高い。

## やること

- [ ] 何のアプリか（概要）
- [ ] 必要な環境変数
- [ ] 起動方法（`npm install` → `npm run dev`）
- [ ] 主要画面の一覧と役割
- [ ] 権限モデル（admin / manager / patrol / staff）
- [ ] デプロイ方法（Vercel）
- [ ] `.env.example` も合わせて更新

## 完了条件

- 初見の開発者が README だけで起動できる
- 主要画面の役割がわかる
EOF
)"

# --- Issue 9 ---
echo "[9/10] changelog と release ルールを作る"
gh issue create --repo "$REPO" \
  --title "changelog と release ルールを作る" \
  --body "$(cat <<'EOF'
## 目的
現場に入れた版を追えるようにする。

## 背景
GitHub 上では Releases が未公開、Issues も 0 のまま。

## やること

- [ ] `CHANGELOG.md` を追加
- [ ] 版番号ルール（semver）を決める
- [ ] 本番反映時に release note を残す運用にする
- [ ] GitHub Releases で最初のタグを打つ

## 完了条件

- 「今の本番はどの版か」が追える
- 切り戻し判断がしやすい
EOF
)"

# --- Issue 10 ---
echo "[10/10] 監査ログの土台を作る"
gh issue create --repo "$REPO" \
  --title "監査ログの土台を作る" \
  --body "$(cat <<'EOF'
## 目的
在庫と棚卸しの変更履歴を追えるようにする。

## 背景
`services/sheets.js` では `MOVEMENT_TYPES` として `transfer`, `arrival`, `replenish`, `count`, `adjust` が定義されている。ここまであるなら、次に必要なのは履歴管理。

## やること

- [ ] `audit_logs` テーブル設計
- [ ] カラム: `actor_id`, `action`, `target_type`, `target_id`, `before_json`, `after_json`, `created_at`
- [ ] 在庫移動から先にログ記録を入れる
- [ ] 棚卸し調整にもログ記録を入れる
- [ ] RLS ポリシー設定（insert: authenticated, select: admin のみ）

## 完了条件

- 重要更新に履歴が残る
- 後から追跡できる
EOF
)"

echo ""
echo "=== 完了！全10件のIssueを作成しました ==="
