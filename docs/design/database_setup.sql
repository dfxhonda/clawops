-- ============================================================================
-- Supabase Database Setup: PIN認証セキュリティ対応
-- ============================================================================
-- 実行前チェックリスト:
-- [ ] Supabase プロジェクトにアクセス可能か確認
-- [ ] バックアップを取得
-- [ ] テスト環境で先に実行
-- [ ] 既存データへの影響を確認
-- ============================================================================

-- ============================================================================
-- 1. PIN カラムのハッシュ化（Option A: 推奨）
-- ============================================================================
-- PostgreSQL の pgcrypto 拡張で bcrypt をサポート

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pin_hash カラムを追加
ALTER TABLE IF EXISTS public.staff ADD COLUMN pin_hash TEXT;

-- 既存の平文 PIN を bcrypt でハッシュ化
-- ※ 本運用前に必ずバックアップを取得
UPDATE public.staff
SET pin_hash = crypt(pin, gen_salt('bf', 10))
WHERE pin IS NOT NULL AND pin_hash IS NULL;

-- 古い pin カラムを削除（一度削除すると復元不可）
-- 確認後、コメントを外して実行
-- ALTER TABLE public.staff DROP COLUMN pin;

-- 実行状況の確認
-- SELECT staff_id, name, pin, pin_hash FROM staff LIMIT 5;

-- ============================================================================
-- 2. staff_public VIEW を作成（PIN カラムを隠蔽）
-- ============================================================================

DROP VIEW IF EXISTS public.staff_public CASCADE;

CREATE VIEW public.staff_public AS
SELECT
  staff_id,
  name,
  email,
  phone,
  role,
  operator_id,
  store_code,
  has_vehicle_stock,
  is_active,
  joined_at,
  notes,
  created_at,
  updated_at,
  updated_by
FROM public.staff
WHERE is_active = true;

-- VIEW に対して SELECT RLS を設定（誰でも読可能）
ALTER VIEW public.staff_public OWNER TO postgres;

-- ============================================================================
-- 3. RLS ポリシーの設定
-- ============================================================================

-- staff テーブルの RLS を有効化
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 既存の古いポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "staff_anon_read" ON public.staff;
DROP POLICY IF EXISTS "staff_authenticated_read" ON public.staff;

-- Policy 1: anon ユーザーは read 不可（Edge Function が SERVICE_ROLE で直接アクセス）
CREATE POLICY "staff_anon_read_denied" ON public.staff
  FOR SELECT
  USING (false);  -- 全員アクセス禁止

-- Policy 2: 認証済みユーザーは自分の情報のみ読取
-- （将来の拡張を想定）
CREATE POLICY "staff_authenticated_read_own" ON public.staff
  FOR SELECT
  USING (
    auth.uid() = (
      SELECT id FROM auth.users WHERE email = staff.email
    )
    OR
    -- admin/manager ロールは全スタッフを見られる
    (SELECT role FROM public.staff WHERE staff_id = auth.jwt() ->> 'staff_id') IN ('admin', 'manager')
  );

-- Policy 3: 認証済みユーザーは自分の情報のみ更新
CREATE POLICY "staff_authenticated_update_own" ON public.staff
  FOR UPDATE
  USING (
    auth.uid() = (
      SELECT id FROM auth.users WHERE email = staff.email
    )
    OR
    (SELECT role FROM public.staff WHERE staff_id = auth.jwt() ->> 'staff_id') IN ('admin', 'manager')
  );

-- ============================================================================
-- 4. staff_public VIEW の RLS（anon ユーザー向け）
-- ============================================================================

-- VIEW は直接 RLS を持たないため、基盤テーブルの RLS に依存
-- ただし、staff_public は安全なカラムのみを公開しているため、
-- anon ユーザーが read 可能にする場合は以下の設定を検討

-- NOTE: 現在の構成では、Edge Function が SERVICE_ROLE で直接 staff テーブルアクセス
-- anon ユーザーは staff_public VIEW から staff_id と name を取得するのに使用

-- ============================================================================
-- 5. PIN 検証用の PL/pgSQL 関数（オプション）
-- ============================================================================

-- Edge Function から呼び出すことで bcrypt 検証をサーバー側で実施
DROP FUNCTION IF EXISTS public.verify_pin(TEXT, TEXT);

CREATE FUNCTION public.verify_pin(
  p_staff_id TEXT,
  p_pin TEXT
)
RETURNS TABLE (
  verified BOOLEAN,
  staff_id TEXT,
  email TEXT,
  name TEXT,
  role TEXT,
  store_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.pin_hash = crypt(p_pin, s.pin_hash)) as verified,
    s.staff_id,
    s.email,
    s.name,
    s.role,
    s.store_code
  FROM public.staff s
  WHERE s.staff_id = p_staff_id
  AND s.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 関数の権限を設定
GRANT EXECUTE ON FUNCTION public.verify_pin(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- 6. 監査ログテーブル（セキュリティ強化用）
-- ============================================================================

-- PIN 認証の試行履歴を記録
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id BIGSERIAL PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES public.staff(staff_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('pin_attempt', 'pin_success', 'pin_failure', 'login', 'logout')),
  ip_address INET,
  user_agent TEXT,
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成（検索性能向上）
CREATE INDEX idx_auth_logs_staff_id ON public.auth_logs(staff_id);
CREATE INDEX idx_auth_logs_created_at ON public.auth_logs(created_at DESC);
CREATE INDEX idx_auth_logs_event_type ON public.auth_logs(event_type);

-- RLS: 認証済みユーザーは自分のログのみ閲覧可能
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_logs_read_own" ON public.auth_logs
  FOR SELECT
  USING (
    staff_id = auth.jwt() ->> 'staff_id'
    OR
    (SELECT role FROM public.staff WHERE staff_id = auth.jwt() ->> 'staff_id') IN ('admin', 'manager')
  );

-- ============================================================================
-- 7. Rate Limiting 用のテーブル（オプション）
-- ============================================================================

-- PIN 試行回数を追跡（DDoS 対策）
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id BIGSERIAL PRIMARY KEY,
  staff_id TEXT NOT NULL,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  ip_address INET
);

CREATE INDEX idx_pin_attempts_staff_id_time ON public.pin_attempts(staff_id, attempt_time DESC);

-- 古いレコードの自動削除（クリーンアップ）
-- NOTE: PostgreSQL の autovacuum で定期実行
-- または Edge Function で定期削除

-- ============================================================================
-- 8. テスト用データの挿入
-- ============================================================================

-- テスト環境でのみ実行
-- SELECT current_setting('app.environment', true) = 'test' OR current_database() = 'clawops_test'

-- テストスタッフ: S001 / PIN: 1234
-- ハッシュ値は事前に生成: crypt('1234', gen_salt('bf', 10))

-- INSERT INTO public.staff (
--   staff_id, name, email, phone, role, operator_id, store_code,
--   has_vehicle_stock, is_active, joined_at, pin_hash, created_at, updated_at, updated_by
-- ) VALUES (
--   'S001', 'Test Staff', 'test@example.com', '09000000000', 'operator', 'OP001', 'KIK01',
--   false, true, NOW(),
--   crypt('1234', gen_salt('bf', 10)),
--   NOW(), NOW(), 'system'
-- ) ON CONFLICT (staff_id) DO UPDATE SET pin_hash = crypt('1234', gen_salt('bf', 10));

-- ============================================================================
-- 9. 検証クエリ
-- ============================================================================

-- 1. PIN ハッシュが正しく保存されているか確認
-- SELECT staff_id, name, pin, pin_hash FROM public.staff LIMIT 5;

-- 2. PIN 検証関数のテスト
-- SELECT * FROM public.verify_pin('S001', '1234');

-- 3. VIEW のアクセステスト
-- SELECT * FROM public.staff_public LIMIT 5;

-- 4. RLS ポリシーの確認
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'staff';

-- 5. 認証ログの確認
-- SELECT * FROM public.auth_logs ORDER BY created_at DESC LIMIT 10;

-- ============================================================================
-- 10. Rollback スクリプト（何か問題が発生した場合）
-- ============================================================================

/*
-- PIN ハッシュ化を取り消す
UPDATE public.staff SET pin = SUBSTRING(pin_hash, 1, 6) WHERE pin IS NULL AND pin_hash IS NOT NULL;
ALTER TABLE public.staff DROP COLUMN pin_hash;

-- VIEW を削除
DROP VIEW IF EXISTS public.staff_public CASCADE;

-- RLS を無効化
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_anon_read_denied" ON public.staff;
DROP POLICY IF EXISTS "staff_authenticated_read_own" ON public.staff;
DROP POLICY IF EXISTS "staff_authenticated_update_own" ON public.staff;

-- 関数を削除
DROP FUNCTION IF EXISTS public.verify_pin(TEXT, TEXT);

-- 監査ログテーブルを削除
DROP TABLE IF EXISTS public.auth_logs;
DROP TABLE IF EXISTS public.pin_attempts;
*/

-- ============================================================================
-- 実行完了
-- ============================================================================
-- このスクリプトの実行後、以下を確認してください：
-- 1. エラーがないか確認
-- 2. 検証クエリで動作確認
-- 3. Edge Function のテスト
-- 4. ローカル環境での統合テスト
-- 5. プレビュー環境での本番前確認
