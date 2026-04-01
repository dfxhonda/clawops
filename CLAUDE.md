# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawOps (クレーンゲーム運営管理システム) is a mobile-first React SPA for managing crane game (claw machine) arcade operations. Operators use it to record meter readings, track prize inventory, and view performance rankings across stores and machines.

## Commands

- `npm run dev` - Start Vite dev server
- `npm run build` - Production build (output to `dist/`)
- `npm run preview` - Preview production build locally
- No test framework is configured.

## Architecture

**Frontend:** React 19 + React Router v7 + Vite 7. All source is JSX (not TypeScript). No state management library; state is local `useState` with an in-memory cache in `sheets.js`.

**Backend:** There is no backend server. The app reads/writes directly to a Google Spreadsheet via the Sheets API v4, authenticated with Google OAuth2 implicit flow (access token stored in `sessionStorage`).

**Data layer (`src/services/sheets.js`):**
- All data operations go through this single file
- Wraps `fetch()` calls to `sheets.googleapis.com` with Bearer token auth
- Spreadsheet has these sheets: `stores`, `machines`, `booths`, `meter_readings`
- In-memory `cache` object avoids redundant API calls per session; `clearCache()` invalidates after writes
- Column mapping in `meter_readings` is resolved dynamically from header row; other sheets use hardcoded column indices

**Routing (`src/App.jsx`):**
- All routes except `/login` are wrapped in `PrivateRoute` (redirects to login if no token)
- Flow: Login -> StoreSelect (`/`) -> MachineList (`/machines/:storeId`) -> BoothInput (`/booth/:machineId`) -> DraftList (`/drafts`) -> Complete (`/complete`)
- Additional routes: `/ranking/:storeId`, `/datasearch`, `/edit/:boothId`

**Draft system:** `BoothInput` saves readings to `sessionStorage` as drafts before final submission. `DraftList` reviews and submits all drafts to the spreadsheet.

**Styling:** Single `src/index.css` with CSS custom properties. Dark mode is the default theme (dark backgrounds defined in `:root`). Many components use inline styles.

## Deployment

Hosted on Vercel. `vercel.json` rewrites all routes to `index.html` for SPA routing.

## Language

UI text is in Japanese. Commit messages use Japanese with a category prefix (e.g., `ui:`, `feat:`, `fix:`).

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
