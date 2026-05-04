# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## ど安定ver 5点不可侵

以下の5点は「ど安定ver」として守る。触る前に司令塔（ヒロさん）に打診すること:

1. **メーター記録** — in/out 値の保存ロジック (`clawsupport/`)
2. **集金根拠** — 誰がいつ何を入/出/集金した記録
3. **景品在庫** — 補充・在庫数の記録 (`tanasupport/`)
4. **認証処理** — AuthProvider / useAuth / Supabase Auth / RLS
5. **スキーマ変更** — `stocktake_sessions`, `stocktake_items`, `staff`, `stores`, `prize_masters` など主要テーブル構造

---

## Project

Round Zero はクレーンゲーム運営向けの React アプリです。44店舗規模のゲームセンター運営を支えるモバイルファーストWebアプリ。

主な機能:

- クレサポ: 巡回入力・集金・補充記録
- タナサポ: 入荷チェック・棚卸し・発注追跡
- 管理運営: スタッフ管理・マスター管理・統計

## Stack

- React 19
- React Router v7
- Vite 7
- Tailwind CSS v4（ダークモード標準）
- Supabase（PostgreSQL + Auth + Edge Functions）
- Supabase Auth（JWT user_metadata.role）
- Vitest
- Testing Library
- happy-dom
- Vercel

## Effort

このプロジェクトでは常に `/effort high` で作業すること。

## Commands

```bash
npm run dev
npm run build
npm test
npm run test:watch
npm run release
```

## Rules

### 1. 実装前に考える
非単純作業は tasks/todo.md にチェック式で分解してから進める。

### 2. 完了前に必ず確認
完了報告の前に最低限これを実行する。

```bash
npm run build
npm test
```

必要なら差分確認、SHA指定で公開確認も行う。

### 3. 認証の基準
- Auth の基準は Supabase Auth
- AuthProvider / useAuth を使う (`useAuth()` → `{ staffId, staffName, staffRole }`)
- 独自のローカル認証ロジックを増やさない
- ロールは `session.user.user_metadata.role` から取得

### 4. 権限

| ロール | 説明 |
|--------|------|
| admin | 全機能（マスター編集・削除・承認） |
| manager | 棚卸し承認・発注管理・入荷確認 |
| patrol | 巡回入力・集金・補充記録 |
| staff | 棚卸し入力のみ |

画面追加時は `src/shared/auth/roles.js` の `MODULE_ACCESS` と `LAUNCHER_TILES` を更新する。

### 5. 実装方針
- ページは組み立て中心にする
- 計算・判定は hook / service / lib に逃がす
- 大きい JSX は表示部品に分ける
- 既存の共通 UI パターンに寄せる
- 新規実装で古い互換層を増やさない

### 6. DB変更ルール
以下はスキーマ変更・RLS変更前に司令塔打診が必要:
- `staff` テーブル（`staff.role` が JWT と紐付き）
- `staff_stores` テーブル（店舗権限）
- `stocktake_sessions` / `stocktake_items`（棚卸しフロー）
- `prize_masters` / `prize_stocks`（景品・在庫）
- `stores` テーブル

変更不要でも OK なもの: `store_code` FK 追加、新テーブル追加（既存テーブル非破壊）

### 7. F章 UIルール

すべての画面でこのルールに従う:

**テキストサイズ**
- 本文: `text-sm`（14px）
- 見出し: `text-xl font-bold`
- 補足: `text-xs text-muted`

**タッチターゲット**
- ボタン最小高さ: `h-12`（48px）
- カードタップ領域は `w-full` で取る

**日付表示**
- 短縮形: `M/D(曜)` 例: `5/2(金)`
- 時刻付き: `M/D(曜) HH:MM` 例: `5/2(金) 14:30`
- `toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })` を使う

**コンパクトヘッダー**
- `PageHeader` 共通コンポーネントを使う（`src/shared/ui/PageHeader.jsx`）
- props: `module` / `title` / `subtitle` / `onBack` / `backLabel` / `children`
- モジュール識別カラー: clawsupport=`#ec4899`, tanasupport=`#10b981`, manesupport=`#3b82f6`

**タブUI**
- フィルター・ステータス切替は `rounded-full` ピルボタンで並べる
- アクティブ: `bg-accent text-bg`
- 非アクティブ: `bg-surface text-muted border border-border`

**iOS対応**
- 数値入力: `type="tel" inputMode="numeric" style={{ fontSize: 16 }}`（ズーム防止）
- テキスト入力: `style={{ fontSize: 16 }}`
- ステッパーボタン: `h-10 w-10`（44px相当）

**CSSトークン**（`index.css @theme` で定義）
- 背景: `bg-bg` / カード: `bg-surface` / ボーダー: `border-border`
- 文字: `text-text` / 薄字: `text-muted` / アクセント: `text-accent`

### 8. J章 モジュール独立設計（Feature Flag）

モジュールは独立して追加・無効化できるようにする:

- 新機能は `src/shared/auth/roles.js` の `MODULE_ACCESS` でロール制限
- ランチャーへの表示は `LAUNCHER_TILES` の `requiredModules` で制御
- モジュール間でコンポーネントを直接 import しない（shared/ 経由）
- 機能削除時は routes + LAUNCHER_TILES + MODULE_ACCESS をセットで消す

### 9. 監査ログ
重要更新は監査ログ対象にする。
使える所では reason_code / reason_note を使う。

### 10. 観察可能性 (Observability-First)

新機能・実装中機能は必ず追跡可能にする。

**DB 監査列** (機能ごとに `*_attempted_at`, `*_raw_text`, `*_confidence`, `input_method` を追加):
- 例: OCR → `ocr_attempted_at`, `ocr_raw_text`, `ocr_confidence`, `input_method`
- `input_method` の値: `'manual'` / `'ocr'` / `'ocr_corrected'` / `'ocr_failed'`

**Sentry ログ** (`機能名.ステップ名` 形式):
- 各ステップ開始・成功: `Sentry.captureMessage('ocr.file_received', { level: 'info', extra: {...} })`
- 失敗・例外: `Sentry.captureException(err, { tags: { ocr_step: 'api_call' } })`
- `console.warn` だけでなく必ず Sentry にも上げる

**UI ステータス表示** (デバッグ用、本番でも表示):
- 処理中の各フェーズを UI に `text-[10px]` で表示
- ヒロさんが現場で「今何が起きてるか」を視認できる状態にする

安定後にログ削減判断。最初は全段記録が原則。

### 11. テスト
- 純粋関数 → 単体テスト
- 主要画面 → component test
- 権限、保存、監査ログまわりは優先して確認

### 11. 通知
通知は「本当に完了した時」だけ送る。
未 push、未検証では送らない。

標準通知:

```bash
~/scripts/zundamon.sh "作業が完了しました"
curl -d "作業が完了しました" ntfy.sh/clawops-hiro-0328
```

### 12. lessons
修正指摘が入ったら tasks/lessons.md を更新する。

### 13. 危ない操作
慎重に扱うもの:
- push
- tag
- release
- 外部通知
- 削除
- 本番データ更新

### 14. デバッグ
- 視覚的な問題はスクリーンショットを共有する
- Playwright MCP でブラウザのコンソールログを直接確認できる
- 長時間かかるコマンドはバックグラウンドタスクとして実行する
- 詰まったら `/rewind` で脱線前に巻き戻す

### 15. コンテキスト管理
- コンテキストが 50% に達したら手動で `/compact` する
- 複雑・大規模なタスクは plan mode から始める
- 実装後に「これが動くことを証明して」と言うことで自己検証させられる

### 16. Dispatch体制

| 担当 | 役割 |
|------|------|
| ヒロさん | 司令塔・現場確認・要件定義 |
| Claude Code | 実装・テスト・push |
| チャットClaude | 調査・設計相談・コードレビュー |

「ど安定ver5点」への変更は必ずヒロさんが司令塔として判断する。Claude Code 単独では進めない。

## Important

古い前提で作業しないこと。
この repo は現在:

- Supabase を使用
- テスト基盤あり
- AuthProvider / useAuth 前提（JWT user_metadata.role）
- 監査ログあり
- release / changelog 運用あり

「テストなし」「バックエンドなし」「Sheets 直操作中心」として扱わないこと。
「ClawOps」「stocktake_lines」「43台」「170台」等の旧称は使わないこと。

## ブランチ運用ルール (2026-05 以降)

### 原則
- **main** = 本番、ど安定ver保証ライン
- **dev** = 作業ブランチ、Claude Code はここに push

### どちらにpushするかの判断
**dev にする**: 以下のいずれかに関わる変更
- in/out メーター記録
- 設定値記録
- 景品在庫記録
- 補充数記録
- 集金根拠 (誰がいつ何を入/出/集金)
- 上記に間接的に効くテーブルスキーマ / RLS / 認証処理
- 新規画面/大規模リファクタ

**main 直 OK**: 以下のみ
- タイポ修正
- README/CLAUDE.md/コメント修正
- ど安定ver5点に一切関わらない表示調整 (例: ヘルプ画面、設定メニュー)
- Sentry/ログ関連の調整

### 迷ったら dev
「これ main 直でもいいかな」と思った時点で dev にする。コストは Preview URL が一つ出るだけ、デメリットはゼロ。

### dev → main マージ手順
```
git checkout main && git pull
git merge dev
git push
```
(リベース/squash不要、ちゃんと動いてる dev の状態をそのまま main に込む)

### Preview URL
- main: https://round-0.com ・ https://clawops-tau.vercel.app
- dev: Vercelが pushごとに生成、Vercelダッシュボード → clawops → Deployments タブで確認

### ロールバック
コードや git操作不要。Vercel ダッシュボード → Deployments → 前のデプロイの三点メニュー → Promote to Production で1クリック。
