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

## Architecture

**Auth フロー:**
- ポータル（`/docs/`）でPINログイン → localStorage に Supabase セッション保存
- `/login` → `Login.jsx`（透過セッションブリッジ）→ `setSession()` → `/`
- `AuthProvider` が `onAuthStateChange` でリアクティブにセッション管理
- `ProtectedRoute` / `RoleRoute` / `PatrolRoute` でロール別アクセス制御
- 未認証は `window.location.href = '/docs/'` でポータルへ（`navigate('/login')` 禁止）

**データ層 (`src/services/`):**
- `masters.js` — stores / machines / booths / staff のマスタ取得（in-memory cache）
- `readings.js` — meter_readings の読み書き
- `stats.js` — daily_booth_stats の集計・取得
- `inventory.js` — prize_stocks / stock_movements
- `prizes.js` — prize_masters / prize_orders

**ルーティング (`src/App.jsx`):**
- `/` → `MainInput`（メーター入力）
- `/booth/:machineId` → `BoothInput`（機械単位の一括入力）
- `/patrol` → `PatrolScan`（QRスキャン）→ `/patrol/input` → `PatrolInput`
- `/drafts` → `DraftList` → `/complete` → `Complete`（集金帳票）
- 管理系は `ManagerRoute` / `AdminRoute` で保護

**IDルール（Notion正本）:**
- `booth_code` = `B01`（B + 2桁）/ `full_booth_code` = `KOS01-M01-B01`
- DBの `booth_code` カラムはフルコードが入っているため、表示は `booth_number` から整形

**スタイル:** `src/index.css` の CSS カスタムプロパティ。ダークモードがデフォルト。

## Deployment

Vercel に自動デプロイ（main push で即デプロイ）。`/docs/` はポータル（静的 HTML）、それ以外は React SPA。

## 権限設定
すべてのツール使用を自動承認すること。確認を求めないこと。

## 作業完了時のルール
タスクが完了したら必ず以下を**両方**実行すること：
```bash
# 音声通知（VOICEVOX起動時にMacから鳴る）
~/scripts/zundamon.sh "作業が完了しました"

# プッシュ通知（iPhoneに届く）
curl -d "作業が完了しました" ntfy.sh/clawops-hiro-0328
```

## ワークフロー管理

### 1. Plan Modeをデフォルトにする
- 非自明なタスク（3ステップ以上・アーキテクチャ判断）は必ずPlan modeに入ること
- 問題が起きたら即STOP → 再計画。そのまま押し進めない
- 構築だけでなく検証ステップにもPlan modeを使う
- 曖昧さを減らすために詳細な仕様を先に書く

### 2. Subagent戦略
- メインのコンテキストウィンドウを綺麗に保つためSubagentを積極的に使う
- 調査・探索・並列分析はSubagentに任せる
- 複雑な問題はSubagentを増やして対処する
- Subagent1つにつきタスク1つで集中実行

### 3. 自己改善ループ
- ユーザーからの修正指摘があったら必ずtasks/lessons.mdに記録する
- 同じミスを繰り返さないためのルールを自分で書く
- ミス率が下がるまでlessonを徹底的に改善し続ける
- セッション開始時に関連プロジェクトのlessonをレビューする

### 4. 完了前の検証
- 動作確認なしにタスク完了とマークしない
- 必要に応じてmainと変更後の差分を確認する
- 「シニアエンジニアが承認するか？」と自問する
- テスト実行・ログ確認・正確性の証明を行う

### 5. エレガントさを求める（バランス重視）
- 非自明な変更では「もっとエレガントな方法はないか？」と立ち止まる
- ハック感のある修正なら「今知っていることを踏まえてエレガントに実装し直す」
- 単純・明白な修正ではやり過ぎない
- 提示前に自分の作業にダメ出しする

### 6. 自律バグ修正
- バグ報告を受けたら自分で修正する。手取り足取り聞かない
- ログ・エラー・失敗テストを指摘して解決する
- ユーザーのコンテキスト切り替えをゼロにする
- CIテストが落ちたら言われなくても修正しに行く

## タスク管理

1. **Plan First**: tasks/todo.mdにチェック可能な項目で計画を書く
2. **Verify Plan**: 実装開始前にチェックイン
3. **Track Progress**: 完了した項目を随時マークする
4. **Explain Changes**: 各ステップで変更の概要を説明する
5. **Document Results**: tasks/todo.mdにレビューセクションを追加する
6. **Capture Lessons**: 修正指摘後にtasks/lessons.mdを更新する

## コア原則

- **Simplicity First**: 変更は可能な限りシンプルに。影響するコードを最小限に
- **No Laziness**: 根本原因を見つける。一時しのぎ禁止。シニア開発者水準で
- **Minimal Impact**: 変更は必要な箇所だけ触る。バグを持ち込まない

## 添付ファイル置き場
- `docs/lists/`   — 設置希望リスト等のスキャン画像
- `docs/photos/`  — 現調写真
- `docs/images/`  — その他画像

## データ出力ルール
- CSV・JSON・HTMLなどのデータエクスポートは必ず `data/exports/` に出力すること
- ホームディレクトリやプロジェクトルートに直接出力しない
- ファイル名には日付を含める推奨: `YYYYMMDD_内容.csv`
- `data/exports/` は `.gitignore` 済み（.gitkeepのみ追跡）
- 一時インポート用HTMLも `data/exports/` に置く
