# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

ClawOps（クレーンゲーム運営管理システム）は、クレーンゲーム運営向けのモバイルファーストな React SPA です。
主な目的: 売上・メーター入力 / 巡回入力 / 棚卸し・在庫移動 / 集金帳票 / 監査ログ / 日次集計 / 管理画面

UI は日本語が基本です。Commit messages use Japanese with a category prefix (e.g., `ui:`, `feat:`, `fix:`).

## Tech Stack

- **Frontend:** React 19 + React Router v7 + Vite 7（JSX のみ、TypeScript なし）
- **Backend / DB:** Supabase（PostgreSQL + RLS）
- **Auth:** Supabase Auth + `AuthProvider` / `useAuth`（`src/lib/auth/`）
- **Tests:** Vitest + Testing Library + happy-dom
- **Deployment:** Vercel（`vercel.json` で SPA ルーティング）

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm test             # Run all tests
npm run test:watch   # Watch mode
```

---

## Architecture

### 1. Routing
- 主要ルーティングは `src/App.jsx`
- 認証系は `ProtectedRoute` / `RoleRoute`
- 権限は少なくとも `admin` / `manager` / `patrol` / `staff` を意識する
- 画面追加時は「どのロールに見せるか」を必ず決める

**Auth フロー:**
- ポータル（`/docs/`）でPINログイン → localStorage に Supabase セッション保存
- `/login` → `Login.jsx`（透過セッションブリッジ）→ `setSession()` → `/`
- `AuthProvider` が `onAuthStateChange` でリアクティブにセッション管理
- 未認証は `window.location.href = '/docs/'` でポータルへ（`navigate('/login')` 禁止）

**主要ルート:**
- `/` → `MainInput`（メーター入力）
- `/booth/:machineId` → `BoothInput`（機械単位の一括入力）
- `/patrol` → `PatrolScan`（QRスキャン）→ `/patrol/input` → `PatrolInput`
- `/drafts` → `DraftList` → `/complete` → `Complete`（集金帳票）
- 管理系は `ManagerRoute` / `AdminRoute` で保護

### 2. Auth
- 認証の基準は Supabase Auth
- 認証状態は `AuthProvider` / `useAuth` を基準に扱う
- 独自のローカル保存や古い互換ロジックを増やさない
- 画面側で PIN や権限を独自判定しない

### 3. Data / Services
- データ取得・更新は feature / service 単位で扱う（`src/services/`）
  - `masters.js` — stores / machines / booths / staff のマスタ取得
  - `readings.js` — meter_readings の読み書き
  - `stats.js` — daily_booth_stats の集計・取得
  - `inventory.js` — prize_stocks / stock_movements
  - `prizes.js` — prize_masters / prize_orders
- 新規実装では `src/services/sheets.js` に責務を戻さない
- 監査ログ対象の更新処理は、可能な限り `writeAuditLog` を通す
- `reason_code` / `reason_note` を使える処理では、自由文だけにしない

**IDルール（Notion正本）:**
- `booth_code` = `B01`（B + 2桁）/ `full_booth_code` = `KOS01-M01-B01`
- DBの `booth_code` カラムはフルコードが入っているため、表示は `booth_number` から整形

### 4. UI / Pages
- ページは「画面の組み立て」に寄せる
- 判定や計算は hook / service / lib に逃がす
- 大きくなった JSX は表示部品へ分割する
- `ErrorDisplay` / retry パターンは既存の共通方式に寄せる
- スタイル: `src/index.css` の CSS カスタムプロパティ。ダークモードがデフォルト

### 5. Tests
- 変更に応じてテストも更新する
- 純粋関数は単体テスト
- 主要画面は component test
- 権限制御、監査ログ、保存系は特に壊しやすいので優先的に確認する
- 「テストがあるからOK」ではなく、仕様に合っているかも見る

---

## Working Rules

### Plan first
非自明な変更では、実装前に `tasks/todo.md` にチェック式で計画を書く。

### Verify before claiming done
完了報告の前に最低限これを確認する:
- `npm run build`
- `npm test`
- 変更ファイルの差分確認
- 公開確認が必要な時は、ブランチ名ではなく必要に応じて SHA 指定で確認

### Keep lessons
ユーザーから修正指摘があったら `tasks/lessons.md` を更新する。
同じミスを繰り返さないためのルールまで書く。

### Prefer root-cause fixes
一時しのぎではなく、根本原因を直す。ただし過剰設計はしない。

### Minimal-impact changes
- 必要な場所だけ触る
- 既存フローを壊さない
- 互換レイヤーを消す時は呼び出し元を確認してから行う

---

## Safety / Approval Rules

以下は自動で進めてよい:
- 読み取り
- ローカル編集
- テスト実行
- ビルド確認

以下は慎重に扱う:
- push / tag / release
- 外部通知
- 削除系操作
- 大量置換
- 本番データを書き換える操作

「実装は終わったが push していない」状態を完了扱いしない。

---

## Completion Notifications

通知は「本当に完了した時」だけ送る。途中確認・未 push・未検証の状態では送らない。

```bash
# 音声通知（VOICEVOX起動時にMacから鳴る）
~/scripts/zundamon.sh "作業が完了しました"

# プッシュ通知（iPhoneに届く）
curl -d "作業が完了しました" ntfy.sh/clawops-hiro-0328
```

---

## ファイル置き場

- `docs/lists/` — 設置希望リスト等のスキャン画像
- `docs/photos/` — 現調写真
- `docs/images/` — その他画像
- `data/exports/` — CSV・JSON・HTML 等のエクスポート（`.gitignore` 済み）
  - ファイル名には日付を含める推奨: `YYYYMMDD_内容.csv`
  - 一時インポート用 HTML もここに置く
