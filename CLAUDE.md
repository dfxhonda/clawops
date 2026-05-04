# CLAUDE.md — Round Zero

## 鉄則 (違反即停止)
1. 推測・憶測で動かない。ファイルを読んでから実装する
2. ど安定ver5点に触れる前にヒロさんに打診する
3. 既存資産(supabase/functions/, src/hooks/, src/shared/, api/)を確認してから実装する
4. tasks/lessons.md を変更前に必ず読む (先祖返り防止)
5. TODOコメントを残したままpushしない
6. 「スクリーンショットを貼ってください」等、ヒロさんへ作業を振らない
7. 選択肢を提示しない。完成品を作ってダメ出しをもらう
8. commit直後に必ずgit push。push後にのみ完了報告する

## ど安定ver5点 (要打診)
in/outメーター記録 / 集金根拠 / 景品在庫 / 認証処理 / スキーマ変更
詳細: .claude/rules/safe-ops.md

## Stack
React 19 + Vite 7 + Supabase + Vercel | 44店舗マルチテナント | iPhone Safari本番
ブランチ: main=本番 / dev=作業 | 迷ったらdev | preview分離禁止、main直push

## 応答スタイル
- 冒頭の「承知しました/素晴らしい/ご指摘ありがとうございます」禁止
- 末尾の「何かご不明な点は」禁止
- 「おそらく/〜と思われる」禁止 - 確認してから書く
- 反省・共感・気遣い前置き全削除、行動>言葉、結果>謝罪

## 実装フロー
非単純作業: tasks/todo.md分解 → 実装 → npm run build && npm run lint → push
完了確認: ビルド緑+lint緑 必須、main READY確認後にntfy通知

## 段階分離
外出時: Spec Authoring (Notion) のみ、Implementation禁止
帰宅後: Cursor + Sonnet で実装、Vitest+Playwright緑→push

## 詳細ルール (.claude/rules/)
safe-ops.md ど安定ver詳細 / observability.md 監査ログ / ocr.md OCR仕様
ui.md UIルール+iOS / auth.md 認証RLS / branch.md ブランチ運用
dispatch.md 司令塔Opus分担 / patrol.md 巡回業務

## 権限
admin / manager / patrol / staff → src/shared/auth/roles.js

## 通知
curl -d "完了内容" ntfy.sh/clawops-hiro-0328 (push後のみ)

## lessons
修正指摘が入ったら tasks/lessons.md を必ず更新する。書いて終わりではない、生きた文書
