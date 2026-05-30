---
name: plan-and-review
description: 実装計画を作成し、plan-reviewerエージェントで自動レビューしてから実装に進むスキル。非自明なタスクの着手時に使う。
user-invocable: true
argument-hint: "[タスクの説明]"
allowed-tools: Read, Glob, Grep, Bash, Agent, Edit, Write
---

# Plan and Review ワークフロー

タスク: $ARGUMENTS

## 手順

### Phase 1: 調査
1. Subagent(Explore)を使い、関連するコードと既存パターンを調査する
2. 影響範囲を特定する
3. 調査結果をまとめる

### Phase 2: 計画作成
1. Plan modeに入る
2. 調査結果を踏まえ、以下の構造で実装計画を作成する：

```markdown
## 実装計画: [タスク名]

### 目的
[何を・なぜ]

### 影響範囲
[変更するファイル一覧]

### 実装ステップ
- [ ] ステップ1: ...
- [ ] ステップ2: ...
- [ ] ステップ3: ...

### 検証方法
[どうやって正しさを確認するか]

### リスク・注意点
[既存機能への影響、エッジケースなど]
```

3. 計画を `tasks/todo.md` に書き出す

### Phase 3: レビュー
1. `plan-reviewer` エージェントを起動し、計画をレビューさせる
2. レビュー結果が **GO** → Phase 4へ
3. レビュー結果が **CONDITIONAL GO** → 指摘を反映して計画を更新し、再度Phase 3
4. レビュー結果が **STOP** → ユーザーに報告し、方針を相談する

### Phase 4: 実装
1. Plan modeを出る
2. 計画に沿って実装を進める
3. 各ステップ完了ごとに `tasks/todo.md` のチェックを更新する
4. 全ステップ完了後、動作確認を行う

### Phase 5: 完了
1. 変更の概要をユーザーに報告する
2. 完了通知を送る
