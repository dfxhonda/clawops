# 実装計画: 古い版を見続ける問題を仕組みで防ぐ

## 目的

コードを変えたのに古い画面を見続ける状態を減らす。
確認手順ではなく仕組みで防ぐ。

## 実装ステップ

- [x] Step 1: vite.config.js — ビルド時に dist/version.json を生成
- [x] Step 2: vercel.json — /version.json に no-cache ヘッダー追加 + catch-all rewrite 除外
- [x] Step 3: src/hooks/useVersionCheck.js — 10分ポーリング + visibilitychange フック
- [x] Step 4: src/components/UpdateBanner.jsx — 更新通知バナー
- [x] Step 5: src/App.jsx — AppInner に分離してバナー + ビルド情報を全ページに表示
- [x] Step 6: scripts/release.sh — デプロイ後の SHA 確認コマンドを表示に追加

## 検証

- ビルド: PASS
- テスト: 157/157 PASS
- dist/version.json: {"sha":"e94ec3c","buildNumber":"391","version":"1.0.0"}
