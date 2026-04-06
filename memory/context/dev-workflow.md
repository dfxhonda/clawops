# 開発ワークフロー

## コミット規約
- 日本語 + カテゴリプレフィックス
- `feat:` 新機能, `fix:` バグ修正, `refactor:` リファクタ, `ui:` UI変更
- Co-Authored-By: Claude Opus 4.6 を付ける

## ブランチ戦略
- main 直接プッシュ（小規模チーム）
- Vercel が main を自動デプロイ

## テスト
- `npm test` → vitest run (69テスト)
- `npm run test:watch` → vitest watch
- テストファイル: src/__tests__/*.test.js

## ビルド
- `npm run build` → vite build → dist/
- dist/ にパーミッション問題がある場合 → `--outDir /tmp/clawops-build`
- 151モジュール、941KB（code split 推奨）

## サンドボックス制約
- git index.lock が消せない → Desktop Commander で Mac 側から操作
- dist/ の EPERM → /tmp に出力して回避
- `gh` CLI はサンドボックスにない → Desktop Commander 経由

## 作業完了時
1. ビルド確認
2. テスト確認
3. zundamon.sh で音声通知
4. ntfy.sh でiPhone通知
5. 変更ファイル一覧出力

## lessons.md
- まだ空（今後ミス指摘時に記録する）
