---
name: team-impl
description: 複数のSubagentを並列起動して実装を分担させるスキル。独立した複数ファイルの変更や、調査と実装の並列化に使う。
user-invocable: true
argument-hint: "[タスクの説明]"
allowed-tools: Read, Glob, Grep, Bash, Agent, Edit, Write
---

# Team Implementation ワークフロー

タスク: $ARGUMENTS

## 原則
- Subagent 1つにつきタスク1つ。明確なスコープで集中実行
- 独立した変更は並列で、依存関係がある変更は順番に
- メインコンテキストはオーケストレーションに専念し、実装はSubagentに任せる

## 手順

### Step 1: タスク分解
タスクを独立した作業単位に分解する。各単位は：
- 変更するファイルが明確
- 他の作業単位と競合しない
- 単独で検証可能

### Step 2: 並列実装
各作業単位に対してSubagentを起動する。Subagentへの指示には以下を含める：
- **目的**: 何をするか
- **対象ファイル**: どのファイルを変更するか
- **制約**: CLAUDE.mdのコア原則（シンプルさ、最小影響、根本対応）
- **完了条件**: 何をもって完了とするか

```
Agent(general-purpose): "作業単位1の実装"
Agent(general-purpose): "作業単位2の実装"  ← 並列起動
Agent(general-purpose): "作業単位3の実装"  ← 並列起動
```

### Step 3: 統合確認
全Subagentの完了後：
1. 各Subagentの結果を確認する
2. 変更間に矛盾がないか検証する
3. `npm run build` でビルドが通ることを確認する
4. 必要に応じて微調整を行う

### Step 4: 報告
- 各作業単位の変更内容を簡潔にまとめる
- 完了通知を送る
