# Supabase キーローテーション手順書

## 背景

2026年3月のプロジェクト開始時から、Supabase の `service_role` キーがフロントエンドコードに直書きされていた。
このキーは RLS をバイパスする権限を持ち、ブラウザの DevTools から誰でも読み取れる状態だった。

## 対応済み（Phase 1-A）

1. `src/lib/supabase.js` からハードコードされたキーを削除
2. 環境変数（`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`）に切り替え
3. `.env.example` を追加
4. `public/docs/` 内の 11 HTML ファイルから直書きキーを削除し、`config.js` 経由に変更

## まだ必要な対応

### 1. Supabase ダッシュボードで service_role キーを再発行

漏洩した service_role キーは無効化する必要がある。

手順:
1. https://supabase.com/dashboard/project/gedxzunoyzmvbqgwjalx/settings/api にアクセス
2. 「Project API keys」セクションを確認
3. service_role key の「Regenerate」をクリック
4. 新しいキーをコピーし、Supabase Edge Function の環境変数に反映（自動で反映される）
5. Vercel の環境変数を更新（後述）

注意: service_role キーを再発行すると、古いキーを使っている Edge Function や外部連携が即座に動かなくなる。
ClawOps では Edge Function（verify-pin）が service_role を使用しているが、Supabase の自動環境変数（SUPABASE_SERVICE_ROLE_KEY）経由なので再発行後も自動反映される。

### 2. Vercel 環境変数の更新

Vercel ダッシュボードで以下を設定:

```
VITE_SUPABASE_URL=https://gedxzunoyzmvbqgwjalx.supabase.co
VITE_SUPABASE_ANON_KEY=（anon キーの値）
```

手順:
1. Vercel ダッシュボード → Settings → Environment Variables
2. 上記2つを追加（Production / Preview / Development すべて）
3. 再デプロイを実行

### 3. public/docs/config.js の本番設定

デプロイ時に `public/docs/config.js` の値を設定する必要がある。
Vercel のビルドコマンドまたは CI で自動注入するのが望ましい。

### 4. git 履歴の対策

service_role キーは git 履歴に残っている。キーを再発行すれば古いキーは無効になるため、git 履歴のクリーンアップは必須ではないが、以下は推奨:

- `git filter-branch` や `git-filter-repo` で履歴から削除する場合、全員がリポジトリを再クローンする必要がある
- キー再発行で古いキーを無効化する方が現実的

## 確認項目

- [ ] Supabase ダッシュボードで service_role キーを再発行した
- [ ] Edge Function が新キーで動作することを確認した
- [ ] Vercel 環境変数を設定した
- [ ] 再デプロイ後にログインが動作することを確認した
- [ ] public/docs/config.js に本番値を設定した
- [ ] 古い service_role キーでのアクセスが拒否されることを確認した
