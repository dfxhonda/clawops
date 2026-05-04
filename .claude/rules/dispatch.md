# Dispatch体制

## 役割
- 司令塔Opus (チャット): 設計・検証・指示書作成・Notion文書化・Supabase監視
- Claude Code Sonnet (Cursor): 実装のみ
- ヒロさん: ダメ出し・業務適合性判断・承認

## 段階分離
- Spec Authoring (外出時、Notion完結のみ) → Spec Freeze (ADR) → Implementation (帰宅後 Cursor) → Review (Opus) → Cooldown
- 外出時は Implementation 一切禁止 (regression地獄回避)

## 2段階フロー強制
- 不確実な実装は「解析→検証→実装」の2段階
- 第1段階は Cursor で「読むだけ・報告のみ」
- 第2段階は Opus検証後に確定指示書

## 指示書テンプレ
- 【参照仕様書】(URL)
- 【参照CLAUDE.md】 ./CLAUDE.md
- 【スコープ】 触る範囲完全列挙
- 【変更禁止】 ど安定ver5点 / 特定ファイル
- 【完了基準】 build / lint / push / ntfy
- 【迷ったら】 仕様書再読 → TODOログ残して止まる、独自実装禁止
