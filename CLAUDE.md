# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

ClawOps はクレーンゲーム運営向けの React アプリです。
主な機能:

- 売上・メーター入力
- 巡回入力
- 棚卸し・在庫移動
- 集金帳票
- 監査ログ
- 管理画面 / 日次集計

## Stack

- React 19
- React Router v7
- Vite 7
- Supabase
- Supabase Auth
- Vitest
- Testing Library
- happy-dom
- Vercel

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
- AuthProvider / useAuth を使う
- 独自のローカル認証ロジックを増やさない

### 4. 権限
- admin
- manager
- patrol
- staff

画面追加時は、どのロールに見せるかを決める。

### 5. 実装方針
- ページは組み立て中心にする
- 計算・判定は hook / service / lib に逃がす
- 大きい JSX は表示部品に分ける
- 既存の共通 UI パターンに寄せる
- 新規実装で古い互換層を増やさない

### 6. 監査ログ
重要更新は監査ログ対象にする。
使える所では reason_code / reason_note を使う。

### 7. テスト
- 純粋関数 → 単体テスト
- 主要画面 → component test
- 権限、保存、監査ログまわりは優先して確認

### 8. 通知
通知は「本当に完了した時」だけ送る。
未 push、未検証では送らない。

標準通知:

```bash
~/scripts/zundamon.sh "作業が完了しました"
curl -d "作業が完了しました" ntfy.sh/clawops-hiro-0328
```

### 9. lessons
修正指摘が入ったら tasks/lessons.md を更新する。

### 10. 危ない操作
慎重に扱うもの:
- push
- tag
- release
- 外部通知
- 削除
- 本番データ更新

### 11. デバッグ
- 視覚的な問題はスクリーンショットを共有する
- Playwright MCP でブラウザのコンソールログを直接確認できる
- 長時間かかるコマンドはバックグラウンドタスクとして実行する
- 詰まったら `/rewind` で脱線前に巻き戻す

### 12. コンテキスト管理
- コンテキストが 50% に達したら手動で `/compact` する
- 複雑・大規模なタスクは plan mode から始める
- 実装後に「これが動くことを証明して」と言うことで自己検証させられる

## Important

古い前提で作業しないこと。
この repo は現在:

- Supabase を使用
- テスト基盤あり
- AuthProvider / useAuth 前提
- 監査ログあり
- release / changelog 運用あり

「テストなし」「バックエンドなし」「Sheets 直操作中心」として扱わないこと。
