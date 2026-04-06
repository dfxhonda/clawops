# フロントエンド実装変更設計

## 1. Login.jsx の変更案

### 1.1 現在の実装（問題あり）

```jsx
// 現在: src/pages/Login.jsx
import { useState } from 'react';
import { fetchStaffList, setToken } from '../services/sheets.js';

export default function Login() {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 問題1: 全staff情報を取得（PINを含む）
      const staffList = await fetchStaffList();
      const staff = staffList.find(s => s.staff_id === staffId);

      if (!staff) {
        setError('Staff not found');
        return;
      }

      // 問題2: ブラウザ側で直接比較
      if (staff.pin !== pin) {
        setError('Invalid PIN');
        return;
      }

      // 問題3: ダミートークンを保存
      setToken('dummy_token');
      window.location.href = '/';
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Staff ID"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        />
        <input
          type="password"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
```

### 1.2 改善後の実装

```jsx
// 新: src/pages/Login.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [staffName, setStaffName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: ID入力, Step 2: PIN入力

  // ============================================================
  // Step 1: Staff ID を入力 → 名前を取得（PIN除外）
  // ============================================================
  const handleGetStaffName = async () => {
    setError('');
    setLoading(true);

    try {
      // PINなしで staff 情報を取得
      // ※ RLS により pin カラムは自動除外
      const { data, error: fetchError } = await supabase
        .from('staff_public')
        .select('staff_id, name, email')
        .eq('staff_id', staffId)
        .single();

      if (fetchError) {
        setError('Staff not found');
        return;
      }

      setStaffName(data.name);
      setStep(2); // PIN入力画面へ
    } catch (err) {
      setError('Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Step 2: PIN を入力 → Edge Function で検証
  // ============================================================
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Edge Function を呼び出し
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            staff_id: staffId,
            pin: pin,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        setError(error.error || 'Authentication failed');
        return;
      }

      const { access_token, user } = await response.json();

      // Supabase のセッションを設定
      // ※ setSession() は access_token と session オブジェクトを受け取る
      await supabase.auth.setSession({
        access_token: access_token,
        refresh_token: null, // 後で実装可能
      });

      // ログイン成功後、ホームページへリダイレクト
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI: Step 1 (Staff ID 入力)
  // ============================================================
  if (step === 1) {
    return (
      <div className="login-page">
        <div className="login-container">
          <h1>ClawOps Login</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGetStaffName();
            }}
          >
            <input
              type="text"
              placeholder="Staff ID (e.g., S001)"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !staffId}>
              {loading ? 'Searching...' : 'Next'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  // ============================================================
  // UI: Step 2 (PIN 入力)
  // ============================================================
  return (
    <div className="login-page">
      <div className="login-container">
        <h1>ClawOps Login</h1>
        <p className="staff-info">Welcome, {staffName}</p>
        <form onSubmit={handleVerifyPin}>
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={loading}
            autoFocus
            inputMode="numeric"
          />
          <button type="submit" disabled={loading || !pin}>
            {loading ? 'Verifying...' : 'Login'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setPin('');
              setStaffName('');
              setError('');
            }}
            disabled={loading}
          >
            Back
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
```

---

## 2. sheets.js（サービス層）の変更

### 2.1 getToken() の改修

```javascript
// 現在: src/services/sheets.js
export function getToken() {
  return sessionStorage.getItem('token') || null;
}

// 新: Supabase の getSession() を使用
export async function getToken() {
  const { data, error } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}
```

### 2.2 API リクエストの改修

```javascript
// 現在: 手動で Authorization ヘッダーを付加
export async function fetchData(spreadsheetId, range) {
  const token = getToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.json();
}

// 新: Supabase クライアントで自動付加
export async function fetchStaffPublic() {
  const { data, error } = await supabase
    .from('staff_public')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data;
}

// ※ Google Sheets API の呼び出しが必要な場合は、
// Edge Function 経由に変更するか、
// Supabase DB に同期
```

### 2.3 キャッシュ管理

```javascript
// 現在
const cache = {
  staff_list: null,
  machines: null,
};

// 新: セッション単位ではなく、認証時点でクリア
export async function clearAuthCache() {
  cache.staff_list = null;
  // 他のキャッシュもリセット
}

export async function logout() {
  await supabase.auth.signOut();
  clearAuthCache();
  window.location.href = '/login';
}
```

---

## 3. App.jsx（ルーティング）の変更

### 3.1 PrivateRoute の改修

```jsx
// 現在: getToken() で dummy_token チェック
function PrivateRoute({ element }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return element;
}

// 新: Supabase Auth で確認
function PrivateRoute({ element }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return element;
}
```

---

## 4. 環境変数の設定

### 4.1 .env.local (開発環境)

```bash
# Google Sheets API (既存)
VITE_SHEET_ID=your-spreadsheet-id
VITE_GOOGLE_API_KEY=your-api-key

# Supabase (新規)
VITE_SUPABASE_URL=https://gedxzunoyzmvbqgwjalx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDgwNTgsImV4cCI6MjA4OTcyNDA1OH0.J2rH4L6zXStwdNikIUIzPRnyKTVPhy0J5lGtqN1QCHI
```

### 4.2 vercel.json (本番環境)

```json
{
  "env": {
    "VITE_SUPABASE_URL": "@vite_supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@vite_supabase_anon_key"
  }
}
```

---

## 5. lib/supabase.js (新規作成)

```javascript
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 6. 削除対象（レガシー）

- [ ] `src/services/sheets.js` の `fetchStaffList()` （PIN含む版）
- [ ] `setToken()` / `getToken()` のダミー実装
- [ ] `sessionStorage.token` の参照
- [ ] Google Sheets 認証フロー（Supabase DB に移行後）

---

## 7. テストチェックリスト

### ローカル環境
- [ ] `npm run dev` で起動
- [ ] Staff ID を入力して名前表示 ✓
- [ ] 正しい PIN を入力してログイン ✓
- [ ] 間違う PIN で 401 エラー ✓
- [ ] ログイン後、`supabase.auth.getSession()` でトークン確認 ✓
- [ ] sessionStorage に token がない（Supabase Auth に移行） ✓

### プレビュー環境（Vercel）
- [ ] Edge Function のデプロイ確認 ✓
- [ ] 本番 Supabase DB での検証 ✓
- [ ] CORS エラーなし ✓

### 本番環境
- [ ] 既存スタッフが全員ログイン可能 ✓
- [ ] PIN不一致時の失敗フロー ✓
- [ ] セッション TTL 管理 ✓

---

## 付録: Migration Path（既存システムからの移行）

### Phase 0: 並行運用（1-2週間）
```
ユーザー実装: 両方をサポート
┌─────────────┐        ┌─────────────┐
│ Google Sheets + ブラウザ PIN照合 │  → 既存
└─────────────┘        └─────────────┘
       ↓
┌─────────────┐        ┌──────────────────────┐
│ Supabase PIN + Edge Function 検証 │  → 新規
└─────────────┘        └──────────────────────┘
```

### Phase 1: 段階的切り替え
- 新規スタッフ → 新システムで登録
- 既存スタッフ → 互換モード（dual login）

### Phase 2: 完全移行
- Google Sheets API 廃止
- 旧トークン方式削除
- Supabase の staff テーブルに統一
