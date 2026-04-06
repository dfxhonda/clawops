# Supabase Edge Function PIN認証 設計ドキュメント

**日付**: 2026-04-05  
**ステータス**: 設計段階  
**対象**: ClawOps v1.0.0

## 1. 現状分析

### 1.1 現在の実装

```
Login.jsx
├── GET /staff（Google Sheets API）→ 全staff情報を取得
│   ├── name, email, phone, role, store_code, ... **pin（含む）**
│   └── sessionStorage.staff_list に保存
├── PIN入力フォーム
├── ブラウザ側で比較：input.pin === staff.pin
├── 成功時：sessionStorage.token = "dummy_token"
└── getToken()で毎回sessionStorageから取得
```

**セキュリティ上の問題**:
- PINが全フロントエンドに送信される
- ブラウザでPIN照合（誰でも検証可能）
- トークンがダミー値（認証属性なし）

### 1.2 Staff テーブル構造

```sql
staff (
  staff_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  operator_id TEXT,
  store_code TEXT,
  has_vehicle_stock BOOLEAN,
  is_active BOOLEAN,
  joined_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by TEXT,
  pin TEXT  -- ← 平文保存（要ハッシュ化）
)
```

---

## 2. 提案アーキテクチャ

### 2.1 認証フロー（改善後）

```
┌─────────────────────────────────────────────────────────────┐
│ Login.jsx                                                   │
│ 1. Staff IDを入力 → 名前を取得（pinなし）                    │
│ 2. PINコード入力                                             │
│ 3. [verify-pin] Edge Functionへ POST                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Edge Function: verify-pin                                   │
│ - staff_id, pin を受け取り                                   │
│ - DB（SERVICE_ROLE）で staff.pin と照合                     │
│ - bcrypt.compare() で検証                                   │
│ - 成功 → Supabase Auth に user を create/get                │
│ - JWT（access_token）を生成                                 │
│ - クライアントに返す                                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ クライアント                                                 │
│ - supabase.auth.setSession()でJWT保存                       │
│ - getToken() → supabase.auth.getSession()で取得             │
│ - 以降、全API呼び出しにJWTを自動付加                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 主要な変更点

| 項目 | 現状 | 新案 |
|------|------|------|
| **PIN送信** | フロント←→Sheets | フロント→Edge Fn（→DB） |
| **PIN照合** | JavaScript側 | Edge Function（bcrypt） |
| **トークン生成** | ダミー値 | Supabase Auth（JWT） |
| **データ保護** | — | RLS + VIEW で pin カラム隠蔽 |
| **セッション管理** | sessionStorage | supabase.auth.getSession() |

---

## 3. 詳細設計

### 3.1 Edge Function: verify-pin

**ファイル**: `supabase/functions/verify-pin/index.ts`

**要件**:
- HTTP POST `/verify-pin`
- リクエスト: `{ staff_id: string, pin: string }`
- レスポンス: `{ access_token: string, user: {...} }` または `{ error: string }`
- PINハッシュはbcryptで検証
- ユーザーが存在しない場合は自動作成（または既存を取得）

**実装方針**:
1. `SUPABASE_SERVICE_ROLE_KEY`でDBアクセス
2. `SELECT * FROM staff WHERE staff_id = $1` で取得
3. `bcrypt.compare(pin, staff.pin_hash)` で検証
4. 成功時：セッション情報をクライアントに返す
5. Edge Fnが自動的にJWTを生成・署名

**注意点**:
- `auth.admin.createUser()`がDeno環境で動作しない可能性
- 代替案：既存ユーザーを取得、なければ作成API呼び出し
- エラーハンドリング：401（PIN不一致）/ 404（ユーザーなし）/ 500（DB障害）

### 3.2 PIN ハッシュ化戦略

**現状**: `staff.pin` は平文保存  
**改善案**:

#### Option A: bcrypt化（推奨）
```sql
-- マイグレーション例
ALTER TABLE staff ADD COLUMN pin_hash TEXT;

-- 既存の平文PINをbcryptでハッシュ化
UPDATE staff SET pin_hash = crypt(pin, gen_salt('bf')) WHERE pin IS NOT NULL;

-- 古いカラムを削除
ALTER TABLE staff DROP COLUMN pin;
```

**メリット**:
- 標準的なハッシュ化手法
- bcrypt.compare()で検証可能
- DB侵害時もPIN推測困難

**デメリット**:
- 既存データの移行が必要
- bcryptはCPU-intensive（Edge Fn での遅延注意）

#### Option B: プレーンテキスト + RLS隠蔽（暫定）
```sql
-- 現状の pin カラムを RLS で隠蔽
CREATE VIEW staff_public AS
SELECT staff_id, name, email, phone, role, operator_id, store_code, 
       has_vehicle_stock, is_active, joined_at, notes, created_at, updated_at, updated_by
FROM staff;  -- pin カラムは含めない

-- Edge Function では元テーブルに直接アクセス（SERVICE_ROLE）
```

**メリット**:
- 即座に実装可能
- 既存データ変更不要

**デメリット**:
- DB侵害時にPINが公開
- ハッシュ化への移行が後必須

### 3.3 Supabase Auth との連携

**課題**: `auth.admin.createUser()`がDeno環境で動作しない可能性

**対策案**:

#### 案1: GoTrue Admin API 直接呼び出し
```typescript
const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: staff.email,
    password: generateRandomPassword(),
    user_metadata: { staff_id, role, store_code },
  }),
});
```

#### 案2: getUser()で既存確認 → signInWithPassword()
```typescript
// 既存ユーザーを email で検索
const existing = await supabase.auth.admin.getUserByEmail(staff.email);

if (!existing) {
  // 新規作成
  await createUserViaAPI();
}

// セッション生成
const session = await generateSession(staff_id);
return session;
```

**推奨**: 案1（GoTrue API直接）

### 3.4 RLS ポリシー

**staff テーブルの RLS 設定**:

```sql
-- anon（unauthenticated）
-- → pin カラムを隠蔽したVIEWのみアクセス可能

CREATE VIEW staff_public AS
SELECT staff_id, name, email, phone, role, operator_id, store_code, 
       has_vehicle_stock, is_active, joined_at, notes, created_at, updated_at, updated_by
FROM staff
WHERE is_active = true;  -- 有効なスタッフのみ

CREATE POLICY "public_read_staff_public" ON staff_public
  FOR SELECT
  USING (true);  -- 誰でも読可能

-- staff テーブル本体には RLS で制限
CREATE POLICY "authenticated_read_own_staff" ON staff
  FOR SELECT
  USING (
    auth.uid() = (SELECT id FROM auth.users WHERE email = staff.email)
    OR
    (SELECT role FROM staff WHERE staff_id = auth.jwt() ->> 'staff_id') IN ('admin', 'manager')
  );
```

---

## 4. フロントエンド実装設計

### 4.1 Login.jsx の変更

```jsx
// 現状
const staffList = await fetchStaffList(); // pin を含む全データ
const matched = staffList.find(s => s.staff_id === staffId && s.pin === pinInput);

// 新案
const staffList = await fetchStaffListPublic(); // pin を **除外**
const {access_token, user} = await verifyPin(staffId, pinInput); // Edge Fn呼び出し
await supabase.auth.setSession({access_token, refresh_token: null});
```

### 4.2 getToken() の改修

```javascript
// 現状
export function getToken() {
  return sessionStorage.getItem('token'); // "dummy_token"
}

// 新案
export function getToken() {
  const session = supabase.auth.getSession();
  return session?.data?.session?.access_token || null;
}

// 検証
if (!getToken()) {
  // リダイレクト to /login
}
```

### 4.3 API リクエストの自動付与

```javascript
// 既存（手動付加）
const headers = { Authorization: `Bearer ${getToken()}` };

// Supabase JS では自動付加
const { data } = await supabase
  .from('meter_readings')
  .select('*');
  // Authorization header は自動で付加される
```

### 4.4 sessionStorage の移行

```javascript
// 旧
sessionStorage.setItem('token', 'dummy_token');
sessionStorage.setItem('staff_list', JSON.stringify([...]));

// 新
// - token → supabase.auth.getSession()で管理
// - staff_list → 必要に応じてオンデマンド取得（キャッシュ別途）
```

---

## 5. セキュリティチェックリスト

- [ ] PINは平文で転送されない（HTTPS + TLS）
- [ ] PINはEdge Fnでのみ照合（サーバー側）
- [ ] PINハッシュはbcrypt以上（salt 10+ round）
- [ ] JWTは署名付き（RS256またはHS256）
- [ ] CORS設定：ClawOpsドメインのみ許可
- [ ] Rate limiting：PIN試行3回失敗で5分間ロック
- [ ] ログ記録：PIN認証失敗を監査ログに記録
- [ ] 環境変数：SUPABASE_SERVICE_ROLE_KEY は .env.local（未コミット）
- [ ] RLS ポリシー：全テーブルで authenticated 条件確認
- [ ] Session TTL：24時間（または設定値）

---

## 6. 段階的実装ロードマップ

### Phase 1: PIN ハッシュ化（Week 1）
- [ ] `pin_hash` カラムを staff テーブルに追加
- [ ] 既存PINをbcrypt化するマイグレーション
- [ ] staff_public VIEWを作成
- [ ] RLS設定（pin カラム隠蔽）

### Phase 2: Edge Function 実装（Week 2）
- [ ] verify-pin 関数の実装
- [ ] Deno 環境での bcrypt / GoTrue API 検証
- [ ] ローカルテスト（supabase functions serve）

### Phase 3: フロント修正（Week 2-3）
- [ ] Login.jsx: PIN→verify-pin 呼び出しに変更
- [ ] getToken() を supabase.auth.getSession() に修正
- [ ] sessionStorage 参照の削除

### Phase 4: テスト & デプロイ（Week 3）
- [ ] ローカル環境での統合テスト
- [ ] プレビュー環境での検証
- [ ] 本番デプロイ
- [ ] ロールバック計画の準備

---

## 7. リスク & 対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Deno環境でbcrypt動作不可 | 検証不可 | tweetnacl.js + argon2.js の代替検討 |
| createUser()がnot a function | デプロイ失敗 | GoTrue API 直接呼び出しに変更 |
| PIN移行中のダウンタイム | スタッフ入力不可 | フェーズド移行（一部スタッフ試験） |
| RLS設定エラー | PIN漏洩 | テスト環境で十分検証してから本番 |
| JWT署名検証失敗 | 認証NG | Edge Fn のテストログで確認 |

---

## 8. 参考リンク

- [Supabase Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Password Security Best Practices](https://supabase.com/docs/guides/auth/password-security)
- [Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Edge Function Architecture](https://supabase.com/docs/guides/functions/architecture)

---

## 承認・確認

| 項目 | 担当 | 完了 |
|------|------|------|
| 要件確認 | — | — |
| 技術検証 | — | — |
| 実装 | — | — |
| テスト | — | — |
| デプロイ | — | — |
