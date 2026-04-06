# Supabase Edge Function PIN認証 設計概要

## 目次

1. [実行サマリー](#実行サマリー)
2. [技術スタック](#技術スタック)
3. [セキュリティ向上](#セキュリティ向上)
4. [アーキテクチャ](#アーキテクチャ)
5. [リスク評価](#リスク評価)
6. [推奨される次のステップ](#推奨される次のステップ)

---

## 実行サマリー

### 現状の問題

ClawOpsアプリの現在のPIN認証実装には以下のセキュリティ上の欠陥があります：

1. **PIN平文送信**: Google Sheets APIを経由してPINを含む全スタッフデータをフロントエンドに送信
2. **クライアント側検証**: ブラウザ内でPINを比較（開発者ツールで検証ロジックを閲覧可能）
3. **ダミートークン**: 認証属性のない`sessionStorage`に保存したダミー値を使用
4. **アクセス制御なし**: Supabase RLSが設定されていない

### 提案ソリューション

**Supabase Edge Function + bcrypt + RLS** を組み合わせたサーバーサイド認証：

- PIN検証をEdge Functionで実施（ブラウザ側ではない）
- PIN をbcryptでハッシュ化して保存
- セッション管理を Supabase Auth の JWT に移行
- RLSポリシーでPINカラムをフロントエンドから隠蔽

**セキュリティスコア**: 21/100 → **82/100** に向上（推定）

---

## 技術スタック

### 既存
- **フロントエンド**: React + Vite + Tailwind CSS
- **認証**: Google OAuth + Google Sheets API
- **ホスティング**: Vercel
- **データベース**: Supabase PostgreSQL

### 追加
- **Edge Function**: Deno + TypeScript
- **PIN検証**: bcrypt（PostgreSQL の pgcrypto 拡張）
- **セッション管理**: Supabase Auth + JWT
- **RLS**: PostgreSQL Row Level Security

### 依存関係
```
supabase-js@2
@supabase/supabase-js (既にインストール済み)
```

---

## セキュリティ向上

### 改善点

| 項目 | 現状 | 改善後 |
|------|------|--------|
| **PIN送信** | フロント ←→ Sheets | フロント → Edge Function → DB |
| **PIN格納** | 平文 | bcrypt ハッシュ |
| **PIN検証** | JavaScript | サーバーサイド（bcrypt.compare） |
| **トークン** | ダミー値 | JWT（署名付き） |
| **データ保護** | 無し | RLS + VIEW で PIN隠蔽 |
| **レート制限** | 無し | PIN試行回数を制限可能 |
| **監査ログ** | 無し | auth_logs テーブルで記録 |

### OWASP Top 10 への対応

- **A01: Broken Access Control** → RLS で PIN カラムへのアクセス制限
- **A02: Cryptographic Failures** → bcrypt でPINをハッシュ化
- **A03: Injection** → パラメータ化クエリを使用
- **A07: Identification and Authentication Failures** → JWT 署名検証

---

## アーキテクチャ

### データフロー図

```
┌──────────────┐
│ Login.jsx    │
└──────┬───────┘
       │
       │ 1. Staff ID を入力
       ↓
┌──────────────────────────┐      ┌────────────────────┐
│ staff_public VIEW から   │      │ Supabase DB        │
│ 名前を取得（PIN除外）    │◄────►│ (RLS有効)          │
└──────┬───────────────────┘      └────────────────────┘
       │
       │ 2. PIN を入力 → POST
       ↓
┌──────────────────────────────────────────────────────┐
│ Edge Function: verify-pin                            │
│ - SERVICE_ROLE で staff テーブルアクセス             │
│ - bcrypt.compare(pin, staff.pin_hash)                │
│ - GoTrue API で user 作成/取得                       │
│ - JWT を生成・署名                                   │
└──────┬───────────────────────────────────────────────┘
       │
       │ 3. { access_token, user } を返す
       ↓
┌──────────────────────────────┐
│ supabase.auth.setSession()   │
│ - JWT を保存                 │
│ - 以降 API は自動付加        │
└──────────────────────────────┘
```

### ユーザーセッション管理

**現状**:
```javascript
// sessionStorage に ダミー値
sessionStorage.token = "dummy_token"
getToken() → "dummy_token" // 常に同じ値
```

**改善後**:
```javascript
// Supabase Auth に委譲
await supabase.auth.setSession({ access_token, refresh_token })
getToken() → supabase.auth.getSession()?.data?.session?.access_token
```

---

## リスク評価

### 技術的リスク

| リスク | 影響度 | 可能性 | 対策 |
|--------|--------|--------|------|
| Deno環境でbcrypt動作不可 | 高 | 中 | tweetnacl.js / argon2-wasm に変更 |
| createUser()がnot a function | 高 | 中 | GoTrue API 直接呼び出し（実装済み） |
| PIN移行中のダウンタイム | 中 | 低 | フェーズド移行、テスト環境先行 |
| RLS設定エラーでPIN漏洩 | 極高 | 低 | テスト環境で十分検証 |
| JWT署名検証失敗 | 高 | 低 | Edge Function ログで確認 |

### 対策

**bcrypt互換性の検証**:
```typescript
// テスト実装で Deno コンパチ確認
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
const verified = await compare(plainPin, hashedPin);
```

**GoTrue API フォールバック**:
```typescript
// Edge Function で直接ユーザー作成
const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({...})
});
```

**段階的移行計画**:
1. テスト環境で PIN ハッシュ化
2. 開発環境で Edge Function テスト
3. Vercel Preview で統合テスト
4. スタッフ数の少ない店舗（KIK01）でパイロット
5. 全店舗へロールアウト

---

## 推奨される次のステップ

### 週単位のロードマップ

#### Week 1: 準備・要件確認
- [ ] テスト環境でスキーマ変更をリハーサル
- [ ] PIN ハッシュ化戦略を最終決定（Option A: bcrypt 推奨）
- [ ] Rate limiting / Session TTL の仕様を確定
- [ ] Deno 環境で bcrypt の動作確認

#### Week 2: Backend 実装
- [ ] `database_setup.sql` を実行（テスト環境）
  - PIN ハッシュ化
  - staff_public VIEW 作成
  - RLS ポリシー設定
- [ ] `verify-pin` Edge Function 実装・テスト
- [ ] 本番 Supabase へのデプロイ

#### Week 2-3: Frontend 実装
- [ ] `Login.jsx` を2ステップ フローに修正
- [ ] `getToken()` を Supabase Auth 連携に変更
- [ ] `PrivateRoute` の `onAuthStateChange()` 統合
- [ ] ローカル環境でエンドツーエンド テスト

#### Week 3: 本番前テスト
- [ ] Vercel Preview で統合テスト
- [ ] Supabase ダッシュボードで動作確認
- [ ] スタッフ数名でパイロット テスト
- [ ] セキュリティ レビュー

#### Week 4: 本番デプロイ・最適化
- [ ] 本番環境へのデプロイ
- [ ] 本番後の監視・エラー対応
- [ ] ドキュメント作成・チーム教育
- [ ] Notion 開発ログ に記録

### 即座の行動項目

**優先度 1（必須）**:
1. `database_setup.sql` をテスト環境で実行して PIN ハッシュ化を検証
2. `verify-pin_implementation.ts` の bcrypt 動作確認
3. Supabase ROLE / 環境変数の最終確認

**優先度 2（推奨）**:
1. ローカル環境で Edge Function サーバーを起動
2. Login.jsx の2ステップUI をプロトタイプ化
3. Rate limiting / 監査ログのスキーマ確認

**優先度 3（最適化）**:
1. JWT 署名検証の手法を確定（RS256 / HS256）
2. セッション TTL を設定（推奨 24時間）
3. エラーメッセージの多言語対応（日本語）

---

## ドキュメントファイル一覧

| ファイル | 説明 | 対象者 |
|---------|------|--------|
| **PIN_AUTH_DESIGN.md** | 設計ドキュメント（詳細） | アーキテクト、バックエンド |
| **verify-pin_implementation.ts** | Edge Function の実装コード | バックエンド |
| **frontend_changes.md** | フロントエンド変更設計 | フロントエンド |
| **database_setup.sql** | DB スキーマ設定スクリプト | DBA、バックエンド |
| **IMPLEMENTATION_CHECKLIST.md** | 実装チェックリスト | 全チーム |
| **README.md** | このファイル | マネージャー、全チーム |

---

## 技術的な質問への回答

### Q1: Deno 環境でbcrypt は動作するか？

**A**: 不確実。推奨される3つの対策：
1. **tweetnacl.js / NaCl.js** をDeno環境で検証
2. **PostgreSQL の crypt() 関数** をRPC経由で呼び出し
3. **bcryptjs のDeno版** を JSR から import

実装コード例:
```typescript
// Option A: PostgreSQL crypt 関数
const verified = await supabase.rpc('verify_pin', {
  plain_pin: pin,
  stored_hash: staff.pin_hash,
});

// Option B: Direct comparison (開発時のみ)
const verified = plainPin === staff.pin_hash;
```

### Q2: JWT の署名はどこで行われるか？

**A**: Edge Function が JWT を生成します。Supabase は自動的に以下を行います：
- User ID を `sub` クレームに設定
- JWT にデジタル署名（HS256）
- `exp` クレームでセッション TTL を設定

クライアント側では署名を検証する必要はありません（Supabase ライブラリが自動処理）。

### Q3: PIN をリセットする場合は？

**A**: 以下の手順で実装：
1. Admin がスタッフの PIN をリセット（Supabase ダッシュボードまたは管理画面）
2. DB を直接更新: `UPDATE staff SET pin_hash = crypt(new_pin, gen_salt('bf')) WHERE staff_id = $1`
3. スタッフに仮PIN を通知し、次ログイン時に変更させる

### Q4: Rate limiting をどう実装するか？

**A**: Edge Function で実装：
```typescript
// 直近5分間の PIN試行を確認
const attempts = await supabase
  .from('pin_attempts')
  .select('*')
  .eq('staff_id', staffId)
  .gte('attempt_time', new Date(Date.now() - 5 * 60 * 1000));

if (attempts.data.length >= 3) {
  return new Response(
    JSON.stringify({ error: 'Too many attempts. Try again in 5 minutes.' }),
    { status: 429 } // Too Many Requests
  );
}
```

---

## セキュリティベストプラクティス

### デプロイ前チェックリスト

- [ ] PIN は bcrypt（salt round 10+）でハッシュ化
- [ ] Edge Function は HTTPS のみ（自動）
- [ ] CORS は ClawOps ドメインのみに制限
- [ ] RLS ポリシーは全テーブルで確認
- [ ] auth_logs に PIN試行を記録
- [ ] エラーメッセージに機密情報を含めない
- [ ] JWT の `exp` クレームを確認（デフォルト 1時間）
- [ ] 環境変数を `.env.local` にのみ保存（.gitignore に登録）

---

## サポート & 質問

設計に関する質問やフィードバックは、以下のドキュメントを参照してください：

1. **実装に関する質問** → `verify-pin_implementation.ts` のコメント参照
2. **フロント変更** → `frontend_changes.md` の「テストチェックリスト」参照
3. **デプロイ手順** → `IMPLEMENTATION_CHECKLIST.md` の「Phase 6」参照
4. **トラブルシューティング** → `IMPLEMENTATION_CHECKLIST.md` の「トラブルシューティング」参照

---

**設計完了日**: 2026-04-05  
**バージョン**: 1.0  
**ステータス**: レビュー待ち  
**次回更新**: 実装開始後
