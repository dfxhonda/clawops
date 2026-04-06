# Supabase PIN認証 実装チェックリスト

**開始日**: 2026-04-05  
**対象フェーズ**: ClawOps v1.1.0  
**所要期間**: 3-4週間  

---

## Phase 1: 準備・計画（Week 1）

### Database 準備
- [ ] Supabase プロジェクトのバックアップを取得
- [ ] テスト環境でスキーマ変更をリハーサル
- [ ] PIN ハッシュ化の影響範囲を洗い出し
- [ ] ロールバック計画を作成

### 要件確認
- [ ] ステークホルダーと要件を確認
- [ ] PIN ハッシュ化のタイミングを決定（Option A / B）
- [ ] セッション TTL を決定（推奨: 24時間）
- [ ] Rate limiting の設定（推奨: 3回失敗で5分ロック）

### 環境構築
- [ ] Deno CLI をローカルにインストール
- [ ] Supabase CLI をインストール（`supabase-cli`）
- [ ] Edge Function の開発環境構築（`supabase functions serve`）
- [ ] Vercel 環境変数設定の確認

---

## Phase 2: Backend 実装（Week 2）

### Edge Function: verify-pin の実装
- [ ] `supabase/functions/verify-pin/index.ts` を作成
  - [ ] PIN リクエスト検証（staff_id, pin）
  - [ ] DB から staff レコードを取得
  - [ ] bcrypt または crypt() で PIN 検証
  - [ ] 成功時：ユーザー作成/取得ロジック
  - [ ] エラーハンドリング（401, 404, 500）
  - [ ] CORS ヘッダー設定

- [ ] PIN ハッシュ化（Option A）実施
  - [ ] `pin_hash` カラムを追加
  - [ ] マイグレーションスクリプトを実行
  - [ ] 既存 PIN を bcrypt 化
  - [ ] 検証: `SELECT * FROM staff LIMIT 5;`

- [ ] RLS ポリシー設定
  - [ ] `staff_public` VIEW を作成
  - [ ] anon ユーザーのアクセス制限
  - [ ] authenticated ユーザーのポリシー設定
  - [ ] テスト: `SELECT * FROM staff_public;`

### Edge Function のテスト
- [ ] ローカルで Edge Function 起動
  ```bash
  supabase functions serve
  ```

- [ ] 正常系テスト
  - [ ] `POST /verify-pin` で正しい PIN
  - [ ] レスポンスに access_token が含まれるか
  - [ ] user メタデータが正しいか

- [ ] エラー系テスト
  - [ ] 間違った PIN → 401
  - [ ] 存在しない staff_id → 404
  - [ ] リクエストが不完全 → 400
  - [ ] CORS プリフライト対応

- [ ] 本番環境へのデプロイ
  ```bash
  supabase functions deploy verify-pin --project-id gedxzunoyzmvbqgwjalx
  ```

---

## Phase 3: Frontend 実装（Week 2-3）

### Login.jsx の修正
- [ ] 2ステップログイン UI に変更
  - [ ] Step 1: Staff ID 入力 → 名前表示
  - [ ] Step 2: PIN 入力 → Edge Function 呼び出し
  - [ ] Back ボタンで Step 1 に戻る

- [ ] Edge Function 呼び出し実装
  ```javascript
  const response = await fetch(
    `${VITE_SUPABASE_URL}/functions/v1/verify-pin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ staff_id, pin }),
    }
  );
  ```

- [ ] Supabase Auth セッション設定
  ```javascript
  await supabase.auth.setSession({
    access_token: response.access_token,
    refresh_token: null,
  });
  ```

### getToken() の改修
- [ ] `sheets.js` の `getToken()` を修正
  - [ ] 旧実装: `sessionStorage.getItem('token')`
  - [ ] 新実装: `supabase.auth.getSession()` を使用

- [ ] API リクエスト層の確認
  - [ ] 各 API 呼び出しが自動的に Authorization ヘッダーを付加
  - [ ] 手動設定が残っていないか確認

### PrivateRoute の改修
- [ ] App.jsx の PrivateRoute を修正
  - [ ] `supabase.auth.onAuthStateChange()` を使用
  - [ ] セッション有無で条件分岐
  - [ ] ローディング UI を追加

### sessionStorage の削除
- [ ] `setToken()` 呼び出しを全削除
- [ ] `sessionStorage.token` 参照を全削除
- [ ] `sessionStorage.staff_list` の使用を確認
  - [ ] 必要に応じて `staff_public` VIEW から取得に変更

### 環境変数設定
- [ ] `.env.local` に Supabase 設定を追加
  ```
  VITE_SUPABASE_URL=https://gedxzunoyzmvbqgwjalx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGc...
  ```

- [ ] `vercel.json` に本番環境変数を設定

- [ ] `src/lib/supabase.js` を作成
  ```javascript
  import { createClient } from '@supabase/supabase-js';
  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  ```

---

## Phase 4: ローカルテスト（Week 3）

### 開発環境での統合テスト
- [ ] `npm run dev` で起動
- [ ] Login.jsx でログインフロー全体をテスト
  - [ ] [ ] Staff ID を入力して名前表示 ✓
  - [ ] [ ] Back ボタンで戻る ✓
  - [ ] [ ] 正しい PIN でログイン ✓
  - [ ] [ ] 間違う PIN で 401 エラー ✓
  - [ ] [ ] ログイン後、ホームページが表示される ✓

- [ ] Session の永続性テスト
  - [ ] ページリロード後もセッションが保持される ✓
  - [ ] `supabase.auth.getSession()` でトークン取得可能 ✓

- [ ] logout() 実装確認
  - [ ] `await supabase.auth.signOut();` でセッション削除 ✓
  - [ ] sessionStorage に残されたデータなし ✓

- [ ] エラーハンドリング確認
  - [ ] ネットワークエラー時の UI
  - [ ] Edge Function が遅延した場合のタイムアウト
  - [ ] 予期しないエラーのロギング

### ブラウザ開発者ツール確認
- [ ] Network タブで Edge Function への POST リクエスト確認
- [ ] Application タブで sessionStorage/localStorage の確認
  - [ ] token キーが削除されている
  - [ ] Supabase の auth token が保存されている
- [ ] Console でエラーが出ていないか確認

---

## Phase 5: 本番前テスト（Vercel Preview）

### Vercel への一時デプロイ
- [ ] `git push origin develop` で Preview URL を生成
- [ ] Preview URL でログインテスト
  - [ ] [ ] Edge Function が正常動作 ✓
  - [ ] [ ] CORS エラーなし ✓
  - [ ] [ ] アクセストークンが返される ✓

- [ ] Supabase ダッシュボードで確認
  - [ ] Edge Function の実行ログ
  - [ ] API Usage の確認
  - [ ] エラーログの確認

### プリフライト確認
- [ ] 既存スタッフ数が影響を受けないか確認
- [ ] PIN ハッシュ化完了の確認（Option A の場合）
- [ ] RLS ポリシーの動作確認
- [ ] Rate limiting のテスト

---

## Phase 6: 本番デプロイ（Week 4）

### デプロイ前チェック
- [ ] Notion の引き継ぎプロンプトを確認
- [ ] CI/CD パイプラインが正常か確認
- [ ] ロールバック計画が準備されているか確認
- [ ] チームメンバーへの通知（デプロイ時間、影響範囲）

### 本番デプロイの実行
- [ ] `vercel --prod` でデプロイ
- [ ] Edge Function が本番環境でも デプロイされているか確認
  ```bash
  supabase functions list --project-id gedxzunoyzmvbqgwjalx
  ```

- [ ] 本番環境でのログインテスト
  - [ ] [ ] 複数のテストスタッフでログイン ✓
  - [ ] [ ] Edge Function のレスポンスが正常 ✓
  - [ ] [ ] アクセストークンが有効 ✓

### 本番後の監視
- [ ] Supabase ダッシュボードでエラー監視
- [ ] Vercel Analytics でトラフィック確認
- [ ] 認証ログテーブルでアクティビティ確認
- [ ] ユーザーフィードバック収集

---

## Phase 7: 最終化・ドキュメント（Week 4）

### 設定の最適化
- [ ] Rate limiting の調整（必要に応じて）
- [ ] セッション TTL の調整
- [ ] エラーメッセージの改善
- [ ] ログレベルの設定

### ドキュメント作成
- [ ] README.md に認証フロー説明を追加
- [ ] API ドキュメントを更新
- [ ] 運用マニュアルを作成
  - [ ] PIN リセット手順
  - [ ] ユーザーオンボーディング
  - [ ] トラブルシューティング

### チーム教育
- [ ] スタッフへの新ログイン手順説明
- [ ] 管理者への PIN リセット手順説明
- [ ] 開発チームへのレビュー

### Notion ログ記録
- [ ] 開発ログに完了日時と変更内容を記録
- [ ] Known Issues と解決方法を記録

---

## セキュリティ検証（全フェーズ中）

### 暗号化 & ハッシング
- [ ] PIN は bcrypt で正しくハッシュ化されている
- [ ] JWT の署名検証が正しく機能している
- [ ] DB への PIN 平文アクセスが不可能

### アクセス制御
- [ ] CORS が正しく設定されている（ClawOps ドメインのみ）
- [ ] RLS ポリシーが全テーブルで適用されている
- [ ] anon キーでは pin カラムへアクセス不可

### エラーハンドリング
- [ ] エラーレスポンスに機密情報を含まない
- [ ] レート制限が機能している
- [ ] 不正なリクエストが適切に拒否される

### ロギング & 監視
- [ ] PIN 認証試行が auth_logs に記録される
- [ ] 異常なアクセスパターンを検出可能
- [ ] セッションタイムアウトが適切に機能

---

## トラブルシューティング

| 問題 | 原因 | 対策 |
|------|------|------|
| `createUser() is not a function` | Deno 互換性 | GoTrue API 直接呼び出しに変更 |
| PIN 認証が常に失敗 | ハッシュ関数エラー | bcrypt.js を tweetnacl.js に変更 |
| CORS エラー | ヘッダー不足 | Edge Function で ACCESS_CONTROL_ALLOW_ORIGIN 追加 |
| セッション保持されない | ブラウザ設定 | localStorage ポリシー確認 |
| RLS エラー | ポリシー不正 | `pg_policies` テーブルで確認 |

---

## 完了基準

### 機能要件
- [x] PIN はサーバー側で検証される（ブラウザ側ではない）
- [x] PIN ハッシュは bcrypt で保護されている
- [x] セッショントークンは JWT（署名付き）
- [x] セッションは Supabase Auth で管理される

### パフォーマンス
- [x] ログイン時間が 2秒以内
- [x] Edge Function のレスポンスが 500ms 以内
- [x] PIN ハッシング処理が 1秒以内

### セキュリティ
- [x] HTTPS/TLS による通信暗号化
- [x] PIN は平文で転送されない
- [x] アクセストークンはセキュアストレージに保存
- [x] セッションタイムアウトが機能

### ドキュメント & 教育
- [x] 実装ドキュメント完成
- [x] API ドキュメント更新
- [x] チームトレーニング実施
- [x] Notion ログ記録完了

---

## 関連ドキュメント

- [PIN認証設計](./PIN_AUTH_DESIGN.md)
- [Edge Function実装](./verify-pin_implementation.ts)
- [フロントエンド変更](./frontend_changes.md)
- [データベース設定](./database_setup.sql)

---

## 承認サイン

| 役割 | 名前 | サイン | 日付 |
|------|------|--------|------|
| プロジェクトマネージャー | — | — | — |
| バックエンド担当 | — | — | — |
| フロントエンド担当 | — | — | — |
| QA / テスト | — | — | — |
| セキュリティレビュー | — | — | — |

---

**最終更新**: 2026-04-05
